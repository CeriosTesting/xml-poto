import { XmlNamespace } from "./xml-namespace";

/**
 * Metadata for XML element configuration
 */
export interface XmlElementMetadata {
	/** The XML element name */
	name: string;
	/** Optional XML namespace configuration */
	namespace?: XmlNamespace;
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
}

/**
 * Metadata for XML attribute configuration
 */
export interface XmlAttributeMetadata {
	/** The XML attribute name */
	name: string;
	/** Optional XML namespace configuration */
	namespace?: XmlNamespace;
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
}

/**
 * Root element metadata
 */
export interface XmlRootMetadata {
	/** Root element name */
	elementName?: string;
	/** Root namespace */
	namespace?: XmlNamespace;
	/** XML Schema data type */
	dataType?: string;
	/** Support for xsi:nil */
	isNullable?: boolean;
}

/**
 * Array item metadata
 */
export interface XmlArrayItemMetadata {
	/** Name for the array container element (overrides property name) */
	containerName?: string;
	/** Element name for individual array items */
	itemName?: string;
	/** Runtime type for polymorphic arrays */
	type?: any;
	/** Namespace for array items */
	namespace?: XmlNamespace;
	/** Nesting level */
	nestingLevel?: number;
	/** Support for xsi:nil */
	isNullable?: boolean;
	/** XML Schema data type */
	dataType?: string;
	/** When true, array items are serialized directly to parent without container element */
	unwrapped?: boolean;
}
