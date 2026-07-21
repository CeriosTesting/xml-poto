import fs from "node:fs";
import path from "node:path";

import { XmlDecoratorParser } from "@cerios/xml-poto";

import type {
	WsdlDefinitions,
	WsdlMessage,
	WsdlOperation,
	WsdlPortType,
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
 * A WSDL `<definitions>` element together with the directory its relative
 * locations resolve against.
 *
 * A WSDL split over several files is one logical document, but each file resolves
 * its own `wsdl:import`/`xs:import` locations relative to where *it* lives — an
 * imported WSDL in a subdirectory would otherwise look for its schemas next to the
 * file that imported it.
 */
interface WsdlDocument {
	defObj: Record<string, unknown>;
	baseDir?: string;
}

/** A bare XSD named by a `wsdl:import`, which WSDL 1.1 allows alongside WSDL targets. */
interface WsdlImportedSchema {
	path: string;
	namespace?: string;
}

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
	 * Absolute paths of files already merged into the schema currently being built.
	 *
	 * Schemas reference each other freely — mutually (A includes B, B includes A)
	 * and in diamonds (A imports B and C, both of which import D). Without this,
	 * the first recurses until the stack overflows and the second merges D twice.
	 * Cleared at the start of each top-level parse.
	 */
	private resolvedFiles = new Set<string>();

	/**
	 * Operation metadata from the last WSDL parsed, or undefined when the source was
	 * a plain XSD. Kept as state rather than returned so `parseFile`/`parseString`
	 * keep their signature — the schema is what almost every caller wants.
	 */
	private wsdlDefinitions?: WsdlDefinitions;

	/**
	 * The `<message>`, `<portType>` and `<binding>` content of the WSDL last parsed.
	 *
	 * Undefined for a plain XSD, and for a WSDL whose operations could not be read.
	 * Feeds the generated `operations.ts` — see the codegen's operations generator.
	 */
	getWsdlDefinitions(): WsdlDefinitions | undefined {
		return this.wsdlDefinitions;
	}

	/**
	 * Parse an XSD file at the given path, resolving includes/imports relative to it.
	 */
	parseFile(xsdPath: string): XsdSchema {
		const absolutePath = path.resolve(xsdPath);
		this.resolvedFiles.clear();
		this.resolvedFiles.add(absolutePath);
		this.wsdlDefinitions = undefined;
		return this.parseFileInternal(absolutePath);
	}

	/** Parse a file already registered in {@link resolvedFiles} (see {@link parseFile}). */
	private parseFileInternal(absolutePath: string): XsdSchema {
		const content = fs.readFileSync(absolutePath, "utf-8");
		return this.parseStringInternal(content, path.dirname(absolutePath));
	}

	/**
	 * Parse an XSD or WSDL string into a structured schema model.
	 * WSDL documents are detected by their `<definitions>` root; all XSD schemas
	 * embedded in the WSDL `<types>` section are extracted and merged.
	 */
	parseString(xsdContent: string, baseDir?: string): XsdSchema {
		this.resolvedFiles.clear();
		this.wsdlDefinitions = undefined;
		return this.parseStringInternal(xsdContent, baseDir);
	}

	/** Parse without resetting the resolved-file set, so recursion keeps its cycle guard. */
	private parseStringInternal(xsdContent: string, baseDir?: string): XsdSchema {
		// Strip the optional XML declaration and any XML comments, then check
		// that the root element is a schema or WSDL definitions element (any
		// namespace prefix is accepted). This is done before handing off to the
		// XML parser so invalid input produces a clear, actionable error instead
		// of a cryptic tag-mismatch.
		const normalized = normalizeDocument(xsdContent);

		if (detectRootKind(normalized) === undefined) {
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
	 * Extract and merge all XSD schemas a WSDL describes, following `wsdl:import`.
	 *
	 * A WSDL is routinely split: the file naming the service holds `<service>` and
	 * `<binding>` and imports a second file holding `<types>`, `<message>` and
	 * `<portType>`. Both halves are one document, so every reachable file
	 * contributes — its schemas here, its operations in {@link parseWsdlOperations}.
	 *
	 * Each file's schemas are merged and resolved against that file's own directory
	 * before being merged with the rest, so an imported WSDL elsewhere on disk
	 * resolves its own `xs:import` locations correctly.
	 */
	private parseWsdlDefinitions(defObj: Record<string, unknown>, baseDir?: string): XsdSchema {
		const documents: WsdlDocument[] = [{ defObj, baseDir }];
		const importedSchemas: WsdlImportedSchema[] = [];
		this.collectWsdlImports(documents, importedSchemas);

		this.wsdlDefinitions = this.parseWsdlOperations(documents);

		const schemas = documents
			.map((document) => this.parseWsdlDocumentSchema(document))
			.filter((schema): schema is XsdSchema => schema !== undefined);

		if (schemas.length === 0 && importedSchemas.length === 0) {
			throw new Error(
				"The WSDL document contains no XSD schemas. Expected at least one <schema> element " +
					"inside the WSDL <types> section.",
			);
		}

		// A wsdl:import naming a bare XSD merges like an xs:import, keeping its own
		// namespace and element form. With no <types> anywhere, the first such schema
		// *is* the model, so it becomes the base rather than an import into an empty one.
		let pending = importedSchemas;
		let merged: XsdSchema;
		if (schemas.length > 0) {
			merged = this.mergeWsdlSchemas(schemas);
		} else {
			merged = this.parseFileInternal(pending[0].path);
			pending = pending.slice(1);
		}

		for (const imported of pending) {
			this.mergeImportedSchema(merged, imported.path, imported.namespace);
		}

		return merged;
	}

	/**
	 * The schemas embedded in one `<definitions>` element, merged and resolved
	 * against that document's own directory. Undefined when it has no `<types>`.
	 *
	 * Namespace declarations on the WSDL `<definitions>` root are inherited by each
	 * embedded schema (schema-local declarations win), because WSDL files commonly
	 * declare `xmlns:xsd`/`xmlns:tns` on the root only.
	 */
	private parseWsdlDocumentSchema(document: WsdlDocument): XsdSchema | undefined {
		const schemaObjs = this.collectWsdlSchemaObjects(document.defObj);
		if (schemaObjs.length === 0) return undefined;

		// Inherit xmlns declarations from <definitions> onto each embedded schema.
		for (const schemaObj of schemaObjs) {
			this.inheritNamespaceDeclarations(document.defObj, schemaObj);
		}

		// The XSD prefix can differ per embedded schema, so detect it immediately
		// before parsing each one (prefix is instance state used by parseSchema).
		const merged = this.mergeWsdlSchemas(
			schemaObjs.map((schemaObj) => {
				this.detectXsdPrefix(schemaObj);
				return this.parseSchema(schemaObj);
			}),
		);

		if (document.baseDir) {
			this.resolveExternalSchemas(merged, document.baseDir);
		}

		return merged;
	}

	/** Merge schemas into the first, reporting the target namespaces that are lost. */
	private mergeWsdlSchemas(schemas: XsdSchema[]): XsdSchema {
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
		return merged;
	}

	/**
	 * Follow every `wsdl:import` reachable from the documents collected so far,
	 * appending imported WSDLs to `documents` and imported XSDs to `schemas`.
	 *
	 * `documents` grows while it is walked, which is how transitive imports are
	 * reached; {@link claimFile} stops a file being visited twice, so a mutual
	 * import terminates and a diamond contributes once.
	 *
	 * Note `wsdl:import` names its target with `location`, not the `schemaLocation`
	 * of its XSD counterpart.
	 */
	private collectWsdlImports(documents: WsdlDocument[], schemas: WsdlImportedSchema[]): void {
		for (let i = 0; i < documents.length; i++) {
			const document = documents[i];
			// Without a base directory there is nothing to resolve a relative location
			// against — the same position xs:import is in when parsing a bare string.
			if (!document.baseDir) continue;

			for (const importObj of this.childrenByLocalName(document.defObj, "import")) {
				const location = attr(importObj, "location");
				if (!location) continue;

				const importPath = this.resolveSchemaLocation(location, document.baseDir, "wsdl:import");
				if (!importPath || !this.claimFile(importPath)) continue;

				const normalized = normalizeDocument(fs.readFileSync(importPath, "utf-8"));
				const kind = detectRootKind(normalized);

				if (kind === "schema") {
					// WSDL 1.1 allows a wsdl:import to name a schema document directly.
					schemas.push({ path: importPath, namespace: attr(importObj, "namespace") });
					continue;
				}

				const parsed = kind === "definitions" ? this.parser.parse(normalized) : undefined;
				const rootKey = parsed ? this.findDefinitionsRootKey(parsed) : undefined;
				if (!parsed || !rootKey) {
					console.warn(
						`Warning: wsdl:import location '${location}' is neither a <definitions> nor a <schema> document. Skipped.`,
					);
					continue;
				}

				documents.push({
					defObj: parsed[rootKey] as Record<string, unknown>,
					baseDir: path.dirname(importPath),
				});
			}
		}
	}

	/**
	 * Read the operation-describing half of a WSDL: `<message>`, `<portType>` and
	 * `<binding>`.
	 *
	 * Reads across every file of a split WSDL at once, rather than per file. The
	 * bindings are collected from all of them *before* any portType is walked,
	 * because the usual split puts `<binding>` — and so the soapAction — in the file
	 * that imports the `<portType>` it annotates.
	 *
	 * WSDL elements are matched by local name, since the prefix bound to the WSDL
	 * namespace varies (`wsdl:`, none, occasionally something else). The SOAP
	 * binding is likewise matched by local name, which covers both the SOAP 1.1 and
	 * 1.2 binding namespaces without having to resolve either.
	 */
	private parseWsdlOperations(documents: WsdlDocument[]): WsdlDefinitions {
		const messages: WsdlMessage[] = [];
		for (const { defObj } of documents) {
			for (const messageObj of this.childrenByLocalName(defObj, "message")) {
				const name = attr(messageObj, "name");
				if (!name) continue;
				const parts = this.childrenByLocalName(messageObj, "part");
				messages.push({
					name,
					elementName: parts.length > 0 ? attr(parts[0], "element") : undefined,
					partCount: parts.length,
				});
			}
		}

		// soapAction/style/use live on the binding, keyed by operation name.
		const bindingInfo = this.parseWsdlBindings(documents);

		const portTypes: WsdlPortType[] = [];
		for (const { defObj } of documents) {
			for (const portTypeObj of this.childrenByLocalName(defObj, "portType")) {
				const name = attr(portTypeObj, "name");
				if (!name) continue;

				const operations = this.childrenByLocalName(portTypeObj, "operation")
					.map((opObj) => this.parseWsdlOperation(opObj, bindingInfo))
					.filter((operation): operation is WsdlOperation => operation !== undefined);

				portTypes.push({ name, operations });
			}
		}

		// The document imported into is the one that names the service.
		return { targetNamespace: attr(documents[0].defObj, "targetNamespace"), messages, portTypes };
	}

	/** One `<operation>` of a portType, merged with what its binding says. */
	private parseWsdlOperation(
		opObj: Record<string, unknown>,
		bindingInfo: Map<string, Pick<WsdlOperation, "soapAction" | "style" | "use">>,
	): WsdlOperation | undefined {
		const opName = attr(opObj, "name");
		if (!opName) return undefined;

		const faults: Record<string, string> = {};
		for (const faultObj of this.childrenByLocalName(opObj, "fault")) {
			const faultName = attr(faultObj, "name");
			const faultMessage = attr(faultObj, "message");
			if (faultName && faultMessage) faults[faultName] = stripNamePrefix(faultMessage);
		}

		const input = this.childrenByLocalName(opObj, "input")[0];
		const output = this.childrenByLocalName(opObj, "output")[0];

		return {
			name: opName,
			documentation: this.parseWsdlDocumentation(opObj),
			inputMessage: input ? stripNamePrefix(attr(input, "message") ?? "") || undefined : undefined,
			outputMessage: output ? stripNamePrefix(attr(output, "message") ?? "") || undefined : undefined,
			faults,
			...bindingInfo.get(opName),
		};
	}

	/**
	 * soapAction, style and use per operation name, read from the `<binding>`
	 * elements of every file of the WSDL.
	 */
	private parseWsdlBindings(
		documents: WsdlDocument[],
	): Map<string, Pick<WsdlOperation, "soapAction" | "style" | "use">> {
		const byOperation = new Map<string, Pick<WsdlOperation, "soapAction" | "style" | "use">>();

		for (const { defObj } of documents) {
			for (const bindingObj of this.childrenByLocalName(defObj, "binding")) {
				// <soap:binding style="document"> sets the default for the whole binding.
				const bindingStyle = attr(this.childrenByLocalName(bindingObj, "binding")[0] ?? {}, "style");

				for (const opObj of this.childrenByLocalName(bindingObj, "operation")) {
					const opName = attr(opObj, "name");
					if (!opName) continue;

					// The SOAP extension element shares the local name 'operation' with its
					// WSDL parent; it is the one carrying soapAction.
					const soapOp = this.childrenByLocalName(opObj, "operation")[0];
					const inputObj = this.childrenByLocalName(opObj, "input")[0];
					const bodyObj = inputObj ? this.childrenByLocalName(inputObj, "body")[0] : undefined;

					byOperation.set(opName, {
						soapAction: soapOp ? attr(soapOp, "soapAction") : undefined,
						style: (attr(soapOp ?? {}, "style") ?? bindingStyle) as WsdlOperation["style"],
						use: attr(bodyObj ?? {}, "use") as WsdlOperation["use"],
					});
				}
			}
		}

		return byOperation;
	}

	/**
	 * Text of a WSDL `<documentation>` child, which is not namespaced like
	 * xs:documentation.
	 *
	 * Read straight off the key rather than through {@link childrenByLocalName},
	 * because the usual `<documentation>text</documentation>` parses to a bare
	 * string — an element-shaped lookup drops it, and only the rarer form carrying
	 * an attribute (`xml:lang`) survives as an object with `#text`.
	 */
	private parseWsdlDocumentation(obj: Record<string, unknown>): string | undefined {
		for (const key of Object.keys(obj)) {
			const local = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
			if (local !== "documentation") continue;

			const raw = obj[key];
			const node = Array.isArray(raw) ? raw[0] : raw;
			const text = typeof node === "object" && node !== null ? (node as Record<string, unknown>)["#text"] : node;
			const cleaned =
				typeof text === "string" || typeof text === "number" ? String(text).replace(/\s+/g, " ").trim() : "";
			if (cleaned) return cleaned;
		}
		return undefined;
	}

	/**
	 * Children matching a local name, whatever prefix they carry.
	 *
	 * WSDL documents bind their own namespace to `wsdl:`, to no prefix, or
	 * occasionally to something else, and SOAP binding extensions vary the same way.
	 * Matching on the local name sidesteps all of it.
	 */
	private childrenByLocalName(obj: Record<string, unknown>, localName: string): Record<string, unknown>[] {
		const result: Record<string, unknown>[] = [];
		for (const key of Object.keys(obj)) {
			const local = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
			if (local === localName) result.push(...this.parseChildren(obj, key));
		}
		return result;
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
				const incPath = this.resolveSchemaLocation(inc.schemaLocation, baseDir, "xs:include");
				if (incPath && this.claimFile(incPath)) {
					this.mergeSchema(schema, this.parseFileInternal(incPath));
				}
			}
		}

		for (const red of [...schema.redefines]) {
			if (red.schemaLocation) {
				const redPath = this.resolveSchemaLocation(red.schemaLocation, baseDir, "xs:redefine");
				if (redPath && this.claimFile(redPath)) {
					console.warn(
						`Warning: xs:redefine of '${red.schemaLocation}' is merged like an include; ` +
							`redefinition overrides are not applied.`,
					);
					this.mergeSchema(schema, this.parseFileInternal(redPath));
				}
			}
		}

		for (const imp of [...schema.imports]) {
			if (imp.schemaLocation) {
				const impPath = this.resolveSchemaLocation(imp.schemaLocation, baseDir, "xs:import");
				if (impPath && this.claimFile(impPath)) {
					this.mergeImportedSchema(schema, impPath, imp.namespace);
				}
			}
		}
	}

	/**
	 * Register a file as merged, returning false when it already was.
	 *
	 * Both a cycle and a diamond reach the same file twice; in either case there is
	 * nothing left to contribute, because the first visit merged the whole file.
	 */
	private claimFile(absolutePath: string): boolean {
		if (this.resolvedFiles.has(absolutePath)) return false;
		this.resolvedFiles.add(absolutePath);
		return true;
	}

	/** Merge an imported schema file and adopt the prefix bound to its target namespace. */
	private mergeImportedSchema(schema: XsdSchema, importPath: string, importNamespace?: string): void {
		const imported = this.parseFileInternal(importPath);

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
	 * Resolve a referenced document to a local file path, warning (instead of
	 * silently skipping) when the location is remote or does not exist on disk.
	 *
	 * `kind` is the full element name (`xs:import`, `wsdl:import`, …), so the
	 * warning names the construct the reader has to go and look at.
	 */
	private resolveSchemaLocation(schemaLocation: string, baseDir: string, kind: string): string | undefined {
		if (/^https?:\/\//i.test(schemaLocation)) {
			console.warn(
				`Warning: ${kind} location '${schemaLocation}' is a remote URL and is not fetched. ` +
					`Download the document locally and reference it by file path to include its types.`,
			);
			return undefined;
		}

		const resolved = path.resolve(baseDir, schemaLocation);
		if (!fs.existsSync(resolved)) {
			console.warn(`Warning: ${kind} location '${schemaLocation}' not found at '${resolved}'. Skipped.`);
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
			attributes: this.parseChildren(obj, this.xsd("attribute")).map((e) => this.parseAttribute(e)),
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
				...this.parseChildren(red, this.xsd("complexType")).map((e) => ({
					...this.parseComplexType(e),
					isRedefinition: true,
				})),
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
			abstract: attr(obj, "abstract") === "true" || undefined,
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
			anyAttribute: this.hasAnyAttribute(obj),
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
			// The item type is either the `itemType` attribute or an inline declaration.
			const itemSimpleType = this.getChild(list, this.xsd("simpleType"));
			st.list = {
				itemType: attr(list, "itemType") ?? "",
				itemSimpleType: itemSimpleType ? this.parseSimpleType(itemSimpleType) : undefined,
			};
		}

		const union = this.getChild(obj, this.xsd("union"));
		if (union) {
			// memberTypes and inline <xs:simpleType> members may both be present; the
			// union is their concatenation, attribute members first.
			const memberTypes = attr(union, "memberTypes");
			st.union = {
				memberTypes: memberTypes ? memberTypes.split(/\s+/) : [],
				memberSimpleTypes: this.parseChildren(union, this.xsd("simpleType")).map((m) => this.parseSimpleType(m)),
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
			minOccurs: numAttr(obj, "minOccurs"),
			maxOccurs: occursAttr(obj, "maxOccurs"),
		};
	}

	private parseChoice(obj: Record<string, unknown>): XsdChoice {
		return {
			elements: this.parseChildren(obj, this.xsd("element")).map((e) => this.parseElement(e)),
			sequences: this.parseChildren(obj, this.xsd("sequence")).map((s) => this.parseSequence(s)),
			groupRefs: this.parseGroupRefs(obj),
			any: this.parseChildren(obj, this.xsd("any")).map((a) => this.parseAny(a)),
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
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
			anyAttribute: this.hasAnyAttribute(obj),
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
			attributeGroupRefs: this.parseAttributeGroupRefs(obj),
			anyAttribute: this.hasAnyAttribute(obj),
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
			anyAttribute: this.hasAnyAttribute(obj),
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
			anyAttribute: this.hasAnyAttribute(obj),
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
			anyAttribute: this.hasAnyAttribute(obj),
		};
	}

	/**
	 * Whether an attribute-carrying construct declares an `xs:anyAttribute` wildcard.
	 *
	 * The wildcard is legal on a complexType, on either half of simpleContent and
	 * complexContent, and on an attributeGroup definition — every place attributes
	 * themselves are legal. Undefined rather than false when absent, to keep the
	 * parsed model free of noise fields.
	 */
	private hasAnyAttribute(obj: Record<string, unknown>): boolean | undefined {
		return this.getChild(obj, this.xsd("anyAttribute")) !== undefined || undefined;
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
		target.attributes.push(...source.attributes);
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

/** Strip the XML declaration and leading comments, so the root element comes first. */
function normalizeDocument(content: string): string {
	return content
		.replace(/<\?xml[^?]*\?>/i, "") // optional XML declaration
		.replace(/<!--[\s\S]*?-->/g, "") // XML comments before root
		.trim();
}

/**
 * Which kind of document this is, from its root element — any namespace prefix is
 * accepted. Undefined for anything that is neither an XSD nor a WSDL.
 */
function detectRootKind(normalized: string): "schema" | "definitions" | undefined {
	if (/^<(?:[a-zA-Z_][\w.-]*:)?schema[\s/>]/i.test(normalized)) return "schema";
	if (/^<(?:[a-zA-Z_][\w.-]*:)?definitions[\s/>]/i.test(normalized)) return "definitions";
	return undefined;
}

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

/** Strip a `tns:` style prefix from a WSDL QName reference. */
function stripNamePrefix(name: string): string {
	const idx = name.indexOf(":");
	return idx >= 0 ? name.substring(idx + 1) : name;
}
