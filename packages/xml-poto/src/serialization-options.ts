/**
 * Processing instruction (e.g., <?xml-stylesheet?>)
 */
export interface ProcessingInstruction {
	/** Target of the processing instruction */
	target: string;
	/** Data/content of the processing instruction */
	data: string;
}

/**
 * DOCTYPE declaration configuration
 */
export interface DocType {
	/** Root element name */
	rootElement: string;
	/** Public identifier (for PUBLIC DOCTYPE) */
	publicId?: string;
	/** System identifier (DTD URI) */
	systemId?: string;
	/** Internal subset (DTD declarations) */
	internalSubset?: string;
}

/**
 * Configuration options for XML serialization and deserialization.
 */
export interface SerializationOptions {
	/** Skip parsing/generating XML attributes */
	ignoreAttributes?: boolean;
	/** Prefix for attribute names in parsed objects */
	attributeNamePrefix?: string;
	/** Property name for text content in mixed elements */
	textNodeName?: string;
	/** Skip XML declaration (<?xml version="1.0"?>) - default: false */
	omitXmlDeclaration?: boolean;
	/** XML version in declaration - default: "1.0" */
	xmlVersion?: string;
	/** Character encoding in declaration - default: "UTF-8" */
	encoding?: string;
	/** Include standalone declaration - optional */
	standalone?: boolean;
	/** Skip null/undefined values instead of empty elements - default: false */
	omitNullValues?: boolean;
	/** Generate xsi:type attributes for polymorphic types - default: false */
	useXsiType?: boolean;
	/** Processing instructions to include after XML declaration */
	processingInstructions?: ProcessingInstruction[];
	/** DOCTYPE declaration to include */
	docType?: DocType;
	/** Empty element syntax: 'self-closing' (<tag/>) or 'explicit' (<tag></tag>) - default: 'self-closing' */
	emptyElementStyle?: "self-closing" | "explicit";
	/** Throw error if nested objects with are not properly instantiated via type option - default: false */
	strictValidation?: boolean;
}

/**
 * Default serialization options.
 */
export const DEFAULT_SERIALIZATION_OPTIONS: Required<
	Omit<SerializationOptions, "standalone" | "processingInstructions" | "docType">
> = {
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	omitXmlDeclaration: false,
	xmlVersion: "1.0",
	encoding: "UTF-8",
	omitNullValues: false,
	useXsiType: false,
	emptyElementStyle: "self-closing",
	strictValidation: false,
};
