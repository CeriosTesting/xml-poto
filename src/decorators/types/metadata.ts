import { XmlNamespace } from "./xml-namespace";

/**
 * Metadata types for XML decorators
 */
export interface XmlElementMetadata {
	/** The XML element name */
	name: string;
	/** XML namespaces for this element (first is primary, rest are additional declarations) */
	namespaces?: XmlNamespace[];
	/** Whether this element is required */
	required: boolean;
	/** Serialization order */
	order?: number;
	/** XML Schema data type */
	dataType?: string;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** Namespace form */
	form?: "qualified" | "unqualified";
	/** Runtime type for polymorphism */
	type?: any;
	/** Whether to wrap element content in CDATA section */
	useCDATA?: boolean;
	/** Union types for properties that can be multiple types */
	unionTypes?: any[];
	/** Enable mixed content support (text and child elements interspersed) */
	mixedContent?: boolean;
	/** Default value to use when element is missing during deserialization */
	defaultValue?: any;
	/** Control whitespace handling with xml:space attribute ('preserve' or 'default') */
	xmlSpace?: "preserve" | "default";
	/** Custom transformation functions for converting between property values and XML */
	transform?: {
		/** Transform property value to XML (serialization) */
		serialize?: (value: any) => string | number | boolean;
		/** Transform XML value to property value (deserialization) */
		deserialize?: (value: string) => any;
	};
}

/**
 * Metadata for XML attribute configuration
 */
export interface XmlAttributeMetadata {
	/** The XML attribute name */
	name: string;
	/** XML namespaces for this attribute (first is primary, rest are additional declarations) */
	namespaces?: XmlNamespace[];
	/** Whether this attribute is required */
	required: boolean;
	/** Custom type conversion functions */
	converter?: {
		serialize?: (value: any) => string;
		deserialize?: (value: string) => any;
	};
	/** Validation pattern for the value */
	pattern?: RegExp;
	/** Allowed enumeration values */
	enumValues?: readonly string[];
	/** XML Schema data type */
	dataType?: string;
	/** Namespace form */
	form?: "qualified" | "unqualified";
	/** Runtime type for complex attributes */
	type?: any;
	/** Default value to use when attribute is missing during deserialization */
	defaultValue?: any;
}

/**
 * Root element metadata
 */
export interface XmlRootMetadata {
	/** Root element name */
	name?: string;
	/** XML namespaces for this element (first is primary, rest are additional declarations) */
	namespaces?: XmlNamespace[];
	/** XML Schema data type */
	dataType?: string;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** Control whitespace handling with xml:space attribute ('preserve' or 'default') */
	xmlSpace?: "preserve" | "default";

	// Legacy support - will be deprecated
	/** @deprecated Use name instead */
	elementName?: string;
}

/**
 * Metadata for XML text content configuration
 */
export interface XmlTextMetadata {
	/** Custom type conversion functions */
	converter?: {
		serialize?: (value: any) => string;
		deserialize?: (value: string) => any;
	};
	/** Whether text content is required */
	required?: boolean;
	/** XML Schema data type for text content */
	dataType?: string;
	/** Whether to wrap text content in CDATA section */
	useCDATA?: boolean;
}

/**
 * Array metadata
 */
export interface XmlArrayMetadata {
	/** Name for the array container element (overrides property name) */
	containerName?: string;
	/** Element name for individual array items */
	itemName?: string;
	/** Runtime type for polymorphic arrays */
	type?: any;
	/** XML namespaces for this array (first is primary, rest are additional declarations) */
	namespaces?: XmlNamespace[];
	/** Nesting level */
	nestingLevel?: number;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** XML Schema data type */
	dataType?: string;
	/** When true, array items are serialized directly to parent without container element */
	unwrapped?: boolean;
}

/**
 * Metadata for XML comment configuration
 */
export interface XmlCommentMetadata {
	/** Whether the comment is required */
	required?: boolean;
}

/**
 * Metadata for dynamic element configuration
 */
export interface XmlDynamicMetadata {
	/** Property key that stores the DynamicElement */
	propertyKey: string;
	/** Target property name to make dynamic (if not specified, queries the root element) */
	targetProperty?: string;
	/** Whether this dynamic element is required */
	required?: boolean;
	/** Whether to automatically parse child elements */
	parseChildren?: boolean;
	/** Whether to parse numeric values */
	parseNumeric?: boolean;
	/** Whether to parse boolean values */
	parseBoolean?: boolean;
	/** Whether to trim whitespace from text values */
	trimValues?: boolean;
	/** Whether to preserve raw text including whitespace */
	preserveRawText?: boolean;
	/** Maximum depth to parse in the element tree */
	maxDepth?: number;
	/** Whether to cache the parsed dynamic result */
	cache?: boolean;
	/** Whether to use lazy loading (default: false) */
	lazyLoad?: boolean;
}

/**
 * Metadata for ignored properties
 */
export interface XmlIgnoreMetadata {
	/** Property key to ignore during serialization/deserialization */
	propertyKey: string;
}
