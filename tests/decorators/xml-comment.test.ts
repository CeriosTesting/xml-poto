import { beforeEach, describe, expect, it } from "vitest";
import { XmlComment, XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("@XmlComment Decorator", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("Basic Functionality", () => {
		@XmlRoot({ name: "Document" })
		class Document {
			@XmlComment({ targetProperty: "title" })
			titleComment: string = "";

			@XmlElement({ name: "Title" })
			title: string = "";
		}

		it("should serialize comment before target element", () => {
			const doc = new Document();
			doc.titleComment = "This is the title";
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--This is the title-->");
			expect(xml).toContain("<Title>My Document</Title>");
			expect(xml.indexOf("<!--")).toBeLessThan(xml.indexOf("<Title>"));
		});

		it("should deserialize comment from XML", () => {
			const xml = `
				<Document>
					<!--This is the title-->
					<Title>My Document</Title>
				</Document>
			`;

			const doc = serializer.fromXml(xml, Document);

			expect(doc.titleComment).toBe("This is the title");
			expect(doc.title).toBe("My Document");
		});

		it("should handle round-trip serialization", () => {
			const doc1 = new Document();
			doc1.titleComment = "Original comment";
			doc1.title = "Original Title";

			const xml = serializer.toXml(doc1);
			const doc2 = serializer.fromXml(xml, Document);

			expect(doc2.titleComment).toBe("Original comment");
			expect(doc2.title).toBe("Original Title");
		});

		it("should handle empty comments", () => {
			const doc = new Document();
			doc.titleComment = "";
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<!--");
			expect(xml).toContain("<Title>My Document</Title>");
		});

		it("should handle undefined comments", () => {
			const doc = new Document();
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<!--");
			expect(xml).toContain("<Title>My Document</Title>");
		});
	});

	describe("Multiple Comments", () => {
		@XmlRoot({ name: "Config" })
		class Config {
			@XmlComment({ targetProperty: "version" })
			versionComment: string = "";

			@XmlElement({ name: "Version" })
			version: string = "";

			@XmlComment({ targetProperty: "setting" })
			settingComment: string = "";

			@XmlElement({ name: "Setting" })
			setting: string = "";
		}

		it("should serialize multiple comments correctly", () => {
			const config = new Config();
			config.versionComment = "Application version";
			config.version = "1.0.0";
			config.settingComment = "Configuration setting";
			config.setting = "production";

			const xml = serializer.toXml(config);

			expect(xml).toContain("<!--Application version-->");
			expect(xml).toContain("<!--Configuration setting-->");
			expect(xml).toContain("<Version>1.0.0</Version>");
			expect(xml).toContain("<Setting>production</Setting>");
		});

		it("should deserialize multiple comments correctly", () => {
			const xml = `
				<Config>
					<!--Application version-->
					<Version>1.0.0</Version>
					<!--Configuration setting-->
					<Setting>production</Setting>
				</Config>
			`;

			const config = serializer.fromXml(xml, Config);

			expect(config.versionComment).toBe("Application version");
			expect(config.version).toBe("1.0.0");
			expect(config.settingComment).toBe("Configuration setting");
			expect(config.setting).toBe("production");
		});
	});

	describe("Optional Comments", () => {
		@XmlRoot({ name: "Document" })
		class Document {
			@XmlComment({ targetProperty: "title" })
			titleComment?: string;

			@XmlElement({ name: "Title" })
			title: string = "";

			@XmlElement({ name: "Content" })
			content: string = "";
		}

		it("should handle missing optional comments in serialization", () => {
			const doc = new Document();
			doc.title = "My Title";
			doc.content = "My Content";

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<!--");
			expect(xml).toContain("<Title>My Title</Title>");
			expect(xml).toContain("<Content>My Content</Content>");
		});

		it("should handle missing optional comments in deserialization", () => {
			const xml = `
				<Document>
					<Title>My Title</Title>
					<Content>My Content</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, Document);

			expect(doc.titleComment).toBeUndefined();
			expect(doc.title).toBe("My Title");
			expect(doc.content).toBe("My Content");
		});
	});

	describe("Required Comments", () => {
		@XmlRoot({ name: "Report" })
		class Report {
			@XmlComment({ targetProperty: "data", required: true })
			dataComment: string = "";

			@XmlElement({ name: "Data" })
			data: string = "";
		}

		it("should throw error when required comment is missing during serialization", () => {
			const report = new Report();
			report.data = "Some data";

			expect(() => serializer.toXml(report)).toThrow("Required comment for 'data' is missing");
		});

		it("should serialize when required comment is provided", () => {
			const report = new Report();
			report.dataComment = "Important data";
			report.data = "Some data";

			const xml = serializer.toXml(report);

			expect(xml).toContain("<!--Important data-->");
			expect(xml).toContain("<Data>Some data</Data>");
		});

		it("should throw error when required comment is missing during deserialization", () => {
			const xml = `
				<Report>
					<Data>Some data</Data>
				</Report>
			`;

			expect(() => serializer.fromXml(xml, Report)).toThrow("Required comment for 'data' is missing");
		});
	});

	describe("Special Characters", () => {
		@XmlRoot({ name: "Test" })
		class Test {
			@XmlComment({ targetProperty: "value" })
			comment: string = "";

			@XmlElement({ name: "Value" })
			value: string = "";
		}

		it("should handle comments with special XML characters", () => {
			const test = new Test();
			test.comment = "TODO: Fix <bug> in version 2.0 & update docs";
			test.value = "test";

			const xml = serializer.toXml(test);

			expect(xml).toContain("<!--TODO: Fix <bug> in version 2.0 & update docs-->");
		});

		it("should handle multi-line comments", () => {
			const test = new Test();
			test.comment = "Line 1\nLine 2\nLine 3";
			test.value = "test";

			const xml = serializer.toXml(test);

			expect(xml).toContain("<!--Line 1\nLine 2\nLine 3-->");
		});

		it("should handle comments with whitespace", () => {
			const test = new Test();
			test.comment = "   Comment with spaces   ";
			test.value = "test";

			const xml = serializer.toXml(test);

			expect(xml).toContain("<!--   Comment with spaces   -->");
		});
	});

	describe("Edge Cases", () => {
		@XmlRoot({ name: "Test" })
		class Test {
			@XmlComment({ targetProperty: "value" })
			comment: string = "";

			@XmlElement({ name: "Value" })
			value: string = "";
		}

		it("should convert non-string values to strings", () => {
			const test = new Test();
			test.comment = 12345 as any;
			test.value = "test";

			const xml = serializer.toXml(test);

			expect(xml).toContain("<!--12345-->");
		});

		it("should handle null comment value", () => {
			const test = new Test();
			test.comment = null as any;
			test.value = "test";

			const xml = serializer.toXml(test);

			expect(xml).not.toContain("<!--");
			expect(xml).toContain("<Value>test</Value>");
		});
	});

	describe("Integration with Other Features", () => {
		@XmlRoot({ name: "Product" })
		class Product {
			@XmlComment({ targetProperty: "name" })
			nameComment: string = "";

			@XmlElement({ name: "Name" })
			name: string = "";

			@XmlComment({ targetProperty: "price" })
			priceComment: string = "";

			@XmlElement({ name: "Price" })
			price: number = 0;
		}

		it("should work with different property types", () => {
			const product = new Product();
			product.nameComment = "Product name";
			product.name = "Widget";
			product.priceComment = "Price in USD";
			product.price = 99.99;

			const xml = serializer.toXml(product);

			expect(xml).toContain("<!--Product name-->");
			expect(xml).toContain("<Name>Widget</Name>");
			expect(xml).toContain("<!--Price in USD-->");
			expect(xml).toContain("<Price>99.99</Price>");

			const deserialized = serializer.fromXml(xml, Product);
			expect(deserialized.nameComment).toBe("Product name");
			expect(deserialized.name).toBe("Widget");
			expect(deserialized.priceComment).toBe("Price in USD");
			expect(deserialized.price).toBe(99.99);
		});
	});

	describe("Multi-line Comments", () => {
		@XmlRoot({ name: "Document" })
		class DocumentWithMultilineString {
			@XmlComment({ targetProperty: "content" })
			contentComment: string = "";

			@XmlElement({ name: "Content" })
			content: string = "";
		}

		@XmlRoot({ name: "Document" })
		class DocumentWithMultilineArray {
			@XmlComment({ targetProperty: "content" })
			contentComment: string[] = [];

			@XmlElement({ name: "Content" })
			content: string = "";
		}

		it("should handle multi-line comments with string type (serialization)", () => {
			const doc = new DocumentWithMultilineString();
			doc.contentComment = "Line 1\nLine 2\nLine 3";
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--Line 1\nLine 2\nLine 3-->");
			expect(xml).toContain("<Content>Test</Content>");
		});

		it("should handle multi-line comments with string type (deserialization)", () => {
			const xml = `
				<Document>
					<!--Line 1
Line 2
Line 3-->
					<Content>Test</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentWithMultilineString);

			expect(doc.contentComment).toBe("Line 1\nLine 2\nLine 3");
			expect(doc.content).toBe("Test");
		});

		it("should handle multi-line comments with string[] type (serialization)", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["Line 1", "Line 2", "Line 3"];
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--Line 1\nLine 2\nLine 3-->");
			expect(xml).toContain("<Content>Test</Content>");
		});

		it("should handle multi-line comments with string[] type (deserialization)", () => {
			const xml = `
				<Document>
					<!--Line 1
Line 2
Line 3-->
					<Content>Test</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(doc.contentComment).toEqual(["Line 1", "Line 2", "Line 3"]);
			expect(doc.content).toBe("Test");
		});

		it("should handle single-line comment with string[] type", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["Single line"];
			doc.content = "Test";

			const xml = serializer.toXml(doc);
			const deserialized = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(deserialized.contentComment).toEqual(["Single line"]);
		});

		it("should handle empty string[] comment", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = [];
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<!--");
			expect(xml).toContain("<Content>Test</Content>");
		});

		it("should handle round-trip with multi-line string", () => {
			const doc1 = new DocumentWithMultilineString();
			doc1.contentComment = "First line\nSecond line\nThird line";
			doc1.content = "Content";

			const xml = serializer.toXml(doc1);
			const doc2 = serializer.fromXml(xml, DocumentWithMultilineString);

			expect(doc2.contentComment).toBe("First line\nSecond line\nThird line");
			expect(doc2.content).toBe("Content");
		});

		it("should handle round-trip with multi-line array", () => {
			const doc1 = new DocumentWithMultilineArray();
			doc1.contentComment = ["First line", "Second line", "Third line"];
			doc1.content = "Content";

			const xml = serializer.toXml(doc1);
			const doc2 = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(doc2.contentComment).toEqual(["First line", "Second line", "Third line"]);
			expect(doc2.content).toBe("Content");
		});

		it("should handle comments with leading/trailing whitespace on lines", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["  Line with leading spaces", "Line with trailing spaces  ", "  Both  "];
			doc.content = "Test";

			const xml = serializer.toXml(doc);
			const deserialized = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(deserialized.contentComment).toEqual([
				"  Line with leading spaces",
				"Line with trailing spaces  ",
				"  Both  ",
			]);
		});

		it("should handle --> appearing in comment text (XML limitation)", () => {
			// Note: XML spec prohibits --> in comment content
			// The parser will terminate at the first --> it finds
			const xml = `
				<Document>
					<!--This comment has -->
					<Content>Test</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentWithMultilineString);

			// Comment ends at the first -->
			expect(doc.contentComment).toBe("This comment has ");
			expect(doc.content).toBe("Test");
		});

		it("should handle comment closing tag on separate line", () => {
			const xml = `
				<Document>
					<!--Line 1
Line 2
Line 3
-->

					<Content>Test</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(doc.contentComment).toEqual(["Line 1", "Line 2", "Line 3", ""]);
			expect(doc.content).toBe("Test");
		});

		it("should handle different line endings - CRLF (\\r\\n)", () => {
			const doc = new DocumentWithMultilineString();
			doc.contentComment = "Line 1\r\nLine 2\r\nLine 3";
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--Line 1\r\nLine 2\r\nLine 3-->");

			const deserialized = serializer.fromXml(xml, DocumentWithMultilineString);
			expect(deserialized.contentComment).toBe("Line 1\r\nLine 2\r\nLine 3");
		});

		it("should handle different line endings - LF (\\n) with string[]", () => {
			const xml = `
				<Document>
					<!--Line 1
Line 2
Line 3-->
					<Content>Test</Content>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(doc.contentComment).toEqual(["Line 1", "Line 2", "Line 3"]);
		});

		it("should handle different line endings - CRLF (\\r\\n) with string[]", () => {
			const xml = "<Document><!--Line 1\r\nLine 2\r\nLine 3--><Content>Test</Content></Document>";

			const doc = serializer.fromXml(xml, DocumentWithMultilineArray);

			// Should split by \n (which also handles \r\n)
			expect(doc.contentComment.length).toBeGreaterThan(1);
			expect(doc.contentComment[0]).toContain("Line 1");
		});

		it("should handle mixed line endings in string[]", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["Line 1\r", "Line 2", "Line 3"];
			doc.content = "Test";

			const xml = serializer.toXml(doc);
			const deserialized = serializer.fromXml(xml, DocumentWithMultilineArray);

			// After round-trip, should still have multiple lines
			expect(deserialized.contentComment.length).toBeGreaterThanOrEqual(3);
		});

		it("should handle empty lines in multi-line comments with string[]", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["Line 1", "", "Line 3"];
			doc.content = "Test";

			const xml = serializer.toXml(doc);
			const deserialized = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(deserialized.contentComment).toEqual(["Line 1", "", "Line 3"]);
		});

		it("should handle comments with only whitespace lines", () => {
			const doc = new DocumentWithMultilineArray();
			doc.contentComment = ["Line 1", "   ", "Line 3"];
			doc.content = "Test";

			const xml = serializer.toXml(doc);
			const deserialized = serializer.fromXml(xml, DocumentWithMultilineArray);

			expect(deserialized.contentComment).toEqual(["Line 1", "   ", "Line 3"]);
		});
	});
});
