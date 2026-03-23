import { describe, expect, it } from "vitest";

import {
	buildDecorator,
	buildFileHeader,
	buildImport,
	buildProperty,
	formatValue,
	indent,
	toKebabCase,
} from "../../src/generator/ts-builder";

describe("ts-builder", () => {
	describe("indent", () => {
		it("should indent non-empty lines", () => {
			const result = indent("line1\nline2", 1);
			expect(result).toBe("\tline1\n\tline2");
		});

		it("should not indent empty lines", () => {
			const result = indent("line1\n\nline2", 1);
			expect(result).toBe("\tline1\n\n\tline2");
		});

		it("should indent by multiple levels", () => {
			const result = indent("hello", 3);
			expect(result).toBe("\t\t\thello");
		});

		it("should handle zero indent", () => {
			const result = indent("hello", 0);
			expect(result).toBe("hello");
		});
	});

	describe("buildImport", () => {
		it("should return empty string for no names", () => {
			expect(buildImport([], "some-pkg")).toBe("");
		});

		it("should build inline import for 1-3 names", () => {
			const result = buildImport(["Foo", "Bar"], "some-pkg");
			expect(result).toBe('import { Bar, Foo } from "some-pkg";');
		});

		it("should sort names alphabetically", () => {
			const result = buildImport(["Zeta", "Alpha", "Middle"], "pkg");
			expect(result).toBe('import { Alpha, Middle, Zeta } from "pkg";');
		});

		it("should deduplicate names", () => {
			const result = buildImport(["Foo", "Foo", "Bar"], "pkg");
			expect(result).toBe('import { Bar, Foo } from "pkg";');
		});

		it("should build multi-line import for >3 names", () => {
			const result = buildImport(["A", "B", "C", "D"], "pkg");
			expect(result).toContain("import {\n");
			expect(result).toContain("\tA,");
			expect(result).toContain("\tB,");
			expect(result).toContain("\tC,");
			expect(result).toContain("\tD,");
			expect(result).toContain('} from "pkg";');
		});

		it("should support type imports", () => {
			const result = buildImport(["Foo"], "pkg", true);
			expect(result).toBe('import type { Foo } from "pkg";');
		});
	});

	describe("buildDecorator", () => {
		it("should build decorator with no options", () => {
			expect(buildDecorator("XmlRoot")).toBe("@XmlRoot()");
		});

		it("should build decorator with empty options object", () => {
			expect(buildDecorator("XmlRoot", {})).toBe("@XmlRoot()");
		});

		it("should filter out undefined values", () => {
			expect(buildDecorator("XmlRoot", { a: undefined })).toBe("@XmlRoot()");
		});

		it("should build inline decorator for short options", () => {
			const result = buildDecorator("XmlElement", { name: "'Foo'" });
			expect(result).toBe("@XmlElement({ name: 'Foo' })");
		});

		it("should build multi-line decorator for long options", () => {
			const longValue = "'a-very-long-name-that-exceeds-the-sixty-character-limit-easily'";
			const result = buildDecorator("XmlElement", { name: longValue, required: true });
			expect(result).toContain("@XmlElement({\n");
			expect(result).toContain("})");
		});
	});

	describe("formatValue", () => {
		it("should return strings as-is", () => {
			expect(formatValue("'hello'")).toBe("'hello'");
		});

		it("should convert numbers to string", () => {
			expect(formatValue(42)).toBe("42");
		});

		it("should convert booleans to string", () => {
			expect(formatValue(true)).toBe("true");
			expect(formatValue(false)).toBe("false");
		});

		it("should format regexps", () => {
			expect(formatValue(/abc/)).toBe("/abc/");
		});

		it("should format arrays", () => {
			expect(formatValue(["'a'", "'b'"])).toBe("['a', 'b']");
		});

		it("should format objects", () => {
			const result = formatValue({ uri: "'http://example.com'", prefix: "'ns'" });
			expect(result).toBe("{ uri: 'http://example.com', prefix: 'ns' }");
		});

		it("should handle null", () => {
			expect(formatValue(null)).toBe("null");
		});

		it("should handle undefined", () => {
			expect(formatValue(undefined)).toBe("undefined");
		});

		it("should filter undefined values in objects", () => {
			const result = formatValue({ a: "'hello'", b: undefined });
			expect(result).toBe("{ a: 'hello' }");
		});
	});

	describe("buildProperty", () => {
		it("should build a required property", () => {
			expect(buildProperty("name", "string", "''")).toBe("name: string = '';");
		});

		it("should build an optional property", () => {
			expect(buildProperty("name", "string", "''", true)).toBe("name?: string = '';");
		});

		it("should build an optional property without initializer", () => {
			expect(buildProperty("name", "string", undefined, true)).toBe("name?: string;");
		});
	});

	describe("buildFileHeader", () => {
		it("should include AUTO-GENERATED marker", () => {
			const result = buildFileHeader("test.xsd");
			expect(result).toContain("AUTO-GENERATED");
		});

		it("should include source path", () => {
			const result = buildFileHeader("./schemas/my-schema.xsd");
			expect(result).toContain("./schemas/my-schema.xsd");
		});

		it("should include package name", () => {
			const result = buildFileHeader("test.xsd");
			expect(result).toContain("@cerios/xml-poto-codegen");
		});
	});

	describe("toKebabCase", () => {
		it("should convert PascalCase to kebab-case", () => {
			expect(toKebabCase("MyClassName")).toBe("my-class-name");
		});

		it("should convert camelCase to kebab-case", () => {
			expect(toKebabCase("myClassName")).toBe("my-class-name");
		});

		it("should handle consecutive capitals", () => {
			expect(toKebabCase("XMLParser")).toBe("xml-parser");
		});

		it("should handle single word", () => {
			expect(toKebabCase("test")).toBe("test");
		});

		it("should handle already kebab-case", () => {
			expect(toKebabCase("already-kebab")).toBe("already-kebab");
		});
	});
});
