import type { QueryableElement } from "../query/xml-query";
import { registerQueryableMetadata } from "./storage";
import type { XmlQueryableOptions } from "./types";

/**
 * Decorator to create a queryable interface for advanced XML navigation and searching.
 *
 * Adds a property that provides a fluent query API (QueryableElement) for powerful XPath-like
 * queries, filtering, text extraction, attribute access, and tree navigation. Ideal for
 * complex XML processing, data extraction, and transformation scenarios without parsing
 * the entire document structure into typed objects.
 *
 * @param options Configuration options for the queryable element
 * @param options.targetProperty - Specific property to query (default: root element)
 * @param options.required - Whether the queryable element is required
 * @param options.parseChildren - Parse child elements (default: true)
 * @param options.parseNumeric - Auto-parse numeric values (default: true)
 * @param options.parseBoolean - Auto-parse boolean values (default: true)
 * @param options.trimValues - Trim whitespace from text values (default: true)
 * @param options.preserveRawText - Keep original text with whitespace (default: false)
 * @param options.maxDepth - Maximum depth to parse for performance optimization
 * @param options.cache - Cache query results for repeated queries (default: false)
 * @returns A field decorator function that creates a QueryableElement property
 *
 * @example
 * ```
 * // Query the root element
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlQueryable()
 *   query!: QueryableElement;
 *
 *   @XmlElement() title!: string;
 *   @XmlElement() content!: string;
 * }
 *
 * const xml = '<Document><title>My Doc</title><content>Hello</content></Document>';
 * const doc = serializer.fromXml(xml, Document);
 *
 * // Use fluent query API
 * const titles = doc.query.find('title').texts();  // ['My Doc']
 * const hasContent = doc.query.exists('content');  // true
 * const allElements = doc.query.children;          // All child elements
 * ```
 *
 * @example
 * ```
 * // Query specific nested element
 * @XmlRoot({ elementName: 'Library' })
 * class Library {
 *   @XmlElement() name!: string;
 *   @XmlArrayItem({ itemName: 'Book', containerName: 'Books' })
 *   books!: Book[];
 *
 *   @XmlQueryable({ targetProperty: 'books' })
 *   booksQuery?: QueryableElement;
 * }
 *
 * const library = serializer.fromXml(xml, Library);
 *
 * // Query just the Books container
 * const bookTitles = library.booksQuery?.find('title').texts();
 * const expensiveBooks = library.booksQuery?.filter(
 *   book => book.attr('price') && parseFloat(book.attr('price')!) > 50
 * );
 * ```
 *
 * @example
 * ```
 * // Advanced querying with XPath-like syntax
 * @XmlRoot({ elementName: 'Catalog' })
 * class Catalog {
 *   @XmlQueryable()
 *   query!: QueryableElement;
 * }
 *
 * const catalog = serializer.fromXml(xmlString, Catalog);
 *
 * // Find all Product elements with price > 100
 * const expensive = catalog.query
 *   .find('Product')
 *   .filter(p => parseFloat(p.attr('price') || '0') > 100);
 *
 * // Get all text content from Description elements
 * const descriptions = catalog.query.find('Description').texts();
 *
 * // Navigate with parent/child relationships
 * const parent = catalog.query.children[0].parent;
 * const siblings = catalog.query.children[0].siblings;
 * ```
 *
 * @example
 * ```
 * // Performance optimization with maxDepth
 * @XmlRoot({ elementName: 'LargeDocument' })
 * class LargeDocument {
 *   @XmlQueryable({ maxDepth: 3 })  // Only parse 3 levels deep
 *   query!: QueryableElement;
 * }
 *
 * // Improves performance on very deep XML structures
 * ```
 *
 * @example
 * ```
 * // Extract attribute values
 * @XmlRoot({ elementName: 'Products' })
 * class Products {
 *   @XmlQueryable()
 *   query!: QueryableElement;
 * }
 *
 * const products = serializer.fromXml(xml, Products);
 *
 * // Get all product IDs
 * const ids = products.query.find('Product').attrs('id');
 *
 * // Check if attribute exists
 * const hasCategory = products.query.find('Product').first()?.hasAttr('category');
 * ```
 *
 * @example
 * ```
 * // Combined with typed properties
 * @XmlRoot({ elementName: 'Order' })
 * class Order {
 *   @XmlAttribute() id!: string;
 *   @XmlElement() customer!: string;
 *
 *   // Typed access for known properties
 *   // Query access for dynamic/unknown structure
 *   @XmlQueryable()
 *   query!: QueryableElement;
 * }
 *
 * const order = serializer.fromXml(xml, Order);
 * console.log(order.id);           // Typed access
 * console.log(order.customer);     // Typed access
 * const extras = order.query.find('Extra').texts();  // Dynamic query
 * ```
 */
export function XmlQueryable(options: XmlQueryableOptions = {}) {
	return <T, V extends QueryableElement | undefined>(
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
		};

		// Store metadata during class initialization
		context.addInitializer(function (this: any) {
			const ctor = this.constructor;

			// Use helper function to register queryable metadata
			registerQueryableMetadata(ctor, metadata);

			// Setup lazy loading via property descriptor
			// Use unique symbols for cache and builder keys to avoid property name collisions
			const cachedValueKey = Symbol.for(`queryable_cache_${ctor.name}_${propertyKey}`);
			const builderKey = Symbol.for(`queryable_builder_${ctor.name}_${propertyKey}`);

			Object.defineProperty(this, propertyKey, {
				get(this: any): V {
					const cacheEnabled = metadata.cache;

					// Return cached value if caching is enabled
					if (cacheEnabled && this[cachedValueKey] !== undefined) {
						return this[cachedValueKey];
					}

					// Build QueryableElement lazily using stored builder function
					if (this[builderKey]) {
						const element = this[builderKey]();

						// Cache the result if caching is enabled
						if (cacheEnabled) {
							this[cachedValueKey] = element;
						}

						return element;
					}

					// Return undefined if no builder is set (not yet initialized)
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
		});
	};
}
