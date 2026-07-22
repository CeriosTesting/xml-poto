/* eslint-disable typescript/no-explicit-any -- Serializer works with dynamic objects during XML conversion */
import { DEFAULT_SERIALIZATION_OPTIONS, SerializationOptions } from "./serialization-options";
import {
	EMPTY_NAMESPACE_SCOPE,
	extendNamespaceScope,
	findElementKey,
	getOrCreateDefaultElementMetadata,
	type NamespaceScope,
	XmlMappingUtil,
	XmlNamespaceUtil,
} from "./utils";
import { XmlBuilder } from "./xml-builder";
import { XmlDecoratorParser } from "./xml-decorator-parser";

/**
 * Main XML serialization class that orchestrates the conversion between
 * typed objects and XML strings using decorator metadata.
 *
 * Members are `protected` rather than `private` so subclasses can wrap the
 * document without reimplementing the mapping pipeline — see
 * {@link buildDocumentRoot} / {@link resolveDocumentBody} and `SoapSerializer`.
 */
export class XmlDecoratorSerializer {
	protected parser: XmlDecoratorParser;
	protected builder: XmlBuilder;
	protected options: SerializationOptions;
	protected namespaceUtil: XmlNamespaceUtil;
	protected mappingUtil: XmlMappingUtil;

	/**
	 * Creates a new XmlDecoratorSerializer to convert between TypeScript objects and XML strings.
	 *
	 * The serializer uses decorator metadata from your classes to handle serialization and
	 * deserialization. Configure XML generation options like DOCTYPE, processing instructions,
	 * empty element syntax, and validation behaviour.
	 *
	 * @param options Configuration options for XML serialization
	 * @param options.omitXmlDeclaration - Suppress the `<?xml?>` declaration entirely (default: false)
	 * @param options.xmlVersion - XML version written in the declaration (default: `"1.0"`)
	 * @param options.encoding - Character encoding written in the declaration (default: `"UTF-8"`)
	 * @param options.standalone - Standalone attribute for the XML declaration (`true` → `"yes"`, `false` → `"no"`)
	 * @param options.processingInstructions - Processing instructions to insert after the XML declaration
	 * @param options.docType - DOCTYPE declaration to insert before the root element
	 * @param options.emptyElementStyle - How to render empty elements: `'self-closing'` (default) or `'explicit'`
	 * @param options.format - Indent and line-break the output (default: true); false produces a compact document
	 * @param options.indent - Indentation string per nesting level when `format` is true (default: two spaces)
	 * @param options.ignoreAttributes - Skip all XML attributes during parsing/serialization (default: false)
	 * @param options.attributeNamePrefix - Prefix added to attribute keys in the intermediate object (default: `"@_"`)
	 * @param options.textNodeName - Key used for text content in mixed-content elements (default: `"#text"`)
	 * @param options.omitNullValues - Omit `null`/`undefined` members instead of writing empty elements, matching C# XmlSerializer (default: true); `isNullable` members still emit `xsi:nil`. Set false for the legacy empty-element behavior.
	 * @param options.useXsiType - Emit `xsi:type` attributes for polymorphic types (default: false)
	 * @param options.strictValidation - Throw when a nested object is not properly instantiated (i.e. missing a `type` option or `@XmlDynamic`) (default: false)
	 * @param options.requireAllByDefault - Treat every `@XmlElement`, `@XmlAttribute`, `@XmlArray` and `@XmlText` property as required during deserialization unless `required: false` is explicitly set on the decorator (default: false)
	 *
	 * @example
	 * ```
	 * // Basic serializer
	 * const serializer = new XmlDecoratorSerializer();
	 * ```
	 *
	 * @example
	 * ```
	 * // Suppress XML declaration, use explicit empty-element syntax
	 * const serializer = new XmlDecoratorSerializer({
	 *   omitXmlDeclaration: true,
	 *   emptyElementStyle: 'explicit'
	 * });
	 * ```
	 *
	 * @example
	 * ```
	 * // With DOCTYPE and processing instructions
	 * const advancedSerializer = new XmlDecoratorSerializer({
	 *   processingInstructions: [
	 *     { target: 'xml-stylesheet', data: 'type="text/xsl" href="style.xsl"' }
	 *   ],
	 *   docType: {
	 *     rootElement: 'document',
	 *     publicId: '-//W3C//DTD XHTML 1.0 Strict//EN',
	 *     systemId: 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd'
	 *   }
	 * });
	 * ```
	 *
	 * @example
	 * ```
	 * // Require all decorated properties to be present in XML input
	 * const strictSerializer = new XmlDecoratorSerializer({ requireAllByDefault: true });
	 *
	 * @XmlRoot({ name: 'config' })
	 * class Config {
	 *   @XmlElement({ name: 'host' })            // required (throws if absent)
	 *   host?: string;
	 *
	 *   @XmlElement({ name: 'port', required: false })  // explicitly optional
	 *   port?: number;
	 * }
	 *
	 * strictSerializer.fromXml('<config><host>localhost</host></config>', Config);
	 * // → Config { host: 'localhost', port: undefined }
	 * ```
	 */
	constructor(options: SerializationOptions = {}) {
		// Merge with defaults
		this.options = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };

		// Initialize utilities
		this.namespaceUtil = new XmlNamespaceUtil();
		this.mappingUtil = new XmlMappingUtil(this.options);

		// Configure custom parser
		this.parser = new XmlDecoratorParser({
			attributeNamePrefix: this.options.attributeNamePrefix,
			textNodeName: this.options.textNodeName,
			trimValues: false,
			parseTagValue: true,
			cdataPropName: "__cdata",
		});

		// Configure builder
		this.builder = new XmlBuilder({
			format: this.options.format,
			indentBy: this.options.indent,
			attributeNamePrefix: this.options.attributeNamePrefix,
			textNodeName: this.options.textNodeName,
			cdataPropName: "__cdata",
			emptyElementStyle: this.options.emptyElementStyle,
		});
	}

	/**
	 * Deserializes an XML string into a strongly-typed TypeScript object.
	 *
	 * Parses the XML string and maps elements, attributes, and text content to class properties
	 * based on decorator metadata (@XmlRoot, @XmlElement, @XmlAttribute, etc.). Handles nested
	 * objects, arrays, namespaces, mixed content, CDATA sections, and type conversions.
	 *
	 * @template T The target class type to deserialize into
	 * @param xmlString The XML string to deserialize (must be valid XML)
	 * @param targetClass The class constructor decorated with @XmlRoot
	 * @returns A new instance of the target class with properties populated from XML data
	 *
	 * @throws {Error} If XML is malformed or doesn't match the expected structure
	 * @throws {Error} If required elements or attributes are missing
	 * @throws {Error} If type conversion fails for numeric/boolean values
	 *
	 * @example
	 * // Define your data model with decorators
	 * @XmlRoot({ name: 'Person' })
	 * class Person {
	 *   @XmlAttribute() id!: string;
	 *   @XmlElement() name!: string;
	 *   @XmlElement() age!: number;
	 * }
	 *
	 * // Deserialize XML to typed object
	 * const serializer = new XmlDecoratorSerializer();
	 * const xml = '<Person id="123"><name>John</name><age>30</age></Person>';
	 * const person = serializer.fromXml(xml, Person);
	 * console.log(person.name); // 'John'
	 * console.log(person.age);  // 30 (as number)
	 *
	 * @example
	 * // Nested objects and arrays
	 * @XmlRoot({ name: 'Library' })
	 * class Library {
	 *   @XmlElement() name!: string;
	 *   @XmlArray({ itemName: 'Book', containerName: 'Books' })
	 *   books!: Book[];
	 * }
	 *
	 * @XmlElement({ name: 'Book' })
	 * class Book {
	 *   @XmlAttribute() isbn!: string;
	 *   @XmlElement() title!: string;
	 * }
	 *
	 * const xml = `
	 *   <Library>
	 *     <name>City Library</name>
	 *     <Books>
	 *       <Book isbn="123"><title>Book 1</title></Book>
	 *       <Book isbn="456"><title>Book 2</title></Book>
	 *     </Books>
	 *   </Library>`;
	 * const library = serializer.fromXml(xml, Library);
	 * console.log(library.books.length); // 2
	 * console.log(library.books[0].title); // 'Book 1'
	 *
	 * @example
	 * // With namespaces
	 * @XmlRoot({
	 *   name: 'Document',
	 *   namespace: { uri: 'http://example.com/doc', prefix: 'doc' }
	 * })
	 * class Document {
	 *   @XmlElement({ namespace: { uri: 'http://example.com/doc', prefix: 'doc' } })
	 *   content!: string;
	 * }
	 *
	 * const xml = '<doc:Document xmlns:doc="http://example.com/doc"><doc:content>Hello</doc:content></doc:Document>';
	 * const doc = serializer.fromXml(xml, Document);
	 */
	fromXml<const T extends new (...args: any[]) => any>(xmlString: string, targetClass: T): InstanceType<T> {
		// Parse XML using the custom parser (handles both regular and mixed content)
		const parsed = this.parser.parse(xmlString);

		// Give a subclass the chance to descend into an outer document structure
		// (e.g. a SOAP Envelope > Body) before the payload root is looked up.
		const { node, scope } = this.resolveDocumentBody(parsed);

		// Get or create element metadata (supports undecorated classes)
		const elementMetadata = getOrCreateDefaultElementMetadata(targetClass);

		// Match the root on {namespace-uri, local-name} rather than the literal
		// prefixed string: a peer may answer with any prefix, or a default xmlns,
		// and still mean the same element.
		const elementName = this.namespaceUtil.buildElementName(elementMetadata);
		const expectedUri = elementMetadata.form === "unqualified" ? undefined : elementMetadata.namespaces?.[0]?.uri;
		const rootKey = findElementKey(node, elementName, expectedUri, scope);
		if (rootKey === undefined) {
			throw new Error(`Root element ${elementName} not found in XML`);
		}

		let rootElement = node[rootKey];

		// Convert empty string to empty object for proper deserialization
		if (rootElement === "") {
			rootElement = {};
		}

		// The root's own xmlns declarations extend the scope its descendants resolve in.
		const rootScope = extendNamespaceScope(scope, rootElement);

		return this.mappingUtil.mapToObject(rootElement, targetClass, rootScope);
	}

	/**
	 * Wrap the mapped payload in an outer document structure, returning the element
	 * that should become the document root.
	 *
	 * The base implementation is the identity: the payload *is* the document. A
	 * subclass overrides this to nest the payload — `SoapSerializer` returns a SOAP
	 * `Envelope` containing it.
	 *
	 * @param mappedObj The mapped payload, shaped `{ [rootName]: content }`
	 * @param rootName The payload's element name (namespace prefix included)
	 * @param source The object being serialized, for subclasses that need it
	 */
	protected buildDocumentRoot(mappedObj: any, rootName: string, source: object): { root: any; rootName: string } {
		void source;
		return { root: mappedObj, rootName };
	}

	/**
	 * Descend from the parsed document to the node the payload root lives in, along
	 * with the namespace bindings in scope there.
	 *
	 * The base implementation is the identity: the payload root is at the top of the
	 * document, with no inherited bindings. `SoapSerializer` overrides this to step
	 * through `Envelope > Body`, carrying down the xmlns declarations those elements
	 * make — responses commonly bind the payload's own prefix on the Envelope.
	 */
	protected resolveDocumentBody(parsed: any): { node: any; scope: NamespaceScope } {
		return { node: parsed, scope: EMPTY_NAMESPACE_SCOPE };
	}

	/**
	 * Serializes a strongly-typed TypeScript object into an XML string.
	 *
	 * Converts class properties to XML elements, attributes, and text content based on
	 * decorator metadata. Generates formatted XML with optional indentation, XML declaration,
	 * DOCTYPE, processing instructions, and namespace handling. Supports nested objects,
	 * arrays, CDATA sections, comments, and empty element syntax control.
	 *
	 * @template T The type of object to serialize (must be decorated with @XmlRoot)
	 * @param obj The object instance to convert to XML
	 * @returns A valid XML string representation of the object
	 *
	 * @throws {Error} If the object's class is not decorated with @XmlRoot
	 * @throws {Error} If required properties are missing or invalid
	 *
	 * @example
	 * ```
	 * // Basic serialization
	 * @XmlRoot({ name: 'Person' })
	 * class Person {
	 *   @XmlAttribute() id: string = '123';
	 *   @XmlElement() name: string = 'John';
	 *   @XmlElement() age: number = 30;
	 * }
	 *
	 * const serializer = new XmlDecoratorSerializer();
	 * const person = new Person();
	 * const xml = serializer.toXml(person);
	 * // Output: <?xml version="1.0" encoding="UTF-8"?><Person id="123"><name>John</name><age>30</age></Person>
	 * ```
	 *
	 * @example
	 * ```
	 * // Indentation is on by default; widen it with `indent`
	 * const prettySerializer = new XmlDecoratorSerializer({ indent: '\t' });
	 * const xml = prettySerializer.toXml(person);
	 * // Output:
	 * // <?xml version="1.0" encoding="UTF-8"?>
	 * // <Person id="123">
	 * // \t<name>John</name>
	 * // \t<age>30</age>
	 * // </Person>
	 * ```
	 *
	 * @example
	 * ```
	 * // Compact output — no indentation or line breaks
	 * const compact = new XmlDecoratorSerializer({ format: false });
	 * compact.toXml(person);
	 * // Output: <?xml version="1.0" encoding="UTF-8"?><Person id="123"><name>John</name><age>30</age></Person>
	 * ```
	 *
	 * @example
	 * ```
	 * // Nested objects and arrays
	 * @XmlRoot({ name: 'Library' })
	 * class Library {
	 *   @XmlElement() name: string = 'City Library';
	 *   @XmlArray({ itemName: 'Book', containerName: 'Books' })
	 *   books: Book[] = [
	 *     { isbn: '123', title: 'Book 1' },
	 *     { isbn: '456', title: 'Book 2' }
	 *   ];
	 * }
	 *
	 * const library = new Library();
	 * const xml = serializer.toXml(library);
	 * // Generates: <Library><name>City Library</name><Books><Book isbn="123"><title>Book 1</title></Book>...</Books></Library>
	 * ```
	 *
	 * @example
	 * ```
	 * // With DOCTYPE and processing instructions
	 * const advancedSerializer = new XmlDecoratorSerializer({
	 *   processingInstructions: [
	 *     { target: 'xml-stylesheet', data: 'type="text/xsl" href="style.xsl"' }
	 *   ],
	 *   docType: {
	 *     rootElement: 'document',
	 *     systemId: 'http://example.com/dtd/document.dtd'
	 *   }
	 * });
	 * const xml = advancedSerializer.toXml(document);
	 * // Output:
	 * // <?xml version="1.0" encoding="UTF-8"?>
	 * // <?xml-stylesheet type="text/xsl" href="style.xsl"?>
	 * // <!DOCTYPE document SYSTEM "http://example.com/dtd/document.dtd">
	 * ```
	 *
	 * @example
	 * ```
	 * // Empty element syntax control
	 * @XmlRoot({ name: 'Config' })
	 * class Config {
	 *   @XmlElement() enabled: string = ''; // Empty string
	 *   @XmlElement() name: string = 'test';
	 * }
	 *
	 * // Self-closing (default)
	 * const selfClosing = new XmlDecoratorSerializer({ emptyElementStyle: 'self-closing' });
	 * selfClosing.toXml(config); // <Config><enabled/><name>test</name></Config>
	 *
	 * // Explicit closing
	 * const explicit = new XmlDecoratorSerializer({ emptyElementStyle: 'explicit' });
	 * explicit.toXml(config); // <Config><enabled></enabled><name>test</name></Config>
	 * ```
	 */
	toXml<const T extends object>(obj: T): string {
		// Reset visited objects for circular reference detection
		this.mappingUtil.resetVisitedObjects();

		const ctor = (obj as any).constructor;

		// Get or create element metadata (supports undecorated classes)
		const effectiveMetadata = getOrCreateDefaultElementMetadata(ctor);

		const elementName = this.namespaceUtil.buildElementName(effectiveMetadata);
		const mappedObj = this.mappingUtil.mapFromObject(obj, elementName, effectiveMetadata);

		// Schema hints go on the payload root, before namespaces are collected — they
		// are xsi: attributes, so their presence is what pulls in the xsi declaration.
		this.addSchemaLocation(mappedObj[elementName]);

		// Collect and add all namespace declarations (including XSI if needed)
		const allNamespaces = this.namespaceUtil.collectAllNamespaces(obj);
		this.namespaceUtil.addNamespaceDeclarations(mappedObj, elementName, allNamespaces);

		// Give a subclass the chance to wrap the mapped payload in an outer document
		// structure (e.g. a SOAP Envelope). Done before the dedupe below so that pass
		// walks from the real document root.
		const document = this.buildDocumentRoot(mappedObj, elementName, obj);

		// Drop nested xmlns declarations already bound by an ancestor to the same URI,
		// and reset (xmlns="") namespace-free elements nested under a default namespace
		this.namespaceUtil.dedupeNamespaceDeclarations(
			document.root,
			document.rootName,
			this.mappingUtil.getNamespaceFreeContent(),
		);

		const xmlBody = this.builder.build(document.root);

		// Build the final XML document. The prolog is separated by line breaks only
		// when formatting; a compact document stays on one line throughout.
		let result = "";
		const separator = this.options.format === false ? "" : "\n";

		// Add XML declaration
		if (!this.options.omitXmlDeclaration) {
			result += `${this.generateXmlDeclaration()}${separator}`;
		}

		// Add processing instructions
		if (this.options.processingInstructions && this.options.processingInstructions.length > 0) {
			for (const pi of this.options.processingInstructions) {
				result += `${this.generateProcessingInstruction(pi)}${separator}`;
			}
		}

		// Add DOCTYPE declaration
		if (this.options.docType) {
			result += `${this.generateDocType(this.options.docType)}${separator}`;
		}

		result += xmlBody;

		return result;
	}

	/**
	 * Write the configured `xsi:schemaLocation` / `xsi:noNamespaceSchemaLocation`
	 * onto the document root.
	 *
	 * `schemaLocation` is a flat list of alternating namespace URI and location, so
	 * the map's entries are joined pairwise into one space-separated string.
	 */
	private addSchemaLocation(root: any): void {
		if (typeof root !== "object" || root === null) return;

		const { schemaLocation, noNamespaceSchemaLocation } = this.options;
		const prefix = this.options.attributeNamePrefix ?? "@_";

		const pairs = Object.entries(schemaLocation ?? {});
		if (pairs.length > 0) {
			root[`${prefix}xsi:schemaLocation`] = pairs.map(([uri, location]) => `${uri} ${location}`).join(" ");
		}
		if (noNamespaceSchemaLocation) {
			root[`${prefix}xsi:noNamespaceSchemaLocation`] = noNamespaceSchemaLocation;
		}
	}

	/**
	 * Generate XML declaration.
	 */
	private generateXmlDeclaration(): string {
		let declaration = `<?xml version="${this.options.xmlVersion}"`;

		if (this.options.encoding) {
			declaration += ` encoding="${this.options.encoding}"`;
		}

		if (this.options.standalone !== undefined) {
			declaration += ` standalone="${this.options.standalone ? "yes" : "no"}"`;
		}

		declaration += `?>`;
		return declaration;
	}

	/**
	 * Generate processing instruction.
	 */
	private generateProcessingInstruction(pi: { target: string; data: string }): string {
		return `<?${pi.target} ${pi.data}?>`;
	}

	/**
	 * Generate DOCTYPE declaration.
	 */
	private generateDocType(docType: {
		rootElement: string;
		publicId?: string;
		systemId?: string;
		internalSubset?: string;
	}): string {
		let docTypeStr = `<!DOCTYPE ${docType.rootElement}`;

		if (docType.publicId && docType.systemId) {
			docTypeStr += ` PUBLIC "${docType.publicId}" "${docType.systemId}"`;
		} else if (docType.systemId) {
			docTypeStr += ` SYSTEM "${docType.systemId}"`;
		}

		if (docType.internalSubset) {
			docTypeStr += ` [${docType.internalSubset}]`;
		}

		docTypeStr += `>`;
		return docTypeStr;
	}
}
