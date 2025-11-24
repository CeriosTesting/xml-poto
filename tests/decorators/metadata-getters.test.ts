import {
	getXmlArrayItemMetadata,
	getXmlAttributeMetadata,
	getXmlElementMetadata,
	getXmlFieldElementMetadata,
	getXmlPropertyMappings,
	getXmlRootMetadata,
	getXmlTextMetadata,
} from "../../src/decorators/getters";
import { getMetadata } from "../../src/decorators/storage/metadata-storage";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";

describe("Metadata Getters", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("getXmlElementMetadata", () => {
		it("should retrieve metadata from WeakMap", () => {
			class TestClass {}
			const metadata = { name: "Test", required: false };
			getMetadata(TestClass).element = metadata;

			const result = getXmlElementMetadata(TestClass);

			expect(result).toEqual(metadata);
		});

		it("should return undefined when no metadata exists", () => {
			class TestClass {}

			const result = getXmlElementMetadata(TestClass);

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

				const result = getXmlAttributeMetadata(TestClass);

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

				const result = getXmlAttributeMetadata(TestClass);

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

				const result = getXmlAttributeMetadata(TestClass);

				expect(result.id).toBeDefined();
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getXmlAttributeMetadata(TestClass);

				expect(result).toEqual({});
			});

			it("should return empty object when WeakMap returns empty object", () => {
				class TestClass {}
				getMetadata(TestClass).attributes = {};

				const result = getXmlAttributeMetadata(TestClass);

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

				const result = getXmlAttributeMetadata(TestClass);

				expect(result).toEqual({});
			});

			it("should return empty object when constructor requires parameters", () => {
				class TestClass {
					// biome-ignore lint/complexity/noUselessConstructor: <Needed for test>
					constructor(_required: string) {}
				}

				const result = getXmlAttributeMetadata(TestClass);

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

				const result = getXmlAttributeMetadata(TestClass);

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

				const result = getXmlTextMetadata(TestClass);

				expect(result).toBeDefined();
				expect(result?.propertyKey).toBe("content");
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return undefined when no metadata exists", () => {
				class TestClass {}

				const result = getXmlTextMetadata(TestClass);

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

				const result = getXmlTextMetadata(TestClass);

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

				const result = getXmlPropertyMappings(TestClass);

				expect(result).toEqual(mappings);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no mappings exist", () => {
				class TestClass {}

				const result = getXmlPropertyMappings(TestClass);

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

				const result = getXmlPropertyMappings(TestClass);

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

				const result = getXmlFieldElementMetadata(TestClass);

				expect(result).toEqual(fieldMetadata);
			});

			it("should retrieve multiple fields", () => {
				class TestClass {}
				const fieldMetadata = {
					field1: { name: "Field1", required: false },
					field2: { name: "Field2", required: true },
				};
				getMetadata(TestClass).fieldElements = fieldMetadata;

				const result = getXmlFieldElementMetadata(TestClass);

				expect(Object.keys(result)).toHaveLength(2);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getXmlFieldElementMetadata(TestClass);

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

				const result = getXmlFieldElementMetadata(TestClass);

				expect(result.field1).toBeDefined();
			});
		});
	});

	describe("getXmlRootMetadata", () => {
		it("should retrieve root metadata from WeakMap", () => {
			class TestClass {}
			const metadata = { elementName: "Root" };
			getMetadata(TestClass).root = metadata;

			const result = getXmlRootMetadata(TestClass);

			expect(result).toEqual(metadata);
		});

		it("should return undefined when no metadata exists", () => {
			class TestClass {}

			const result = getXmlRootMetadata(TestClass);

			expect(result).toBeUndefined();
		});
	});

	describe("getXmlArrayItemMetadata", () => {
		describe("WeakMap storage retrieval", () => {
			it("should retrieve metadata from WeakMap storage", () => {
				class TestClass {}
				const metadata = {
					items: [{ itemName: "item", type: String }],
				};
				getMetadata(TestClass).arrayItems = metadata;

				const result = getXmlArrayItemMetadata(TestClass);

				expect(result).toEqual(metadata);
			});

			it("should retrieve multiple properties with array items", () => {
				class TestClass {}
				const metadata = {
					items: [{ itemName: "item", type: String }],
					products: [{ itemName: "product", type: Number }],
				};
				getMetadata(TestClass).arrayItems = metadata;

				const result = getXmlArrayItemMetadata(TestClass);

				expect(Object.keys(result)).toHaveLength(2);
			});
		});

		describe("Empty/undefined handling", () => {
			it("should return empty object when no metadata exists", () => {
				class TestClass {}

				const result = getXmlArrayItemMetadata(TestClass);

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

				const result = getXmlArrayItemMetadata(TestClass);

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
				getMetadata(TestClass).arrayItems = metadata;

				const result = getXmlArrayItemMetadata(TestClass);

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
				getMetadata(TestClass).arrayItems = metadata;

				const result = getXmlArrayItemMetadata(TestClass);

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

			const attrMetadata = getXmlAttributeMetadata(TestClass);
			const textMetadata = getXmlTextMetadata(TestClass);
			const mappings = getXmlPropertyMappings(TestClass);
			const fieldMetadata = getXmlFieldElementMetadata(TestClass);
			const arrayMetadata = getXmlArrayItemMetadata(TestClass);

			expect(typeof attrMetadata).toBe("object");
			expect(textMetadata === undefined || typeof textMetadata).toBeTruthy();
			expect(typeof mappings).toBe("object");
			expect(typeof fieldMetadata).toBe("object");
			expect(typeof arrayMetadata).toBe("object");
		});
	});
});
