import type { DynamicElement } from "../query/dynamic-element";
import { getMetadata } from "./storage/metadata-storage";

/**
 * Manually initialize @XmlDynamic properties when decorators are not fully supported
 * (e.g., when using esbuild in Playwright tests).
 *
 * This helper function should be called in the constructor of classes that use @XmlDynamic
 * when working in environments where decorator support is limited.
 *
 * @param instance - The class instance to initialize
 * @param propertyKey - The name of the property decorated with @XmlDynamic
 *
 * @example
 * ```typescript
 * @XmlRoot({ name: 'Document' })
 * class Document {
 *   @XmlDynamic({ lazyLoad: false })
 *   dynamic!: DynamicElement;
 *
 *   constructor() {
 *     // Manual initialization for environments with limited decorator support
 *     initializeDynamicProperty(this, 'dynamic');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Initialize multiple dynamic properties
 * @XmlRoot({ name: 'Container' })
 * class Container {
 *   @XmlDynamic({ lazyLoad: false })
 *   dynamic1!: DynamicElement;
 *
 *   @XmlDynamic({ lazyLoad: false })
 *   dynamic2!: DynamicElement;
 *
 *   constructor() {
 *     initializeDynamicProperty(this, 'dynamic1');
 *     initializeDynamicProperty(this, 'dynamic2');
 *   }
 * }
 * ```
 */
export function initializeDynamicProperty<T extends object>(instance: T, propertyKey: keyof T): void {
	const ctor = instance.constructor as any as new (...args: any[]) => T;

	// Get metadata for this class
	const metadata = getMetadata(ctor);
	const dynamicMetadata = metadata.queryables?.find(q => q.propertyKey === String(propertyKey));

	if (!dynamicMetadata) {
		// If no metadata found, just create a default DynamicElement
		const rootMetadata = metadata.root;
		const elementName = rootMetadata?.name || ctor.name;

		const DynamicElement =
			require("../query/dynamic-element").DynamicElement || require("../query/dynamic-element").default;
		(instance as any)[propertyKey] = new DynamicElement({
			name: elementName,
			attributes: {},
		});
		return;
	}

	// Check if lazyLoad is enabled
	if (dynamicMetadata.lazyLoad) {
		// For lazy loading, set up getter/setter with Symbol storage
		const cachedValueKey = Symbol.for(`dynamic_cache_${ctor.name}_${String(propertyKey)}`);
		const builderKey = Symbol.for(`dynamic_builder_${ctor.name}_${String(propertyKey)}`);

		const getter = function (this: any): DynamicElement | undefined {
			const cacheEnabled = dynamicMetadata.cache;

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

		const setter = function (this: any, value: DynamicElement | undefined) {
			if (dynamicMetadata.cache) {
				this[cachedValueKey] = value;
			}
			// Clear builder if value is set manually
			delete this[builderKey];
		};

		Object.defineProperty(instance, propertyKey, {
			get: getter,
			set: setter,
			enumerable: true,
			configurable: true,
		});
	} else {
		// Immediate loading mode: create DynamicElement right away
		const storageKey = Symbol.for(`__xmlDynamic_${ctor.name}_${String(propertyKey)}`);

		const getter = function (this: any): DynamicElement {
			// Return existing value if already set (stored in Symbol property)
			if (this[storageKey] !== undefined) {
				return this[storageKey];
			}

			// Auto-create a default empty DynamicElement
			const DynamicElement =
				require("../query/dynamic-element").DynamicElement || require("../query/dynamic-element").default;
			const rootMetadata = metadata.root;
			const elementName = rootMetadata?.name || ctor.name;

			const newValue = new DynamicElement({
				name: elementName,
				attributes: {},
			});

			this[storageKey] = newValue;
			return newValue;
		};

		const setter = function (this: any, value: DynamicElement) {
			this[storageKey] = value;
		};

		Object.defineProperty(instance, propertyKey, {
			get: getter,
			set: setter,
			enumerable: true,
			configurable: true,
		});
	}
}

/**
 * Initialize multiple @XmlDynamic properties at once.
 * This is useful when working in environments with limited decorator support.
 *
 * @param instance - The class instance to initialize
 * @param propertyKeys - Array of property names to initialize
 *
 * @example
 * ```typescript
 * // Initialize multiple dynamic properties
 * @XmlRoot({ name: 'Document' })
 * class Document {
 *   @XmlDynamic({ lazyLoad: false })
 *   dynamic!: DynamicElement;
 *
 *   @XmlDynamic({ lazyLoad: false })
 *   query!: DynamicElement;
 *
 *   constructor() {
 *     // Initialize all properties at once
 *     initializeDynamicProperties(this, ['dynamic', 'query']);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Works in esbuild/Playwright where decorators don't run
 * class Document {
 *   dynamic!: DynamicElement;
 *   query!: DynamicElement;
 *
 *   constructor() {
 *     initializeDynamicProperties(this, ['dynamic', 'query']);
 *   }
 * }
 * ```
 */
export function initializeDynamicProperties<T extends object>(instance: T, propertyKeys: (keyof T)[]): void {
	for (const propertyKey of propertyKeys) {
		initializeDynamicProperty(instance, propertyKey);
	}
}
