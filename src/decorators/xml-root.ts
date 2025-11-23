import { rootMetadataStorage } from "./storage";
import { XmlRootMetadata, XmlRootOptions } from "./types";

/**
 * Decorator to mark a class as the root element of an XML document.
 *
 * This decorator defines the top-level XML element that wraps your entire document structure.
 * Use it to specify the root element name, namespace, and xml:space attribute handling.
 * Required for classes used with {@link XmlDecoratorSerializer.toXml} and {@link XmlDecoratorSerializer.fromXml}.
 *
 * @param options Configuration options for the root element
 * @param options.elementName - Custom XML element name (defaults to class name)
 * @param options.namespace - XML namespace configuration with URI and prefix
 * @param options.dataType - Expected data type for validation
 * @param options.isNullable - Whether null values are allowed
 * @param options.xmlSpace - Controls whitespace handling: 'default' or 'preserve'
 * @returns A class decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Basic root element
 * @XmlRoot({ elementName: 'Person' })
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
 *   elementName: 'Document',
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
 *   elementName: 'Code',
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
export function XmlRoot(options: XmlRootOptions = {}) {
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		const rootMetadata: XmlRootMetadata = {
			elementName: options.elementName || String(context.name),
			namespace: options.namespace,
			dataType: options.dataType,
			isNullable: options.isNullable,
			xmlSpace: options.xmlSpace,
		};

		// Store root metadata
		rootMetadataStorage.set(target, rootMetadata);

		return target;
	};
}
