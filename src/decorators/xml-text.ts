import { registerPropertyMapping, registerTextMetadata } from "./storage";
import { XmlTextMetadata, XmlTextOptions } from "./types";

/**
 * Decorator to map a class property to the text content of an XML element.
 *
 * Use this decorator when an element contains only text (no child elements) or for
 * mixed content scenarios. Supports CDATA sections for special characters, custom
 * type conversion, and required field validation.
 *
 * @param options Configuration options for the XML text content
 * @param options.converter - Custom value converter for serialization/deserialization
 * @param options.required - Whether this text content is required (validation)
 * @param options.dataType - Expected data type (string, number, boolean, etc.)
 * @param options.useCDATA - Wrap text in CDATA section to preserve special characters
 * @param options.xmlName - Custom XML element name for property mapping
 * @returns A field decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Simple text content
 * @XmlRoot({ elementName: 'Message' })
 * class Message {
 *   @XmlAttribute() id!: string;
 *   @XmlText() content!: string;
 * }
 *
 * // Serializes to: <Message id="123">Hello, World!</Message>
 * ```
 *
 * @example
 * ```
 * // Text with CDATA for special characters
 * @XmlRoot({ elementName: 'Code' })
 * class CodeBlock {
 *   @XmlAttribute() language!: string;
 *   @XmlText({ useCDATA: true }) code!: string;
 * }
 *
 * // Serializes to: <Code language="js"><![CDATA[if (x < 5 && y > 10) { }]]></Code>
 * ```
 *
 * @example
 * ```
 * // Required text content
 * @XmlRoot({ elementName: 'Description' })
 * class Description {
 *   @XmlText({ required: true }) text!: string;  // Must have text content
 * }
 * ```
 *
 * @example
 * ```
 * // Numeric text content with type conversion
 * @XmlRoot({ elementName: 'Price' })
 * class Price {
 *   @XmlAttribute() currency!: string;
 *   @XmlText({ dataType: 'number' }) amount!: number;
 * }
 *
 * // Serializes to: <Price currency="USD">99.99</Price>
 * // Deserializes '99.99' as number 99.99
 * ```
 *
 * @example
 * ```
 * // Custom converter for Date objects
 * @XmlRoot({ elementName: 'Timestamp' })
 * class Timestamp {
 *   @XmlText({
 *     converter: {
 *       serialize: (date: Date) => date.toISOString(),
 *       deserialize: (str: string) => new Date(str)
 *     }
 *   })
 *   value!: Date;
 * }
 *
 * // Serializes to: <Timestamp>2024-01-15T10:30:00.000Z</Timestamp>
 * ```
 *
 * @example
 * ```
 * // Mixed with attributes
 * @XmlRoot({ elementName: 'Link' })
 * class Link {
 *   @XmlAttribute() href!: string;
 *   @XmlAttribute() target?: string;
 *   @XmlText() linkText!: string;
 * }
 *
 * // Serializes to: <Link href="https://example.com" target="_blank">Click here</Link>
 * ```
 */
export function XmlText(
	options: XmlTextOptions = {}
): <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>) => (initialValue: V) => V {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const textMetadata: XmlTextMetadata = {
			converter: options.converter,
			required: options.required ?? false,
			dataType: options.dataType,
			useCDATA: options.useCDATA,
		};

		// Store metadata during first instance creation
		let metadataStored = false;

		// Return a field initializer that stores metadata on first use
		return function (this: any, initialValue: V): V {
			if (!metadataStored) {
				const ctor = this.constructor;

				// Use helper function to register text metadata
				registerTextMetadata(ctor, propertyKey, textMetadata);

				// Store property mapping if xmlName is provided
				if (options.xmlName) {
					registerPropertyMapping(ctor, propertyKey, options.xmlName);
				}

				metadataStored = true;
			}
			return initialValue;
		};
	};
}
