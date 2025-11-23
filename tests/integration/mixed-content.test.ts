import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Mixed Content Support", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("Basic Mixed Content", () => {
		it("should serialize simple mixed content (text and elements)", () => {
			@XmlRoot({ elementName: "Paragraph" })
			class Paragraph {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [{ text: "This is " }, { element: "strong", content: "bold" }, { text: " text." }];
			}

			const para = new Paragraph();
			const xml = serializer.toXml(para);

			expect(xml).toContain("<Paragraph>");
			expect(xml).toContain("<content>");
			expect(xml).toContain("This is ");
			expect(xml).toContain("<strong>bold</strong>");
			expect(xml).toContain(" text.");
		});

		// Note: Deserialization has limitations due to XML parser constraints
		it("should deserialize simple mixed content", () => {
			@XmlRoot({ elementName: "Paragraph" })
			class Paragraph {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [];
			}

			const xml = `<?xml version="1.0"?>
<Paragraph>
	<content>This is <strong>bold</strong> text.</content>
</Paragraph>`;

			const para = serializer.fromXml(xml, Paragraph);

			expect(Array.isArray(para.content)).toBe(true);
			expect(para.content.some((n: any) => n.text === "This is ")).toBe(true);
			expect(para.content.some((n: any) => n.element === "strong" && n.content === "bold")).toBe(true);
			expect(para.content.some((n: any) => n.text?.includes("text."))).toBe(true);
		});

		it("should handle mixed content with multiple elements", () => {
			@XmlRoot({ elementName: "Article" })
			class Article {
				@XmlElement({ name: "body", mixedContent: true })
				body: any[] = [
					{ text: "Text with " },
					{ element: "em", content: "emphasis" },
					{ text: " and " },
					{ element: "strong", content: "bold" },
					{ text: " words." },
				];
			}

			const article = new Article();
			const xml = serializer.toXml(article);

			expect(xml).toContain("<em>emphasis</em>");
			expect(xml).toContain("<strong>bold</strong>");
			expect(xml).toContain("Text with ");
			expect(xml).toContain(" and ");
			expect(xml).toContain(" words.");
		});
	});

	describe("Mixed Content with Attributes", () => {
		it("should serialize elements with attributes in mixed content", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ text: "Click " },
					{
						element: "a",
						content: "here",
						attributes: { href: "https://example.com", target: "_blank" },
					},
					{ text: " for more." },
				];
			}

			const doc = new Document();
			const xml = serializer.toXml(doc);

			expect(xml).toContain("Click ");
			expect(xml).toContain('href="https://example.com"');
			expect(xml).toContain('target="_blank"');
			expect(xml).toContain(">here</");
			expect(xml).toContain(" for more.");
		});

		// Note: Deserialization has limitations due to XML parser constraints
		it("should deserialize elements with attributes in mixed content", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [];
			}

			const xml = `<?xml version="1.0"?>
<Document>
	<content>Click <a href="https://example.com" target="_blank">here</a> for more.</content>
</Document>`;

			const doc = serializer.fromXml(xml, Document);

			expect(Array.isArray(doc.content)).toBe(true);
			const linkNode = doc.content.find((n: any) => n.element === "a");
			expect(linkNode).toBeDefined();
			expect(linkNode.content).toBe("here");
			expect(linkNode.attributes?.href).toBe("https://example.com");
			expect(linkNode.attributes?.target).toBe("_blank");
		});

		it("should handle multiple attributes on mixed content elements", () => {
			@XmlRoot({ elementName: "HTML" })
			class HtmlContent {
				@XmlElement({ name: "div", mixedContent: true })
				div: any[] = [
					{ text: "Styled " },
					{
						element: "span",
						content: "text",
						attributes: { class: "highlight", id: "main", style: "color: red;" },
					},
				];
			}

			const html = new HtmlContent();
			const xml = serializer.toXml(html);

			expect(xml).toContain('class="highlight"');
			expect(xml).toContain('id="main"');
			expect(xml).toContain('style="color: red;"');
			expect(xml).toContain(">text</");
		});
	});

	describe("Nested Mixed Content", () => {
		it("should handle nested elements in mixed content", () => {
			@XmlRoot({ elementName: "Section" })
			class Section {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ text: "Text with " },
					{
						element: "div",
						content: [{ text: "nested " }, { element: "em", content: "emphasis" }],
					},
					{ text: " structure." },
				];
			}

			const section = new Section();
			const xml = serializer.toXml(section);

			expect(xml).toContain("Text with ");
			expect(xml).toContain("<div>");
			expect(xml).toContain("nested ");
			expect(xml).toContain("<em>emphasis</em>");
			expect(xml).toContain("</div>");
			expect(xml).toContain(" structure.");
		});

		it("should handle deeply nested mixed content", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "body", mixedContent: true })
				body: any[] = [
					{ text: "Level 1 " },
					{
						element: "div",
						content: [
							{ text: "Level 2 " },
							{
								element: "span",
								content: [{ text: "Level 3 " }, { element: "strong", content: "deep" }],
							},
						],
					},
				];
			}

			const doc = new Document();
			const xml = serializer.toXml(doc);

			expect(xml).toContain("Level 1 ");
			expect(xml).toContain("Level 2 ");
			expect(xml).toContain("Level 3 ");
			expect(xml).toContain("<strong>deep</strong>");
		});
	});

	describe("Mixed Content Edge Cases", () => {
		it("should handle empty text nodes", () => {
			@XmlRoot({ elementName: "Test" })
			class Test {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [{ text: "" }, { element: "span", content: "text" }, { text: "" }];
			}

			const test = new Test();
			const xml = serializer.toXml(test);

			expect(xml).toContain("<span>text</span>");
		});

		it("should handle only text nodes (no elements)", () => {
			@XmlRoot({ elementName: "Plain" })
			class Plain {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [{ text: "Just plain text" }];
			}

			const plain = new Plain();
			const xml = serializer.toXml(plain);

			expect(xml).toContain("Just plain text");
		});

		it("should handle only element nodes (no text)", () => {
			@XmlRoot({ elementName: "Elements" })
			class Elements {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ element: "span", content: "one" },
					{ element: "span", content: "two" },
				];
			}

			const elements = new Elements();
			const xml = serializer.toXml(elements);

			expect(xml).toContain("<span>one</span>");
			expect(xml).toContain("<span>two</span>");
		});

		it("should handle empty mixed content array", () => {
			@XmlRoot({ elementName: "Empty" })
			class Empty {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [];
			}

			const empty = new Empty();
			const xml = serializer.toXml(empty);

			expect(xml).toContain("<Empty>");
			expect(xml).toContain("<content");
		});

		it("should handle special XML characters in text nodes", () => {
			@XmlRoot({ elementName: "Special" })
			class Special {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ text: "Text with <, >, &, \"quotes\" and 'apostrophes'" },
					{ element: "span", content: "element" },
				];
			}

			const special = new Special();
			const xml = serializer.toXml(special);

			// XML should escape special characters
			expect(xml).toBeDefined();
			expect(xml).toContain("<span>element</span>");
		});

		it("should handle whitespace preservation", () => {
			@XmlRoot({ elementName: "Whitespace" })
			class Whitespace {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ text: "  Leading spaces" },
					{ element: "span", content: "element" },
					{ text: "Trailing spaces  " },
				];
			}

			const ws = new Whitespace();
			const xml = serializer.toXml(ws);

			expect(xml).toBeDefined();
			expect(xml).toContain("<span>element</span>");
		});
	});

	describe("Real-World HTML-like Scenarios", () => {
		it("should handle paragraph with emphasis and links", () => {
			@XmlRoot({ elementName: "Article" })
			class Article {
				@XmlAttribute({ name: "id" })
				id: string = "article-1";

				@XmlElement({ name: "paragraph", mixedContent: true })
				paragraph: any[] = [
					{ text: "This is an " },
					{ element: "em", content: "important" },
					{ text: " message. Visit " },
					{
						element: "a",
						content: "our website",
						attributes: { href: "https://example.com" },
					},
					{ text: " for more details." },
				];
			}

			const article = new Article();
			const xml = serializer.toXml(article);

			expect(xml).toContain('id="article-1"');
			expect(xml).toContain("This is an ");
			expect(xml).toContain("<em>important</em>");
			expect(xml).toContain(" message. Visit ");
			expect(xml).toContain('<a href="https://example.com">our website</a>');
			expect(xml).toContain(" for more details.");
		});

		it("should handle formatted text with multiple styles", () => {
			@XmlRoot({ elementName: "Content" })
			class Content {
				@XmlElement({ name: "text", mixedContent: true })
				text: any[] = [
					{ text: "Text can be " },
					{ element: "strong", content: "bold" },
					{ text: ", " },
					{ element: "em", content: "italic" },
					{ text: ", or " },
					{ element: "u", content: "underlined" },
					{ text: "." },
				];
			}

			const content = new Content();
			const xml = serializer.toXml(content);

			expect(xml).toContain("<strong>bold</strong>");
			expect(xml).toContain("<em>italic</em>");
			expect(xml).toContain("<u>underlined</u>");
		});

		it("should handle code snippets with inline code", () => {
			@XmlRoot({ elementName: "Documentation" })
			class Documentation {
				@XmlElement({ name: "description", mixedContent: true })
				description: any[] = [
					{ text: "Use the " },
					{ element: "code", content: "serialize()" },
					{ text: " method to convert objects to XML." },
				];
			}

			const doc = new Documentation();
			const xml = serializer.toXml(doc);

			expect(xml).toContain("Use the ");
			expect(xml).toContain("<code>serialize()</code>");
			expect(xml).toContain(" method to convert objects to XML.");
		});

		it("should handle list items with formatted text", () => {
			@XmlRoot({ elementName: "ListItem" })
			class ListItem {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{ text: "Item with " },
					{ element: "strong", content: "bold" },
					{ text: " and " },
					{
						element: "a",
						content: "link",
						attributes: { href: "#section" },
					},
				];
			}

			const item = new ListItem();
			const xml = serializer.toXml(item);

			expect(xml).toContain("Item with ");
			expect(xml).toContain("<strong>bold</strong>");
			expect(xml).toContain(" and ");
			expect(xml).toContain('<a href="#section">link</a>');
		});
	});

	describe("Mixed Content Round-Trip", () => {
		it("should preserve mixed content through serialization and deserialization", () => {
			@XmlRoot({ elementName: "Message" })
			class Message {
				@XmlElement({ name: "body", mixedContent: true })
				body: any[] = [{ text: "Hello " }, { element: "strong", content: "World" }, { text: "!" }];
			}

			const original = new Message();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Message);

			expect(Array.isArray(deserialized.body)).toBe(true);
			expect(deserialized.body.length).toBeGreaterThan(0);

			// Check for text nodes
			const textNodes = deserialized.body.filter((n: any) => n.text !== undefined);
			expect(textNodes.length).toBeGreaterThan(0);

			// Check for element nodes
			const elementNodes = deserialized.body.filter((n: any) => n.element !== undefined);
			expect(elementNodes.length).toBeGreaterThan(0);
			expect(elementNodes.some((n: any) => n.element === "strong")).toBe(true);
		});

		// Note: Round-trip deserialization has limitations
		it("should preserve attributes through round-trip", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement({ name: "content", mixedContent: true })
				content: any[] = [
					{
						element: "a",
						content: "link",
						attributes: { href: "https://test.com", class: "external" },
					},
				];
			}

			const original = new Document();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Document);

			// Check what we got
			expect(Array.isArray(deserialized.content)).toBe(true);
			expect(deserialized.content.length).toBeGreaterThan(0);

			const linkNode = deserialized.content.find((n: any) => n.element === "a");
			expect(linkNode).toBeDefined();
			expect(linkNode.attributes?.href).toBe("https://test.com");
			expect(linkNode.attributes?.class).toBe("external");
		});
	});
});
