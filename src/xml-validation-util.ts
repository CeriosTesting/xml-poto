import { XmlAttributeMetadata } from "./decorators";

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
		operation: "serialize" | "deserialize"
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
	 * Get all property keys that should be included in XML (C#-style).
	 */
	static getAllPropertyKeys(obj: any, propertyMappings: Record<string, string>): string[] {
		// Get all keys from the object instance
		const instanceKeys = Object.keys(obj);

		// Get all keys that have property mappings (even if not set on instance)
		const mappedKeys = Object.keys(propertyMappings);

		// Combine and deduplicate
		const allKeys = [...new Set([...instanceKeys, ...mappedKeys])];

		return allKeys;
	}
}
