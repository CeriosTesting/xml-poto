/**
 * Configuration for a single XSD source to process.
 */
export type EnumStyle = "union" | "enum" | "const-object";

export interface XsdSource {
	/** Path to the XSD file (relative to config file or absolute). */
	xsdPath: string;
	/** Output directory for generated TypeScript files. */
	outputDir: string;
	/** Output style: 'per-type' generates one file per class, 'per-xsd' puts all types in one file. */
	outputStyle?: "per-type" | "per-xsd";
	/** Enum generation style for this source. Overrides the global setting. */
	enumStyle?: EnumStyle;
}

/**
 * Root configuration for xml-poto-codegen.
 */
export interface XmlPotoCodegenConfig {
	/** Array of XSD sources to process. */
	sources: XsdSource[];
	/** Default output style when not specified per source. Defaults to 'per-type'. */
	defaultOutputStyle?: "per-type" | "per-xsd";
	/** Default enum generation style. Defaults to 'union'. */
	enumStyle?: EnumStyle;
}
