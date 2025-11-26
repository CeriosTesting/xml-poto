import { XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("xml:space attribute", () => {
	describe("Class-level xml:space", () => {
		@XmlRoot({ name: "document", xmlSpace: "preserve" })
		class DocWithPreserve {
			@XmlElement()
			content: string = "  text with spaces  ";
		}

		@XmlRoot({ name: "document", xmlSpace: "default" })
		class DocWithDefault {
			@XmlElement()
			content: string = "text";
		}

		it("should add xml:space='preserve' attribute on root element", () => {
			const doc = new DocWithPreserve();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('xml:space="preserve"');
			expect(xml).toContain("<document");
		});

		it("should add xml:space='default' attribute on root element", () => {
			const doc = new DocWithDefault();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('xml:space="default"');
		});

		it("should place xml:space attribute on the correct element", () => {
			const doc = new DocWithPreserve();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			// xml:space should be on document element
			const docStartMatch = xml.match(/<document[^>]*>/);
			expect(docStartMatch).toBeTruthy();
			if (docStartMatch) {
				expect(docStartMatch[0]).toContain('xml:space="preserve"');
			}
		});
	});

	describe("Field-level xml:space", () => {
		@XmlRoot({ name: "document" })
		class DocWithFieldPreserve {
			@XmlElement({ xmlSpace: "preserve" })
			preserved: string = "  text  ";

			@XmlElement()
			normal: string = "text";
		}

		it("should add xml:space='preserve' on specific field element", () => {
			const doc = new DocWithFieldPreserve();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			// Find the preserved element
			const preservedMatch = xml.match(/<preserved[^>]*>/);
			expect(preservedMatch).toBeTruthy();
			if (preservedMatch) {
				expect(preservedMatch[0]).toContain('xml:space="preserve"');
			}

			// Normal element should not have xml:space
			const normalMatch = xml.match(/<normal[^>]*>/);
			expect(normalMatch).toBeTruthy();
			if (normalMatch) {
				expect(normalMatch[0]).not.toContain("xml:space");
			}
		});
	});

	describe("Nested elements with xml:space", () => {
		@XmlElement({ xmlSpace: "preserve" })
		class PreservedChild {
			@XmlElement()
			text: string = "  content  ";
		}

		@XmlRoot({ name: "parent" })
		class Parent {
			@XmlElement()
			child: PreservedChild = new PreservedChild();
		}

		it("should add xml:space on nested element", () => {
			const parent = new Parent();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(parent);

			// Child element should have xml:space (element name comes from property name 'child')
			const childMatch = xml.match(/<child[^>]*>/);
			expect(childMatch).toBeTruthy();
			if (childMatch) {
				expect(childMatch[0]).toContain('xml:space="preserve"');
			}
		});
	});

	describe("xml:space with other attributes", () => {
		@XmlRoot({ name: "element", xmlSpace: "preserve" })
		class ElementWithAttrs {
			@XmlElement()
			content: string = "text";
		}

		it("should combine xml:space with namespace declarations", () => {
			const element = new ElementWithAttrs();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(element);

			const elementMatch = xml.match(/<element[^>]*>/);
			expect(elementMatch).toBeTruthy();
			if (elementMatch) {
				expect(elementMatch[0]).toContain('xml:space="preserve"');
			}
		});
	});

	describe("No xml:space", () => {
		@XmlRoot({ name: "document" })
		class SimpleDoc {
			@XmlElement()
			content: string = "text";
		}

		it("should not add xml:space when not specified", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("xml:space");
		});
	});

	describe("Real-world use cases", () => {
		@XmlRoot({ name: "code", xmlSpace: "preserve" })
		class CodeBlock {
			@XmlElement()
			content: string = "    function test() {\n        return true;\n    }";
		}

		@XmlRoot({ name: "poem" })
		class Poem {
			@XmlElement({ xmlSpace: "preserve" })
			verse: string = "  Roses are red,\n  Violets are blue  ";

			@XmlElement()
			author: string = "Anonymous";
		}

		it("should preserve whitespace in code blocks", () => {
			const code = new CodeBlock();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(code);

			expect(xml).toContain('xml:space="preserve"');
			expect(xml).toContain("function test()");
		});

		it("should preserve whitespace in poetry verses", () => {
			const poem = new Poem();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(poem);

			// Verse should have xml:space
			const verseMatch = xml.match(/<verse[^>]*>/);
			expect(verseMatch).toBeTruthy();
			if (verseMatch) {
				expect(verseMatch[0]).toContain('xml:space="preserve"');
			}

			// Author should not have xml:space
			const authorMatch = xml.match(/<author[^>]*>/);
			expect(authorMatch).toBeTruthy();
			if (authorMatch) {
				expect(authorMatch[0]).not.toContain("xml:space");
			}
		});
	});

	describe("XML specification compliance", () => {
		it("should only allow 'preserve' or 'default' values", () => {
			// TypeScript should enforce this at compile time
			// Runtime behavior: only these two values are valid per XML spec

			@XmlRoot({ name: "doc", xmlSpace: "preserve" })
			class ValidPreserve {
				@XmlElement()
				content: string = "text";
			}

			@XmlRoot({ name: "doc", xmlSpace: "default" })
			class ValidDefault {
				@XmlElement()
				content: string = "text";
			}

			const preserve = new ValidPreserve();
			const def = new ValidDefault();
			const serializer = new XmlDecoratorSerializer({});

			const xml1 = serializer.toXml(preserve);
			const xml2 = serializer.toXml(def);

			expect(xml1).toContain('xml:space="preserve"');
			expect(xml2).toContain('xml:space="default"');
		});

		it("should use proper XML namespace prefix", () => {
			@XmlRoot({ name: "doc", xmlSpace: "preserve" })
			class Doc {
				@XmlElement()
				content: string = "text";
			}

			const doc = new Doc();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			// Should use "xml:" prefix per XML specification
			expect(xml).toContain('xml:space="preserve"');
			// Verify it's not using space= without the xml: prefix (check with leading space)
			expect(xml).not.toMatch(/\sspace="preserve"/);
		});
	});
});
