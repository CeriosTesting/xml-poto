import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("Empty Element Syntax Control", () => {
	@XmlRoot({ elementName: "document" })
	class DocWithEmptyElements {
		@XmlElement()
		emptyString: string = "";

		@XmlElement()
		nullValue: string | null = null;

		@XmlElement()
		undefinedValue: string | undefined = undefined;

		@XmlElement()
		normalValue: string = "content";
	}

	@XmlRoot({ elementName: "container" })
	class Container {
		@XmlAttribute()
		id: string = "1";

		@XmlElement()
		empty: string = "";
	}

	describe("Self-closing style (default)", () => {
		it("should use self-closing tags for empty elements by default", () => {
			const doc = new DocWithEmptyElements();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<emptyString/>");
			expect(xml).toContain("<nullValue/>");
			expect(xml).toContain("<undefinedValue/>");
			expect(xml).toContain("<normalValue>content</normalValue>");
		});

		it("should use self-closing tags when explicitly specified", () => {
			const doc = new DocWithEmptyElements();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<emptyString/>");
			expect(xml).toContain("<nullValue/>");
			expect(xml).not.toContain("<emptyString></emptyString>");
		});

		it("should preserve self-closing for elements with attributes only", () => {
			const container = new Container();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(container);

			expect(xml).toContain("<empty/>");
		});
	});

	describe("Explicit close style", () => {
		it("should use explicit closing tags when specified", () => {
			const doc = new DocWithEmptyElements();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<emptyString></emptyString>");
			expect(xml).toContain("<nullValue></nullValue>");
			expect(xml).toContain("<undefinedValue></undefinedValue>");
			expect(xml).toContain("<normalValue>content</normalValue>");
		});

		it("should use explicit closing tags for elements with attributes", () => {
			const container = new Container();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(container);

			expect(xml).toContain("<empty></empty>");
			expect(xml).not.toContain("<empty/>");
		});

		it("should not affect non-empty elements", () => {
			const doc = new DocWithEmptyElements();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(doc);

			// Non-empty elements should work the same
			expect(xml).toContain("<normalValue>content</normalValue>");
			expect(xml).not.toContain("<normalValue/>");
		});
	});

	describe("Nested structures", () => {
		@XmlElement()
		class Child {
			@XmlElement()
			empty: string = "";

			@XmlElement()
			value: string = "text";
		}

		@XmlRoot({ elementName: "parent" })
		class Parent {
			@XmlElement()
			child: Child = new Child();
		}

		it("should apply self-closing style to nested empty elements", () => {
			const parent = new Parent();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(parent);

			expect(xml).toContain("<empty/>");
			expect(xml).toContain("<value>text</value>");
		});

		it("should apply explicit style to nested empty elements", () => {
			const parent = new Parent();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(parent);

			expect(xml).toContain("<empty></empty>");
			expect(xml).toContain("<value>text</value>");
		});
	});

	describe("HTML/XHTML compatibility", () => {
		@XmlRoot({ elementName: "html" })
		class HtmlDoc {
			@XmlElement()
			br: string = "";

			@XmlElement()
			img: string = "";

			@XmlElement()
			p: string = "Content";
		}

		it("should use explicit closing tags for HTML compatibility", () => {
			const html = new HtmlDoc();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(html);

			// HTML parsers often expect explicit closing tags
			expect(xml).toContain("<br></br>");
			expect(xml).toContain("<img></img>");
		});

		it("should use self-closing tags for XHTML", () => {
			const html = new HtmlDoc();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(html);

			// XHTML allows self-closing tags
			expect(xml).toContain("<br/>");
			expect(xml).toContain("<img/>");
		});
	});

	describe("Arrays with empty elements", () => {
		@XmlRoot({ elementName: "list" })
		class ItemList {
			@XmlElement()
			items: string[] = ["", "value", ""];
		}

		it("should apply self-closing style to empty array items", () => {
			const list = new ItemList();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(list);

			// Count self-closing tags
			const selfClosing = (xml.match(/<items\/>/g) || []).length;
			expect(selfClosing).toBeGreaterThanOrEqual(2); // At least 2 empty items
		});

		it("should apply explicit style to empty array items", () => {
			const list = new ItemList();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "explicit",
			});

			const xml = serializer.toXml(list);

			// Count explicit closing tags
			const explicit = (xml.match(/<items><\/items>/g) || []).length;
			expect(explicit).toBeGreaterThanOrEqual(2); // At least 2 empty items
		});
	});

	describe("Edge cases", () => {
		it("should handle whitespace-only content as non-empty", () => {
			@XmlRoot({ elementName: "doc" })
			class Doc {
				@XmlElement()
				whitespace: string = "   ";
			}

			const doc = new Doc();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(doc);

			// Whitespace-only should not be treated as empty
			expect(xml).toContain("<whitespace>   </whitespace>");
		});

		it("should handle zero as non-empty", () => {
			@XmlRoot({ elementName: "doc" })
			class Doc {
				@XmlElement()
				zero: number = 0;
			}

			const doc = new Doc();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(doc);

			// Zero should not be treated as empty
			expect(xml).toContain("<zero>0</zero>");
		});

		it("should handle false as non-empty", () => {
			@XmlRoot({ elementName: "doc" })
			class Doc {
				@XmlElement()
				flag: boolean = false;
			}

			const doc = new Doc();
			const serializer = new XmlDecoratorSerializer({
				emptyElementStyle: "self-closing",
			});

			const xml = serializer.toXml(doc);

			// False should not be treated as empty
			expect(xml).toContain("<flag>false</flag>");
		});
	});
});
