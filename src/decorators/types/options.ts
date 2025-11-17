import { XmlNamespace } from "./xml-namespace";

/**
 * Options for XmlElement decorator
 */
export interface XmlElementOptions {
	/** The XML element name */
	name?: string;
	/** XML namespace with both prefix and URI */
	namespace?: XmlNamespace;
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
	/** Runtime type for polymorphism */
	type?: any;
	/** Whether to wrap element content in CDATA section (field decorator only) */
	useCDATA?: boolean;
}

/**
 * Options for XmlAttribute decorator
 */
export interface XmlAttributeOptions {
	/** The XML attribute name */
	name?: string;
	/** XML namespace with both prefix and URI */
	namespace?: XmlNamespace;
	/** Whether this attribute is required */
	required?: boolean;
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
 * Options for XmlText decorator
 */
export interface XmlTextOptions {
	/** Custom type conversion for text content */
	converter?: {
		serialize?: (value: any) => string;
		deserialize?: (value: string) => any;
	};
	/** Whether text content is required */
	required?: boolean;
	/** Custom XML element name for this property */
	xmlName?: string;
	/** XML Schema data type for text content */
	dataType?: string;
	/** Whether to wrap text content in CDATA section */
	useCDATA?: boolean;
}

/**
 * Root element options
 */
export interface XmlRootOptions {
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
 * Array item options
 */
export interface XmlArrayItemOptions {
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
	/**
	 * When true, array items are serialized directly to parent without container element.
	 * This is automatically set to true when containerName is not provided.
	 */
	unwrapped?: boolean;

	// Legacy support - will be deprecated
	/** @deprecated Use containerName instead */
	name?: string;
	/** @deprecated Use itemName instead */
	elementName?: string;
}
