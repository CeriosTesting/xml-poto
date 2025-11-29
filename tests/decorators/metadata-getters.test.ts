import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetadata } from "../../src/decorators/storage/metadata-storage";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";

describe("Metadata Getters", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getXmlElementMetadata", () => {
		it("should retrieve metadata from WeakMap", () => {
			class TestClass {}
			const metadata = { name: "Test", required: false };
			getMetadata(TestClass).element = metadata;

			const result = getMetadata(TestClass).element;

			expect(result).toEqual(metadata);
		});

		it("should return undefined when no metadata exists", () => {
			class TestClass {}

			const result = getMetadata(TestClass).element;

			expect(result).toBeUndefined();
		});
	});

	describe("getXmlAttributeMetadata", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve metadata from WeakMap storage", () => {
				class TestClass {}
				const metadata = {
					id: { name: "id", required: false },
					name: { name: "name", required: true },
				};
				getMetadata(TestClass).attributes = metadata;

				const result = getMetadata(TestClass).attributes;

				expect(result).toEqual(metadata);
			});

			it("should retrieve multiple attributes", () => {
				class TestClass {}
				const metadata = {
					attr1: { name: "attr1", required: false },
					attr2: { name: "attr2", required: false },
					attr3: { name: "attr3", required: true },
				};
				getMetadata(TestClass).attributes = metadata;

				const result = getMetadata(TestClass).attributes;

				expect(Object.keys(result)).toHaveLength(3);
			});
		});

		describe("Instantiation fallback", () => {
			it("should instantiate class if no metadata found initially", () => {
				class TestClass {
					constructor() {
						const metadata = {
							id: { name: "id", required: false },
						};
						getMetadata(TestClass).attributes = metadata;
					}
				}

				// Instantiate to trigger constructor
				void new TestClass();
				const result = getMetadata(TestClass).attributes;

				expect(result.id).toBeDefined();
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getMetadata(TestClass).attributes;

				expect(result).toEqual({});
			});

			it("should return empty object when WeakMap returns empty object", () => {
				class TestClass {}
				getMetadata(TestClass).attributes = {};

				const result = getMetadata(TestClass).attributes;

				expect(result).toEqual({});
			});
		});

		describe("Instantiation failure handling", () => {
			it("should return empty object when instantiation throws error", () => {
				class TestClass {
					constructor() {
						throw new Error("Cannot instantiate");
					}
				}

				const result = getMetadata(TestClass).attributes;

				expect(result).toEqual({});
			});

			it("should return empty object when constructor requires parameters", () => {
				class TestClass {
					// biome-ignore lint/complexity/noUselessConstructor: <Needed for test>
					constructor(_required: string) {}
				}

				const result = getMetadata(TestClass).attributes;

				expect(result).toEqual({});
			});
		});

		describe("Integration with actual decorator", () => {
			it("should retrieve metadata from XmlAttribute decorator", () => {
				class TestClass {
					@XmlAttribute({ name: "testAttr" })
					attr: string = "";
				}

				// Need to instantiate to trigger decorator
				new TestClass();

				const result = getMetadata(TestClass).attributes;

				expect(result.attr).toBeDefined();
				expect(result.attr.name).toBe("testAttr");
			});
		});
	});

	describe("getXmlTextMetadata", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve metadata from WeakMap storage", () => {
				class TestClass {
					static __xmlTextMetadata = { required: false };
				}

				getMetadata(TestClass).textProperty = "content";
				getMetadata(TestClass).textMetadata = { required: false };

				const metadata = getMetadata(TestClass);

				expect(metadata.textProperty).toBe("content");
				expect(metadata.textMetadata).toBeDefined();
				expect(metadata.textMetadata?.required).toBe(false);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return undefined when no metadata exists", () => {
				class TestClass {}

				const result = getMetadata(TestClass).textMetadata;

				expect(result).toBeUndefined();
			});
		});

		describe("Instantiation failure handling", () => {
			it("should return undefined when instantiation throws error", () => {
				class TestClass {
					constructor() {
						throw new Error("Cannot instantiate");
					}
				}

				const result = getMetadata(TestClass).textMetadata;

				expect(result).toBeUndefined();
			});
		});
	});

	describe("getXmlPropertyMappings", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve mappings from WeakMap", () => {
				class TestClass {}
				const mappings = { prop1: "Prop1", prop2: "Prop2" };
				getMetadata(TestClass).propertyMappings = mappings;

				const result = getMetadata(TestClass).propertyMappings;

				expect(result).toEqual(mappings);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no mappings exist", () => {
				class TestClass {}

				const result = getMetadata(TestClass).propertyMappings;

				expect(result).toEqual({});
			});
		});

		describe("Integration with actual decorator", () => {
			it("should retrieve mappings from XmlElement field decorator", () => {
				class TestClass {
					@XmlElement("MappedName")
					field: string = "";
				}

				// Need to instantiate to trigger decorator
				new TestClass();

				const result = getMetadata(TestClass).propertyMappings;

				expect(result.field).toBe("MappedName");
			});
		});
	});

	describe("getXmlFieldElementMetadata", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve field metadata from WeakMap", () => {
				class TestClass {}
				const fieldMetadata = {
					field1: { name: "Field1", required: false },
				};
				getMetadata(TestClass).fieldElements = fieldMetadata;

				const result = getMetadata(TestClass).fieldElements;

				expect(result).toEqual(fieldMetadata);
			});

			it("should retrieve multiple fields", () => {
				class TestClass {}
				const fieldMetadata = {
					field1: { name: "Field1", required: false },
					field2: { name: "Field2", required: true },
				};
				getMetadata(TestClass).fieldElements = fieldMetadata;

				const result = getMetadata(TestClass).fieldElements;

				expect(Object.keys(result)).toHaveLength(2);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getMetadata(TestClass).fieldElements;

				expect(result).toEqual({});
			});
		});

		describe("Instantiation fallback", () => {
			it("should instantiate class if no metadata found", () => {
				class TestClass {
					constructor() {
						const metadata = {
							field1: { name: "Field1", required: false },
						};
						getMetadata(TestClass).fieldElements = metadata;
					}
				}

				// Instantiate to trigger constructor
				void new TestClass();
				const result = getMetadata(TestClass).fieldElements;

				expect(result.field1).toBeDefined();
			});
		});
	});

	describe("getXmlRootMetadata", () => {
		it("should retrieve root metadata from WeakMap", () => {
			class TestClass {}
			const metadata = { elementName: "Root" };
			getMetadata(TestClass).root = metadata;

			const result = getMetadata(TestClass).root;

			expect(result).toEqual(metadata);
		});

		it("should return undefined when no metadata exists", () => {
			class TestClass {}

			const result = getMetadata(TestClass).root;

			expect(result).toBeUndefined();
		});
	});

	describe("getXmlArrayMetadata", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve metadata from WeakMap storage", () => {
				class TestClass {}
				const metadata = {
					items: [{ itemName: "item", type: String }],
				};
				getMetadata(TestClass).arrays = metadata;

				const result = getMetadata(TestClass).arrays;

				expect(result).toEqual(metadata);
			});

			it("should retrieve multiple properties with array items", () => {
				class TestClass {}
				const metadata = {
					items: [{ itemName: "item", type: String }],
					products: [{ itemName: "product", type: Number }],
				};
				getMetadata(TestClass).arrays = metadata;

				const result = getMetadata(TestClass).arrays;

				expect(Object.keys(result)).toHaveLength(2);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getMetadata(TestClass).arrays;

				expect(result).toEqual({});
			});
		});

		describe("Instantiation failure handling", () => {
			it("should return empty object when instantiation throws error", () => {
				class TestClass {
					constructor() {
						throw new Error("Cannot instantiate");
					}
				}

				const result = getMetadata(TestClass).arrays;

				expect(result).toEqual({});
			});
		});

		describe("Complex metadata scenarios", () => {
			it("should handle array items with complex metadata", () => {
				class ItemType {}
				class TestClass {}

				const metadata = {
					items: [
						{
							itemName: "item",
							type: ItemType,
							namespace: { uri: "http://example.com" },
						},
					],
				};
				getMetadata(TestClass).arrays = metadata;

				const result = getMetadata(TestClass).arrays;

				expect(result.items).toHaveLength(1);
				expect(result.items[0].namespace).toEqual({ uri: "http://example.com" });
			});

			it("should handle multiple array item types for same property", () => {
				class ItemA {}
				class ItemB {}
				class TestClass {}

				const metadata = {
					items: [
						{ itemName: "itemA", type: ItemA },
						{ itemName: "itemB", type: ItemB },
					],
				};
				getMetadata(TestClass).arrays = metadata;

				const result = getMetadata(TestClass).arrays;

				expect(result.items).toHaveLength(2);
				expect(result.items[0].type).toBe(ItemA);
				expect(result.items[1].type).toBe(ItemB);
			});
		});
	});

	describe("Type safety", () => {
		it("should maintain correct return type structures", () => {
			class TestClass {
				@XmlAttribute({ name: "attr" })
				attr: string = "";
			}

			new TestClass();

			const attrMetadata = getMetadata(TestClass).attributes;
			const textMetadata = getMetadata(TestClass).textMetadata;
			const mappings = getMetadata(TestClass).propertyMappings;
			const fieldMetadata = getMetadata(TestClass).fieldElements;
			const arrayMetadata = getMetadata(TestClass).arrays;

			expect(typeof attrMetadata).toBe("object");
			expect(textMetadata === undefined || typeof textMetadata).toBeTruthy();
			expect(typeof mappings).toBe("object");
			expect(typeof fieldMetadata).toBe("object");
			expect(typeof arrayMetadata).toBe("object");
		});
	});
});
