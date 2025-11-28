import { XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

describe("XML Namespace Integration Tests", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("Default namespace (xmlns)", () => {
		it("should serialize root element with default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "Test";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title>Test</title>");
		});

		it("should serialize empty element with default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title");
			expect(xml).toContain("</Document>");
		});

		it("should handle complex default namespace URIs", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "urn:example:schema:v1.0" },
			})
			class Root {
				@XmlElement()
				value!: string;
			}

			const root = new Root();
			root.value = "test";

			const xml = serializer.toXml(root);
			expect(xml).toContain('xmlns="urn:example:schema:v1.0"');
		});
	});

	describe("Prefixed namespace (xmlns:prefix)", () => {
		it("should serialize root element with prefixed namespace", () => {
			@XmlRoot({
				name: "Person",
				namespace: {
					uri: "http://example.com/person",
					prefix: "per",
				},
			})
			class Person {
				@XmlElement()
				name!: string;
			}

			const person = new Person();
			person.name = "John";

			const xml = serializer.toXml(person);
			expect(xml).toContain('xmlns:per="http://example.com/person"');
			expect(xml).toContain("<per:Person");
			expect(xml).toContain("</per:Person>");
		});

		it("should handle multiple different prefixed namespaces", () => {
			@XmlRoot({
				name: "Book",
				namespace: {
					uri: "http://example.com/books",
					prefix: "bk",
				},
			})
			class Book {
				@XmlElement()
				title!: string;
			}

			const book = new Book();
			book.title = "XML Guide";

			const xml = serializer.toXml(book);
			expect(xml).toContain('xmlns:bk="http://example.com/books"');
			expect(xml).toContain("<bk:Book");
			expect(xml).toContain("</bk:Book>");
		});
	});

	describe("No namespace", () => {
		it("should serialize root element without namespace", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "Test";

			const xml = serializer.toXml(doc);
			expect(xml).not.toContain("xmlns");
			expect(xml).toContain("<Document>");
			expect(xml).toContain("<title>Test</title>");
		});
	});

	describe("Nested elements with parent namespace", () => {
		it("should handle nested elements with parent namespace", () => {
			@XmlRoot({
				name: "Book",
				namespace: { uri: "http://example.com/books" },
			})
			class Book {
				@XmlElement()
				title!: string;

				@XmlElement()
				author!: string;
			}

			const book = new Book();
			book.title = "XML Guide";
			book.author = "John Doe";

			const xml = serializer.toXml(book);
			expect(xml).toContain('xmlns="http://example.com/books"');
			expect(xml).toContain("<Book");
			expect(xml).toContain("<title>XML Guide</title>");
			expect(xml).toContain("<author>John Doe</author>");
		});
	});

	describe("Edge cases", () => {
		it("should handle namespace with special characters in URI", () => {
			@XmlRoot({
				name: "Data",
				namespace: { uri: "http://example.com/data?version=1&type=xml" },
			})
			class Data {
				@XmlElement()
				value!: string;
			}

			const data = new Data();
			data.value = "test";

			const xml = serializer.toXml(data);
			expect(xml).toContain('xmlns="http://example.com/data?version=1&amp;type=xml"');
		});

		it("should not add namespace declaration when namespace is empty object", () => {
			@XmlRoot({
				name: "Root",
				namespace: {} as any,
			})
			class Root {
				@XmlElement()
				value!: string;
			}

			const root = new Root();
			root.value = "test";

			const xml = serializer.toXml(root);
			expect(xml).not.toContain("xmlns");
		});
	});
});
