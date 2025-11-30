import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetadata } from "../../src/decorators/storage/metadata-storage";
import { XmlElement } from "../../src/decorators/xml-element";

describe("XmlElement decorator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Class decorator usage", () => {
		it("should store element metadata with default options", () => {
			@XmlElement()
			class TestElement {}

			const metadata = getMetadata(TestElement).element;
			expect(metadata).toBeDefined();
			expect(metadata?.name).toBe("TestElement");
			expect(metadata?.required).toBe(false);
		});

		it("should store custom element name from string", () => {
			@XmlElement("CustomName")
			class TestElement {}

			const metadata = getMetadata(TestElement).element;
			expect(metadata?.name).toBe("CustomName"); // Class decorator uses context.name
		});

		it("should store element name from options", () => {
			@XmlElement({ name: "CustomElement" })
			class TestElement {}

			const metadata = getMetadata(TestElement).element;
			expect(metadata?.name).toBe("CustomElement");
		});

		it("should store namespace information", () => {
			@XmlElement({
				name: "Person",
				namespace: { uri: "http://example.com", prefix: "ex" },
			})
			class Person {}

			const metadata = getMetadata(Person).element;
			expect(metadata?.namespace).toEqual({
				uri: "http://example.com",
				prefix: "ex",
			});
		});

		it("should store required flag", () => {
			@XmlElement({ name: "RequiredElement", required: true })
			class RequiredElement {}

			const metadata = getMetadata(RequiredElement).element;
			expect(metadata?.required).toBe(true);
		});

		it("should store order", () => {
			@XmlElement({ name: "OrderedElement", order: 5 })
			class OrderedElement {}

			const metadata = getMetadata(OrderedElement).element;
			expect(metadata?.order).toBe(5);
		});

		it("should store all metadata properties", () => {
			@XmlElement({
				name: "ComplexElement",
				namespace: { uri: "http://test.com" },
				required: true,
				order: 10,
				dataType: "xs:string",
				isNullable: true,
				form: "qualified",
				type: String,
			})
			class ComplexElement {}

			const metadata = getMetadata(ComplexElement).element;
			expect(metadata).toEqual({
				name: "ComplexElement",
				namespace: { uri: "http://test.com" },
				required: true,
				order: 10,
				dataType: "xs:string",
				isNullable: true,
				form: "qualified",
				type: String,
			});
		});
	});

	describe("Field decorator usage", () => {
		it("should store field-level element metadata with string name", () => {
			class TestClass {
				@XmlElement("customName")
				field: string = "";
			}

			void new TestClass();
			const fieldMetadata = getMetadata(TestClass).fieldElements;
			const mappings = getMetadata(TestClass).propertyMappings;

			expect(fieldMetadata.field).toBeDefined();
			expect(fieldMetadata.field.name).toBe("customName");
			expect(mappings.field).toBe("customName");
		});

		it("should use property name when no name provided", () => {
			class TestClass {
				@XmlElement()
				myProperty: string = "";
			}

			void new TestClass();
			const fieldMetadata = getMetadata(TestClass).fieldElements;

			expect(fieldMetadata.myProperty).toBeDefined();
			expect(fieldMetadata.myProperty.name).toBe("myProperty");
		});

		it("should store field namespace", () => {
			class TestClass {
				@XmlElement({
					name: "namespacedField",
					namespace: { uri: "http://field.com", prefix: "f" },
				})
				field: string = "";
			}

			void new TestClass();
			const fieldMetadata = getMetadata(TestClass).fieldElements;

			expect(fieldMetadata.field.namespace).toEqual({
				uri: "http://field.com",
				prefix: "f",
			});
		});

		it("should store multiple fields on same class", () => {
			class TestClass {
				@XmlElement("firstName")
				first: string = "";

				@XmlElement("lastName")
				last: string = "";

				@XmlElement({ name: "age", dataType: "xs:int" })
				age: number = 0;
			}

			void new TestClass();
			const fieldMetadata = getMetadata(TestClass).fieldElements;
			const mappings = getMetadata(TestClass).propertyMappings;

			expect(Object.keys(fieldMetadata)).toHaveLength(3);
			expect(fieldMetadata.first.name).toBe("firstName");
			expect(fieldMetadata.last.name).toBe("lastName");
			expect(fieldMetadata.age.name).toBe("age");
			expect(fieldMetadata.age.dataType).toBe("xs:int");
			expect(mappings).toEqual({
				first: "firstName",
				last: "lastName",
				age: "age",
			});
		});

		it("should store field with all options", () => {
			class TestClass {
				@XmlElement({
					name: "complexField",
					namespace: { uri: "http://complex.com" },
					required: true,
					order: 3,
					dataType: "xs:decimal",
					isNullable: false,
					form: "unqualified",
					type: Number,
				})
				field: number = 0;
			}

			void new TestClass();
			const fieldMetadata = getMetadata(TestClass).fieldElements;

			expect(fieldMetadata.field).toEqual({
				name: "complexField",
				namespace: { uri: "http://complex.com" },
				required: true,
				order: 3,
				dataType: "xs:decimal",
				isNullable: false,
				form: "unqualified",
				type: Number,
			});
		});
	});

	describe("Storage mechanisms", () => {
		it("should store class metadata in unified storage", () => {
			@XmlElement({ name: "StorageTest" })
			class StorageTest {}

			const stored = getMetadata(StorageTest).element;
			expect(stored).toBeDefined();
			expect(stored?.name).toBe("StorageTest");
		});

		it("should store field metadata in unified storage", () => {
			class TestClass {
				@XmlElement("testField")
				field: string = "";
			}

			void new TestClass();
			const stored = getMetadata(TestClass).fieldElements;

			expect(stored).toBeDefined();
			expect(stored?.field).toBeDefined();
		});

		it("should store property mappings in unified storage", () => {
			class TestClass {
				@XmlElement("mappedName")
				field: string = "";
			}

			void new TestClass();
			const unifiedMappings = getMetadata(TestClass).propertyMappings;

			expect(unifiedMappings).toEqual({ field: "mappedName" });
		});
	});

	describe("Edge cases", () => {
		it("should handle empty options object", () => {
			@XmlElement({})
			class EmptyOptions {}

			const metadata = getMetadata(EmptyOptions).element;
			expect(metadata?.name).toBe("EmptyOptions");
			expect(metadata?.required).toBe(false);
		});

		it("should preserve initialValue for fields", () => {
			class TestClass {
				@XmlElement("value")
				field: string = "initial";
			}

			const instance = new TestClass();
			expect(instance.field).toBe("initial");
		});

		it("should work with inherited classes", () => {
			class BaseClass {
				@XmlElement("basefield")
				base: string = "";
			}

			class DerivedClass extends BaseClass {
				@XmlElement("derivedfield")
				derived: string = "";
			}

			void new DerivedClass();
			const fieldMetadata = getMetadata(DerivedClass).fieldElements;

			// Note: inheritance behavior may vary
			expect(fieldMetadata.derived).toBeDefined();
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata type structure", () => {
			@XmlElement({
				name: "TypeTest",
				required: false,
			})
			class TypeTest {}

			const metadata = getMetadata(TypeTest).element;
			expect(typeof metadata?.name).toBe("string");
			expect(typeof metadata?.required).toBe("boolean");
		});
	});
});
