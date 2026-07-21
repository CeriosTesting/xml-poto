/* eslint-disable typescript/no-explicit-any -- Validation utils work with dynamic values of unknown type */
import { XmlAttributeMetadata, XmlListOptions, XmlValidationRule, XmlValueFacets } from "../decorators";

/** A single facet violation, identifying which validation rule failed. */
export interface XmlFacetViolation {
	rule: XmlValidationRule;
	message: string;
}

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
	static validateFacets(value: any, facets: XmlValueFacets): XmlFacetViolation[] {
		const violations: XmlFacetViolation[] = [];

		if (Array.isArray(value)) {
			XmlValidationUtil.validateLengthFacets(value.length, facets, "item count", violations);
			for (const item of value) {
				XmlValidationUtil.validateScalarFacets(item, facets, violations);
			}
		} else {
			XmlValidationUtil.validateScalarFacets(value, facets, violations);
			if (typeof value === "string") {
				XmlValidationUtil.validateLengthFacets(value.length, facets, "length", violations);
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
		if (facets.pattern && typeof value === "string" && !facets.pattern.test(value)) {
			violations.push({ rule: "pattern", message: `does not match pattern ${facets.pattern}` });
		}

		if (facets.enumValues && facets.enumValues.length > 0 && !facets.enumValues.includes(value)) {
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
		const hasNumericFacet =
			facets.minInclusive !== undefined ||
			facets.maxInclusive !== undefined ||
			facets.minExclusive !== undefined ||
			facets.maxExclusive !== undefined ||
			facets.totalDigits !== undefined ||
			facets.fractionDigits !== undefined;
		if (!hasNumericFacet) return;

		const num = Number(value);
		if (Number.isNaN(num) || String(value).trim() === "") return;

		XmlValidationUtil.validateBoundFacets(num, facets, violations);
		XmlValidationUtil.validateDigitFacets(num, facets, violations);
	}

	private static validateBoundFacets(num: number, facets: XmlValueFacets, violations: XmlFacetViolation[]): void {
		if (facets.minInclusive !== undefined && num < facets.minInclusive) {
			violations.push({ rule: "minInclusive", message: `is less than minInclusive ${facets.minInclusive}` });
		}
		if (facets.maxInclusive !== undefined && num > facets.maxInclusive) {
			violations.push({ rule: "maxInclusive", message: `is greater than maxInclusive ${facets.maxInclusive}` });
		}
		if (facets.minExclusive !== undefined && num <= facets.minExclusive) {
			violations.push({ rule: "minExclusive", message: `is not greater than minExclusive ${facets.minExclusive}` });
		}
		if (facets.maxExclusive !== undefined && num >= facets.maxExclusive) {
			violations.push({ rule: "maxExclusive", message: `is not less than maxExclusive ${facets.maxExclusive}` });
		}
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
	 * Coerce a raw string value based on the declared XSD dataType.
	 * Only used as a fallback when the property type cannot be inferred from
	 * its current runtime value.
	 */
	static coerceByDataType(value: any, dataType: string): any {
		if (typeof value !== "string") return value;

		const localType = dataType.includes(":") ? dataType.substring(dataType.indexOf(":") + 1) : dataType;

		if (NUMERIC_XSD_TYPES.has(localType)) {
			const num = Number(value);
			return Number.isNaN(num) || value.trim() === "" ? value : num;
		}

		if (localType === "boolean") {
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
