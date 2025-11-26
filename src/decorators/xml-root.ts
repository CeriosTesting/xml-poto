import { getMetadata } from "./storage/metadata-storage";
import { XmlRootMetadata, XmlRootOptions } from "./types";

/**
 * Decorator to mark a class as the root element of an XML document.
 *
 * This decorator defines the top-level XML element that wraps your entire document structure.
 * Use it to specify the root element name, namespace, and xml:space attribute handling.
 * Required for classes used with {@link XmlDecoratorSerializer.toXml} and {@link XmlDecoratorSerializer.fromXml}.
 *
 * @param options Configuration options for the root element
 * @param options.name - Custom XML element name (defaults to class name)
 * @param options.elementName - DEPRECATED: Use options.name instead
 * @param options.namespace - XML namespace configuration with URI and prefix
 * @param options.dataType - Expected data type for validation
 * @param options.isNullable - Whether null values are allowed
 * @param options.xmlSpace - Controls whitespace handling: 'default' or 'preserve'
 * @returns A class decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Basic root element
 * @XmlRoot({ name: 'Person' })
 * class Person {
 *   @XmlElement() name!: string;
 *   @XmlElement() age!: number;
 * }
 *
 * // Serializes to: <Person><name>John</name><age>30</age></Person>
 * ```
 *
 * @example
 * ```
 * // With namespace
 * @XmlRoot({
 *   name: 'Document',
 *   namespace: { uri: 'http://example.com/doc', prefix: 'doc' }
 * })
 * class Document {
 *   @XmlElement() title!: string;
 * }
 *
 * // Serializes to: <doc:Document xmlns:doc="http://example.com/doc"><title>...</title></doc:Document>
 * ```
 *
 * @example
 * ```
 * // Preserve whitespace in all child elements
 * @XmlRoot({
 *   name: 'Code',
 *   xmlSpace: 'preserve'
 * })
 * class CodeBlock {
 *   @XmlText() code!: string;
 * }
 *
 * // Preserves exact formatting and whitespace in the <Code> element
 * ```
 *
 * @example
 * ```
 * // Using class name as element name (default)
 * @XmlRoot() // Generates <Book>...</Book>
 * class Book {
 *   @XmlElement() title!: string;
 * }
 * ```
 */
export function XmlRoot(
	options: XmlRootOptions = {}
): <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>) => T {
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		// Support both new 'name' and legacy 'elementName' properties
		const elementName = options.name || options.elementName || String(context.name);

		const rootMetadata: XmlRootMetadata = {
			name: elementName,
			namespace: options.namespace,
			dataType: options.dataType,
			isNullable: options.isNullable,
			xmlSpace: options.xmlSpace,
			// Keep elementName for backward compatibility
			elementName: elementName,
		};

		// Store root metadata in unified storage
		getMetadata(target).root = rootMetadata;

		return target;
	};
}
