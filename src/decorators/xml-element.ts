import { DynamicElement } from "../query/dynamic-element";
import { registerDynamicMetadata, registerFieldElementMetadata, registerPropertyMapping } from "./storage";
import { getMetadata } from "./storage/metadata-storage";
import { XmlElementMetadata, XmlElementOptions } from "./types";
import { PENDING_DYNAMIC_SYMBOL } from "./xml-dynamic";

// Symbol to store pending field element metadata that needs to be processed by class decorators
const PENDING_FIELD_ELEMENT_SYMBOL = Symbol.for("pendingFieldElement");

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
			// Handle string argument (e.g., @XmlElement("elementName"))
			const xmlName = typeof nameOrOptions === "string" ? nameOrOptions : options.name || String(context.name);

			const elementMetadata: XmlElementMetadata = {
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

			// Store comprehensive metadata on the class itself using unified storage
			getMetadata(target).element = elementMetadata;

			// Check for pending queryable metadata and register it
			// This is needed because addInitializer doesn't work in some environments
			if (context.metadata && (context.metadata as any)[PENDING_DYNAMIC_SYMBOL]) {
				const pendingQueryables = (context.metadata as any)[PENDING_DYNAMIC_SYMBOL];

				for (const { metadata } of pendingQueryables) {
					registerDynamicMetadata(target, metadata);
				}

				// Set up property descriptors on prototype at class definition time
				// This is crucial for Stage 3 decorators where field initialization happens after
				// the initializer runs, so we need to define the getter/setter on the prototype
				// to ensure they work correctly via prototype chain
				const elementName =
					typeof nameOrOptions === "string" ? nameOrOptions : (nameOrOptions as XmlElementOptions)?.name || target.name;

				for (const { propertyKey, metadata } of pendingQueryables) {
					if (!metadata.lazyLoad) {
						// Immediate loading: auto-create DynamicElement on first access
						const storageKey = Symbol.for(`__xmlDynamic_${target.name}_${propertyKey}`);

						const getter = function (this: any) {
							// Return existing value if already set
							if (this[storageKey] !== undefined) {
								return this[storageKey];
							}

							// Auto-create a default empty DynamicElement
							const newValue = new DynamicElement({
								name: elementName,
								attributes: {},
							});

							this[storageKey] = newValue;
							return newValue;
						};

						const setter = function (this: any, value: any) {
							this[storageKey] = value;
							// Also create an own property descriptor to ensure serializers see it
							Object.defineProperty(this, propertyKey, {
								get: getter,
								set: setter,
								enumerable: true,
								configurable: true,
							});
						};

						// Define on prototype
						Object.defineProperty(target.prototype, propertyKey, {
							get: getter,
							set: setter,
							enumerable: true,
							configurable: true,
						});
					} else {
						// Lazy loading mode: use getter/setter with builder function
						const cachedValueKey = Symbol.for(`dynamic_cache_${target.name}_${propertyKey}`);
						const builderKey = Symbol.for(`dynamic_builder_${target.name}_${propertyKey}`);

						const getter = function (this: any) {
							const cacheEnabled = metadata.cache;

							// Return cached value if caching is enabled
							if (cacheEnabled && this[cachedValueKey] !== undefined) {
								return this[cachedValueKey];
							}

							// Build DynamicElement lazily using stored builder function
							if (this[builderKey]) {
								const element = this[builderKey]();

								// Cache the result if caching is enabled
								if (cacheEnabled) {
									this[cachedValueKey] = element;
								}

								return element;
							}

							// Return undefined if no builder is set
							return undefined;
						};

						const setter = function (this: any, value: any) {
							if (metadata.cache) {
								this[cachedValueKey] = value;
							}
							// Clear builder if value is set manually
							delete this[builderKey];
							// Also create an own property descriptor to ensure serializers see it
							Object.defineProperty(this, propertyKey, {
								get: getter,
								set: setter,
								enumerable: true,
								configurable: true,
							});
						};

						// Define on prototype
						Object.defineProperty(target.prototype, propertyKey, {
							get: getter,
							set: setter,
							enumerable: true,
							configurable: true,
						});
					}
				}
			}

			return target;
		} else if (context.kind === "field") {
			// Field decorator usage
			const options = (typeof nameOrOptions === "object" ? nameOrOptions : {}) || {};
			const xmlName = typeof nameOrOptions === "string" ? nameOrOptions : options.name || String(context.name);
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

			// Store pending metadata in context.metadata for class decorators to process
			// This ensures metadata is available at class definition time for namespace collection
			if (!context.metadata) {
				(context as any).metadata = {};
			}
			if (!(context.metadata as any)[PENDING_FIELD_ELEMENT_SYMBOL]) {
				(context.metadata as any)[PENDING_FIELD_ELEMENT_SYMBOL] = [];
			}
			(context.metadata as any)[PENDING_FIELD_ELEMENT_SYMBOL].push({
				propertyKey,
				metadata: fieldElementMetadata,
				xmlName,
			});

			return function (this: any, initialValue: any): any {
				// Metadata will be registered by class decorator
				// But also register here for classes without class decorators
				const ctor = this.constructor;
				registerFieldElementMetadata(ctor, propertyKey, fieldElementMetadata);
				registerPropertyMapping(ctor, propertyKey, xmlName);
				return initialValue;
			};
		}

		throw new Error(`XmlElement decorator can only be used on classes or fields, not ${context.kind}`);
	}) as any;
}
