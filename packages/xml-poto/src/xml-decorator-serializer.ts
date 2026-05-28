/* eslint-disable typescript/no-explicit-any -- Serializer works with dynamic objects during XML conversion */
import { DEFAULT_SERIALIZATION_OPTIONS, SerializationOptions } from "./serialization-options";
import { getOrCreateDefaultElementMetadata, XmlMappingUtil, XmlNamespaceUtil } from "./utils";
import { XmlBuilder } from "./xml-builder";
import { XmlDecoratorParser } from "./xml-decorator-parser";

/**
 * Main XML serialization class that orchestrates the conversion between
 * typed objects and XML strings using decorator metadata.
 */
export class XmlDecoratorSerializer {
	private parser: XmlDecoratorParser;
	private builder: XmlBuilder;
	private options: SerializationOptions;
	private namespaceUtil: XmlNamespaceUtil;
	private mappingUtil: XmlMappingUtil;

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
	 * @param options.ignoreAttributes - Skip all XML attributes during parsing/serialization (default: false)
	 * @param options.attributeNamePrefix - Prefix added to attribute keys in the intermediate object (default: `"@_"`)
	 * @param options.textNodeName - Key used for text content in mixed-content elements (default: `"#text"`)
	 * @param options.omitNullValues - Skip `null`/`undefined` values instead of writing empty elements (default: false)
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
			format: true,
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

		// Get or create element metadata (supports undecorated classes)
		const elementMetadata = getOrCreateDefaultElementMetadata(targetClass);

		// Handle namespaced element names
		const elementName = this.namespaceUtil.buildElementName(elementMetadata);
		let rootElement = parsed[elementName];
		if (rootElement === undefined) {
			throw new Error(`Root element ${elementName} not found in XML`);
		}

		// Convert empty string to empty object for proper deserialization
		if (rootElement === "") {
			rootElement = {};
		}

		return this.mappingUtil.mapToObject(rootElement, targetClass);
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
	 * // Formatted output with indentation
	 * const prettySerializer = new XmlDecoratorSerializer({
	 *   indent: '  ',
	 *   newLine: '\n'
	 * });
	 * const xml = prettySerializer.toXml(person);
	 * // Output:
	 * // <?xml version="1.0" encoding="UTF-8"?>
	 * // <Person id="123">
	 * //   <name>John</name>
	 * //   <age>30</age>
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

		// Collect and add all namespace declarations (including XSI if needed)
		const allNamespaces = this.namespaceUtil.collectAllNamespaces(obj);
		this.namespaceUtil.addNamespaceDeclarations(mappedObj, elementName, allNamespaces);

		const xmlBody = this.builder.build(mappedObj);

		// Build the final XML document
		let result = "";

		// Add XML declaration
		if (!this.options.omitXmlDeclaration) {
			result += `${this.generateXmlDeclaration()}\n`;
		}

		// Add processing instructions
		if (this.options.processingInstructions && this.options.processingInstructions.length > 0) {
			for (const pi of this.options.processingInstructions) {
				result += `${this.generateProcessingInstruction(pi)}\n`;
			}
		}

		// Add DOCTYPE declaration
		if (this.options.docType) {
			result += `${this.generateDocType(this.options.docType)}\n`;
		}

		result += xmlBody;

		return result;
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
