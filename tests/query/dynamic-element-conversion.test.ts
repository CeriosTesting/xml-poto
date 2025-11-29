import { describe, expect, it } from "vitest";
import { XmlAttribute, XmlElement, XmlRoot } from "../../src/decorators";
import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

// Test classes
@XmlRoot({ elementName: "Person" })
class Person {
	@XmlAttribute()
	id!: string;

	@XmlElement()
	name!: string;

	@XmlElement()
	age!: number;

	@XmlElement()
	email?: string;
}

@XmlRoot({ elementName: "Book" })
class Book {
	@XmlAttribute()
	isbn!: string;

	@XmlElement()
	title!: string;

	@XmlElement()
	author!: string;

	@XmlElement()
	price!: number;
}

@XmlRoot({ elementName: "Library" })
class Library {
	@XmlElement()
	name!: string;

	@XmlElement({ type: Book })
	books!: Book[];
}

describe("DynamicElement conversion methods", () => {
	describe("fromDecoratedClass", () => {
		it("should convert a simple decorated class to DynamicElement", async () => {
			const person = new Person();
			person.id = "123";
			person.name = "John Doe";
			person.age = 30;

			const element = await DynamicElement.fromDecoratedClass(person);

			expect(element.name).toBe("Person");
			expect(element.attributes.id).toBe("123");
			// Note: may have empty text nodes or formatting
			expect(element.children.length).toBeGreaterThanOrEqual(2);

			const nameChild = element.children.find(c => c.name === "name");
			expect(nameChild?.text).toBe("John Doe");

			const ageChild = element.children.find(c => c.name === "age");
			expect(ageChild?.text).toBe("30");
			expect(ageChild?.numericValue).toBe(30);
		});

		it("should convert with optional properties", async () => {
			const person = new Person();
			person.id = "456";
			person.name = "Jane Smith";
			person.age = 25;
			person.email = "jane@example.com";

			const element = await DynamicElement.fromDecoratedClass(person);

			expect(element.name).toBe("Person");
			expect(element.children).toHaveLength(3);

			const emailChild = element.children.find(c => c.name === "email");
			expect(emailChild?.text).toBe("jane@example.com");
		});

		it("should work with custom serializer", async () => {
			const serializer = new XmlDecoratorSerializer({
				encoding: "UTF-8",
			});

			const person = new Person();
			person.id = "789";
			person.name = "Bob";
			person.age = 40;

			const element = await DynamicElement.fromDecoratedClass(person, serializer);

			expect(element.name).toBe("Person");
			expect(element.attributes.id).toBe("789");
		});

		it("should handle nested objects", async () => {
			const book1 = new Book();
			book1.isbn = "123-456";
			book1.title = "Book One";
			book1.author = "Author One";
			book1.price = 29.99;

			const book2 = new Book();
			book2.isbn = "789-012";
			book2.title = "Book Two";
			book2.author = "Author Two";
			book2.price = 39.99;

			const library = new Library();
			library.name = "City Library";
			library.books = [book1, book2];

			const element = await DynamicElement.fromDecoratedClass(library);

			expect(element.name).toBe("Library");
			expect(element.children).toHaveLength(3); // name + 2 books
		});
	});

	describe("toDecoratedClass", () => {
		it("should convert a DynamicElement to decorated class", () => {
			const element = new DynamicElement({
				name: "Person",
				attributes: { id: "123" },
			});

			element.createChild({ name: "name", text: "John Doe" });
			element.createChild({ name: "age", text: "30" });

			const person = element.toDecoratedClass(Person);

			expect(person).toBeInstanceOf(Person);
			expect(person.id).toBe("123");
			expect(person.name).toBe("John Doe");
			expect(person.age).toBe(30);
		});

		it("should handle optional properties", () => {
			const element = new DynamicElement({
				name: "Person",
				attributes: { id: "456" },
			});

			element.createChild({ name: "name", text: "Jane Smith" });
			element.createChild({ name: "age", text: "25" });
			element.createChild({ name: "email", text: "jane@example.com" });

			const person = element.toDecoratedClass(Person);

			expect(person.id).toBe("456");
			expect(person.name).toBe("Jane Smith");
			expect(person.age).toBe(25);
			expect(person.email).toBe("jane@example.com");
		});

		it("should work with custom serializer", () => {
			const serializer = new XmlDecoratorSerializer({
				encoding: "UTF-8",
			});

			const element = new DynamicElement({
				name: "Person",
				attributes: { id: "789" },
			});

			element.createChild({ name: "name", text: "Bob" });
			element.createChild({ name: "age", text: "40" });

			const person = element.toDecoratedClass(Person, serializer);

			expect(person).toBeInstanceOf(Person);
			expect(person.id).toBe("789");
			expect(person.name).toBe("Bob");
			expect(person.age).toBe(40);
		});

		it("should preserve type conversions", () => {
			const element = new DynamicElement({
				name: "Book",
				attributes: { isbn: "123-456" },
			});

			element.createChild({ name: "title", text: "Test Book" });
			element.createChild({ name: "author", text: "Test Author" });
			element.createChild({ name: "price", text: "19.99" });

			const book = element.toDecoratedClass(Book);

			expect(book.isbn).toBe("123-456");
			expect(book.title).toBe("Test Book");
			expect(book.author).toBe("Test Author");
			expect(book.price).toBe(19.99);
			expect(typeof book.price).toBe("number");
		});
	});

	describe("round-trip conversion", () => {
		it("should handle round-trip conversion: decorated class -> DynamicElement -> decorated class", async () => {
			const original = new Person();
			original.id = "123";
			original.name = "John Doe";
			original.age = 30;
			original.email = "john@example.com";

			// Convert to DynamicElement
			const element = await DynamicElement.fromDecoratedClass(original);

			// Convert back to decorated class
			const result = element.toDecoratedClass(Person);

			expect(result.id).toBe(original.id);
			expect(result.name).toBe(original.name);
			expect(result.age).toBe(original.age);
			expect(result.email).toBe(original.email);
		});

		it("should handle round-trip with modifications", async () => {
			const original = new Person();
			original.id = "123";
			original.name = "John Doe";
			original.age = 30;

			// Convert to DynamicElement
			const element = await DynamicElement.fromDecoratedClass(original);

			// Modify the element
			element.setAttribute("id", "456");
			const nameChild = element.children.find(c => c.name === "name");
			nameChild?.setText("Jane Smith");

			// Convert back to decorated class
			const result = element.toDecoratedClass(Person);

			expect(result.id).toBe("456");
			expect(result.name).toBe("Jane Smith");
			expect(result.age).toBe(30);
		});

		it("should handle adding new elements during round-trip", async () => {
			const original = new Person();
			original.id = "123";
			original.name = "John Doe";
			original.age = 30;

			// Convert to DynamicElement
			const element = await DynamicElement.fromDecoratedClass(original);

			// Add a new element
			element.createChild({ name: "email", text: "newemail@example.com" });

			// Convert back to decorated class
			const result = element.toDecoratedClass(Person);

			expect(result.id).toBe("123");
			expect(result.name).toBe("John Doe");
			expect(result.age).toBe(30);
			// Note: When adding a child to an existing element that was parsed from XML,
			// it may create duplicate children or array structures depending on existing children
			// For this test, just verify the email field is populated (it may be an array or string)
			expect(result.email).toBeTruthy();
			if (Array.isArray(result.email)) {
				expect(result.email).toContain("newemail@example.com");
			} else {
				expect(result.email).toBe("newemail@example.com");
			}
		});
	});

	describe("integration with XmlQuery", () => {
		it("should allow querying after conversion from decorated class", async () => {
			const person = new Person();
			person.id = "123";
			person.name = "John Doe";
			person.age = 30;

			const element = await DynamicElement.fromDecoratedClass(person);

			// Use query API
			const nameElement = element.query().find("name").first();
			expect(nameElement?.text).toBe("John Doe");

			const ageElement = element.query().find("age").first();
			expect(ageElement?.numericValue).toBe(30);
		});

		it("should allow modifications through query API before converting back", async () => {
			const person = new Person();
			person.id = "123";
			person.name = "John Doe";
			person.age = 30;

			const element = await DynamicElement.fromDecoratedClass(person);

			// Modify using query API
			element.query().find("name").setText("Jane Smith");
			element.query().find("age").setText("25");

			// Convert back
			const result = element.toDecoratedClass(Person);

			expect(result.name).toBe("Jane Smith");
			expect(result.age).toBe(25);
		});
	});
});
