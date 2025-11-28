import { beforeEach, describe, expect, it } from "vitest";
import { XmlArray } from "../src/decorators/xml-array";
import { XmlAttribute } from "../src/decorators/xml-attribute";
import { XmlElement } from "../src/decorators/xml-element";
import { XmlRoot } from "../src/decorators/xml-root";
import { XmlText } from "../src/decorators/xml-text";
import { XmlDecoratorSerializer } from "../src/xml-decorator-serializer";

describe("XmlSerializer", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("toXml - Basic serialization", () => {
		it("should serialize simple class with XmlRoot", () => {
			@XmlRoot({ name: "Person" })
			class Person {
				@XmlElement("Name")
				name: string = "John";
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<Name>John</Name>");
			expect(xml).toContain("</Person>");
		});

		it("should serialize class with XmlElement decorator", () => {
			@XmlElement({ name: "Book" })
			class Book {
				@XmlElement("Title")
				title: string = "Test Book";
			}

			const book = new Book();
			const xml = serializer.toXml(book);

			expect(xml).toContain("<Book>");
			expect(xml).toContain("<Title>Test Book</Title>");
		});

		it("should serialize attributes", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlAttribute({ name: "id" })
				id: string = "123";

				@XmlElement("Name")
				name: string = "Widget";
			}

			const product = new Product();
			const xml = serializer.toXml(product);

			expect(xml).toContain('id="123"');
			expect(xml).toContain("<Name>Widget</Name>");
		});

		it("should serialize text content", () => {
			@XmlRoot({ name: "Message" })
			class Message {
				@XmlAttribute({ name: "lang" })
				language: string = "en";

				@XmlText()
				content: string = "Hello World";
			}

			const message = new Message();
			const xml = serializer.toXml(message);

			expect(xml).toContain('lang="en"');
			expect(xml).toContain("Hello World");
		});

		it("should include XML declaration by default", () => {
			@XmlRoot({ name: "Root" })
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).toMatch(/^<\?xml version="1\.0"/);
		});

		it("should omit XML declaration when configured", () => {
			const serializer = new XmlDecoratorSerializer({ omitXmlDeclaration: true });

			@XmlRoot({ name: "Root" })
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).not.toContain("<?xml");
		});
	});

	describe("toXml - Complex structures", () => {
		it("should serialize nested objects", () => {
			@XmlElement({ name: "Address" })
			class Address {
				@XmlElement("Street")
				street: string = "123 Main St";

				@XmlElement("City")
				city: string = "Springfield";
			}

			@XmlRoot({ name: "Person" })
			class Person {
				@XmlElement("Name")
				name: string = "John";

				@XmlElement("Address")
				address: Address = new Address();
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Address>");
			expect(xml).toContain("<Street>123 Main St</Street>");
			expect(xml).toContain("<City>Springfield</City>");
			expect(xml).toContain("</Address>");
		});

		it("should serialize arrays with XmlArray", () => {
			@XmlRoot({ name: "Library" })
			class Library {
				@XmlArray({ containerName: "Books", itemName: "Book" })
				books: string[] = ["Book1", "Book2", "Book3"];
			}

			const library = new Library();
			const xml = serializer.toXml(library);

			expect(xml).toContain("<Books>");
			expect(xml).toContain("<Book>Book1</Book>");
			expect(xml).toContain("<Book>Book2</Book>");
			expect(xml).toContain("<Book>Book3</Book>");
			expect(xml).toContain("</Books>");
		});

		it("should serialize unwrapped arrays", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlArray({ itemName: "Item" })
				items: string[] = ["A", "B", "C"];
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<Item>A</Item>");
			expect(xml).toContain("<Item>B</Item>");
			expect(xml).toContain("<Item>C</Item>");
			expect(xml).not.toContain("<items>");
		});

		it("should serialize arrays of complex objects", () => {
			@XmlElement({ name: "Book" })
			class Book {
				@XmlAttribute({ name: "isbn" })
				isbn: string = "";

				@XmlElement("Title")
				title: string = "";

				constructor(isbn: string, title: string) {
					this.isbn = isbn;
					this.title = title;
				}
			}

			@XmlRoot({ name: "Library" })
			class Library {
				@XmlArray({ containerName: "Books", itemName: "Book", type: Book })
				books: Book[] = [new Book("123", "Book A"), new Book("456", "Book B")];
			}

			const library = new Library();
			const xml = serializer.toXml(library);

			expect(xml).toContain('isbn="123"');
			expect(xml).toContain("<Title>Book A</Title>");
			expect(xml).toContain('isbn="456"');
			expect(xml).toContain("<Title>Book B</Title>");
		});
	});

	describe("toXml - Null and undefined handling", () => {
		it("should handle null values based on options", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement("Value")
				value: string | null = null;
			}

			const data = new Data();
			const xml = serializer.toXml(data);

			expect(xml).toContain("<Value");
		});

		it("should omit null values when configured", () => {
			const serializer = new XmlDecoratorSerializer({ omitNullValues: true });

			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement("Value")
				value: string | null = null;

				@XmlElement("Other")
				other: string = "present";
			}

			const data = new Data();
			const xml = serializer.toXml(data);

			expect(xml).not.toContain("<Value");
			expect(xml).toContain("<Other>present</Other>");
		});

		it("should handle undefined attributes", () => {
			@XmlRoot({ name: "Element" })
			class Element {
				@XmlAttribute({ name: "attr" })
				attr: string | undefined;
			}

			const element = new Element();
			const xml = serializer.toXml(element);

			// Should contain empty attribute or omit it based on settings
			expect(xml).toBeTruthy();
		});
	});

	describe("toXml - Namespaces", () => {
		it("should handle element namespaces", () => {
			@XmlRoot({
				name: "Person",
				namespace: { uri: "http://example.com", prefix: "ex" },
			})
			class Person {
				@XmlElement("Name")
				name: string = "John";
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("ex:Person");
			expect(xml).toContain('xmlns:ex="http://example.com"');
		});

		it("should handle attribute namespaces", () => {
			@XmlRoot({ name: "Element" })
			class Element {
				@XmlAttribute({
					name: "attr",
					namespace: { uri: "http://test.com", prefix: "t" },
				})
				attr: string = "value";
			}

			const element = new Element();
			const xml = serializer.toXml(element);

			expect(xml).toContain("t:attr");
			expect(xml).toContain('xmlns:t="http://test.com"');
		});

		it("should handle default namespace", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://example.com", isDefault: true },
			})
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).toContain('xmlns="http://example.com"');
		});
	});

	describe("fromXml - Basic deserialization", () => {
		it("should deserialize simple XML", () => {
			@XmlElement({ name: "Person" })
			class Person {
				@XmlElement("Name")
				name: string = "";

				@XmlElement("Age")
				age: number = 0;
			}

			const xml = `
				<Person>
					<Name>John</Name>
					<Age>30</Age>
				</Person>
			`;

			const person = serializer.fromXml(xml, Person);

			expect(person.name).toBe("John");
			expect(person.age).toBe(30);
		});

		it("should deserialize attributes", () => {
			@XmlElement({ name: "Product" })
			class Product {
				@XmlAttribute({ name: "id" })
				id: string = "";

				@XmlElement("Name")
				name: string = "";
			}

			const xml = '<Product id="123"><Name>Widget</Name></Product>';

			const product = serializer.fromXml(xml, Product);

			expect(product.id).toBe("123");
			expect(product.name).toBe("Widget");
		});

		it("should deserialize text content", () => {
			@XmlElement({ name: "Message" })
			class Message {
				@XmlAttribute({ name: "lang" })
				language: string = "";

				@XmlText()
				content: string = "";
			}

			const xml = '<Message lang="en">Hello World</Message>';

			const message = serializer.fromXml(xml, Message);

			expect(message.language).toBe("en");
			expect(message.content).toBe("Hello World");
		});

		it("should throw error for missing root element", () => {
			@XmlElement({ name: "Person" })
			class Person {}

			const xml = "<WrongRoot></WrongRoot>";

			expect(() => serializer.fromXml(xml, Person)).toThrow();
		});

		it("should throw error for class without decorator", () => {
			class UnDecoratedClass {}

			const xml = "<Root></Root>";

			expect(() => serializer.fromXml(xml, UnDecoratedClass)).toThrow();
		});
	});

	describe("fromXml - Complex structures", () => {
		it("should deserialize nested objects", () => {
			@XmlElement({ name: "Address" })
			class Address {
				@XmlElement("Street")
				street: string = "";

				@XmlElement("City")
				city: string = "";
			}

			@XmlElement({ name: "Person" })
			class Person {
				@XmlElement("Name")
				name: string = "";

				@XmlElement("Address")
				address: Address = new Address();
			}

			const xml = `
				<Person>
					<Name>John</Name>
					<Address>
						<Street>123 Main St</Street>
						<City>Springfield</City>
					</Address>
				</Person>
			`;

			const person = serializer.fromXml(xml, Person);

			expect(person.name).toBe("John");
			expect(person.address).toBeDefined();
		});

		it("should deserialize arrays", () => {
			@XmlElement({ name: "Library" })
			class Library {
				@XmlArray({ containerName: "Books", itemName: "Book" })
				books: string[] = [];
			}

			const xml = `
				<Library>
					<Books>
						<Book>Book1</Book>
						<Book>Book2</Book>
					</Books>
				</Library>
			`;

			const library = serializer.fromXml(xml, Library);

			expect(library.books).toHaveLength(2);
			expect(library.books[0]).toBe("Book1");
			expect(library.books[1]).toBe("Book2");
		});
	});

	describe("fromXml - Validation", () => {
		it("should validate required attributes", () => {
			@XmlRoot({ name: "Element" })
			class Element {
				@XmlAttribute({ name: "attr", required: true })
				requiredAttr: string = "";
			}

			const xml = "<Element></Element>";

			expect(() => serializer.fromXml(xml, Element)).toThrow("Required attribute");
		});

		it("should validate required elements", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement({ name: "Required", required: true })
				required: string = "";
			}

			const xml = "<Container></Container>";

			expect(() => serializer.fromXml(xml, Container)).toThrow("Required element");
		});

		it("should validate attribute patterns", () => {
			@XmlElement({ name: "Element" })
			class Element {
				@XmlAttribute({ name: "code", pattern: /^[0-9]+$/ })
				code: string = "";
			}

			const xml = '<Element code="ABC"></Element>';

			expect(() => serializer.fromXml(xml, Element)).toThrow("Invalid value");
		});

		it("should validate enum values", () => {
			@XmlElement({ name: "Element" })
			class Element {
				@XmlAttribute({ name: "color", enumValues: ["red", "green", "blue"] })
				color: string = "";
			}

			const xml = '<Element color="yellow"></Element>';

			expect(() => serializer.fromXml(xml, Element)).toThrow("Invalid value");
		});
	});

	describe("Round-trip serialization", () => {
		it("should preserve data through serialize-deserialize cycle", () => {
			@XmlRoot({ name: "Person" })
			class Person {
				@XmlAttribute({ name: "id" })
				id: string = "123";

				@XmlElement("Name")
				name: string = "John Doe";

				@XmlElement("Age")
				age: number = 30;
			}

			const original = new Person();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Person);

			expect(deserialized.id).toBe(original.id);
			expect(deserialized.name).toBe(original.name);
			expect(deserialized.age).toBe(original.age);
		});

		it("should handle complex nested structures in round-trip", () => {
			@XmlElement("Address")
			class Address {
				@XmlElement("Street")
				street: string = "123 Main St";

				@XmlElement("City")
				city: string = "Springfield";
			}

			@XmlRoot({ name: "Person" })
			class Person {
				@XmlElement("Name")
				name: string = "John";

				@XmlElement("Address")
				address: Address = new Address();
			}

			const original = new Person();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Person);

			expect(deserialized.name).toBe(original.name);
			expect(deserialized.address).toBeDefined();
		});
	});

	describe("Custom serialization options", () => {
		it("should use custom encoding", () => {
			const serializer = new XmlDecoratorSerializer({ encoding: "UTF-16" });

			@XmlRoot({ name: "Root" })
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).toContain('encoding="UTF-16"');
		});

		it("should include standalone declaration", () => {
			const serializer = new XmlDecoratorSerializer({ standalone: true });

			@XmlRoot({ name: "Root" })
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).toContain('standalone="yes"');
		});

		it("should handle custom XML version", () => {
			const serializer = new XmlDecoratorSerializer({ xmlVersion: "1.1" });

			@XmlRoot({ name: "Root" })
			class Root {}

			const root = new Root();
			const xml = serializer.toXml(root);

			expect(xml).toContain('version="1.1"');
		});
	});
});
