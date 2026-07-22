import type { XmlValidationMode, XmlValidationRule } from "./decorators/types/options";

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
	/**
	 * Omit null/undefined members instead of writing empty elements/attributes,
	 * matching C# XmlSerializer (default: true). `isNullable` members still emit
	 * `xsi:nil="true"`. Set to false to restore the legacy empty-element behavior.
	 */
	omitNullValues?: boolean;
	/**
	 * Omit a member whose value equals its `defaultValue` instead of writing it,
	 * matching C# XmlSerializer `[DefaultValue]` (default: true). Applies to scalar
	 * element, attribute, and text members that declare a `defaultValue` and are not
	 * `required`/`isNullable`. Set to false to always emit the value.
	 */
	omitDefaultValues?: boolean;
	/** Generate xsi:type attributes for polymorphic types - default: false */
	useXsiType?: boolean;
	/**
	 * Emit `xsi:schemaLocation` on the document root, as namespace URI → location
	 * pairs. Written in the `"uri location"` form the spec requires, space-separated
	 * across entries. Many public schemas (government, banking) require it.
	 *
	 * @example { "http://example.com/v1": "https://example.com/v1/schema.xsd" }
	 */
	schemaLocation?: Record<string, string>;
	/** Emit `xsi:noNamespaceSchemaLocation` on the document root, for a schema with no target namespace */
	noNamespaceSchemaLocation?: string;
	/** Processing instructions to include after XML declaration */
	processingInstructions?: ProcessingInstruction[];
	/** DOCTYPE declaration to include */
	docType?: DocType;
	/** Empty element syntax: 'self-closing' (<tag/>) or 'explicit' (<tag></tag>) - default: 'self-closing' */
	emptyElementStyle?: "self-closing" | "explicit";
	/**
	 * Indent and line-break the output (default: true). Set to false for a compact,
	 * single-line document — what a SOAP request usually wants, and what anything
	 * hashing or signing the payload requires.
	 */
	format?: boolean;
	/** Indentation string per nesting level when `format` is true - default: two spaces */
	indent?: string;
	/** Throw error if nested objects with are not properly instantiated via type option - default: false */
	strictValidation?: boolean;
	/** Treat all @XmlElement, @XmlAttribute, @XmlArray and @XmlText properties as required unless required: false is explicitly set - default: false */
	requireAllByDefault?: boolean;
	/**
	 * How XSD facet violations (pattern, enumValues, length/min/max facets, fixedValue)
	 * and structural checks (choice groups, min/maxOccurs) are handled:
	 * 'strict' throws (default), 'warn' logs a console warning, 'off' skips validation.
	 * Individual rules can be tuned via validationModeOverrides.
	 */
	validationMode?: XmlValidationMode;
	/**
	 * Per-rule overrides of validationMode. Each key is a single validation rule;
	 * unlisted rules follow validationMode.
	 * @example { pattern: "warn", fixedValue: "off", choiceGroup: "warn" }
	 */
	validationModeOverrides?: Partial<Record<XmlValidationRule, XmlValidationMode>>;
}

/**
 * Default serialization options.
 */
export const DEFAULT_SERIALIZATION_OPTIONS: Required<
	Omit<
		SerializationOptions,
		| "standalone"
		| "processingInstructions"
		| "docType"
		| "validationModeOverrides"
		| "schemaLocation"
		| "noNamespaceSchemaLocation"
	>
> = {
	ignoreAttributes: false,
	attributeNamePrefix: "@_",
	textNodeName: "#text",
	omitXmlDeclaration: false,
	xmlVersion: "1.0",
	encoding: "UTF-8",
	omitNullValues: true,
	omitDefaultValues: true,
	useXsiType: false,
	emptyElementStyle: "self-closing",
	format: true,
	indent: "  ",
	strictValidation: false,
	requireAllByDefault: false,
	validationMode: "strict",
};
