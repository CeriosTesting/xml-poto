import fs from "node:fs";
import path from "node:path";

import { XmlDecoratorParser } from "@cerios/xml-poto";

import type {
	XsdAll,
	XsdAny,
	XsdAttribute,
	XsdAttributeGroup,
	XsdAttributeGroupRef,
	XsdChoice,
	XsdComplexContent,
	XsdComplexContentExtension,
	XsdComplexContentRestriction,
	XsdComplexType,
	XsdElement,
	XsdGroup,
	XsdGroupRef,
	XsdIdentityConstraint,
	XsdImport,
	XsdInclude,
	XsdRedefine,
	XsdRestriction,
	XsdSchema,
	XsdSequence,
	XsdSimpleContent,
	XsdSimpleContentExtension,
	XsdSimpleContentRestriction,
	XsdSimpleType,
} from "./xsd-types";

// XSD namespace URIs
const XSD_NS = "http://www.w3.org/2001/XMLSchema";

/**
 * Parses XSD files into a structured XsdSchema model using @cerios/xml-poto's XML parser.
 */
export class XsdParser {
	private parser = new XmlDecoratorParser({
		trimValues: false,
		parseTagValue: false,
	});

	/** Detected XSD prefix in the current schema (e.g. 'xs', 'xsd', or '') */
	private xsdPrefix = "xs";

	/**
	 * Parse an XSD file at the given path, resolving includes/imports relative to it.
	 */
	parseFile(xsdPath: string): XsdSchema {
		const absolutePath = path.resolve(xsdPath);
		const content = fs.readFileSync(absolutePath, "utf-8");
		return this.parseString(content, path.dirname(absolutePath));
	}

	/**
	 * Parse an XSD or WSDL string into a structured schema model.
	 * WSDL documents are detected by their `<definitions>` root; all XSD schemas
	 * embedded in the WSDL `<types>` section are extracted and merged.
	 */
	parseString(xsdContent: string, baseDir?: string): XsdSchema {
		// Strip the optional XML declaration and any XML comments, then check
		// that the root element is a schema or WSDL definitions element (any
		// namespace prefix is accepted). This is done before handing off to the
		// XML parser so invalid input produces a clear, actionable error instead
		// of a cryptic tag-mismatch.
		const normalized = xsdContent
			.replace(/<\?xml[^?]*\?>/i, "") // optional XML declaration
			.replace(/<!--[\s\S]*?-->/g, "") // XML comments before root
			.trim();

		const isSchemaRoot = /^<(?:[a-zA-Z_][\w.-]*:)?schema[\s/>]/i.test(normalized);
		const isWsdlRoot = /^<(?:[a-zA-Z_][\w.-]*:)?definitions[\s/>]/i.test(normalized);
		if (!isSchemaRoot && !isWsdlRoot) {
			throw new Error(
				"The provided content does not appear to be a valid XSD schema or WSDL document. " +
					"Expected a root <xs:schema>, <xsd:schema>, or <schema> element (XSD), " +
					"or a <definitions> element (WSDL).",
			);
		}

		const parsed = this.parser.parse(normalized);
		const rootKey = this.findSchemaRootKey(parsed);
		if (!rootKey) {
			const definitionsKey = this.findDefinitionsRootKey(parsed);
			if (definitionsKey) {
				return this.parseWsdlDefinitions(parsed[definitionsKey] as Record<string, unknown>, baseDir);
			}
			throw new Error(
				"No XSD schema root element found. Expected <xs:schema>, <xsd:schema>, or <schema> (XSD), " +
					"or <definitions> (WSDL).",
			);
		}

		const schemaObj = parsed[rootKey];
		this.detectXsdPrefix(schemaObj);

		const schema = this.parseSchema(schemaObj);

		if (baseDir) {
			this.resolveExternalSchemas(schema, baseDir);
		}

		return schema;
	}

	/**
	 * Extract and merge all XSD schemas embedded in a WSDL `<types>` section.
	 * Namespace declarations on the WSDL `<definitions>` root are inherited by
	 * each embedded schema (schema-local declarations win), because WSDL files
	 * commonly declare `xmlns:xsd`/`xmlns:tns` on the root only.
	 */
	private parseWsdlDefinitions(defObj: Record<string, unknown>, baseDir?: string): XsdSchema {
		const schemaObjs = this.collectWsdlSchemaObjects(defObj);

		if (schemaObjs.length === 0) {
			throw new Error(
				"The WSDL document contains no XSD schemas. Expected at least one <schema> element " +
					"inside the WSDL <types> section.",
			);
		}

		// Inherit xmlns declarations from <definitions> onto each embedded schema.
		for (const schemaObj of schemaObjs) {
			this.inheritNamespaceDeclarations(defObj, schemaObj);
		}

		// The XSD prefix can differ per embedded schema, so detect it immediately
		// before parsing each one (prefix is instance state used by parseSchema).
		const schemas = schemaObjs.map((schemaObj) => {
			this.detectXsdPrefix(schemaObj);
			return this.parseSchema(schemaObj);
		});

		const merged = schemas[0];
		for (const other of schemas.slice(1)) {
			if (other.targetNamespace && merged.targetNamespace && other.targetNamespace !== merged.targetNamespace) {
				console.warn(
					`Warning: WSDL contains schemas with multiple target namespaces ` +
						`('${merged.targetNamespace}' and '${other.targetNamespace}'). ` +
						`Only the first target namespace is used for namespace generation.`,
				);
			}
			this.mergeSchema(merged, other);
		}

		if (baseDir) {
			this.resolveExternalSchemas(merged, baseDir);
		}

		return merged;
	}

	/** Collect all embedded schema objects from the WSDL <types> section(s). */
	private collectWsdlSchemaObjects(defObj: Record<string, unknown>): Record<string, unknown>[] {
		const typesKeys = Object.keys(defObj).filter((k) => k === "types" || k.endsWith(":types"));

		const schemaObjs: Record<string, unknown>[] = [];
		for (const typesKey of typesKeys) {
			for (const typesObj of this.parseChildren(defObj, typesKey)) {
				for (const key of Object.keys(typesObj)) {
					if (key === "schema" || key.endsWith(":schema")) {
						schemaObjs.push(...this.parseChildren(typesObj, key));
					}
				}
			}
		}
		return schemaObjs;
	}

	/** Copy xmlns declarations from a parent object onto a child (child-local declarations win). */
	private inheritNamespaceDeclarations(parent: Record<string, unknown>, child: Record<string, unknown>): void {
		for (const key of Object.keys(parent)) {
			if ((key === "@_xmlns" || key.startsWith("@_xmlns:")) && !(key in child)) {
				child[key] = parent[key];
			}
		}
	}

	private resolveExternalSchemas(schema: XsdSchema, baseDir: string): void {
		// Iterate snapshots: mergeSchema appends the merged file's own (already
		// recursively resolved) includes/imports to this schema's arrays.
		for (const inc of [...schema.includes]) {
			if (inc.schemaLocation) {
				const incPath = this.resolveSchemaLocation(inc.schemaLocation, baseDir, "include");
				if (incPath) {
					this.mergeSchema(schema, this.parseFile(incPath));
				}
			}
		}

		for (const red of [...schema.redefines]) {
			if (red.schemaLocation) {
				const redPath = this.resolveSchemaLocation(red.schemaLocation, baseDir, "redefine");
				if (redPath) {
					console.warn(
						`Warning: xs:redefine of '${red.schemaLocation}' is merged like an include; ` +
							`redefinition overrides are not applied.`,
					);
					this.mergeSchema(schema, this.parseFile(redPath));
				}
			}
		}

		for (const imp of [...schema.imports]) {
			if (imp.schemaLocation) {
				const impPath = this.resolveSchemaLocation(imp.schemaLocation, baseDir, "import");
				if (impPath) {
					this.mergeImportedSchema(schema, impPath, imp.namespace);
				}
			}
		}
	}

	/** Merge an imported schema file and adopt the prefix bound to its target namespace. */
	private mergeImportedSchema(schema: XsdSchema, importPath: string, importNamespace?: string): void {
		const imported = this.parseFile(importPath);

		// Tag the imported complex types with their OWN namespace/forms so the resolver
		// qualifies them (and their members) correctly instead of adopting the importing
		// schema's namespace. Only meaningful when the imported schema has its own target
		// namespace that differs from the importer's.
		if (imported.targetNamespace && imported.targetNamespace !== schema.targetNamespace) {
			for (const ct of imported.complexTypes) {
				ct.sourceNamespace ??= imported.targetNamespace;
				ct.sourceElementFormDefault ??= imported.elementFormDefault;
				ct.sourceAttributeFormDefault ??= imported.attributeFormDefault;
			}
		}

		this.mergeSchema(schema, imported);
		if (!importNamespace || !imported.targetNamespace) return;

		for (const [prefix, uri] of imported.namespaces) {
			if (uri === imported.targetNamespace && prefix !== "" && !schema.namespaces.has(prefix)) {
				schema.namespaces.set(prefix, uri);
			}
		}
	}

	/**
	 * Resolve a schemaLocation to a local file path, warning (instead of silently
	 * skipping) when the location is remote or does not exist on disk.
	 */
	private resolveSchemaLocation(schemaLocation: string, baseDir: string, kind: string): string | undefined {
		if (/^https?:\/\//i.test(schemaLocation)) {
			console.warn(
				`Warning: xs:${kind} schemaLocation '${schemaLocation}' is a remote URL and is not fetched. ` +
					`Download the schema locally and reference it by file path to include its types.`,
			);
			return undefined;
		}

		const resolved = path.resolve(baseDir, schemaLocation);
		if (!fs.existsSync(resolved)) {
			console.warn(`Warning: xs:${kind} schemaLocation '${schemaLocation}' not found at '${resolved}'. Skipped.`);
			return undefined;
		}

		return resolved;
	}

	private findSchemaRootKey(parsed: Record<string, unknown>): string | undefined {
		return Object.keys(parsed).find(
			(k) => k === "schema" || k.endsWith(":schema") || k === "xs:schema" || k === "xsd:schema",
		);
	}

	private findDefinitionsRootKey(parsed: Record<string, unknown>): string | undefined {
		return Object.keys(parsed).find((k) => k === "definitions" || k.endsWith(":definitions"));
	}

	private detectXsdPrefix(schemaObj: Record<string, unknown>): void {
		// Check for common XSD prefixes by looking at attribute keys
		for (const key of Object.keys(schemaObj)) {
			if (key.startsWith("@_xmlns:")) {
				const prefix = key.substring(8);
				const uri = schemaObj[key] as string;
				if (uri === XSD_NS) {
					this.xsdPrefix = prefix;
					return;
				}
			}
		}
		// Check for default namespace
		if (schemaObj["@_xmlns"] === XSD_NS) {
			this.xsdPrefix = "";
			return;
		}
		// Default fallback
		this.xsdPrefix = "xs";
	}

	/** Returns the full tag name for an XSD element, e.g. 'xs:element' */
	private xsd(localName: string): string {
		return this.xsdPrefix ? `${this.xsdPrefix}:${localName}` : localName;
	}

	private parseSchema(obj: Record<string, unknown>): XsdSchema {
		const schema: XsdSchema = {
			targetNamespace: attr(obj, "targetNamespace"),
			elementFormDefault: attr(obj, "elementFormDefault") as "qualified" | "unqualified" | undefined,
			attributeFormDefault: attr(obj, "attributeFormDefault") as "qualified" | "unqualified" | undefined,
			namespaces: this.extractNamespaces(obj),
			elements: this.parseChildren(obj, this.xsd("element")).map((e) => this.parseElement(e)),
			complexTypes: this.parseChildren(obj, this.xsd("complexType")).map((e) => this.parseComplexType(e)),
			simpleTypes: this.parseChildren(obj, this.xsd("simpleType")).map((e) => this.parseSimpleType(e)),
			groups: this.parseChildren(obj, this.xsd("group")).map((e) => this.parseGroup(e)),
			attributeGroups: this.parseChildren(obj, this.xsd("attributeGroup")).map((e) => this.parseAttributeGroup(e)),
			imports: this.parseChildren(obj, this.xsd("import")).map((e) => this.parseImport(e)),
			includes: this.parseChildren(obj, this.xsd("include")).map((e) => this.parseInclude(e)),
			redefines: this.parseChildren(obj, this.xsd("redefine")).map((e) => this.parseRedefine(e)),
			notations: this.parseChildren(obj, this.xsd("notation"))
				.map((n) => attr(n, "name"))
				.filter((n): n is string => n !== undefined),
			documentation: this.parseDocumentation(obj),
		};

		// xs:redefine can also contain type/group definitions that override the
		// redefined schema; parse them as regular definitions of this schema.
		for (const red of this.parseChildren(obj, this.xsd("redefine"))) {
			schema.complexTypes.push(
				...this.parseChildren(red, this.xsd("complexType")).map((e) => this.parseComplexType(e)),
			);
			schema.simpleTypes.push(...this.parseChildren(red, this.xsd("simpleType")).map((e) => this.parseSimpleType(e)));
			schema.groups.push(...this.parseChildren(red, this.xsd("group")).map((e) => this.parseGroup(e)));
			schema.attributeGroups.push(
				...this.parseChildren(red, this.xsd("attributeGroup")).map((e) => this.parseAttributeGroup(e)),
			);
		}

		return schema;
	}

	/**
	 * Extract the text of xs:annotation/xs:documentation children.
	 * Multiple documentation nodes are joined with newlines.
	 */
	private parseDocumentation(obj: Record<string, unknown>): string | undefined {
		const annotation = this.getChild(obj, this.xsd("annotation"));
		if (!annotation) return undefined;

		const texts: string[] = [];
		const raw = annotation[this.xsd("documentation")];
		const nodes = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
		for (const node of nodes) {
			// A documentation node parses as a plain string, or as an object with
			// '#text' when it carries attributes such as xml:lang.
			let text: unknown;
			if (typeof node === "string") {
				text = node;
			} else if (typeof node === "object" && node !== null) {
				text = (node as Record<string, unknown>)["#text"];
			}
			if (typeof text === "string" || typeof text === "number") {
				const cleaned = String(text).replace(/\s+/g, " ").trim();
				if (cleaned) texts.push(cleaned);
			}
		}

		return texts.length > 0 ? texts.join("\n") : undefined;
	}

	private extractNamespaces(obj: Record<string, unknown>): Map<string, string> {
		const ns = new Map<string, string>();
		for (const key of Object.keys(obj)) {
			if (key === "@_xmlns") {
				ns.set("", obj[key] as string);
			} else if (key.startsWith("@_xmlns:")) {
				ns.set(key.substring(8), obj[key] as string);
			}
		}
		return ns;
	}

	// ── Element parsing ──

	private parseElement(obj: Record<string, unknown>): XsdElement {
		const el: XsdElement = {
			name: attr(obj, "name") ?? "",
			type: attr(obj, "type"),
			ref: attr(obj, "ref"),
			minOccurs: numAttr(obj, "minOccurs"),
			maxOccurs: occursAttr(obj, "maxOccurs"),
			nillable: attr(obj, "nillable") === "true" || undefined,
			defaultValue: attr(obj, "default"),
			fixed: attr(obj, "fixed"),
			form: attr(obj, "form") as "qualified" | "unqualified" | undefined,
			substitutionGroup: attr(obj, "substitutionGroup"),
			documentation: this.parseDocumentation(obj),
		};

		const identityConstraints = this.parseIdentityConstraints(obj);
		if (identityConstraints.length > 0) {
			el.identityConstraints = identityConstraints;
		}

		const ct = this.getChild(obj, this.xsd("complexType"));
		if (ct) {
			el.complexType = this.parseComplexType(ct);
		}

		const st = this.getChild(obj, this.xsd("simpleType"));
		if (st) {
			el.simpleType = this.parseSimpleType(st);
		}

		return el;
	}

	private parseIdentityConstraints(obj: Record<string, unknown>): XsdIdentityConstraint[] {
		const constraints: XsdIdentityConstraint[] = [];
		for (const kind of ["key", "keyref", "unique"] as const) {
			for (const c of this.parseChildren(obj, this.xsd(kind))) {
				constraints.push({ kind, name: attr(c, "name") ?? "" });
			}
		}
		return constraints;
	}

	// ── Complex Type parsing ──

	private parseComplexType(obj: Record<string, unknown>): XsdComplexType {
		const ct: XsdComplexType = {
			name: attr(obj, "name"),
			mixed: attr(obj, "mixed") === "true" || undefined,
			abstract: attr(obj, "abstract") === "true" || undefined,
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
			groupRefs: this.parseGroupRefs(obj),
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
			anyAttribute: this.getChild(obj, this.xsd("anyAttribute")) !== undefined || undefined,
			documentation: this.parseDocumentation(obj),
		};

		const seq = this.getChild(obj, this.xsd("sequence"));
		if (seq) ct.sequence = this.parseSequence(seq);

		const choice = this.getChild(obj, this.xsd("choice"));
		if (choice) ct.choice = this.parseChoice(choice);

		const all = this.getChild(obj, this.xsd("all"));
		if (all) ct.all = this.parseAll(all);

		const sc = this.getChild(obj, this.xsd("simpleContent"));
		if (sc) ct.simpleContent = this.parseSimpleContent(sc);

		const cc = this.getChild(obj, this.xsd("complexContent"));
		if (cc) ct.complexContent = this.parseComplexContent(cc);

		return ct;
	}

	// ── Simple Type parsing ──

	private parseSimpleType(obj: Record<string, unknown>): XsdSimpleType {
		const st: XsdSimpleType = {
			name: attr(obj, "name"),
			documentation: this.parseDocumentation(obj),
		};

		const restriction = this.getChild(obj, this.xsd("restriction"));
		if (restriction) {
			st.restriction = this.parseRestriction(restriction);
		}

		const list = this.getChild(obj, this.xsd("list"));
		if (list) {
			st.list = { itemType: attr(list, "itemType") ?? "" };
		}

		const union = this.getChild(obj, this.xsd("union"));
		if (union) {
			const memberTypes = attr(union, "memberTypes");
			st.union = {
				memberTypes: memberTypes ? memberTypes.split(/\s+/) : [],
			};
		}

		return st;
	}

	private parseRestriction(obj: Record<string, unknown>): XsdRestriction {
		return {
			base: attr(obj, "base") ?? "",
			enumerations: this.parseChildren(obj, this.xsd("enumeration")).map((e) => attr(e, "value") ?? ""),
			pattern: this.parsePatterns(obj),
			length: numAttr(this.getChild(obj, this.xsd("length")) ?? {}, "value"),
			minLength: numAttr(this.getChild(obj, this.xsd("minLength")) ?? {}, "value"),
			maxLength: numAttr(this.getChild(obj, this.xsd("maxLength")) ?? {}, "value"),
			minInclusive: numAttr(this.getChild(obj, this.xsd("minInclusive")) ?? {}, "value"),
			maxInclusive: numAttr(this.getChild(obj, this.xsd("maxInclusive")) ?? {}, "value"),
			minExclusive: numAttr(this.getChild(obj, this.xsd("minExclusive")) ?? {}, "value"),
			maxExclusive: numAttr(this.getChild(obj, this.xsd("maxExclusive")) ?? {}, "value"),
			totalDigits: numAttr(this.getChild(obj, this.xsd("totalDigits")) ?? {}, "value"),
			fractionDigits: numAttr(this.getChild(obj, this.xsd("fractionDigits")) ?? {}, "value"),
			whiteSpace: attr(this.getChild(obj, this.xsd("whiteSpace")) ?? {}, "value") as
				| "preserve"
				| "replace"
				| "collapse"
				| undefined,
		};
	}

	/**
	 * Parse xs:pattern facets. Per the XSD spec, multiple pattern facets in one
	 * restriction step are ORed together, so they combine into a single regex.
	 */
	private parsePatterns(obj: Record<string, unknown>): string | undefined {
		const patterns = this.parseChildren(obj, this.xsd("pattern"))
			.map((p) => attr(p, "value"))
			.filter((p): p is string => p !== undefined);

		if (patterns.length === 0) return undefined;
		if (patterns.length === 1) return patterns[0];
		return patterns.map((p) => `(?:${p})`).join("|");
	}

	// ── Attribute parsing ──

	private parseAttribute(obj: Record<string, unknown>): XsdAttribute {
		const a: XsdAttribute = {
			name: attr(obj, "name") ?? "",
			type: attr(obj, "type"),
			use: attr(obj, "use") as "required" | "optional" | "prohibited" | undefined,
			defaultValue: attr(obj, "default"),
			fixed: attr(obj, "fixed"),
			form: attr(obj, "form") as "qualified" | "unqualified" | undefined,
			ref: attr(obj, "ref"),
			documentation: this.parseDocumentation(obj),
		};

		const st = this.getChild(obj, this.xsd("simpleType"));
		if (st) {
			a.simpleType = this.parseSimpleType(st);
		}

		return a;
	}

	// ── Compositor parsing ──

	private parseSequence(obj: Record<string, unknown>): XsdSequence {
		return {
			elements: this.parseChildren(obj, this.xsd("element")).map((e) => this.parseElement(e)),
			choices: this.parseChildren(obj, this.xsd("choice")).map((c) => this.parseChoice(c)),
			sequences: this.parseChildren(obj, this.xsd("sequence")).map((s) => this.parseSequence(s)),
			groupRefs: this.parseGroupRefs(obj),
			any: this.parseChildren(obj, this.xsd("any")).map((a) => this.parseAny(a)),
		};
	}

	private parseChoice(obj: Record<string, unknown>): XsdChoice {
		return {
			elements: this.parseChildren(obj, this.xsd("element")).map((e) => this.parseElement(e)),
			sequences: this.parseChildren(obj, this.xsd("sequence")).map((s) => this.parseSequence(s)),
			groupRefs: this.parseGroupRefs(obj),
			minOccurs: numAttr(obj, "minOccurs"),
			maxOccurs: occursAttr(obj, "maxOccurs"),
		};
	}

	private parseAll(obj: Record<string, unknown>): XsdAll {
		return {
			elements: this.parseChildren(obj, this.xsd("element")).map((e) => this.parseElement(e)),
			choices: this.parseChildren(obj, this.xsd("choice")).map((c) => this.parseChoice(c)),
			minOccurs: numAttr(obj, "minOccurs"),
		};
	}

	private parseAny(obj: Record<string, unknown>): XsdAny {
		return {
			namespace: attr(obj, "namespace"),
			processContents: attr(obj, "processContents") as "strict" | "lax" | "skip" | undefined,
			minOccurs: numAttr(obj, "minOccurs"),
			maxOccurs: occursAttr(obj, "maxOccurs"),
		};
	}

	// ── Content model parsing ──

	private parseSimpleContent(obj: Record<string, unknown>): XsdSimpleContent {
		const sc: XsdSimpleContent = {};

		const ext = this.getChild(obj, this.xsd("extension"));
		if (ext) {
			sc.extension = this.parseSimpleContentExtension(ext);
		}

		const rest = this.getChild(obj, this.xsd("restriction"));
		if (rest) {
			sc.restriction = this.parseSimpleContentRestriction(rest);
		}

		return sc;
	}

	private parseSimpleContentExtension(obj: Record<string, unknown>): XsdSimpleContentExtension {
		return {
			base: attr(obj, "base") ?? "",
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
		};
	}

	private parseSimpleContentRestriction(obj: Record<string, unknown>): XsdSimpleContentRestriction {
		return {
			base: attr(obj, "base") ?? "",
			enumerations: this.parseChildren(obj, this.xsd("enumeration")).map((e) => attr(e, "value") ?? ""),
			pattern: this.parsePatterns(obj),
			length: numAttr(this.getChild(obj, this.xsd("length")) ?? {}, "value"),
			minLength: numAttr(this.getChild(obj, this.xsd("minLength")) ?? {}, "value"),
			maxLength: numAttr(this.getChild(obj, this.xsd("maxLength")) ?? {}, "value"),
			minInclusive: numAttr(this.getChild(obj, this.xsd("minInclusive")) ?? {}, "value"),
			maxInclusive: numAttr(this.getChild(obj, this.xsd("maxInclusive")) ?? {}, "value"),
			minExclusive: numAttr(this.getChild(obj, this.xsd("minExclusive")) ?? {}, "value"),
			maxExclusive: numAttr(this.getChild(obj, this.xsd("maxExclusive")) ?? {}, "value"),
			totalDigits: numAttr(this.getChild(obj, this.xsd("totalDigits")) ?? {}, "value"),
			fractionDigits: numAttr(this.getChild(obj, this.xsd("fractionDigits")) ?? {}, "value"),
			whiteSpace: attr(this.getChild(obj, this.xsd("whiteSpace")) ?? {}, "value") as
				| "preserve"
				| "replace"
				| "collapse"
				| undefined,
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
		};
	}

	private parseComplexContent(obj: Record<string, unknown>): XsdComplexContent {
		const cc: XsdComplexContent = {
			mixed: attr(obj, "mixed") === "true" || undefined,
		};

		const ext = this.getChild(obj, this.xsd("extension"));
		if (ext) {
			cc.extension = this.parseComplexContentExtension(ext);
		}

		const rest = this.getChild(obj, this.xsd("restriction"));
		if (rest) {
			cc.restriction = this.parseComplexContentRestriction(rest);
		}

		return cc;
	}

	private parseComplexContentExtension(obj: Record<string, unknown>): XsdComplexContentExtension {
		const ext: XsdComplexContentExtension = {
			base: attr(obj, "base") ?? "",
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
			groupRefs: this.parseGroupRefs(obj),
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
		};

		const seq = this.getChild(obj, this.xsd("sequence"));
		if (seq) ext.sequence = this.parseSequence(seq);

		const choice = this.getChild(obj, this.xsd("choice"));
		if (choice) ext.choice = this.parseChoice(choice);

		const all = this.getChild(obj, this.xsd("all"));
		if (all) ext.all = this.parseAll(all);

		return ext;
	}

	private parseComplexContentRestriction(obj: Record<string, unknown>): XsdComplexContentRestriction {
		const rest: XsdComplexContentRestriction = {
			base: attr(obj, "base") ?? "",
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
			groupRefs: this.parseGroupRefs(obj),
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
		};

		const seq = this.getChild(obj, this.xsd("sequence"));
		if (seq) rest.sequence = this.parseSequence(seq);

		const choice = this.getChild(obj, this.xsd("choice"));
		if (choice) rest.choice = this.parseChoice(choice);

		const all = this.getChild(obj, this.xsd("all"));
		if (all) rest.all = this.parseAll(all);

		return rest;
	}

	// ── Group parsing ──

	private parseGroup(obj: Record<string, unknown>): XsdGroup {
		const g: XsdGroup = {
			name: attr(obj, "name") ?? "",
		};

		const seq = this.getChild(obj, this.xsd("sequence"));
		if (seq) g.sequence = this.parseSequence(seq);

		const choice = this.getChild(obj, this.xsd("choice"));
		if (choice) g.choice = this.parseChoice(choice);

		const all = this.getChild(obj, this.xsd("all"));
		if (all) g.all = this.parseAll(all);

		return g;
	}

	private parseGroupRefs(obj: Record<string, unknown>): XsdGroupRef[] {
		return this.parseChildren(obj, this.xsd("group"))
			.filter((g) => attr(g, "ref") !== undefined)
			.map((g) => ({
				ref: attr(g, "ref")!,
				minOccurs: numAttr(g, "minOccurs"),
				maxOccurs: occursAttr(g, "maxOccurs"),
			}));
	}

	private parseAttributeGroup(obj: Record<string, unknown>): XsdAttributeGroup {
		return {
			name: attr(obj, "name") ?? "",
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((a) => this.parseAttribute(a)),
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
		};
	}

	private parseAttributeGroupRefs(obj: Record<string, unknown>): XsdAttributeGroupRef[] {
		return this.parseChildren(obj, this.xsd("attributeGroup"))
			.filter((g) => attr(g, "ref") !== undefined)
			.map((g) => ({ ref: attr(g, "ref")! }));
	}

	// ── Import/Include ──

	private parseImport(obj: Record<string, unknown>): XsdImport {
		return {
			namespace: attr(obj, "namespace"),
			schemaLocation: attr(obj, "schemaLocation"),
		};
	}

	private parseInclude(obj: Record<string, unknown>): XsdInclude {
		return {
			schemaLocation: attr(obj, "schemaLocation") ?? "",
		};
	}

	private parseRedefine(obj: Record<string, unknown>): XsdRedefine {
		return {
			schemaLocation: attr(obj, "schemaLocation") ?? "",
		};
	}

	// ── Schema merging (for includes) ──

	private mergeSchema(target: XsdSchema, source: XsdSchema): void {
		target.elements.push(...source.elements);
		target.complexTypes.push(...source.complexTypes);
		target.simpleTypes.push(...source.simpleTypes);
		target.groups.push(...source.groups);
		target.attributeGroups.push(...source.attributeGroups);
		target.imports.push(...source.imports);
		target.includes.push(...source.includes);
		target.redefines.push(...source.redefines);
		target.notations.push(...source.notations);
		for (const [prefix, uri] of source.namespaces) {
			// Skip the default namespace ("" prefix): inheriting it across documents
			// would change how unprefixed type references resolve in the target.
			if (prefix !== "" && !target.namespaces.has(prefix)) {
				target.namespaces.set(prefix, uri);
			}
		}
	}

	// ── Utility: child access in parsed XML object ──

	/**
	 * Get a single child element by tag name from a parsed XML object.
	 * Returns the child as an object, or undefined if not found.
	 */
	private getChild(obj: Record<string, unknown>, tagName: string): Record<string, unknown> | undefined {
		const child = obj[tagName];
		if (child === undefined || child === null) return undefined;
		if (Array.isArray(child)) return child[0] as Record<string, unknown>;
		if (typeof child === "object") return child as Record<string, unknown>;
		return undefined;
	}

	/**
	 * Get all children with a given tag name as an array.
	 */
	private parseChildren(obj: Record<string, unknown>, tagName: string): Record<string, unknown>[] {
		const child = obj[tagName];
		if (child === undefined || child === null) return [];
		if (Array.isArray(child))
			return child.map((c) => (typeof c === "object" && c !== null ? (c as Record<string, unknown>) : {}));
		if (typeof child === "object") return [child as Record<string, unknown>];
		return [];
	}
}

// ── Helpers ──

/** Get an XML attribute value from a parsed object (attributes have @_ prefix) */
function attr(obj: Record<string, unknown>, name: string): string | undefined {
	const val = obj[`@_${name}`];
	if (val === undefined || val === null) return undefined;
	if (typeof val === "string") return val;
	if (typeof val === "number" || typeof val === "boolean" || typeof val === "bigint" || typeof val === "symbol") {
		return String(val);
	}
	return undefined;
}

/** Get a numeric attribute value */
function numAttr(obj: Record<string, unknown>, name: string): number | undefined {
	const val = attr(obj, name);
	if (val === undefined) return undefined;
	const num = Number(val);
	return Number.isNaN(num) ? undefined : num;
}

/** Parse an occurs attribute that can be "unbounded" or a number */
function occursAttr(obj: Record<string, unknown>, name: string): number | "unbounded" | undefined {
	const val = attr(obj, name);
	if (val === undefined) return undefined;
	if (val === "unbounded") return "unbounded";
	const num = Number(val);
	return Number.isNaN(num) ? undefined : num;
}
