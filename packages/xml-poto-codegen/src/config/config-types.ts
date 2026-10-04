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

/**
 * How a required property is declared when no value is assigned at construction.
 *
 * A required member is generated either with a default initializer (`name: string = ''`) or
 * with a definite-assignment assertion (`name!: string`), which makes `tsc` demand an
 * assignment under `strictPropertyInitialization`.
 *
 * - `schema` (default) decides per property: keep the initializer unless the property's own
 *   facets reject it. A `''` under `minLength="1"` only defers a missing assignment into a
 *   runtime facet error at serialization time, so such members get `!` instead.
 * - `definite` always emits `!`, whatever the schema says.
 * - `initialized` always emits an initializer where one is possible.
 *
 * Forcing a style is for a codebase that wants one uniform shape: whether a schema restricts
 * its simple types is what decides the default per property, so two schemas describing the
 * same service can generate differently.
 *
 * Enum-typed and abstract-typed members take `!` under every style — no assignable
 * initializer exists for them.
 */
export type RequiredPropertyStyle = "schema" | "definite" | "initialized";

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
	/**
	 * Whether to emit @XmlRoot for root elements. When false, @XmlElement is used instead.
	 * Overrides the global setting.
	 *
	 * @deprecated Nothing needs this any more: `SoapSerializer` wraps and unwraps
	 * Envelope/Body around an @XmlRoot payload, and an @XmlRoot class embeds fine as a
	 * member type — the referencing @XmlElement({ name }) decides the tag. Remove the
	 * option; it is removed in the next major.
	 */
	useXmlRoot?: boolean;
	/** How local elements are qualified. Overrides the global setting. */
	elementForm?: ElementForm;
	/** How over-wide integer types are generated. Overrides the global setting. */
	bigIntegerAs?: BigIntegerAs;
	/** How required properties are declared. Overrides the global setting. */
	requiredPropertyStyle?: RequiredPropertyStyle;
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
	/**
	 * Whether to emit @XmlRoot for root elements. When false, @XmlElement is used instead.
	 * Defaults to true.
	 *
	 * @deprecated Nothing needs this any more: `SoapSerializer` wraps and unwraps
	 * Envelope/Body around an @XmlRoot payload, and an @XmlRoot class embeds fine as a
	 * member type — the referencing @XmlElement({ name }) decides the tag. Remove the
	 * option; it is removed in the next major.
	 */
	useXmlRoot?: boolean;
	/** How local elements are qualified. Defaults to 'schema'. */
	elementForm?: ElementForm;
	/** How over-wide integer types are generated. Defaults to 'number'. */
	bigIntegerAs?: BigIntegerAs;
	/** How required properties are declared. Defaults to 'schema'. */
	requiredPropertyStyle?: RequiredPropertyStyle;
}
