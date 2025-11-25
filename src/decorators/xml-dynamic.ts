import { registerDynamicElementMetadata } from "./storage";
import type { XmlDynamicMetadata } from "./types/metadata";

// Symbol to store pending dynamic metadata for environments where addInitializer fails
export const PENDING_DYNAMIC_ELEMENTS_SYMBOL = Symbol.for("xml-poto:pending-dynamic-elements");

/**
 * Base interface for dynamic XML elements with runtime-determined names.
 * Extend this interface to create domain-specific, type-safe element types.
 *
 * @property value - Element text content (automatically converted to string in XML)
 * @property attributes - Optional XML attributes
 *
 * @example Basic usage
 * ```typescript
 * @XmlDynamic()
 * elements: Map<string, DynamicElement> = new Map();
 *
 * elements.set('custom:Element', {
 *   value: 100,
 *   attributes: { type: 'number' }
 * });
 * ```
 *
 * @example Custom type
 * ```typescript
 * interface XBRLDatapoint extends DynamicElement {
 *   contextRef: string;  // Make required
 *   unitRef?: string;
 * }
 *
 * @XmlDynamic()
 * datapoints: Map<string, XBRLDatapoint> = new Map();
 * ```
 */
export interface DynamicElement {
	value: string | number | boolean;
	attributes?: Record<string, string>;
}

/**
 * Container type for dynamic elements. Supports Map (preserves order) or Record.
 * Generic type T allows custom element types extending DynamicElement.
 */
export type DynamicElementsContainer<T extends DynamicElement = DynamicElement> = Map<string, T> | Record<string, T>;

/**
 * Decorator for properties containing dynamic XML elements with runtime-determined names.
 *
 * Use when serializing XML elements whose names are not known at compile time.
 * The decorated property must be a `Map<string, T>` or `Record<string, T>` where
 * T extends `DynamicElement`.
 *
 * @example Default usage
 * ```typescript
 * @XmlElement('xbrli:xbrl')
 * class XBRLRoot {
 *   @XmlDynamic()
 *   datapoints: Map<string, DynamicElement> = new Map();
 * }
 *
 * xbrl.datapoints.set('nl-cd:Price', {
 *   value: 150000,
 *   attributes: { contextRef: 'ctx1', unitRef: 'EUR' }
 * });
 * ```
 *
 * @example Custom type
 * ```typescript
 * interface XBRLDatapoint extends DynamicElement {
 *   contextRef: string;  // Required
 *   unitRef?: string;
 * }
 *
 * @XmlDynamic()
 * datapoints: Map<string, XBRLDatapoint> = new Map();
 * ```
 *
 * @remarks
 * - Elements are serialized in iteration order (Map preserves insertion order)
 * - Element names can include namespace prefixes (e.g., 'ns:Name')
 * - Use `@XmlQueryable()` for reading dynamic elements during deserialization
 * - Values are converted to strings during XML generation
 *
 * @category Decorator
 * @see {@link DynamicElement}
 * @see {@link DynamicElementsContainer}
 */
export function XmlDynamic(): <T, V>(
	_target: undefined,
	context: ClassFieldDecoratorContext<T, V>
) => (initialValue: V) => V {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const dynamicMetadata: XmlDynamicMetadata = {
			propertyKey,
		};

		// Store metadata for class decorators to pick up when addInitializer is broken
		if (context.metadata) {
			if (!(context.metadata as any)[PENDING_DYNAMIC_ELEMENTS_SYMBOL]) {
				(context.metadata as any)[PENDING_DYNAMIC_ELEMENTS_SYMBOL] = [];
			}
			(context.metadata as any)[PENDING_DYNAMIC_ELEMENTS_SYMBOL].push(dynamicMetadata);
		}

		// Use context.addInitializer to run after class field initialization
		context.addInitializer(function (this: any) {
			registerDynamicElementMetadata(this.constructor, dynamicMetadata);
		});

		// Return initializer function
		return (initialValue: V): V => initialValue;
	};
}
