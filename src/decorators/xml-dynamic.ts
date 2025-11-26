import type { DynamicElement } from "../query/dynamic-element";
import { registerDynamicMetadata } from "./storage";
import { getMetadata } from "./storage/metadata-storage";
import type { XmlDynamicOptions } from "./types";

// Symbol to store pending queryable metadata on class prototypes
// This allows class decorators to find and register them
export const PENDING_DYNAMIC_SYMBOL = Symbol.for("xml-poto:pending-dynamics");

/**
 * Decorator to create a dynamic, bi-directional XML interface with mutation capabilities.
 *
 * This is the recommended decorator for bi-directional XML manipulation. It creates a property
 * that provides both query and mutation capabilities through DynamicElement. Supports reading,
 * writing, and modifying XML structures dynamically.
 *
 * Key Features:
 * - Fluent query API for finding and filtering elements
 * - Mutation methods to add, delete, and update elements
 * - Attribute manipulation (set, remove)
 * - Text content updates
 * - Bi-directional: parse from XML and serialize back to XML
 * - Tree navigation and manipulation
 *
 * @param options Configuration options for the dynamic element
 * @param options.targetProperty - Specific property to query (default: root element)
 * @param options.required - Whether the dynamic element is required
 * @param options.parseChildren - Parse child elements (default: true)
 * @param options.parseNumeric - Auto-parse numeric values (default: true)
 * @param options.parseBoolean - Auto-parse boolean values (default: true)
 * @param options.trimValues - Trim whitespace from text values (default: true)
 * @param options.preserveRawText - Keep original text with whitespace (default: false)
 * @param options.maxDepth - Maximum depth to parse for performance optimization
 * @param options.cache - Cache query results for repeated queries (default: true)
 * @param options.lazyLoad - Use lazy loading (default: false). When true, DynamicElement is built on first access
 * @returns A field decorator function that creates a DynamicElement property
 *
 * @example
 * ```
 * // Dynamic XML manipulation
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlDynamic()
 *   dynamic!: DynamicElement;  // Use DynamicElement type
 * }
 *
 * const xml = '<Document><title>My Doc</title></Document>';
 * const doc = serializer.fromXml(xml, Document);
 *
 * // Query elements
 * const title = doc.dynamic.find('title').first();
 *
 * // Modify elements
 * title?.setText('Updated Title');
 * title?.setAttribute('lang', 'en');
 *
 * // Add new elements
 * doc.dynamic.createChild({ name: 'author', text: 'John Doe' });
 *
 * // Serialize back to XML
 * const updatedXml = doc.dynamic.toXml({ indent: '  ' });
 * ```
 *
 * @example
 * ```
 * // Batch operations on multiple elements
 * @XmlRoot({ elementName: 'Catalog' })
 * class Catalog {
 *   @XmlDynamic()
 *   dynamic!: DynamicElement;  // Use DynamicElement type
 * }
 *
 * const catalog = serializer.fromXml(catalogXml, Catalog);
 *
 * // Query and create a fluent API for batch operations
 * const query = new XmlQuery([catalog.dynamic]);
 *
 * // Update all products with price > 100
 * query.find('Product')
 *   .whereValueGreaterThan(100)
 *   .setAttr('premium', 'true');
 *
 * // Remove discontinued items
 * query.find('Product')
 *   .whereAttribute('status', 'discontinued')
 *   .removeElements();
 *
 * // Serialize back
 * const xml = catalog.dynamic.toXml({ indent: '  ', includeDeclaration: true });
 * ```
 *
 * @example
 * ```
 * // Create XML from scratch (auto-initialization with lazyLoad: false)
 * @XmlRoot({ elementName: 'Config' })
 * class Config {
 *   @XmlDynamic({ lazyLoad: false })  // Auto-creates DynamicElement on first access
 *   dynamic!: DynamicElement;
 * }
 *
 * const config = new Config();
 *
 * // DynamicElement is automatically created with root element name
 * config.dynamic.setAttribute('version', '1.0');
 *
 * // Build structure
 * const settings = config.dynamic.createChild({ name: 'Settings' });
 * settings.createChild({ name: 'Theme', text: 'dark' });
 * settings.createChild({ name: 'Language', text: 'en' });
 *
 * // Generate XML
 * const xml = config.dynamic.toXml({ indent: '  ', includeDeclaration: true });
 * ```
 */
export function XmlDynamic(options: XmlDynamicOptions = {}) {
	return <T, V extends DynamicElement | undefined>(
		_target: undefined,
		context: ClassFieldDecoratorContext<T, V>
	): void => {
		const propertyKey = String(context.name);

		const metadata = {
			propertyKey,
			targetProperty: options.targetProperty,
			required: options.required ?? false,
			parseChildren: options.parseChildren ?? true,
			parseNumeric: options.parseNumeric ?? true,
			parseBoolean: options.parseBoolean ?? true,
			trimValues: options.trimValues ?? true,
			preserveRawText: options.preserveRawText ?? false,
			maxDepth: options.maxDepth,
			cache: options.cache ?? true, // Enable caching by default for performance
			lazyLoad: options.lazyLoad ?? false, // Immediate loading by default
		};

		// Store in shared metadata object for class decorator to find
		if (context.metadata) {
			if (!(context.metadata as any)[PENDING_DYNAMIC_SYMBOL]) {
				(context.metadata as any)[PENDING_DYNAMIC_SYMBOL] = [];
			}
			(context.metadata as any)[PENDING_DYNAMIC_SYMBOL].push({ propertyKey, metadata });
		}

		// Store metadata during class initialization
		context.addInitializer(function (this: any) {
			const ctor = this.constructor;

			// Use helper function to register queryable metadata
			registerDynamicMetadata(ctor, metadata);

			// Setup lazy loading via property descriptor
			// Use unique symbols for cache and builder keys to avoid property name collisions
			const cachedValueKey = Symbol.for(`dynamic_cache_${ctor.name}_${propertyKey}`);
			const builderKey = Symbol.for(`dynamic_builder_${ctor.name}_${propertyKey}`);

			if (metadata.lazyLoad) {
				// Lazy loading mode: use getter/setter with builder function
				Object.defineProperty(this, propertyKey, {
					get(this: any): V {
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

						// Return undefined if no builder is set (not yet initialized)
						// This is normal for optional queryable elements
						//
						// Note: If this class was not properly instantiated (e.g., missing type parameter
						// in parent's @XmlRoot or @XmlElement), this decorator never runs and this getter is never
						// defined. The property will simply be undefined on the plain Object.
						return undefined as V;
					},
					set(this: any, value: V) {
						// Allow manual override of the queryable element
						if (metadata.cache) {
							this[cachedValueKey] = value;
						}
						// Clear builder if value is set manually
						delete this[builderKey];
					},
					enumerable: true,
					configurable: true,
				});
			} else {
				// Immediate loading mode: use getter to auto-create DynamicElement on first access
				let internalValue: V | undefined;

				Object.defineProperty(this, propertyKey, {
					get(this: any): V {
						// Return existing value if already set
						if (internalValue !== undefined) {
							return internalValue;
						}

						// Auto-create a default empty DynamicElement for manual instantiation
						// This lazy imports DynamicElement to avoid circular dependency
						const { DynamicElement } = require("../query/dynamic-element");

						// Get the root element name from metadata if available
						const rootMetadata = getMetadata(ctor).root;
						const elementName = rootMetadata?.name || ctor.name;

						internalValue = new DynamicElement({
							name: elementName,
							qualifiedName: elementName,
							attributes: {},
						}) as V;

						return internalValue;
					},
					set(this: any, value: V) {
						internalValue = value;
					},
					enumerable: true,
					configurable: true,
				});
			}
		});
	};
}

/**
 * @deprecated Use @XmlDynamic decorator and DynamicElement type instead.
 * XmlQueryable will continue to work but XmlDynamic is the recommended name
 * for bi-directional XML manipulation.
 *
 * @see XmlDynamic
 */
export function XmlQueryable(options: XmlDynamicOptions = {}) {
	return XmlDynamic(options);
}
