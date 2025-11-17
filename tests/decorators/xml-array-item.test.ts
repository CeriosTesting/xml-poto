import { getXmlArrayItemMetadata } from "../../src/decorators/getters";
import { XmlArrayItem } from "../../src/decorators/xml-array-item";

describe("XmlArrayItem decorator", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("Basic functionality", () => {
		it("should store array item metadata with default options", () => {
			class TestClass {
				@XmlArrayItem()
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items).toBeDefined();
			expect(metadata.items).toHaveLength(1);
			expect(metadata.items[0].unwrapped).toBe(true); // Auto-unwrap when no container
		});

		it("should store containerName", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Items" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].containerName).toBe("Items");
			expect(metadata.items[0].unwrapped).toBe(false); // Don't unwrap with container
		});

		it("should store itemName", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].itemName).toBe("Item");
		});

		it("should store both containerName and itemName", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Books", itemName: "Book" })
				books: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.books?.[0]?.containerName).toBe("Books");
			expect(metadata.books?.[0]?.itemName).toBe("Book");
		});

		it("should preserve initial value", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = ["a", "b", "c"];
			}

			const instance = new TestClass();
			expect(instance.items).toEqual(["a", "b", "c"]);
		});
	});

	describe("Legacy naming support", () => {
		it("should support legacy 'name' for containerName", () => {
			class TestClass {
				@XmlArrayItem({ name: "Container" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].name).toBe("Container");
			expect(metadata.items[0].containerName).toBe("Container");
		});

		it("should support legacy 'elementName' for itemName", () => {
			class TestClass {
				@XmlArrayItem({ elementName: "Element" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].elementName).toBe("Element");
			expect(metadata.items[0].itemName).toBe("Element");
		});

		it("should prefer new naming over legacy", () => {
			class TestClass {
				@XmlArrayItem({
					containerName: "NewContainer",
					name: "OldContainer",
					itemName: "NewItem",
					elementName: "OldItem",
				})
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].containerName).toBe("NewContainer");
			expect(metadata.items[0].itemName).toBe("NewItem");
		});
	});

	describe("Unwrapping behavior", () => {
		it("should auto-unwrap when no containerName", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].unwrapped).toBe(true);
		});

		it("should not unwrap when containerName is provided", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Container", itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].unwrapped).toBe(false);
		});

		it("should respect explicit unwrapped flag", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Container", unwrapped: true })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].unwrapped).toBe(true);
		});

		it("should allow explicit wrapping", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item", unwrapped: false })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].unwrapped).toBe(false);
		});
	});

	describe("Advanced options", () => {
		it("should store type information", () => {
			class ItemType {}

			class TestClass {
				@XmlArrayItem({ type: ItemType, itemName: "Item" })
				items: ItemType[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].type).toBe(ItemType);
		});

		it("should store namespace", () => {
			class TestClass {
				@XmlArrayItem({
					containerName: "Items",
					namespace: { uri: "http://example.com", prefix: "ex" },
				})
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].namespace).toEqual({
				uri: "http://example.com",
				prefix: "ex",
			});
		});

		it("should store nestingLevel", () => {
			class TestClass {
				@XmlArrayItem({ nestingLevel: 2, itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].nestingLevel).toBe(2);
		});

		it("should default nestingLevel to 0", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].nestingLevel).toBe(0);
		});

		it("should store isNullable", () => {
			class TestClass {
				@XmlArrayItem({ isNullable: true, itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].isNullable).toBe(true);
		});

		it("should store dataType", () => {
			class TestClass {
				@XmlArrayItem({ dataType: "xs:string", itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0].dataType).toBe("xs:string");
		});
	});

	describe("Polymorphic arrays", () => {
		it("should support multiple array item types for same property", () => {
			class TypeA {}
			class TypeB {}

			class TestClass {
				@XmlArrayItem({ type: TypeA, itemName: "A" })
				@XmlArrayItem({ type: TypeB, itemName: "B" })
				items: Array<TypeA | TypeB> = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items).toHaveLength(2);
			expect(metadata.items[0].type).toBe(TypeA);
			expect(metadata.items[0].itemName).toBe("A");
			expect(metadata.items[1].type).toBe(TypeB);
			expect(metadata.items[1].itemName).toBe("B");
		});

		it("should avoid duplicate metadata entries", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item", type: String })
				items: string[] = [];
			}

			void new TestClass();
			void new TestClass();

			const metadata = getXmlArrayItemMetadata(TestClass);

			// Should not have duplicates
			expect(metadata.items).toHaveLength(1);
		});
	});

	describe("Complete configuration", () => {
		it("should store all options together", () => {
			class ItemType {}

			class TestClass {
				@XmlArrayItem({
					containerName: "Items",
					itemName: "Item",
					type: ItemType,
					namespace: { uri: "http://test.com", prefix: "t" },
					nestingLevel: 1,
					isNullable: true,
					dataType: "xs:complexType",
					unwrapped: false,
				})
				items: ItemType[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items[0]).toMatchObject({
				containerName: "Items",
				itemName: "Item",
				type: ItemType,
				namespace: { uri: "http://test.com", prefix: "t" },
				nestingLevel: 1,
				isNullable: true,
				dataType: "xs:complexType",
				unwrapped: false,
			});
		});
	});

	describe("Storage mechanisms", () => {
		it("should store in constructor property", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const constructorMetadata = (TestClass as any).__xmlArrayItems;

			expect(constructorMetadata).toBeDefined();
			expect(constructorMetadata.items).toBeDefined();
			expect(constructorMetadata.items).toHaveLength(1);
		});

		it("should allow retrieval via getter function", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Items", itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items).toBeDefined();
			expect(metadata.items[0].containerName).toBe("Items");
		});

		it("should handle multiple properties with array items", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Book" })
				books: string[] = [];

				@XmlArrayItem({ itemName: "Author" })
				authors: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(Object.keys(metadata)).toHaveLength(2);
			expect(metadata.books).toBeDefined();
			expect(metadata.authors).toBeDefined();
		});
	});

	describe("Edge cases", () => {
		it("should handle empty options", () => {
			class TestClass {
				@XmlArrayItem({})
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(metadata.items).toBeDefined();
			expect(metadata.items[0].unwrapped).toBe(true);
		});

		it("should work with empty array", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] = [];
			}

			const instance = new TestClass();
			expect(instance.items).toEqual([]);
		});

		it("should work with undefined initial value", () => {
			class TestClass {
				@XmlArrayItem({ itemName: "Item" })
				items: string[] | undefined;
			}

			const instance = new TestClass();
			expect(instance.items).toBeUndefined();
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata structure", () => {
			class TestClass {
				@XmlArrayItem({ containerName: "Items", itemName: "Item" })
				items: string[] = [];
			}

			void new TestClass();
			const metadata = getXmlArrayItemMetadata(TestClass);

			expect(Array.isArray(metadata.items)).toBe(true);
			expect(metadata.items[0]).toHaveProperty("containerName");
			expect(metadata.items[0]).toHaveProperty("itemName");
			expect(typeof metadata.items[0].containerName).toBe("string");
		});
	});
});
