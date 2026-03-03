/* eslint-disable typescript/no-explicit-any -- Decorators work with dynamic this contexts and runtime values */
import { DynamicElement } from "../query/dynamic-element";
import {
	getMetadata,
	registerAttributeMetadata,
	registerDynamicMetadata,
	registerFieldElementMetadata,
	registerPropertyMapping,
} from "./storage";
import { registerConstructorByName, registerElementClass } from "./storage/metadata-storage";
import { XmlNamespace, XmlRootMetadata, XmlRootOptions } from "./types";
import { PENDING_DYNAMIC_SYMBOL } from "./xml-dynamic";

// Symbol to store pending field element metadata from @XmlElement field decorators
const PENDING_FIELD_ELEMENT_SYMBOL = Symbol.for("pendingFieldElement");

// Symbol to store pending attribute metadata from @XmlAttribute field decorators
const PENDING_ATTRIBUTE_SYMBOL = Symbol.for("pendingAttribute");

/**
 * Registers pending attribute metadata stored during field decoration.
 */
function processPendingAttributes(context: ClassDecoratorContext, target: any): void {
	if (!context.metadata?.[PENDING_ATTRIBUTE_SYMBOL]) return;
	const pendingAttributes = context.metadata[PENDING_ATTRIBUTE_SYMBOL];
	if (!Array.isArray(pendingAttributes)) return;

	for (const { propertyKey, metadata } of pendingAttributes) {
		registerAttributeMetadata(target, propertyKey, metadata);
	}
}

/**
 * Registers pending field element metadata stored during field decoration.
 */
function processPendingFieldElements(context: ClassDecoratorContext, target: any): void {
	if (!context.metadata?.[PENDING_FIELD_ELEMENT_SYMBOL]) return;
	const pendingFields = context.metadata[PENDING_FIELD_ELEMENT_SYMBOL];
	if (!Array.isArray(pendingFields)) return;

	for (const { propertyKey, metadata, xmlName } of pendingFields) {
		registerFieldElementMetadata(target, propertyKey, metadata);
		registerPropertyMapping(target, propertyKey, xmlName);

		if (metadata.type) {
			registerElementClass(xmlName, metadata.type, target);
		}
	}
}

/**
 * Sets up immediate-mode property descriptor for a DynamicElement property.
 */
function setupImmediateDescriptor(target: any, propertyKey: string, elementName: string): void {
	const storageKey = Symbol.for(`__xmlDynamic_${target.name}_${propertyKey}`);

	const getter = function (this: any): DynamicElement {
		if (this[storageKey] !== undefined) {
			return this[storageKey];
		}
		const newValue = new DynamicElement({
			name: elementName,
			attributes: {},
		});
		this[storageKey] = newValue;
		return newValue;
	};

	const setter = function (this: any, value: any): void {
		this[storageKey] = value;
		Object.defineProperty(this, propertyKey, {
			get: getter,
			set: setter,
			enumerable: true,
			configurable: true,
		});
	};

	Object.defineProperty(target.prototype, propertyKey, {
		get: getter,
		set: setter,
		enumerable: true,
		configurable: true,
	});
}

/**
 * Sets up lazy-loading property descriptor for a DynamicElement property.
 */
function setupLazyDescriptor(target: any, propertyKey: string, metadata: any): void {
	const cachedValueKey = Symbol.for(`dynamic_cache_${target.name}_${propertyKey}`);
	const builderKey = Symbol.for(`dynamic_builder_${target.name}_${propertyKey}`);

	const getter = function (this: any): DynamicElement | undefined {
		if (metadata.cache && this[cachedValueKey] !== undefined) {
			return this[cachedValueKey];
		}
		if (this[builderKey]) {
			const element = this[builderKey]();
			if (metadata.cache) {
				this[cachedValueKey] = element;
			}
			return element;
		}
		return undefined;
	};

	const setter = function (this: any, value: any): void {
		if (metadata.cache) {
			this[cachedValueKey] = value;
		}
		delete this[builderKey];
		Object.defineProperty(this, propertyKey, {
			get: getter,
			set: setter,
			enumerable: true,
			configurable: true,
		});
	};

	Object.defineProperty(target.prototype, propertyKey, {
		get: getter,
		set: setter,
		enumerable: true,
		configurable: true,
	});
}

/**
 * Registers pending dynamic/queryable metadata and sets up property descriptors.
 */
function processPendingQueryables(context: ClassDecoratorContext, target: any, elementName: string): void {
	if (!context.metadata?.[PENDING_DYNAMIC_SYMBOL]) return;
	const pendingQueryables = context.metadata[PENDING_DYNAMIC_SYMBOL];
	if (!Array.isArray(pendingQueryables)) return;

	for (const { propertyKey, metadata } of pendingQueryables) {
		registerDynamicMetadata(target, metadata);

		if (!metadata.lazyLoad) {
			setupImmediateDescriptor(target, propertyKey, elementName);
		} else {
			setupLazyDescriptor(target, propertyKey, metadata);
		}
	}
}

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
 * @param options.namespace - Primary XML namespace configuration with URI and prefix
 * @param options.namespaces - Additional namespaces to declare on this element (for child element use)
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
 *
 * @example
 * ```
 * // Multiple namespaces (new feature)
 * @XmlRoot({
 *   name: 'Report',
 *   namespace: { uri: 'http://example.com/report', prefix: 'rpt' },
 *   namespaces: [
 *     { uri: 'http://example.com/data', prefix: 'data' },
 *     { uri: 'http://example.com/meta', prefix: 'meta' }
 *   ]
 * })
 * class Report {
 *   @XmlElement({ namespace: { uri: 'http://example.com/meta', prefix: 'meta' } })
 *   title!: string;
 * }
 *
 * // Serializes to: <rpt:Report xmlns:rpt="..." xmlns:data="..." xmlns:meta="..."><meta:title>...</meta:title></rpt:Report>
 * ```
 */
export function XmlRoot(
	options: XmlRootOptions = {},
): <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>) => T {
	// Complex root decorator with multiple initialization paths
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		// Support both new 'name' and legacy 'elementName' properties
		// eslint-disable-next-line typescript/no-deprecated
		const elementName = options.name ?? options.elementName ?? String(context.name);

		// Combine namespace and namespaces into single array
		const allNamespaces: XmlNamespace[] = [];
		if (options.namespace) {
			allNamespaces.push(options.namespace);
		}
		if (options.namespaces) {
			allNamespaces.push(...options.namespaces);
		}

		const rootMetadata: XmlRootMetadata = {
			name: elementName,
			namespaces: allNamespaces.length > 0 ? allNamespaces : undefined,
			dataType: options.dataType,
			isNullable: options.isNullable,
			xmlSpace: options.xmlSpace,
			// Keep elementName for backward compatibility
			elementName: elementName,
		};

		// Store root metadata in unified storage
		getMetadata(target).root = rootMetadata;

		// Register class constructor by name for undecorated class discovery
		registerConstructorByName(target.name, target);

		// Register pending metadata collected during field decoration
		processPendingAttributes(context, target);
		processPendingFieldElements(context, target);
		processPendingQueryables(context, target, elementName);

		return target;
	};
}
