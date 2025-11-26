import { XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";

describe("CDATA Support", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("@XmlText with CDATA", () => {
		it("should wrap text content in CDATA section", () => {
			@XmlRoot({ name: "Script" })
			class ScriptTag {
				@XmlText({ useCDATA: true })
				content: string = '<script>alert("XSS")</script>';
			}

			const script = new ScriptTag();
			const xml = serializer.toXml(script);

			expect(xml).toContain("<![CDATA[");
			expect(xml).toContain("]]>");
			expect(xml).toContain('<script>alert("XSS")</script>');
		});

		it("should deserialize CDATA content correctly", () => {
			@XmlRoot({ name: "Script" })
			class ScriptTag {
				@XmlText({ useCDATA: true })
				content: string = "";
			}

			const xml = `<?xml version="1.0"?>
<Script><![CDATA[<script>alert("XSS")</script>]]></Script>`;

			const result = serializer.fromXml(xml, ScriptTag);

			expect(result.content).toBe('<script>alert("XSS")</script>');
		});

		it("should handle CDATA with special XML characters", () => {
			@XmlRoot({ name: "Content" })
			class Content {
				@XmlText({ useCDATA: true })
				text: string = "<tag>value & \"quotes\" & 'apostrophes'</tag>";
			}

			const content = new Content();
			const xml = serializer.toXml(content);
			const result = serializer.fromXml(xml, Content);

			expect(result.text).toBe("<tag>value & \"quotes\" & 'apostrophes'</tag>");
		});

		it("should handle CDATA with newlines and whitespace", () => {
			@XmlRoot({ name: "Code" })
			class CodeBlock {
				@XmlText({ useCDATA: true })
				code: string = `function test() {
    return "Hello World";
}`;
			}

			const block = new CodeBlock();
			const xml = serializer.toXml(block);
			const result = serializer.fromXml(xml, CodeBlock);

			expect(result.code).toBe(`function test() {
    return "Hello World";
}`);
		});

		it("should not use CDATA when useCDATA is false", () => {
			@XmlRoot({ name: "Text" })
			class TextContent {
				@XmlText({ useCDATA: false })
				content: string = "Simple text";
			}

			const text = new TextContent();
			const xml = serializer.toXml(text);

			expect(xml).not.toContain("<![CDATA[");
			expect(xml).toContain("Simple text");
		});

		it("should use CDATA with custom converter", () => {
			@XmlRoot({ name: "Data" })
			class DataContainer {
				@XmlText({
					useCDATA: true,
					converter: {
						serialize: val => JSON.stringify(val),
						deserialize: val => JSON.parse(val),
					},
				})
				data: any = { key: "value", nested: { x: 1 } };
			}

			const container = new DataContainer();
			const xml = serializer.toXml(container);
			const result = serializer.fromXml(xml, DataContainer);

			expect(result.data).toEqual({ key: "value", nested: { x: 1 } });
		});
	});

	describe("@XmlElement field with CDATA", () => {
		it("should wrap field element content in CDATA", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement({ name: "HtmlContent", useCDATA: true })
				html: string = "<div>Hello <strong>World</strong></div>";

				@XmlElement({ name: "Title" })
				title: string = "Document Title";
			}

			const doc = new Document();
			const xml = serializer.toXml(doc);

			expect(xml).toContain("<![CDATA[");
			expect(xml).toContain("<div>Hello <strong>World</strong></div>");
			expect(xml).toContain("<Title>Document Title</Title>");
		});

		it("should deserialize field element with CDATA", () => {
			@XmlRoot({ name: "Page" })
			class Page {
				@XmlElement({ name: "Body", useCDATA: true })
				body: string = "";

				@XmlElement({ name: "Title" })
				title: string = "";
			}

			const xml = `<?xml version="1.0"?>
<Page>
	<Title>My Page</Title>
	<Body><![CDATA[<html><body>Content with <tags></body></html>]]></Body>
</Page>`;

			const result = serializer.fromXml(xml, Page);

			expect(result.title).toBe("My Page");
			expect(result.body).toBe("<html><body>Content with <tags></body></html>");
		});

		it("should handle multiple CDATA fields", () => {
			@XmlRoot({ name: "Article" })
			class Article {
				@XmlElement({ name: "Title" })
				title: string = "Article Title";

				@XmlElement({ name: "Content", useCDATA: true })
				content: string = "<p>Main content with <em>emphasis</em></p>";

				@XmlElement({ name: "Footer", useCDATA: true })
				footer: string = "<p>Copyright © 2024</p>";
			}

			const article = new Article();
			const xml = serializer.toXml(article);
			const result = serializer.fromXml(xml, Article);

			expect(result.title).toBe("Article Title");
			expect(result.content).toBe("<p>Main content with <em>emphasis</em></p>");
			expect(result.footer).toBe("<p>Copyright © 2024</p>");
		});

		it("should handle CDATA with number types", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement({ name: "Code", useCDATA: true })
				code: number = 12345;
			}

			const data = new Data();
			const xml = serializer.toXml(data);
			const result = serializer.fromXml(xml, Data);

			expect(result.code).toBe(12345);
		});
	});

	describe("CDATA with attributes", () => {
		it("should handle CDATA text content with attributes", () => {
			@XmlRoot({ name: "StyledContent" })
			class StyledContent {
				@XmlAttribute({ name: "class" })
				className: string = "code-block";

				@XmlAttribute({ name: "language" })
				language: string = "javascript";

				@XmlText({ useCDATA: true })
				code: string = 'function test() { return "<html>"; }';
			}

			const content = new StyledContent();
			const xml = serializer.toXml(content);
			const result = serializer.fromXml(xml, StyledContent);

			expect(result.className).toBe("code-block");
			expect(result.language).toBe("javascript");
			expect(result.code).toBe('function test() { return "<html>"; }');
		});

		it("should handle CDATA field element with attributes", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlAttribute({ name: "version" })
				version: string = "1.0";

				@XmlElement({ name: "Content", useCDATA: true })
				content: string = "<div>HTML content</div>";
			}

			const doc = new Document();
			const xml = serializer.toXml(doc);
			const result = serializer.fromXml(xml, Document);

			expect(result.version).toBe("1.0");
			expect(result.content).toBe("<div>HTML content</div>");
		});
	});

	describe("CDATA edge cases", () => {
		it("should handle empty CDATA content", () => {
			@XmlRoot({ name: "Empty" })
			class EmptyContent {
				@XmlText({ useCDATA: true })
				content: string = "";
			}

			const empty = new EmptyContent();
			const xml = serializer.toXml(empty);
			const result = serializer.fromXml(xml, EmptyContent);

			expect(result.content).toBe("");
		});

		it("should handle CDATA with only whitespace", () => {
			@XmlRoot({ name: "Whitespace" })
			class WhitespaceContent {
				@XmlText({ useCDATA: true })
				content: string = "   \n\t  ";
			}

			const ws = new WhitespaceContent();
			const xml = serializer.toXml(ws);
			const result = serializer.fromXml(xml, WhitespaceContent);

			expect(result.content).toBe("   \n\t  ");
		});

		it("should handle CDATA containing ]]> sequence", () => {
			@XmlRoot({ name: "Complex" })
			class ComplexContent {
				@XmlText({ useCDATA: true })
				content: string = "Text with ]]> sequence inside";
			}

			const complex = new ComplexContent();
			const xml = serializer.toXml(complex);

			expect(xml).toBeDefined();
		});

		it("should handle null values with CDATA flag", () => {
			@XmlRoot({ name: "Nullable" })
			class NullableContent {
				@XmlText({ useCDATA: true })
				content: string | null = null;
			}

			const nullable = new NullableContent();
			nullable.content = null;
			const xml = serializer.toXml(nullable);

			expect(xml).toContain("<Nullable");
		});

		it("should handle CDATA with nested objects and multiple fields", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement({ name: "Title" })
				title: string = "Test Title";

				@XmlElement({ name: "HtmlContent", useCDATA: true })
				htmlContent: string = "<div>Content with <strong>HTML</strong></div>";

				@XmlElement({ name: "ScriptCode", useCDATA: true })
				scriptCode: string = 'if (x < 10 && y > 5) { alert("test"); }';
			}

			const container = new Container();
			const xml = serializer.toXml(container);
			const result = serializer.fromXml(xml, Container);

			expect(result.title).toBe("Test Title");
			expect(result.htmlContent).toBe("<div>Content with <strong>HTML</strong></div>");
			expect(result.scriptCode).toBe('if (x < 10 && y > 5) { alert("test"); }');
		});
	});

	describe("Real-world CDATA scenarios", () => {
		it("should handle HTML content in XML", () => {
			@XmlRoot({ name: "BlogPost" })
			class BlogPost {
				@XmlElement({ name: "Title" })
				title: string = "Using XML in Web Development";

				@XmlElement({ name: "Author" })
				author: string = "John Doe";

				@XmlElement({ name: "Content", useCDATA: true })
				content: string = `
<article>
	<h1>Introduction</h1>
	<p>This is <strong>important</strong> content.</p>
	<code>const x = "<tag>";</code>
</article>
				`.trim();
			}

			const post = new BlogPost();
			const xml = serializer.toXml(post);
			const result = serializer.fromXml(xml, BlogPost);

			expect(result.title).toBe("Using XML in Web Development");
			expect(result.author).toBe("John Doe");
			expect(result.content).toContain("<article>");
			expect(result.content).toContain("<strong>important</strong>");
		});

		it("should handle SQL queries with special characters", () => {
			@XmlRoot({ name: "Query" })
			class SqlQuery {
				@XmlAttribute({ name: "database" })
				database: string = "products";

				@XmlElement({ name: "SQL", useCDATA: true })
				sql: string = "SELECT * FROM users WHERE name LIKE '%test%' AND age > 18";
			}

			const query = new SqlQuery();
			const xml = serializer.toXml(query);
			const result = serializer.fromXml(xml, SqlQuery);

			expect(result.database).toBe("products");
			expect(result.sql).toBe("SELECT * FROM users WHERE name LIKE '%test%' AND age > 18");
		});

		it("should handle JavaScript code snippets", () => {
			@XmlRoot({ name: "CodeSnippet" })
			class CodeSnippet {
				@XmlAttribute({ name: "language" })
				language: string = "javascript";

				@XmlText({ useCDATA: true })
				code: string = `
if (x > 0 && y < 100) {
	console.log("Valid range");
	return true;
}
				`.trim();
			}

			const snippet = new CodeSnippet();
			const xml = serializer.toXml(snippet);
			const result = serializer.fromXml(xml, CodeSnippet);

			expect(result.language).toBe("javascript");
			expect(result.code).toContain("&&");
			expect(result.code).toContain("<");
			expect(result.code).toContain(">");
		});

		it("should handle XML content within CDATA", () => {
			@XmlRoot({ name: "XmlExample" })
			class XmlExample {
				@XmlElement({ name: "Description" })
				description: string = "Example XML structure";

				@XmlElement({ name: "Sample", useCDATA: true })
				sampleXml: string = `<?xml version="1.0"?>
<root>
	<element attr="value">Content</element>
</root>`;
			}

			const example = new XmlExample();
			const xml = serializer.toXml(example);
			const result = serializer.fromXml(xml, XmlExample);

			expect(result.description).toBe("Example XML structure");
			expect(result.sampleXml).toContain('<?xml version="1.0"?>');
			expect(result.sampleXml).toContain("<root>");
			expect(result.sampleXml).toContain('attr="value"');
		});
	});
});
