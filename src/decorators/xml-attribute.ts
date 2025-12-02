import { registerAttributeMetadata } from "./storage";
import { XmlAttributeMetadata, XmlAttributeOptions, XmlNamespace } from "./types";

// Symbol to store pending attribute metadata that needs to be processed by class decorators
const PENDING_ATTRIBUTE_SYMBOL = Symbol.for("pendingAttribute");

/**
 * Decorator to map a class property to an XML attribute.
 *
 * Attributes appear in the opening tag of an element and are typically used for
 * metadata or simple values. Supports custom names, namespaces, required validation,
 * type conversion, pattern validation, and enum constraints.
 *
 * @param options Configuration options for the XML attribute
 * @param options.name - Custom attribute name (defaults to property name)
 * @param options.namespace - XML namespace configuration with URI and prefix
 * @param options.required - Whether this attribute is required (validation)
 * @param options.converter - Custom value converter function
 * @param options.pattern - Regular expression pattern for validation
 * @param options.enumValues - Array of allowed values for enum validation
 * @param options.dataType - Expected data type (string, number, boolean, etc.)
 * @param options.defaultValue - Default value if attribute is missing
 * @returns A field decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Basic attribute mapping
 * @XmlRoot({ elementName: 'Person' })
 * class Person {
 *   @XmlAttribute() id!: string;
 *   @XmlAttribute() active!: boolean;
 *   @XmlElement() name!: string;
 * }
 *
 * // Serializes to: <Person id="123" active="true"><name>John</name></Person>
 * ```
 *
 * @example
 * ```
 * // Custom attribute name
 * @XmlRoot({ elementName: 'Product' })
 * class Product {
 *   @XmlAttribute({ name: 'product-id' }) id!: string;
 *   @XmlAttribute({ name: 'data-price' }) price!: number;
 * }
 *
 * // Serializes to: <Product product-id="P001" data-price="29.99"/>
 * ```
 *
 * @example
 * ```
 * // Required attributes with validation
 * @XmlRoot({ elementName: 'User' })
 * class User {
 *   @XmlAttribute({ required: true }) username!: string;  // Must be present
 *   @XmlAttribute({ required: false }) role?: string;     // Optional
 * }
 * ```
 *
 * @example
 * ```
 * // Enum validation
 * @XmlRoot({ elementName: 'Status' })
 * class Status {
 *   @XmlAttribute({
 *     enumValues: ['active', 'inactive', 'pending']
 *   })
 *   state!: string;
 * }
 * ```
 *
 * @example
 * ```
 * // Pattern validation
 * @XmlRoot({ elementName: 'Contact' })
 * class Contact {
 *   @XmlAttribute({
 *     pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
 *   })
 *   email!: string;
 * }
 * ```
 *
 * @example
 * ```
 * // With namespace
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlAttribute({
 *     name: 'version',
 *     namespace: { uri: 'http://example.com/meta', prefix: 'meta' }
 *   })
 *   version!: string;
 * }
 *
 * // Serializes to: <Document xmlns:meta="http://example.com/meta" meta:version="1.0"/>
 * ```
 *
 * @example
 * ```
 * // Type conversion with converter
 * @XmlRoot({ elementName: 'Event' })
 * class Event {
 *   @XmlAttribute({
 *     converter: {
 *       serialize: (date: Date) => date.toISOString(),
 *       deserialize: (str: string) => new Date(str)
 *     }
 *   })
 *   timestamp!: Date;
 * }
 * ```
 */
export function XmlAttribute(
	options: XmlAttributeOptions = {}
): <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>) => (initialValue: V) => V {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);

		// Combine namespace and namespaces into single array
		const allNamespaces: XmlNamespace[] = [];
		if (options.namespace) {
			allNamespaces.push(options.namespace);
		}
		if (options.namespaces) {
			allNamespaces.push(...options.namespaces);
		}

		const attributeMetadata: XmlAttributeMetadata = {
			name: options.name || propertyKey,
			namespaces: allNamespaces.length > 0 ? allNamespaces : undefined,
			required: options.required ?? false,
			converter: options.converter,
			pattern: options.pattern,
			enumValues: options.enumValues,
			dataType: options.dataType,
			form: options.form,
			type: options.type,
			defaultValue: options.defaultValue,
		};

		// Store pending metadata in context.metadata for class decorators to process
		// This ensures metadata is available at class definition time for classes with decorators
		if (!context.metadata) {
			(context as any).metadata = {};
		}
		if (!(context.metadata as any)[PENDING_ATTRIBUTE_SYMBOL]) {
			(context.metadata as any)[PENDING_ATTRIBUTE_SYMBOL] = [];
		}
		(context.metadata as any)[PENDING_ATTRIBUTE_SYMBOL].push({
			propertyKey,
			metadata: attributeMetadata,
		});

		// Return a field initializer that does the registration
		// This is still needed for classes without decorators
		return function (this: any, initialValue: V): V {
			const ctor = this.constructor;

			// Store using our existing registration system
			registerAttributeMetadata(ctor, propertyKey, attributeMetadata);

			return initialValue;
		};
	};
}
