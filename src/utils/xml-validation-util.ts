/* eslint-disable typescript/no-explicit-any -- Validation utils work with dynamic values of unknown type */
import { XmlAttributeMetadata } from "../decorators";

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
		if (metadata.pattern && typeof value === "string") {
			if (!metadata.pattern.test(value)) {
				return false;
			}
		}

		if (metadata.enumValues && metadata.enumValues.length > 0) {
			if (!metadata.enumValues.includes(value)) {
				return false;
			}
		}

		return true;
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
