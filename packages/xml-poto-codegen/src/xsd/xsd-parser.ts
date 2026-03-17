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
	XsdImport,
	XsdInclude,
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
	 * Parse an XSD string into a structured schema model.
	 */
	parseString(xsdContent: string, baseDir?: string): XsdSchema {
		const parsed = this.parser.parse(xsdContent);
		const rootKey = this.findSchemaRootKey(parsed);
		if (!rootKey) {
			throw new Error("No XSD schema root element found. Expected <xs:schema>, <xsd:schema>, or <schema>.");
		}

		const schemaObj = parsed[rootKey];
		this.detectXsdPrefix(schemaObj);

		const schema = this.parseSchema(schemaObj);

		// Resolve includes inline
		if (baseDir) {
			for (const inc of schema.includes) {
				if (inc.schemaLocation) {
					const incPath = path.resolve(baseDir, inc.schemaLocation);
					if (fs.existsSync(incPath)) {
						const included = this.parseFile(incPath);
						this.mergeSchema(schema, included);
					}
				}
			}

			// Resolve imports (external schemas with their own namespace)
			for (const imp of schema.imports) {
				if (imp.schemaLocation) {
					const impPath = path.resolve(baseDir, imp.schemaLocation);
					if (fs.existsSync(impPath)) {
						const imported = this.parseFile(impPath);
						this.mergeSchema(schema, imported);
						// Add the imported namespace mapping if not already present
						if (imp.namespace && imported.targetNamespace) {
							for (const [prefix, uri] of imported.namespaces) {
								if (uri === imported.targetNamespace && prefix !== "" && !schema.namespaces.has(prefix)) {
									schema.namespaces.set(prefix, uri);
								}
							}
						}
					}
				}
			}
		}

		return schema;
	}

	private findSchemaRootKey(parsed: Record<string, unknown>): string | undefined {
		return Object.keys(parsed).find(
			(k) => k === "schema" || k.endsWith(":schema") || k === "xs:schema" || k === "xsd:schema",
		);
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
		};
		return schema;
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
		};

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
			pattern: attr(this.getChild(obj, this.xsd("pattern")) ?? {}, "value"),
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
			pattern: attr(this.getChild(obj, this.xsd("pattern")) ?? {}, "value"),
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
		};

		const seq = this.getChild(obj, this.xsd("sequence"));
		if (seq) rest.sequence = this.parseSequence(seq);

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

	// ── Schema merging (for includes) ──

	private mergeSchema(target: XsdSchema, source: XsdSchema): void {
		target.elements.push(...source.elements);
		target.complexTypes.push(...source.complexTypes);
		target.simpleTypes.push(...source.simpleTypes);
		target.groups.push(...source.groups);
		target.attributeGroups.push(...source.attributeGroups);
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
