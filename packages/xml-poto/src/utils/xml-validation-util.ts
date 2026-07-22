/* eslint-disable typescript/no-explicit-any -- Validation utils work with dynamic values of unknown type */
import { XmlAttributeMetadata, XmlListOptions, XmlValidationRule, XmlValueFacets } from "../decorators";

/** A single facet violation, identifying which validation rule failed. */
export interface XmlFacetViolation {
	rule: XmlValidationRule;
	message: string;
}

/**
 * Facets plus the declared XSD type, which the length family needs: `xs:length`
 * counts octets for the binary types and characters for everything else.
 */
export type XmlFacetsWithDataType = XmlValueFacets & { dataType?: string };

/**
 * Utility class for XML validation operations.
 */
export class XmlValidationUtil {
	/**
	 * Apply custom converter if available.
	 */
	static applyConverter(
		value: any,
		converter: XmlAttributeMetadata["converter"],
		operation: "serialize" | "deserialize",
	): any {
		if (!converter) return value;

		if (operation === "serialize" && converter.serialize) {
			return converter.serialize(value);
		}

		if (operation === "deserialize" && converter.deserialize) {
			return converter.deserialize(value);
		}

		return value;
	}

	/**
	 * Type-safe value conversion for decorator-based properties.
	 */
	static convertToPropertyType(value: any, instance: any, propertyKey: string): any {
		// If there's no value, return undefined
		if (value === null || value === undefined) {
			return undefined;
		}

		// Get the current property value to infer the expected type
		const currentValue = instance[propertyKey];

		// Handle primitive type conversions based on the current property type
		if (typeof currentValue === "boolean") {
			// Convert to boolean: 'true', 'false', 1, 0, etc.
			return value === "true" || value === true || value === 1 || value === "1";
		} else if (typeof currentValue === "number") {
			// Convert to number
			const numValue = Number(value);
			return Number.isNaN(numValue) ? 0 : numValue;
		} else if (typeof currentValue === "string") {
			// Convert to string
			return String(value);
		}

		// For objects, dates, and other complex types, return as-is
		// Converters should handle these cases
		return value;
	}

	/**
	 * Validate value against pattern and enum constraints.
	 */
	static validateValue(value: any, metadata: XmlAttributeMetadata): boolean {
		return XmlValidationUtil.validateFacets(value, metadata).length === 0;
	}

	/**
	 * Validate a value against XSD facets (pattern, enumValues, length family,
	 * numeric bounds, digit counts, fixedValue).
	 * Returns ALL violations (one per rule) so callers can handle each rule
	 * according to its own validation mode.
	 * Arrays (xs:list values) are length-checked as item counts; other facets
	 * apply to each item.
	 */
	static validateFacets(value: any, facets: XmlFacetsWithDataType): XmlFacetViolation[] {
		const violations: XmlFacetViolation[] = [];

		if (Array.isArray(value)) {
			XmlValidationUtil.validateLengthFacets(value.length, facets, "item count", violations);
			for (const item of value) {
				XmlValidationUtil.validateScalarFacets(item, facets, violations);
			}
		} else {
			XmlValidationUtil.validateScalarFacets(value, facets, violations);
			if (typeof value === "string") {
				const { length, unit } = measureValue(value, facets.dataType);
				XmlValidationUtil.validateLengthFacets(length, facets, unit, violations);
			}
		}

		return XmlValidationUtil.deduplicateByRule(violations);
	}

	/** Keep only the first violation per rule (list items can repeat rules). */
	private static deduplicateByRule(violations: XmlFacetViolation[]): XmlFacetViolation[] {
		if (violations.length <= 1) return violations;
		const seen = new Set<XmlValidationRule>();
		return violations.filter((v) => {
			if (seen.has(v.rule)) return false;
			seen.add(v.rule);
			return true;
		});
	}

	private static validateScalarFacets(value: any, facets: XmlValueFacets, violations: XmlFacetViolation[]): void {
		if (facets.pattern && typeof value === "string" && !anchorPattern(facets.pattern).test(value)) {
			violations.push({ rule: "pattern", message: `does not match pattern ${facets.pattern}` });
		}

		if (
			facets.enumValues &&
			facets.enumValues.length > 0 &&
			!XmlValidationUtil.matchesEnumValue(value, facets.enumValues)
		) {
			violations.push({
				rule: "enumValues",
				message: `is not one of the allowed values [${facets.enumValues.join(", ")}]`,
			});
		}

		if (facets.fixedValue !== undefined && !XmlValidationUtil.matchesFixedValue(value, facets.fixedValue)) {
			violations.push({ rule: "fixedValue", message: `does not equal the fixed value '${facets.fixedValue}'` });
		}

		XmlValidationUtil.validateNumericFacets(value, facets, violations);
	}

	/**
	 * Restore the lexical form of an enumeration token the parser numericised.
	 *
	 * An enumeration's members are wire tokens, and codegen types them as a string
	 * union (`'1' | '2'`), so `<grade>2</grade>` must deserialize to `"2"` and not
	 * the number `2` — otherwise the value does not inhabit its own declared type.
	 * Only values whose lexical form is actually a declared token are converted, so
	 * this can never mangle a value the enumeration does not describe.
	 */
	static normalizeEnumToken(value: any, enumValues: readonly string[] | undefined): any {
		if (!enumValues || enumValues.length === 0) return value;
		if (typeof value !== "number" && typeof value !== "boolean") return value;
		const lexical = String(value);
		return enumValues.includes(lexical) ? lexical : value;
	}

	/**
	 * Is `value` one of the enumeration's allowed tokens?
	 *
	 * Enumeration facets are declared as the lexical tokens that appear on the
	 * wire, but the parser may have already turned a numeric-looking token into a
	 * number — `<grade>2</grade>` arrives as `2`, which no strict comparison with
	 * `["1", "2"]` would match. Compare the lexical form as a fallback so an
	 * enumeration of numeric-looking tokens validates on elements as well as
	 * attributes. Mirrors {@link matchesFixedValue}.
	 */
	private static matchesEnumValue(value: any, enumValues: readonly string[]): boolean {
		if (enumValues.includes(value)) return true;
		if (typeof value === "number" || typeof value === "boolean") {
			return enumValues.includes(String(value));
		}
		return false;
	}

	/**
	 * Compare a value with an XSD fixed value. Compares numerically when both
	 * sides are numeric so parsed values like 1 still match "1.0".
	 */
	private static matchesFixedValue(value: any, fixedValue: string | number | boolean): boolean {
		const bothNumeric =
			typeof value !== "boolean" &&
			String(value).trim() !== "" &&
			!Number.isNaN(Number(value)) &&
			!Number.isNaN(Number(fixedValue));
		return bothNumeric ? Number(value) === Number(fixedValue) : String(value) === String(fixedValue);
	}

	private static validateNumericFacets(value: any, facets: XmlValueFacets, violations: XmlFacetViolation[]): void {
		const hasBoundFacet =
			facets.minInclusive !== undefined ||
			facets.maxInclusive !== undefined ||
			facets.minExclusive !== undefined ||
			facets.maxExclusive !== undefined;
		const hasDigitFacet = facets.totalDigits !== undefined || facets.fractionDigits !== undefined;
		if (!hasBoundFacet && !hasDigitFacet) return;
		if (String(value).trim() === "") return;

		if (hasBoundFacet) {
			XmlValidationUtil.validateBoundFacets(value, facets, violations);
		}

		// Digit counts are meaningful only for a value that really is a number.
		const num = Number(value);
		if (hasDigitFacet && !Number.isNaN(num)) {
			XmlValidationUtil.validateDigitFacets(num, facets, violations);
		}
	}

	private static validateBoundFacets(value: any, facets: XmlValueFacets, violations: XmlFacetViolation[]): void {
		const compare = (bound: number | string): number => XmlValidationUtil.compareToBound(value, bound);

		if (facets.minInclusive !== undefined && compare(facets.minInclusive) < 0) {
			violations.push({ rule: "minInclusive", message: `is less than minInclusive ${facets.minInclusive}` });
		}
		if (facets.maxInclusive !== undefined && compare(facets.maxInclusive) > 0) {
			violations.push({ rule: "maxInclusive", message: `is greater than maxInclusive ${facets.maxInclusive}` });
		}
		if (facets.minExclusive !== undefined && compare(facets.minExclusive) <= 0) {
			violations.push({ rule: "minExclusive", message: `is not greater than minExclusive ${facets.minExclusive}` });
		}
		if (facets.maxExclusive !== undefined && compare(facets.maxExclusive) >= 0) {
			violations.push({ rule: "maxExclusive", message: `is not less than maxExclusive ${facets.maxExclusive}` });
		}
	}

	/**
	 * Order a value against a bound facet, returning the usual negative/zero/positive.
	 *
	 * Numbers compare numerically. Anything else compares lexicographically, which is
	 * exactly right for the ordered XSD date/time types: their canonical lexical forms
	 * (`2000-01-01`, `2000-01-01T09:30:00`) sort chronologically as strings, so a
	 * `minInclusive: "2000-01-01"` bound on an `xs:date` orders correctly without the
	 * library having to parse dates.
	 *
	 * `NaN` never compares, so a non-numeric value measured against a numeric bound
	 * reports no violation — the type mismatch is not this facet's to report.
	 */
	private static compareToBound(value: any, bound: number | string): number {
		const boundNum = typeof bound === "number" ? bound : Number(bound);
		const valueNum = Number(value);
		const bothNumeric = !Number.isNaN(boundNum) && !Number.isNaN(valueNum) && typeof value !== "boolean";

		if (bothNumeric) {
			return valueNum === boundNum ? 0 : valueNum < boundNum ? -1 : 1;
		}

		if (typeof bound === "number" || Number.isNaN(valueNum) !== Number.isNaN(boundNum)) {
			// One side is numeric and the other is not: not comparable.
			return 0;
		}

		const lexical = String(value);
		return lexical === bound ? 0 : lexical < bound ? -1 : 1;
	}

	private static validateDigitFacets(num: number, facets: XmlValueFacets, violations: XmlFacetViolation[]): void {
		if (facets.totalDigits === undefined && facets.fractionDigits === undefined) {
			return;
		}
		const [integerPart, fractionPart = ""] = Math.abs(num).toString().split(".");
		const totalDigits = integerPart.replace(/^0+(?=\d)/, "").length + fractionPart.length;
		if (facets.totalDigits !== undefined && totalDigits > facets.totalDigits) {
			violations.push({ rule: "totalDigits", message: `has more than ${facets.totalDigits} total digits` });
		}
		if (facets.fractionDigits !== undefined && fractionPart.length > facets.fractionDigits) {
			violations.push({
				rule: "fractionDigits",
				message: `has more than ${facets.fractionDigits} fraction digits`,
			});
		}
	}

	private static validateLengthFacets(
		actual: number,
		facets: XmlValueFacets,
		unit: string,
		violations: XmlFacetViolation[],
	): void {
		if (facets.length !== undefined && actual !== facets.length) {
			violations.push({ rule: "length", message: `has ${unit} ${actual}, expected exactly ${facets.length}` });
		}
		if (facets.minLength !== undefined && actual < facets.minLength) {
			violations.push({ rule: "minLength", message: `has ${unit} ${actual}, expected at least ${facets.minLength}` });
		}
		if (facets.maxLength !== undefined && actual > facets.maxLength) {
			violations.push({ rule: "maxLength", message: `has ${unit} ${actual}, expected at most ${facets.maxLength}` });
		}
	}

	/**
	 * Apply xs:whiteSpace normalization to a string value.
	 * 'replace' maps tabs/newlines to spaces; 'collapse' additionally squeezes
	 * runs of spaces and trims; 'preserve' returns the value unchanged.
	 */
	static applyWhiteSpace(value: string, mode: "preserve" | "replace" | "collapse"): string {
		if (mode === "preserve") return value;
		const replaced = value.replace(/[\t\r\n]/g, " ");
		if (mode === "replace") return replaced;
		return replaced.replace(/ {2,}/g, " ").trim();
	}

	/**
	 * Coerce a parsed value to the type its declared XSD dataType implies.
	 *
	 * The input is not necessarily a string: the XML parser already turns
	 * numeric-looking element text into a number, so `<flag>1</flag>` arrives here
	 * as `1` even though xs:boolean says it means `true`. Each branch therefore
	 * decides for itself what inputs it accepts, rather than bailing on everything
	 * non-string up front.
	 *
	 * A value that cannot be represented in the declared type is returned unchanged
	 * — coercion never invents `NaN`, and validation reports the mismatch instead.
	 */
	static coerceByDataType(value: any, dataType: string): any {
		const localType = dataType.includes(":") ? dataType.substring(dataType.indexOf(":") + 1) : dataType;

		if (NUMERIC_XSD_TYPES.has(localType)) {
			if (typeof value === "number") return value;
			if (typeof value !== "string") return value;
			const num = Number(value);
			return Number.isNaN(num) || value.trim() === "" ? value : num;
		}

		if (localType === "boolean") {
			if (typeof value === "boolean") return value;
			// xs:boolean has four lexical forms: true/false/1/0. The parser may hand
			// us the last two already numericised.
			if (value === 1) return true;
			if (value === 0) return false;
			if (value === "true" || value === "1") return true;
			if (value === "false" || value === "0") return false;
			return value;
		}

		return value;
	}

	/**
	 * Split an xs:list text value (space-separated) into typed items.
	 */
	static splitList(text: string, list: XmlListOptions): (string | number | boolean)[] {
		const itemType = typeof list === "object" ? (list.itemType ?? "string") : "string";
		const items = text.trim().split(/\s+/).filter(Boolean);

		if (itemType === "number") {
			return items.map((item) => {
				const num = Number(item);
				return Number.isNaN(num) ? item : num;
			});
		}
		if (itemType === "boolean") {
			return items.map((item) =>
				item === "true" || item === "1" ? true : item === "false" || item === "0" ? false : item,
			);
		}
		return items;
	}

	/**
	 * Join xs:list items into a space-separated text value.
	 */
	static joinList(items: unknown[]): string {
		return items.map((item) => String(item)).join(" ");
	}

	/**
	 * Translate an in-memory enum member to its XML token for serialization
	 * (`[XmlEnum]` member→token). Non-string values and members absent from the
	 * map pass through unchanged.
	 */
	static mapEnumSerialize(value: unknown, enumMap?: Record<string, string>): unknown {
		if (!enumMap || typeof value !== "string") return value;
		return Object.prototype.hasOwnProperty.call(enumMap, value) ? enumMap[value] : value;
	}

	/**
	 * Translate an XML token back to its in-memory enum member for deserialization
	 * (`[XmlEnum]` token→member). Tokens absent from the map pass through unchanged.
	 */
	static mapEnumDeserialize(value: unknown, enumMap?: Record<string, string>): unknown {
		if (!enumMap || typeof value !== "string") return value;
		for (const member in enumMap) {
			if (enumMap[member] === value) return member;
		}
		return value;
	}

	/**
	 * Get all property keys that should be included in XML.
	 * Optimized to avoid intermediate array allocations.
	 */
	static getAllPropertyKeys(obj: any, propertyMappings: Record<string, string>): string[] {
		const allKeys = new Set<string>();

		// Add all keys from the object instance
		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				allKeys.add(key);
			}
		}

		// Add all keys that have property mappings (even if not set on instance)
		for (const key in propertyMappings) {
			allKeys.add(key);
		}

		return Array.from(allKeys);
	}

	/**
	 * Try to convert a value to one of the union types.
	 * Attempts conversion in order: object types first, then primitives (number, boolean, string).
	 */
	static tryConvertToUnionType(value: any, unionTypes?: any[]): any {
		if (!unionTypes || unionTypes.length === 0) {
			return value;
		}

		// If value is already an object, return as-is
		if (typeof value === "object" && value !== null) {
			return value;
		}

		// For primitive values, try conversions in priority order
		const stringValue = String(value);
		return (
			XmlValidationUtil.tryConvertToNumber(stringValue, unionTypes) ??
			XmlValidationUtil.tryConvertToBoolean(stringValue, unionTypes) ??
			(unionTypes.includes(String) ? stringValue : value)
		);
	}

	/**
	 * Attempt to convert a string to Number if Number is in the union types.
	 */
	private static tryConvertToNumber(stringValue: string, unionTypes: any[]): number | null {
		if (!unionTypes.includes(Number)) return null;
		const numValue = Number(stringValue);
		if (!Number.isNaN(numValue) && stringValue.trim() !== "") {
			return numValue;
		}
		return null;
	}

	/**
	 * Attempt to convert a string to Boolean if Boolean is in the union types.
	 */
	private static tryConvertToBoolean(stringValue: string, unionTypes: any[]): boolean | null {
		if (!unionTypes.includes(Boolean)) return null;
		const lowerValue = stringValue.toLowerCase();
		if (lowerValue === "true" || lowerValue === "1") return true;
		if (lowerValue === "false" || lowerValue === "0") return false;
		return null;
	}
}

/**
 * Measure a value the way `xs:length` and its min/max siblings do.
 *
 * XSD counts **octets** for `hexBinary` and `base64Binary` — the length of the
 * data, not of its encoding — and **characters** for everything else. Characters
 * means code points, so `"…"` spelled with an astral character counts once;
 * `String.length` would count the surrogate pair as two.
 */
function measureValue(value: string, dataType: string | undefined): { length: number; unit: string } {
	const localType = dataType?.includes(":") ? dataType.slice(dataType.indexOf(":") + 1) : dataType;

	if (localType === "hexBinary") {
		// Two hex digits per octet.
		return { length: Math.floor(value.length / 2), unit: "octet count" };
	}

	if (localType === "base64Binary") {
		return { length: base64OctetLength(value), unit: "octet count" };
	}

	// Spread, not .length: code points, not UTF-16 code units.
	// eslint-disable-next-line typescript/no-misused-spread -- code points are exactly what xs:length counts
	return { length: [...value].length, unit: "length" };
}

/** Octets encoded by a base64 string, from its length and padding. */
function base64OctetLength(value: string): number {
	const compact = value.replace(/\s/g, "");
	if (compact.length === 0) return 0;
	const padding = compact.endsWith("==") ? 2 : compact.endsWith("=") ? 1 : 0;
	return Math.max(0, (compact.length / 4) * 3 - padding);
}

/**
 * Derived whole-value regexes, keyed by the decorator's original. Anchoring is
 * pure string work, but it happens per validated value, so the result is cached
 * for the lifetime of the pattern object (one per decorator).
 */
const ANCHORED_PATTERN_CACHE = new WeakMap<RegExp, RegExp>();

/**
 * Anchor an XSD `pattern` facet so it constrains the *whole* value.
 *
 * `xs:pattern` is an implicit full match, but `RegExp.test` succeeds on any
 * substring — an unanchored `[0-9]{9}` would accept `"abc123456789xyz"`.
 *
 * The source is always wrapped, even when it already starts with `^` and ends
 * with `$`: that pair does not imply the pattern is anchored (`^a|b$` has both
 * and is not), and re-wrapping an already-anchored pattern is harmless.
 * `g`/`y` are dropped because they make `test` stateful via `lastIndex`.
 */
function anchorPattern(pattern: RegExp): RegExp {
	const cached = ANCHORED_PATTERN_CACHE.get(pattern);
	if (cached) return cached;

	const flags = pattern.flags.replace(/[gy]/g, "");
	const anchored = new RegExp(`^(?:${pattern.source})$`, flags);
	ANCHORED_PATTERN_CACHE.set(pattern, anchored);
	return anchored;
}

/** XSD built-in types coerced to number by coerceByDataType */
const NUMERIC_XSD_TYPES = new Set([
	"integer",
	"int",
	"long",
	"short",
	"byte",
	"decimal",
	"float",
	"double",
	"nonNegativeInteger",
	"nonPositiveInteger",
	"positiveInteger",
	"negativeInteger",
	"unsignedInt",
	"unsignedLong",
	"unsignedShort",
	"unsignedByte",
]);
