import { describe, expect, it } from "vitest";
import { XmlValidationUtil } from "../../src/utils/xml-validation-util";

describe("XmlValidationUtil", () => {
	describe("applyConverter", () => {
		it("should apply serialize converter", () => {
			const converter = {
				serialize: (val: any) => val.toString().toUpperCase(),
			};

			const result = XmlValidationUtil.applyConverter("test", converter, "serialize");

			expect(result).toBe("TEST");
		});

		it("should apply deserialize converter", () => {
			const converter = {
				deserialize: (val: string) => val.toLowerCase(),
			};

			const result = XmlValidationUtil.applyConverter("TEST", converter, "deserialize");

			expect(result).toBe("test");
		});

		it("should return original value when no converter provided", () => {
			const result = XmlValidationUtil.applyConverter("test", undefined, "serialize");

			expect(result).toBe("test");
		});

		it("should return original value when converter doesn't have requested operation", () => {
			const converter = {
				serialize: (val: any) => val.toString().toUpperCase(),
			};

			const result = XmlValidationUtil.applyConverter("test", converter, "deserialize");

			expect(result).toBe("test");
		});

		it("should handle complex converters", () => {
			const converter = {
				serialize: (val: Date) => val.toISOString(),
				deserialize: (val: string) => new Date(val),
			};

			const date = new Date("2023-01-01");
			const serialized = XmlValidationUtil.applyConverter(date, converter, "serialize");

			expect(serialized).toBe("2023-01-01T00:00:00.000Z");

			const deserialized = XmlValidationUtil.applyConverter(serialized, converter, "deserialize");
			expect(deserialized).toBeInstanceOf(Date);
		});
	});

	describe("convertToPropertyType", () => {
		it("should convert string value to boolean when property is boolean", () => {
			const instance = { flag: true };

			const result = XmlValidationUtil.convertToPropertyType("false", instance, "flag");

			expect(result).toBe(false);
		});

		it("should handle various boolean representations", () => {
			const instance = { flag: false };

			expect(XmlValidationUtil.convertToPropertyType("true", instance, "flag")).toBe(true);
			expect(XmlValidationUtil.convertToPropertyType("false", instance, "flag")).toBe(false);
			expect(XmlValidationUtil.convertToPropertyType(true, instance, "flag")).toBe(true);
			expect(XmlValidationUtil.convertToPropertyType(false, instance, "flag")).toBe(false);
			expect(XmlValidationUtil.convertToPropertyType(1, instance, "flag")).toBe(true);
			expect(XmlValidationUtil.convertToPropertyType(0, instance, "flag")).toBe(false);
			expect(XmlValidationUtil.convertToPropertyType("1", instance, "flag")).toBe(true);
		});

		it("should convert string to number when property is number", () => {
			const instance = { count: 0 };

			const result = XmlValidationUtil.convertToPropertyType("42", instance, "count");

			expect(result).toBe(42);
		});

		it("should handle invalid number conversion", () => {
			const instance = { count: 0 };

			const result = XmlValidationUtil.convertToPropertyType("not-a-number", instance, "count");

			expect(result).toBe(0);
		});

		it("should convert value to string when property is string", () => {
			const instance = { text: "" };

			const result = XmlValidationUtil.convertToPropertyType(123, instance, "text");

			expect(result).toBe("123");
		});

		it("should return undefined for null or undefined values", () => {
			const instance = { value: "" };

			expect(XmlValidationUtil.convertToPropertyType(null, instance, "value")).toBeUndefined();
			expect(XmlValidationUtil.convertToPropertyType(undefined, instance, "value")).toBeUndefined();
		});

		it("should return value as-is for complex types", () => {
			const instance = { obj: {} };
			const complexValue = { nested: "value" };

			const result = XmlValidationUtil.convertToPropertyType(complexValue, instance, "obj");

			expect(result).toBe(complexValue);
		});

		it("should handle decimal numbers", () => {
			const instance = { price: 0.0 };

			const result = XmlValidationUtil.convertToPropertyType("19.99", instance, "price");

			expect(result).toBe(19.99);
		});

		it("should handle negative numbers", () => {
			const instance = { temperature: 0 };

			const result = XmlValidationUtil.convertToPropertyType("-5", instance, "temperature");

			expect(result).toBe(-5);
		});
	});

	describe("validateValue", () => {
		it("should validate value against pattern", () => {
			const metadata: any = {
				name: "code",
				required: false,
				pattern: /^[0-9]+$/,
			};

			expect(XmlValidationUtil.validateValue("123", metadata)).toBe(true);
			expect(XmlValidationUtil.validateValue("abc", metadata)).toBe(false);
		});

		it("should validate value against enum values", () => {
			const metadata: any = {
				name: "color",
				required: false,
				enumValues: ["red", "green", "blue"],
			};

			expect(XmlValidationUtil.validateValue("red", metadata)).toBe(true);
			expect(XmlValidationUtil.validateValue("yellow", metadata)).toBe(false);
		});

		it("should validate against both pattern and enum", () => {
			const metadata: any = {
				name: "code",
				required: false,
				pattern: /^[A-Z]+$/,
				enumValues: ["ABC", "DEF", "GHI"],
			};

			expect(XmlValidationUtil.validateValue("ABC", metadata)).toBe(true);
			expect(XmlValidationUtil.validateValue("abc", metadata)).toBe(false); // Pattern fail
			expect(XmlValidationUtil.validateValue("XYZ", metadata)).toBe(false); // Enum fail
		});

		it("should return true when no validation rules provided", () => {
			const metadata: any = {
				name: "value",
				required: false,
			};

			expect(XmlValidationUtil.validateValue("anything", metadata)).toBe(true);
		});

		it("should handle complex patterns", () => {
			const metadata: any = {
				name: "email",
				required: false,
				pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
			};

			expect(XmlValidationUtil.validateValue("test@example.com", metadata)).toBe(true);
			expect(XmlValidationUtil.validateValue("invalid-email", metadata)).toBe(false);
		});

		it("should only validate pattern for string values", () => {
			const metadata: any = {
				name: "value",
				required: false,
				pattern: /^[0-9]+$/,
			};

			// Non-string values should return true (pattern not applicable)
			expect(XmlValidationUtil.validateValue(123, metadata)).toBe(true);
			expect(XmlValidationUtil.validateValue(true, metadata)).toBe(true);
		});
	});

	describe("getAllPropertyKeys", () => {
		it("should return all instance keys", () => {
			const obj = { prop1: "value1", prop2: "value2" };
			const propertyMappings = {};

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toContain("prop1");
			expect(keys).toContain("prop2");
			expect(keys).toHaveLength(2);
		});

		it("should return all mapped keys", () => {
			const obj = {};
			const propertyMappings = { prop1: "Prop1", prop2: "Prop2" };

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toContain("prop1");
			expect(keys).toContain("prop2");
			expect(keys).toHaveLength(2);
		});

		it("should combine instance and mapped keys", () => {
			const obj = { prop1: "value1", prop3: "value3" };
			const propertyMappings = { prop2: "Prop2", prop3: "Prop3" };

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toContain("prop1");
			expect(keys).toContain("prop2");
			expect(keys).toContain("prop3");
			expect(keys).toHaveLength(3);
		});

		it("should deduplicate keys", () => {
			const obj = { prop1: "value1" };
			const propertyMappings = { prop1: "Prop1" };

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toHaveLength(1);
			expect(keys[0]).toBe("prop1");
		});

		it("should handle empty object and mappings", () => {
			const obj = {};
			const propertyMappings = {};

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toHaveLength(0);
		});

		it("should include properties with undefined values", () => {
			const obj = { prop1: undefined, prop2: "value" };
			const propertyMappings = {};

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toContain("prop1");
			expect(keys).toContain("prop2");
		});

		it("should include properties with null values", () => {
			const obj = { prop1: null, prop2: "value" };
			const propertyMappings = {};

			const keys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

			expect(keys).toContain("prop1");
			expect(keys).toContain("prop2");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty converter object", () => {
			const converter = {};

			const result = XmlValidationUtil.applyConverter("test", converter as any, "serialize");

			expect(result).toBe("test");
		});

		it("should handle NaN in number conversion", () => {
			const instance = { value: 0 };

			const result = XmlValidationUtil.convertToPropertyType(Number.NaN, instance, "value");

			expect(result).toBe(0);
		});

		it("should handle empty string in number conversion", () => {
			const instance = { value: 0 };

			const result = XmlValidationUtil.convertToPropertyType("", instance, "value");

			expect(result).toBe(0);
		});

		it("should validate with empty enum array", () => {
			const metadata: any = {
				name: "value",
				required: false,
				enumValues: [],
			};

			expect(XmlValidationUtil.validateValue("anything", metadata)).toBe(true);
		});
	});
});
