import { beforeEach, describe, expect, it, vi } from "vitest";
import { getXmlRootMetadata } from "../../src/decorators/getters";
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

			const metadata = getXmlRootMetadata(TestRoot);
			expect(metadata).toBeDefined();
			expect(metadata?.elementName).toBe("TestRoot");
		});

		it("should store custom element name", () => {
			@XmlRoot({ name: "CustomRoot" })
			class TestRoot {}

			const metadata = getXmlRootMetadata(TestRoot);
			expect(metadata?.elementName).toBe("CustomRoot");
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

			const metadata = getXmlRootMetadata(Person);
			expect(metadata?.namespace).toEqual({
				uri: "http://example.com/person",
				prefix: "per",
			});
		});

		it("should store dataType", () => {
			@XmlRoot({ name: "Data", dataType: "xs:string" })
			class DataRoot {}

			const metadata = getXmlRootMetadata(DataRoot);
			expect(metadata?.dataType).toBe("xs:string");
		});

		it("should store isNullable flag", () => {
			@XmlRoot({ name: "NullableRoot", isNullable: true })
			class NullableRoot {}

			const metadata = getXmlRootMetadata(NullableRoot);
			expect(metadata?.isNullable).toBe(true);
		});
	});

	describe("WeakMap storage", () => {
		it("should store metadata in unified storage", () => {
			@XmlRoot({ name: "StorageTest" })
			class StorageTest {}

			const storedMetadata = getMetadata(StorageTest).root;
			expect(storedMetadata).toBeDefined();
			expect(storedMetadata?.elementName).toBe("StorageTest");
		});

		it("should allow multiple classes with different metadata", () => {
			@XmlRoot({ name: "FirstRoot" })
			class FirstClass {}

			@XmlRoot({ name: "SecondRoot" })
			class SecondClass {}

			const firstMetadata = getXmlRootMetadata(FirstClass);
			const secondMetadata = getXmlRootMetadata(SecondClass);

			expect(firstMetadata?.elementName).toBe("FirstRoot");
			expect(secondMetadata?.elementName).toBe("SecondRoot");
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

			const metadata = getXmlRootMetadata(ComplexRoot);
			expect(metadata).toEqual({
				name: "ComplexRoot",
				elementName: "ComplexRoot", // Backward compatibility
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

			const metadata = getXmlRootMetadata(EmptyNamespace);
			expect(metadata?.namespace).toEqual({});
		});
	});

	describe("Edge cases", () => {
		it("should work with class expressions", () => {
			const TestClass = XmlRoot({ name: "DynamicRoot" })(
				class {} as any,
				{ name: "DynamicClass", kind: "class" } as any
			);

			const metadata = getXmlRootMetadata(TestClass);
			expect(metadata?.name).toBe("DynamicRoot");
		});

		it("should handle undefined options", () => {
			@XmlRoot(undefined)
			class UndefinedOptions {}

			const metadata = getXmlRootMetadata(UndefinedOptions);
			expect(metadata).toBeDefined();
			expect(metadata?.elementName).toBe("UndefinedOptions");
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata structure", () => {
			@XmlRoot({
				name: "TypeSafeRoot",
				namespace: { uri: "http://test.com" },
			})
			class TypeSafeRoot {}

			const metadata = getXmlRootMetadata(TypeSafeRoot);
			expect(metadata).toHaveProperty("name");
			expect(metadata).toHaveProperty("namespace");
			expect(typeof metadata?.name).toBe("string");
			expect(typeof metadata?.namespace).toBe("object");
		});
	});
});
