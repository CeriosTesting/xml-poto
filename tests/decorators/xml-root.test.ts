import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetadata } from "../../src/decorators/storage/metadata-storage";
import { XmlRoot } from "../../src/decorators/xml-root";

describe("XmlRoot decorator", () => {
	beforeEach(() => {
		// Clear any existing metadata
		vi.clearAllMocks();
	});

	describe("Basic functionality", () => {
		it("should store root metadata with default options", () => {
			@XmlRoot()
			class TestRoot {}

			const metadata = getMetadata(TestRoot).root;
			expect(metadata).toBeDefined();
			expect(metadata?.name).toBe("TestRoot");
		});

		it("should store custom element name", () => {
			@XmlRoot({ name: "CustomRoot" })
			class TestRoot {}

			const metadata = getMetadata(TestRoot).root;
			expect(metadata?.name).toBe("CustomRoot");
		});

		it("should store namespace information", () => {
			@XmlRoot({
				name: "Person",
				namespace: {
					uri: "http://example.com/person",
					prefix: "per",
				},
			})
			class Person {}

			const metadata = getMetadata(Person).root;
			expect(metadata?.namespace).toEqual({
				uri: "http://example.com/person",
				prefix: "per",
			});
		});

		it("should store dataType", () => {
			@XmlRoot({ name: "Data", dataType: "xs:string" })
			class DataRoot {}

			const metadata = getMetadata(DataRoot).root;
			expect(metadata?.dataType).toBe("xs:string");
		});

		it("should store isNullable flag", () => {
			@XmlRoot({ name: "NullableRoot", isNullable: true })
			class NullableRoot {}

			const metadata = getMetadata(NullableRoot).root;
			expect(metadata?.isNullable).toBe(true);
		});
	});

	describe("WeakMap storage", () => {
		it("should store metadata in unified storage", () => {
			@XmlRoot({ name: "StorageTest" })
			class StorageTest {}

			const storedMetadata = getMetadata(StorageTest).root;
			expect(storedMetadata).toBeDefined();
			expect(storedMetadata?.name).toBe("StorageTest");
		});

		it("should allow multiple classes with different metadata", () => {
			@XmlRoot({ name: "FirstRoot" })
			class FirstClass {}

			@XmlRoot({ name: "SecondRoot" })
			class SecondClass {}

			const firstMetadata = getMetadata(FirstClass).root;
			const secondMetadata = getMetadata(SecondClass).root;

			expect(firstMetadata?.name).toBe("FirstRoot");
			expect(secondMetadata?.name).toBe("SecondRoot");
		});
	});

	describe("Complex configurations", () => {
		it("should handle all options together", () => {
			@XmlRoot({
				name: "ComplexRoot",
				namespace: { uri: "http://example.com", prefix: "ex" },
				dataType: "xs:complexType",
				isNullable: false,
			})
			class ComplexRoot {}

			const metadata = getMetadata(ComplexRoot).root;
			expect(metadata).toEqual({
				name: "ComplexRoot",
				elementName: "ComplexRoot",
				namespace: { uri: "http://example.com", prefix: "ex" },
				dataType: "xs:complexType",
				isNullable: false,
				xmlSpace: undefined,
			});
		});

		it("should handle empty namespace object", () => {
			@XmlRoot({
				name: "Root",
				namespace: {} as any,
			})
			class EmptyNamespace {}

			const metadata = getMetadata(EmptyNamespace).root;
			expect(metadata?.namespace).toEqual({});
		});
	});

	describe("Edge cases", () => {
		it("should work with class expressions", () => {
			const TestClass = XmlRoot({ name: "DynamicRoot" })(
				class {} as any,
				{ name: "DynamicClass", kind: "class" } as any
			);

			const metadata = getMetadata(TestClass).root;
			expect(metadata?.name).toBe("DynamicRoot");
		});

		it("should handle undefined options", () => {
			@XmlRoot(undefined)
			class UndefinedOptions {}

			const metadata = getMetadata(UndefinedOptions).root;
			expect(metadata).toBeDefined();
			expect(metadata?.name).toBe("UndefinedOptions");
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata structure", () => {
			@XmlRoot({
				name: "TypeSafeRoot",
				namespace: { uri: "http://test.com" },
			})
			class TypeSafeRoot {}

			const metadata = getMetadata(TypeSafeRoot).root;
			expect(metadata).toHaveProperty("name");
			expect(metadata).toHaveProperty("namespace");
			expect(typeof metadata?.name).toBe("string");
			expect(typeof metadata?.namespace).toBe("object");
		});
	});
});
