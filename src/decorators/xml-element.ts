import { registerFieldElementMetadata, registerPropertyMapping } from "./storage";
import { getMetadata } from "./storage/metadata-storage";
import { XmlElementMetadata, XmlElementOptions } from "./types";

/**
 * Decorator to map a class or property to an XML element.
 *
 * Can be used on classes (for nested elements) or properties (for child elements).
 * Supports complex features like CDATA sections, mixed content, union types, default values,
 * namespaces, and xml:space attribute control.
 *
 * @param nameOrOptions Element name (string) or configuration options (object)
 * @returns A decorator function that can be used on classes or fields
 *
 * @example
 * ```
 * // Simple property mapping
 * @XmlRoot({ elementName: 'Person' })
 * class Person {
 *   @XmlElement() name!: string;        // <name>value</name>
 *   @XmlElement('full-name') fullName!: string;  // Custom element name
 * }
 * ```
 *
 * @example
 * ```
 * // Nested objects
 * @XmlRoot({ elementName: 'Company' })
 * class Company {
 *   @XmlElement() name!: string;
 *   @XmlElement() address!: Address;    // Nested element
 * }
 *
 * @XmlElement({ name: 'Address' })
 * class Address {
 *   @XmlElement() street!: string;
 *   @XmlElement() city!: string;
 * }
 *
 * // Serializes to:
 * // <Company>
 * //   <name>Acme Corp</name>
 * //   <Address>
 * //     <street>123 Main St</street>
 * //     <city>Springfield</city>
 * //   </Address>
 * // </Company>
 * ```
 *
 * @example
 * ```
 * // CDATA sections for special characters
 * @XmlRoot({ elementName: 'Article' })
 * class Article {
 *   @XmlElement({ useCDATA: true }) content!: string;
 * }
 *
 * // Serializes to: <Article><content><![CDATA[<script>...</script>]]></content></Article>
 * ```
 *
 * @example
 * ```
 * // Mixed content (text and elements)
 * @XmlRoot({ elementName: 'Paragraph' })
 * class Paragraph {
 *   @XmlElement({ mixedContent: true }) content!: any;
 * }
 *
 * // Can contain: <Paragraph>Some text <bold>highlighted</bold> more text</Paragraph>
 * ```
 *
 * @example
 * ```
 * // Required elements with validation
 * @XmlRoot({ elementName: 'User' })
 * class User {
 *   @XmlElement({ required: true }) username!: string;  // Must be present
 *   @XmlElement({ required: false }) nickname?: string; // Optional
 * }
 * ```
 *
 * @example
 * ```
 * // Default values
 * @XmlRoot({ elementName: 'Settings' })
 * class Settings {
 *   @XmlElement({ defaultValue: 'enabled' }) status: string = 'enabled';
 * }
 * ```
 *
 * @example
 * ```
 * // Preserve whitespace for specific element
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlElement({ xmlSpace: 'preserve' }) code!: string;
 * }
 * ```
 *
 * @example
 * ```
 * // With namespace
 * @XmlRoot({ elementName: 'Root' })
 * class Root {
 *   @XmlElement({
 *     name: 'CustomElement',
 *     namespace: { uri: 'http://example.com/ns', prefix: 'ex' }
 *   })
 *   custom!: string;
 * }
 *
 * // Serializes to: <Root><ex:CustomElement xmlns:ex="http://example.com/ns">...</ex:CustomElement></Root>
 * ```
 */
export function XmlElement(nameOrOptions?: string | XmlElementOptions): {
	<T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T;
	<T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): (initialValue: V) => V;
} {
	return ((target: any, context: any) => {
		if (context.kind === "class") {
			// Class decorator usage
			const options = (typeof nameOrOptions === "object" ? nameOrOptions : {}) || {};
			const elementMetadata: XmlElementMetadata = {
				name: options.name || String(context.name),
				namespace: options.namespace,
				required: options.required ?? false,
				order: options.order,
				dataType: options.dataType,
				isNullable: options.isNullable,
				form: options.form,
				type: options.type,
				useCDATA: options.useCDATA,
				unionTypes: options.unionTypes,
				mixedContent: options.mixedContent,
				defaultValue: options.defaultValue,
				xmlSpace: options.xmlSpace,
			};

			// Store comprehensive metadata on the class itself using unified storage
			getMetadata(target).element = elementMetadata;

			return target;
		} else if (context.kind === "field") {
			// Field decorator usage
			const options = (typeof nameOrOptions === "object" ? nameOrOptions : {}) || {};
			const xmlName = typeof nameOrOptions === "string" ? nameOrOptions : options.name || String(context.name);

			return function (this: any, initialValue: any): any {
				const ctor = this.constructor;
				const propertyKey = String(context.name);

				// Store field-level element metadata (including namespace)
				const fieldElementMetadata: XmlElementMetadata = {
					name: xmlName,
					namespace: options.namespace,
					required: options.required ?? false,
					order: options.order,
					dataType: options.dataType,
					isNullable: options.isNullable,
					form: options.form,
					type: options.type,
					useCDATA: options.useCDATA,
					unionTypes: options.unionTypes,
					mixedContent: options.mixedContent,
					defaultValue: options.defaultValue,
					xmlSpace: options.xmlSpace,
				};

				// Use helper functions to register metadata
				registerFieldElementMetadata(ctor, propertyKey, fieldElementMetadata);
				registerPropertyMapping(ctor, propertyKey, xmlName);
				return initialValue;
			};
		}

		throw new Error(`XmlElement decorator can only be used on classes or fields, not ${context.kind}`);
	}) as any;
}
