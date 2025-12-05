import { describe, expect, it } from "vitest";
import { XmlArray, XmlDynamic, XmlElement, XmlRoot } from "../../src/decorators";
import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Strict Validation - Extra Fields", () => {
	describe("Default mode (strictValidation = false)", () => {
		it("should NOT throw error for extra XML fields by default", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlElement({ name: "Email" })
				email: string = "";
			}

			const xml = `
				<User>
					<Name>John Doe</Name>
					<Email>john@example.com</Email>
					<Age>30</Age>
					<Phone>555-1234</Phone>
					<Address>123 Main St</Address>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer();

			// Should NOT throw - extra fields are silently ignored
			expect(() => {
				const user = serializer.fromXml(xml, User);
				expect(user.name).toBe("John Doe");
				expect(user.email).toBe("john@example.com");
			}).not.toThrow();
		});
	});

	describe("Strict mode - Classes WITHOUT @XmlDynamic", () => {
		it("should throw error for extra XML fields in strict mode", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlElement({ name: "Email" })
				email: string = "";
			}

			const xml = `
				<User>
					<Name>John Doe</Name>
					<Email>john@example.com</Email>
					<Age>30</Age>
					<Phone>555-1234</Phone>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, User);
			}).toThrow(/\[Strict Validation Error\] Unexpected XML element\(s\) found in 'User'/);
		});

		it("should list all extra fields in error message", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement({ name: "SKU" })
				sku: string = "";

				@XmlElement({ name: "Name" })
				name: string = "";
			}

			const xml = `
				<Product>
					<SKU>12345</SKU>
					<Name>Widget</Name>
					<Description>A great widget</Description>
					<Price>99.99</Price>
					<Stock>100</Stock>
				</Product>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			try {
				serializer.fromXml(xml, Product);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("<Description>");
				expect(error.message).toContain("<Price>");
				expect(error.message).toContain("<Stock>");
				expect(error.message).toContain("Defined elements in Product:");
				expect(error.message).toContain("<SKU>");
				expect(error.message).toContain("<Name>");
			}
		});

		it("should provide helpful fix suggestions in error message", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ name: "Setting" })
				setting: string = "";
			}

			const xml = `
				<Config>
					<Setting>value</Setting>
					<ExtraField>unexpected</ExtraField>
				</Config>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			try {
				serializer.fromXml(xml, Config);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("To fix this issue:");
				expect(error.message).toContain("Add @XmlElement decorators");
				expect(error.message).toContain("Use @XmlDynamic");
				expect(error.message).toContain("strictValidation: false");
			}
		});

		it("should NOT throw for valid XML that matches the model exactly", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlElement({ name: "Email" })
				email: string = "";

				@XmlElement({ name: "Age" })
				age: number = 0;
			}

			const xml = `
				<User>
					<Name>John Doe</Name>
					<Email>john@example.com</Email>
					<Age>30</Age>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should not throw when all fields match
			const user = serializer.fromXml(xml, User);
			expect(user.name).toBe("John Doe");
			expect(user.email).toBe("john@example.com");
			expect(user.age).toBe(30);
		});

		it("should validate nested objects for extra fields", () => {
			@XmlElement({ name: "Address" })
			class Address {
				@XmlElement({ name: "Street" })
				street: string = "";

				@XmlElement({ name: "City" })
				city: string = "";
			}

			@XmlRoot({ name: "User" })
			class User {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlElement({ name: "Address", type: Address })
				address: Address = new Address();
			}

			const xml = `
				<User>
					<Name>John Doe</Name>
					<Address>
						<Street>123 Main St</Street>
						<City>Springfield</City>
						<ZipCode>12345</ZipCode>
					</Address>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, User);
			}).toThrow(/\[Strict Validation Error\] Unexpected XML element\(s\) found in 'Address'/);
		});

		it("should handle arrays correctly and not flag array items as extra", () => {
			@XmlRoot({ name: "Library" })
			class Library {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlArray({
					itemName: "Book",
				})
				books: string[] = [];
			}

			const xml = `
				<Library>
					<Name>City Library</Name>
					<Book>Book 1</Book>
					<Book>Book 2</Book>
					<Book>Book 3</Book>
				</Library>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - Books are defined as array items
			const library = serializer.fromXml(xml, Library);
			expect(library.name).toBe("City Library");
			expect(library.books).toEqual(["Book 1", "Book 2", "Book 3"]);
		});

		it("should handle wrapped arrays correctly", () => {
			@XmlRoot({ name: "Library" })
			class Library {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlArray({
					containerName: "Books",
					itemName: "Book",
				})
				books: string[] = [];
			}

			const xml = `
				<Library>
					<Name>City Library</Name>
					<Books>
						<Book>Book 1</Book>
						<Book>Book 2</Book>
					</Books>
				</Library>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - Books container is defined
			const library = serializer.fromXml(xml, Library);
			expect(library.name).toBe("City Library");
			expect(library.books).toEqual(["Book 1", "Book 2"]);
		});
	});

	describe("Strict mode - Classes WITH @XmlDynamic", () => {
		it("should NOT throw error for extra fields when class has @XmlDynamic", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement({ name: "Title" })
				title: string = "";

				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `
				<Document>
					<Title>My Document</Title>
					<Author>John Doe</Author>
					<Date>2024-01-01</Date>
					<Version>1.0</Version>
					<Status>Published</Status>
				</Document>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - class has @XmlDynamic to handle arbitrary content
			expect(() => {
				const doc = serializer.fromXml(xml, Document);
				expect(doc.title).toBe("My Document");
				expect(doc.query).toBeDefined();
			}).not.toThrow();
		});

		it("should allow arbitrary XML structure with @XmlDynamic", () => {
			@XmlRoot({ name: "Envelope" })
			class Envelope {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `
				<Envelope>
					<SimpleElement>Value</SimpleElement>
					<AnotherElement>Text</AnotherElement>
				</Envelope>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - @XmlDynamic handles any structure
			const envelope = serializer.fromXml(xml, Envelope);
			expect(envelope.query).toBeDefined();
			expect(envelope.query?.children.length).toBeGreaterThan(0);
		});

		it("should NOT validate nested objects that are accessed through @XmlDynamic", () => {
			@XmlElement({ name: "Metadata" })
			class Metadata {
				@XmlElement({ name: "Version" })
				version: string = "";

				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement({ name: "Title" })
				title: string = "";

				@XmlElement({ name: "Metadata", type: Metadata })
				metadata: Metadata = new Metadata();
			}

			const xml = `
				<Document>
					<Title>Doc</Title>
					<Metadata>
						<Version>v1.0</Version>
						<CustomField1>Value1</CustomField1>
						<CustomField2>Value2</CustomField2>
					</Metadata>
				</Document>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - Metadata has @XmlDynamic
			const doc = serializer.fromXml(xml, Document);
			expect(doc.title).toBe("Doc");
			expect(doc.metadata.version).toBe("v1.0");
			expect(doc.metadata.query).toBeDefined();
		});
	});

	describe("Strict mode - Mixed Content", () => {
		it("should NOT validate extra fields when mixedContent is enabled", () => {
			@XmlRoot({ name: "Paragraph" })
			class Paragraph {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [];
			}

			const xml = `
				<Paragraph>
					<content>Some text <bold>bold text</bold> more text <italic>italic</italic></content>
				</Paragraph>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - mixedContent allows arbitrary elements
			const para = serializer.fromXml(xml, Paragraph);
			expect(para.content).toBeDefined();
			expect(Array.isArray(para.content)).toBe(true);
		});
	});

	describe("Edge Cases", () => {
		it("should not flag attributes as extra fields", () => {
			@XmlRoot({ name: "Element" })
			class Element {
				@XmlElement({ name: "Value" })
				value: string = "";
			}

			const xml = `
				<Element id="123" name="test" attr="value">
					<Value>Content</Value>
				</Element>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - attributes are ignored (not validated as elements)
			const elem = serializer.fromXml(xml, Element);
			expect(elem.value).toBe("Content");
		});

		it("should handle optional fields correctly", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement({ name: "Name" })
				name: string = "";

				@XmlElement({ name: "Email" })
				email?: string;

				@XmlElement({ name: "Phone" })
				phone?: string;
			}

			const xml = `
				<User>
					<Name>John</Name>
					<Age>30</Age>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw for Age (not defined), but Email/Phone are optional and can be missing
			try {
				serializer.fromXml(xml, User);
				expect.fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("Unexpected XML element");
				expect(error.message).toContain("<Age>");
			}
		});

		it("should handle empty classes (no decorators)", () => {
			@XmlRoot({ name: "Empty" })
			class Empty {}

			const xml = `
				<Empty>
					<AnyField>Value</AnyField>
				</Empty>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw - no fields defined, so any content is extra
			expect(() => {
				serializer.fromXml(xml, Empty);
			}).toThrow(/Unexpected XML element/);
		});

		it("should handle classes with only text content", () => {
			@XmlRoot({ name: "SimpleText" })
			class SimpleText {
				@XmlElement({ name: "text" })
				text: string = "";
			}

			const xml = `
				<SimpleText>
					<text>Hello</text>
				</SimpleText>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw
			const obj = serializer.fromXml(xml, SimpleText);
			expect(obj.text).toBe("Hello");
		});
	});

	describe("Real-world scenarios", () => {
		it("should validate API responses with extra fields", () => {
			@XmlRoot({ name: "ApiResponse" })
			class ApiResponse {
				@XmlElement({ name: "Status" })
				status: string = "";

				@XmlElement({ name: "Message" })
				message: string = "";
			}

			// API returns extra fields we don't care about
			const xml = `
				<ApiResponse>
					<Status>success</Status>
					<Message>Operation completed</Message>
					<Timestamp>2024-01-01T00:00:00Z</Timestamp>
					<RequestId>abc-123</RequestId>
					<ServerVersion>2.0</ServerVersion>
				</ApiResponse>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// In strict mode, this will throw - we need to define all fields or use @XmlDynamic
			expect(() => {
				serializer.fromXml(xml, ApiResponse);
			}).toThrow(/Unexpected XML element/);
		});

		it("should handle versioned data models", () => {
			@XmlRoot({ name: "DataV1" })
			class DataV1 {
				@XmlElement({ name: "Field1" })
				field1: string = "";

				@XmlElement({ name: "Field2" })
				field2: string = "";

				// Use @XmlDynamic to allow future version fields
				@XmlDynamic()
				query?: DynamicElement;
			}

			// V2 XML with additional fields
			const xml = `
				<DataV1>
					<Field1>Value1</Field1>
					<Field2>Value2</Field2>
					<Field3>Value3</Field3>
					<Field4>Value4</Field4>
				</DataV1>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - @XmlDynamic allows forward compatibility
			const data = serializer.fromXml(xml, DataV1);
			expect(data.field1).toBe("Value1");
			expect(data.field2).toBe("Value2");
			expect(data.query).toBeDefined();
		});
	});
});
