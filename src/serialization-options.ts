/**
 * Configuration options for XML serialization and deserialization.
 * Inspired by C# XmlWriterSettings and XmlReaderSettings.
 */
export interface SerializationOptions {
	/** Skip parsing/generating XML attributes */
	ignoreAttributes?: boolean;

	/** Prefix for attribute names in parsed objects */
	attributeNamePrefix?: string;

	/** Property name for text content in mixed elements */
	textNodeName?: string;

	// C#-inspired XML declaration options
	/** Skip XML declaration (<?xml version="1.0"?>) - default: false */
	omitXmlDeclaration?: boolean;

	/** XML version in declaration - default: "1.0" */
	xmlVersion?: string;

	/** Character encoding in declaration - default: "UTF-8" */
	encoding?: string;

	/** Include standalone declaration - optional */
	standalone?: boolean;

	// C#-inspired null handling options
	/** Skip null/undefined values instead of empty elements - default: false */
	omitNullValues?: boolean;
}

/**
 * Default serialization options with C#-inspired defaults.
 */
export const DEFAULT_SERIALIZATION_OPTIONS: Required<Omit<SerializationOptions, "standalone">> = {
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	omitXmlDeclaration: false,
	xmlVersion: "1.0",
	encoding: "UTF-8",
	omitNullValues: false,
};
