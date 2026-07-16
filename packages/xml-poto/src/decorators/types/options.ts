import type { Constructor } from "../storage/metadata-storage";
import type { TypeRef } from "../storage/type-ref";

import type { DeepReadonly } from "./type-utils";
import type { XmlNamespace } from "./xml-namespace";

/**
 * How facet violations are handled during serialization/deserialization.
 * - "strict": throw an error (default)
 * - "warn": log a console warning and continue
 * - "off": skip validation entirely
 */
export type XmlValidationMode = "strict" | "warn" | "off";

/**
 * The individual validation rules that can be tuned via the serializer's
 * `validationModeOverrides` option. Each key corresponds to one facet or
 * structural check.
 */
export type XmlValidationRule =
	| "pattern"
	| "enumValues"
	| "length"
	| "minLength"
	| "maxLength"
	| "minInclusive"
	| "maxInclusive"
	| "minExclusive"
	| "maxExclusive"
	| "totalDigits"
	| "fractionDigits"
	| "fixedValue"
	| "choiceGroup"
	| "minOccurs"
	| "maxOccurs";

/**
 * XSD list configuration for values serialized as space-separated text
 * (xs:list). `true` uses string items; an object selects the item type.
 */
export type XmlListOptions = boolean | { itemType?: "string" | "number" | "boolean" };

/**
 * XSD-style value constraints (facets) shared by element, attribute, text,
 * and array-item values. Violations are handled according to the serializer's
 * `validationModeOverrides` (per rule), else its `validationMode`, else "strict".
 */
export interface XmlValueFacets {
	/** Validation pattern for the value (xs:pattern) */
	pattern?: RegExp;
	/** Allowed enumeration values (xs:enumeration) */
	enumValues?: readonly string[];
	/** Exact value length (xs:length) */
	length?: number;
	/** Minimum value length (xs:minLength) */
	minLength?: number;
	/** Maximum value length (xs:maxLength) */
	maxLength?: number;
	/** Minimum numeric value, inclusive (xs:minInclusive) */
	minInclusive?: number;
	/** Maximum numeric value, inclusive (xs:maxInclusive) */
	maxInclusive?: number;
	/** Minimum numeric value, exclusive (xs:minExclusive) */
	minExclusive?: number;
	/** Maximum numeric value, exclusive (xs:maxExclusive) */
	maxExclusive?: number;
	/** Maximum number of total digits for decimal values (xs:totalDigits) */
	totalDigits?: number;
	/** Maximum number of fraction digits for decimal values (xs:fractionDigits) */
	fractionDigits?: number;
	/** Whitespace normalization applied before validation (xs:whiteSpace) */
	whiteSpace?: "preserve" | "replace" | "collapse";
	/** XSD fixed value: the value must equal this constant; also used as default when absent */
	fixedValue?: string | number | boolean;
}

/**
 * Options for XmlElement decorator
 */
export interface XmlElementOptions extends XmlValueFacets {
	/** The XML element name */
	name?: string;
	/** XML namespace with both prefix and URI */
	namespace?: XmlNamespace;
	/** Additional namespaces to declare on this element (beyond the primary namespace) */
	namespaces?: XmlNamespace[];
	/** Whether this element is required */
	required?: boolean;
	/** Serialization order */
	order?: number;
	/** XML Schema data type */
	dataType?: string;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** Namespace form */
	form?: "qualified" | "unqualified";
	/** Runtime type for polymorphism: a constructor, or a `() => Constructor` thunk for forward/circular references */
	type?: TypeRef;
	/** Whether to wrap element content in CDATA section (field decorator only) */
	useCDATA?: boolean;
	/** Union types for properties that can be multiple types (e.g., [String, Number]) */
	unionTypes?: Constructor[];
	/** Enable mixed content support (text and child elements interspersed) */
	mixedContent?: boolean;
	/** Default value to use when element is missing during deserialization */
	defaultValue?: unknown;
	/** Control whitespace handling with xml:space attribute ('preserve' or 'default') */
	xmlSpace?: "preserve" | "default";
	/** Custom transformation functions for converting between property values and XML */
	transform?: {
		/** Transform property value to XML (serialization) */
		serialize?: (value: unknown) => string | number | boolean;
		/** Transform XML value to property value (deserialization) */
		deserialize?: (value: string) => unknown;
	};
	/** Serialize/deserialize the element text as a space-separated list (xs:list) */
	list?: XmlListOptions;
	/** Choice group name: properties sharing a group form an exclusive xs:choice */
	choiceGroup?: string;
	/** Whether at least one member of the choice group must be set */
	choiceRequired?: boolean;
}

/**
 * Options for XmlAttribute decorator
 */
export interface XmlAttributeOptions extends XmlValueFacets {
	/** The XML attribute name */
	name?: string;
	/** XML namespace with both prefix and URI */
	namespace?: XmlNamespace;
	/** Additional namespaces to declare on the parent element of this attribute */
	namespaces?: XmlNamespace[];
	/** Whether this attribute is required */
	required?: boolean;
	/** Custom type conversion functions */
	converter?: {
		serialize?: (value: unknown) => string;
		deserialize?: (value: string) => unknown;
	};
	/** XML Schema data type */
	dataType?: string;
	/** Namespace form */
	form?: "qualified" | "unqualified";
	/** Runtime type for complex attributes: a constructor, or a `() => Constructor` thunk for forward/circular references */
	type?: TypeRef;
	/** Default value to use when attribute is missing during deserialization */
	defaultValue?: unknown;
	/** Serialize/deserialize the attribute value as a space-separated list (xs:list) */
	list?: XmlListOptions;
}

/**
 * Options for XmlText decorator
 */
export interface XmlTextOptions extends XmlValueFacets {
	/** Custom type conversion for text content */
	converter?: {
		serialize?: (value: unknown) => string;
		deserialize?: (value: string) => unknown;
	};
	/** Whether text content is required */
	required?: boolean;
	/** Custom XML element name for this property */
	xmlName?: string;
	/** XML Schema data type for text content */
	dataType?: string;
	/** Whether to wrap text content in CDATA section */
	useCDATA?: boolean;
	/** Serialize/deserialize the text content as a space-separated list (xs:list) */
	list?: XmlListOptions;
}

/**
 * Root element options
 */
export interface XmlRootOptions {
	/** Root element name */
	name?: string;
	/** Root namespace */
	namespace?: XmlNamespace;
	/** Additional namespaces to declare on the root element (beyond the primary namespace) */
	namespaces?: XmlNamespace[];
	/** XML Schema data type */
	dataType?: string;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** Control whitespace handling with xml:space attribute ('preserve' or 'default') */
	xmlSpace?: "preserve" | "default";
}

/**
 * Array item options
 */
export interface XmlArrayOptions extends XmlValueFacets {
	/**
	 * Name for the array container element (overrides property name).
	 * If not provided, array items will be unwrapped (no container).
	 * @example containerName: 'BookCollection' -> <BookCollection><Book>...</Book></BookCollection>
	 */
	containerName?: string;
	/**
	 * Element name for individual array items.
	 * @example itemName: 'Book' -> <Book>...</Book>
	 */
	itemName?: string;
	/** Runtime type for polymorphic arrays: a constructor, or a `() => Constructor` thunk for forward/circular references */
	type?: TypeRef;
	/** Namespace for array items */
	namespace?: XmlNamespace;
	/** Additional namespaces to declare on the array container element */
	namespaces?: XmlNamespace[];
	/** Nesting level */
	nestingLevel?: number;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** XML Schema data type */
	dataType?: string;
	/** Serialization order */
	order?: number;
	/** Namespace form */
	form?: "qualified" | "unqualified";
	/** Whether this array is required (validation fails if the array container element is missing) */
	required?: boolean;
	/** Default value to use when the array is absent during deserialization */
	defaultValue?: unknown[];
	/**
	 * When true, array items are serialized directly to parent without container element.
	 * This is automatically set to true when containerName is not provided.
	 */
	unwrapped?: boolean;
	/** Minimum number of items (xs:minOccurs); checked according to the effective validation mode */
	minOccurs?: number;
	/** Maximum number of items (xs:maxOccurs); checked according to the effective validation mode */
	maxOccurs?: number;
	/** Choice group name: properties sharing a group form an exclusive xs:choice */
	choiceGroup?: string;
	/** Whether at least one member of the choice group must be set */
	choiceRequired?: boolean;
}

/**
 * Options for XmlComment decorator
 */
export interface XmlCommentOptions<T = unknown> {
	/** Target property name that this comment describes (required) */
	targetProperty: keyof T & string;
	/** Whether the comment is required */
	required?: boolean;
}

/**
 * Options for XmlDynamic decorator
 */
export interface XmlDynamicOptions {
	/** Target property name to make queryable (if not specified, queries the root element) */
	targetProperty?: string;
	/** Whether this queryable element is required (validation will fail if missing) */
	required?: boolean;
	/** Whether to automatically parse child elements (default: true) */
	parseChildren?: boolean;
	/** Whether to parse numeric values (default: true) */
	parseNumeric?: boolean;
	/** Whether to parse boolean values (default: true) */
	parseBoolean?: boolean;
	/** Whether to trim whitespace from text values (default: true) */
	trimValues?: boolean;
	/** Whether to preserve raw text including whitespace (default: false) */
	preserveRawText?: boolean;
	/** Maximum depth to parse in the element tree (useful for large documents) */
	maxDepth?: number;
	/** Serialization order */
	order?: number;
	/** Whether to cache the parsed query result (default: true) */
	cache?: boolean;
	/** Whether to use lazy loading (default: false). When true, the DynamicElement is built on first access; when false, it's built immediately during deserialization */
	lazyLoad?: boolean;
}

/**
 * Readonly versions of option types for better immutability hints
 * These provide better IntelliSense when options should not be modified
 */
export type ReadonlyXmlElementOptions = DeepReadonly<XmlElementOptions>;
export type ReadonlyXmlAttributeOptions = DeepReadonly<XmlAttributeOptions>;
export type ReadonlyXmlTextOptions = DeepReadonly<XmlTextOptions>;
export type ReadonlyXmlRootOptions = DeepReadonly<XmlRootOptions>;
export type ReadonlyXmlArrayOptions = DeepReadonly<XmlArrayOptions>;
export type ReadonlyXmlCommentOptions<T = unknown> = DeepReadonly<XmlCommentOptions<T>>;
export type ReadonlyXmlDynamicOptions = DeepReadonly<XmlDynamicOptions>;

/**
 * Immutable namespace definition for better type safety
 */
export type ImmutableNamespace = Readonly<Required<Pick<XmlNamespace, "uri" | "prefix">>>;
