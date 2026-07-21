/**
 * Configuration for a single XSD source to process.
 */
export type EnumStyle = "union" | "enum" | "const-object";

/**
 * How local elements are namespace-qualified in generated decorators.
 *
 * - `schema` (default) honours the XSD's `elementFormDefault`, which itself
 *   defaults to `unqualified` when the schema does not declare it.
 * - `qualified` / `unqualified` force the choice, overriding the schema.
 *
 * Forcing is an escape hatch for services whose WSDL disagrees with what they
 * actually put on the wire.
 */
export type ElementForm = "schema" | "qualified" | "unqualified";

/**
 * How integer types wider than a JavaScript number are generated.
 *
 * `xs:integer` is arbitrary-precision and `xs:long` reaches 9223372036854775807,
 * both beyond `Number.MAX_SAFE_INTEGER` — so `9007199254740993` silently becomes
 * `…992`.
 *
 * - `number` (default) keeps today's ergonomic mapping and accepts that loss.
 * - `string` generates such types as `string`, preserving the value exactly.
 *   Integer types bounded by a `totalDigits` within range stay `number` either
 *   way, so most schemas are unaffected.
 */
export type BigIntegerAs = "number" | "string";

export interface XsdSource {
	/** Path to the XSD file (relative to config file or absolute). */
	xsdPath: string;
	/**
	 * Output path for generated TypeScript files.
	 * - per-type: directory path
	 * - per-xsd: file path
	 */
	outputPath: string;
	/** Output style: 'per-type' generates one file per class, 'per-xsd' puts all types in one file. */
	outputStyle?: "per-type" | "per-xsd";
	/** Enum generation style for this source. Overrides the global setting. */
	enumStyle?: EnumStyle;
	/** Whether to emit @XmlRoot for root elements. When false, @XmlElement is used instead. Overrides the global setting. */
	useXmlRoot?: boolean;
	/** How local elements are qualified. Overrides the global setting. */
	elementForm?: ElementForm;
	/** How over-wide integer types are generated. Overrides the global setting. */
	bigIntegerAs?: BigIntegerAs;
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
	/** Whether to emit @XmlRoot for root elements. When false, @XmlElement is used instead. Defaults to true. */
	useXmlRoot?: boolean;
	/** How local elements are qualified. Defaults to 'schema'. */
	elementForm?: ElementForm;
	/** How over-wide integer types are generated. Defaults to 'number'. */
	bigIntegerAs?: BigIntegerAs;
}
