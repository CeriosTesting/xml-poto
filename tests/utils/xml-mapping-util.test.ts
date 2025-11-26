import { XmlArray, XmlAttribute, XmlComment, XmlElement, XmlQueryable, XmlRoot, XmlText } from "../../src/decorators";
import { QueryableElement } from "../../src/query/xml-query";
import { SerializationOptions } from "../../src/serialization-options";
import { XmlMappingUtil } from "../../src/utils/xml-mapping-util";

describe("XmlMappingUtil", () => {
	let util: XmlMappingUtil;
	let defaultOptions: SerializationOptions;

	beforeEach(() => {
		defaultOptions = {
			ignoreAttributes: false,
			attributeNamePrefix: "@_",
			textNodeName: "#text",
			omitXmlDeclaration: false,
			xmlVersion: "1.0",
			encoding: "UTF-8",
			standalone: undefined,
			omitNullValues: false,
			useXsiType: false,
		};
		util = new XmlMappingUtil(defaultOptions);
	});

	describe("mapToObject", () => {
		describe("Attribute mapping", () => {
			it("should map XML attributes to class properties", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "id" })
					id: string = "";

					@XmlAttribute({ name: "age" })
					age: number = 0;
				}

				const data = {
					"@_id": "123",
					"@_age": "25",
				};

				const result = util.mapToObject(data, Person);

				expect(result.id).toBe("123");
				expect(result.age).toBe(25);
			});

			it("should throw error for missing required attributes", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "id", required: true })
					id: string = "";
				}

				const data = {};

				expect(() => util.mapToObject(data, Person)).toThrow("Required attribute 'id' is missing");
			});

			it("should validate attribute patterns", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "email", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ })
					email: string = "";
				}

				const data = {
					"@_email": "invalid-email",
				};

				expect(() => util.mapToObject(data, Person)).toThrow("Invalid value 'invalid-email' for attribute 'email'");
			});

			it("should apply converters on deserialization", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({
						name: "name",
						converter: {
							deserialize: (value: string) => value.toUpperCase(),
						},
					})
					name: string = "";
				}

				const data = {
					"@_name": "john",
				};

				const result = util.mapToObject(data, Person);

				expect(result.name).toBe("JOHN");
			});
		});

		describe("Text content mapping", () => {
			it("should map #text to text property", () => {
				@XmlRoot({ elementName: "Message" })
				class Message {
					@XmlText()
					content: string = "";
				}

				const data = {
					"#text": "Hello World",
				};

				const result = util.mapToObject(data, Message);

				expect(result.content).toBe("Hello World");
			});

			it("should map CDATA to text property", () => {
				@XmlRoot({ elementName: "Message" })
				class Message {
					@XmlText()
					content: string = "";
				}

				const data = {
					__cdata: "Hello <World>",
				};

				const result = util.mapToObject(data, Message);

				expect(result.content).toBe("Hello <World>");
			});

			it("should throw error for missing required text", () => {
				@XmlRoot({ elementName: "Message" })
				class Message {
					@XmlText({ required: true })
					content: string = "";
				}

				const data = {};

				expect(() => util.mapToObject(data, Message)).toThrow("Required text content is missing");
			});
		});

		describe("Element mapping", () => {
			it("should map nested elements", () => {
				@XmlElement({ name: "Address" })
				class Address {
					@XmlElement({ name: "Street" })
					street: string = "";

					@XmlElement({ name: "City" })
					city: string = "";
				}

				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlElement({ name: "Name" })
					name: string = "";

					@XmlElement({ name: "Address" })
					address: Address = new Address();
				}

				const data = {
					Name: "John",
					Address: {
						Street: "123 Main St",
						City: "Boston",
					},
				};

				const result = util.mapToObject(data, Person);

				expect(result.name).toBe("John");
				expect(result.address.street).toBe("123 Main St");
				expect(result.address.city).toBe("Boston");
			});

			it("should handle CDATA in elements", () => {
				@XmlRoot({ elementName: "Document" })
				class Document {
					@XmlElement({ name: "Content" })
					content: string = "";
				}

				const data = {
					Content: {
						__cdata: "Hello <b>World</b>",
					},
				};

				const result = util.mapToObject(data, Document);

				expect(result.content).toBe("Hello <b>World</b>");
			});

			it("should throw error for missing required elements", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlElement({ name: "Name", required: true })
					name: string = "";
				}

				const data = {};

				expect(() => util.mapToObject(data, Person)).toThrow("Required element 'Name' is missing");
			});
		});

		describe("Array mapping", () => {
			it("should map wrapped arrays", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ containerName: "Items", itemName: "Item", type: Item })
					items: Item[] = [];
				}

				const data = {
					Items: {
						Item: [{ Name: "Item1" }, { Name: "Item2" }],
					},
				};

				const result = util.mapToObject(data, ItemList);

				expect(result.items).toHaveLength(2);
				expect(result.items[0].name).toBe("Item1");
				expect(result.items[1].name).toBe("Item2");
			});

			it("should map unwrapped arrays", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ itemName: "Item", type: Item, unwrapped: true })
					items: Item[] = [];
				}

				const data = {
					Item: [{ Name: "Item1" }, { Name: "Item2" }],
				};

				const result = util.mapToObject(data, ItemList);

				expect(result.items).toHaveLength(2);
				expect(result.items[0].name).toBe("Item1");
				expect(result.items[1].name).toBe("Item2");
			});

			it("should handle single item as array", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ itemName: "Item", type: Item, unwrapped: true })
					items: Item[] = [];
				}

				const data = {
					Item: { Name: "Item1" },
				};

				const result = util.mapToObject(data, ItemList);

				expect(result.items).toHaveLength(1);
				expect(result.items[0].name).toBe("Item1");
			});
		});

		describe("QueryableElement mapping", () => {
			it("should build QueryableElement for root", () => {
				@XmlRoot({ elementName: "Document" })
				class Document {
					@XmlQueryable()
					query?: QueryableElement;

					@XmlElement({ name: "Title" })
					title: string = "";
				}

				const data = {
					Title: "Test",
				};

				const result = util.mapToObject(data, Document);

				expect(result.query).toBeDefined();
				expect(result.query?.name).toBe("Document");
				expect(result.query?.children).toHaveLength(1);
				expect(result.query?.children[0].name).toBe("Title");
			});

			it("should build QueryableElement for nested property", () => {
				@XmlElement({ name: "Product" })
				class Product {
					@XmlElement({ name: "Name" })
					name: string = "";
				}

				@XmlRoot({ elementName: "Catalog" })
				class Catalog {
					@XmlElement({ name: "Products" })
					products: Product[] = [];

					@XmlQueryable({ targetProperty: "products" })
					productsQuery?: QueryableElement;
				}

				const data = {
					Products: [{ Name: "Item1" }],
				};

				const result = util.mapToObject(data, Catalog);

				expect(result.productsQuery).toBeDefined();
				expect(result.productsQuery?.name).toBe("Products");
			});

			it("should parse numeric values in QueryableElement", () => {
				@XmlRoot({ elementName: "Data" })
				class Data {
					@XmlQueryable({ parseNumeric: true })
					query?: QueryableElement;

					@XmlElement({ name: "Value" })
					value: number = 0;
				}

				const data = {
					Value: 123,
				};

				const result = util.mapToObject(data, Data);

				const valueElement = result.query?.children[0];
				expect(valueElement?.text).toBe("123");
				expect(valueElement?.numericValue).toBe(123);
			});
		});

		describe("Type conversion", () => {
			it("should convert string to boolean", () => {
				@XmlRoot({ elementName: "Config" })
				class Config {
					@XmlElement({ name: "Enabled" })
					enabled: boolean = false;
				}

				const data = {
					Enabled: "true",
				};

				const result = util.mapToObject(data, Config);

				expect(result.enabled).toBe(true);
			});

			it("should convert string to number", () => {
				@XmlRoot({ elementName: "Config" })
				class Config {
					@XmlElement({ name: "Count" })
					count: number = 0;
				}

				const data = {
					Count: "42",
				};

				const result = util.mapToObject(data, Config);

				expect(result.count).toBe(42);
			});

			it("should handle union types", () => {
				@XmlRoot({ elementName: "Data" })
				class Data {
					@XmlElement({ name: "Value", unionTypes: [Number, String] })
					value: number | string = "";
				}

				const data = {
					Value: "123",
				};

				const result = util.mapToObject(data, Data);

				expect(result.value).toBe(123);
			});
		});
	});

	describe("mapFromObject", () => {
		describe("Attribute serialization", () => {
			it("should serialize attributes", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "id" })
					id: string = "123";

					@XmlAttribute({ name: "age" })
					age: number = 25;
				}

				const person = new Person();
				const result = util.mapFromObject(person, "Person");

				expect(result.Person["@_id"]).toBe("123");
				// Numbers remain as numbers in attributes
				expect(result.Person["@_age"]).toBe(25);
			});

			it("should handle empty attributes with omitNullValues false", () => {
				const utilWithDefaults = new XmlMappingUtil({ ...defaultOptions, omitNullValues: false });

				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "id" })
					id?: string;
				}

				const person = new Person();
				const result = utilWithDefaults.mapFromObject(person, "Person");

				expect(result.Person["@_id"]).toBe("");
			});

			it("should omit null attributes with omitNullValues true", () => {
				const utilWithOmit = new XmlMappingUtil({ ...defaultOptions, omitNullValues: true });

				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({ name: "id" })
					id?: string;
				}

				const person = new Person();
				const result = utilWithOmit.mapFromObject(person, "Person");

				expect(result.Person["@_id"]).toBeUndefined();
			});

			it("should apply converters on serialization", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlAttribute({
						name: "name",
						converter: {
							serialize: (value: string) => value.toLowerCase(),
						},
					})
					name: string = "JOHN";
				}

				const person = new Person();
				const result = util.mapFromObject(person, "Person");

				expect(result.Person["@_name"]).toBe("john");
			});
		});

		describe("Text content serialization", () => {
			it("should serialize text content", () => {
				@XmlRoot({ elementName: "Message" })
				class Message {
					@XmlText()
					content: string = "Hello World";
				}

				const message = new Message();
				const result = util.mapFromObject(message, "Message");

				expect(result.Message["#text"]).toBe("Hello World");
			});

			it("should wrap text in CDATA when requested", () => {
				@XmlRoot({ elementName: "Message" })
				class Message {
					@XmlText({ useCDATA: true })
					content: string = "Hello <World>";
				}

				const message = new Message();
				const result = util.mapFromObject(message, "Message");

				expect(result.Message.__cdata).toBe("Hello <World>");
			});
		});

		describe("Comment serialization", () => {
			it("should serialize comments", () => {
				@XmlRoot({ elementName: "Document" })
				class Document {
					@XmlComment()
					comment: string = "This is a comment";

					@XmlElement({ name: "Title" })
					title: string = "Test";
				}

				const doc = new Document();
				const result = util.mapFromObject(doc, "Document");

				expect(result.Document["?"]).toBe("This is a comment");
			});

			it("should omit empty comments", () => {
				@XmlRoot({ elementName: "Document" })
				class Document {
					@XmlComment()
					comment: string = "";

					@XmlElement({ name: "Title" })
					title: string = "Test";
				}

				const doc = new Document();
				const result = util.mapFromObject(doc, "Document");

				expect(result.Document["?"]).toBeUndefined();
			});
		});

		describe("Element serialization", () => {
			it("should serialize nested elements", () => {
				@XmlElement({ name: "Address" })
				class Address {
					@XmlElement({ name: "Street" })
					street: string = "123 Main St";

					@XmlElement({ name: "City" })
					city: string = "Boston";
				}

				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlElement({ name: "Name" })
					name: string = "John";

					@XmlElement({ name: "Address" })
					address: Address = new Address();
				}

				const person = new Person();
				const result = util.mapFromObject(person, "Person");

				expect(result.Person.Name).toBe("John");
				expect(result.Person.Address.Street).toBe("123 Main St");
				expect(result.Person.Address.City).toBe("Boston");
			});

			it("should handle null elements with xsi:nil", () => {
				@XmlRoot({ elementName: "Person" })
				class Person {
					@XmlElement({ name: "Name", isNullable: true })
					name: string | null = null;
				}

				const person = new Person();
				const result = util.mapFromObject(person, "Person");

				expect(result.Person.Name["@_xsi:nil"]).toBe("true");
			});

			it("should wrap element values in CDATA when requested", () => {
				@XmlRoot({ elementName: "Document" })
				class Document {
					@XmlElement({ name: "Content", useCDATA: true })
					content: string = "Hello <b>World</b>";
				}

				const doc = new Document();
				const result = util.mapFromObject(doc, "Document");

				expect(result.Document.Content.__cdata).toBe("Hello <b>World</b>");
			});
		});

		describe("Array serialization", () => {
			it("should serialize wrapped arrays", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";

					constructor(name: string = "") {
						this.name = name;
					}
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ containerName: "Items", itemName: "Item", type: Item })
					items: Item[] = [new Item("Item1"), new Item("Item2")];
				}

				const list = new ItemList();
				const result = util.mapFromObject(list, "List");

				expect(result.List.Items.Item).toHaveLength(2);
				expect(result.List.Items.Item[0].Name).toBe("Item1");
				expect(result.List.Items.Item[1].Name).toBe("Item2");
			});

			it("should serialize unwrapped arrays", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";

					constructor(name: string = "") {
						this.name = name;
					}
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ itemName: "Item", type: Item, unwrapped: true })
					items: Item[] = [new Item("Item1"), new Item("Item2")];
				}

				const list = new ItemList();
				const result = util.mapFromObject(list, "List");

				expect(result.List.Item).toHaveLength(2);
				expect(result.List.Item[0].Name).toBe("Item1");
				expect(result.List.Item[1].Name).toBe("Item2");
			});

			it("should handle mixed primitive and complex arrays", () => {
				@XmlElement({ name: "Item" })
				class Item {
					@XmlElement({ name: "Name" })
					name: string = "";

					constructor(name: string = "") {
						this.name = name;
					}
				}

				@XmlRoot({ elementName: "List" })
				class ItemList {
					@XmlArray({ itemName: "Item", type: Item })
					items: Item[] = [new Item("Item1")];
				}

				const list = new ItemList();
				const result = util.mapFromObject(list, "List");

				expect(result.List.Item).toHaveLength(1);
			});
		});

		describe("Circular reference handling", () => {
			it("should detect circular references", () => {
				@XmlElement({ name: "Address" })
				class Address {
					@XmlElement({ name: "Street" })
					street: string = "123 Main St";
				}

				@XmlRoot({ elementName: "Node" })
				class Node {
					@XmlElement({ name: "Name" })
					name: string = "Node1";

					@XmlElement({ name: "Address" })
					address: Address = new Address();
				}

				const node = new Node();
				// Create a circular reference by adding node to address (not a typical pattern)
				(node.address as any).node = node;

				// Reset to avoid interference from previous tests
				util.resetVisitedObjects();

				// Should not throw or cause infinite loop
				const result = util.mapFromObject(node, "Node");

				// Should have successfully serialized
				expect(result.Node).toBeDefined();
				expect(result.Node.Name).toBe("Node1");
				expect(result.Node.Address).toBeDefined();
			});
			it("should reset visited objects between operations", () => {
				@XmlRoot({ elementName: "Node" })
				class Node {
					@XmlElement({ name: "Name" })
					name: string = "Node1";
				}

				const node1 = new Node();
				util.mapFromObject(node1, "Node");

				util.resetVisitedObjects();

				const node2 = new Node();
				const result = util.mapFromObject(node2, "Node");

				expect(result.Node.Name).toBe("Node1");
			});
		});

		describe("xsi:type handling", () => {
			it("should add xsi:type when runtime type differs", () => {
				@XmlElement({ name: "Animal" })
				class Animal {
					@XmlElement({ name: "Name" })
					name: string = "";
				}

				@XmlElement({ name: "Dog" })
				class Dog extends Animal {
					@XmlElement({ name: "Breed" })
					breed: string = "";
				}

				@XmlRoot({ elementName: "Zoo" })
				class Zoo {
					@XmlElement({ name: "Animal", type: Animal })
					animal: Animal = new Dog();
				}

				const utilWithXsi = new XmlMappingUtil({ ...defaultOptions, useXsiType: true });
				const zoo = new Zoo();
				zoo.animal = new Dog();
				(zoo.animal as Dog).breed = "Labrador";

				const result = utilWithXsi.mapFromObject(zoo, "Zoo");

				expect(result.Zoo.Animal["@_xsi:type"]).toBe("Dog");
			});
		});
	});

	describe("hasMixedContentFields", () => {
		it("should return true if class has mixed content fields", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "Content", mixedContent: true })
				content: any[] = [];
			}

			const result = util.hasMixedContentFields(Document);

			expect(result).toBe(true);
		});

		it("should return false if class has no mixed content fields", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "Title" })
				title: string = "";
			}

			const result = util.hasMixedContentFields(Document);

			expect(result).toBe(false);
		});
	});

	describe("Edge cases", () => {
		it("should handle empty objects", () => {
			@XmlRoot({ elementName: "Empty" })
			class Empty {}

			const empty = new Empty();
			const result = util.mapFromObject(empty, "Empty");

			expect(result.Empty).toBeDefined();
		});

		it("should handle objects with only undefined values", () => {
			@XmlRoot({ elementName: "Person" })
			class Person {
				@XmlElement({ name: "Name" })
				name?: string;

				@XmlElement({ name: "Age" })
				age?: number;
			}

			const person = new Person();
			const result = util.mapFromObject(person, "Person");

			expect(result.Person.Name).toBeNull();
			expect(result.Person.Age).toBeNull();
		});

		it("should handle boolean attributes", () => {
			@XmlRoot({ elementName: "Config" })
			class Config {
				@XmlAttribute({ name: "enabled" })
				enabled: boolean = true;
			}

			const config = new Config();
			const result = util.mapFromObject(config, "Config");

			expect(result.Config["@_enabled"]).toBe("true");
		});

		it("should handle numeric zero values", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlElement({ name: "Count" })
				count: number = 0;
			}

			const data = new Data();
			const result = util.mapFromObject(data, "Data");

			expect(result.Data.Count).toBe(0);
		});

		it("should handle false boolean values", () => {
			@XmlRoot({ elementName: "Config" })
			class Config {
				@XmlElement({ name: "Enabled" })
				enabled: boolean = false;
			}

			const config = new Config();
			const result = util.mapFromObject(config, "Config");

			expect(result.Config.Enabled).toBe(false);
		});
	});
});
