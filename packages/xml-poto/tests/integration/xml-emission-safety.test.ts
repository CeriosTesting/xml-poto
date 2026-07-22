/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlAttribute, XmlComment, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";
import { XmlDecoratorParser } from "../../src/xml-decorator-parser";

describe("XML emission safety and prolog round-trips", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("attribute values", () => {
		it("escapes line breaks so a multi-line attribute survives the round-trip", () => {
			@XmlRoot({ name: "Note" })
			class Note {
				@XmlAttribute({ name: "text" })
				text: string = "first\nsecond";
			}

			const xml = serializer.toXml(new Note());

			// A literal newline here would be normalized to a space by any conforming reader.
			expect(xml).toContain('text="first&#10;second"');
			expect(serializer.fromXml(xml, Note).text).toBe("first\nsecond");
		});

		it("escapes tabs and carriage returns in attribute values", () => {
			@XmlRoot({ name: "Note" })
			class Note {
				@XmlAttribute({ name: "text" })
				text: string = "a\tb\rc";
			}

			const xml = serializer.toXml(new Note());

			expect(xml).toContain('text="a&#9;b&#13;c"');
			expect(serializer.fromXml(xml, Note).text).toBe("a\tb\rc");
		});

		it("leaves line breaks literal in text content", () => {
			@XmlRoot({ name: "Note" })
			class Note {
				@XmlText()
				body: string = "first\nsecond";
			}

			const xml = serializer.toXml(new Note());

			expect(xml).toContain("first\nsecond");
			expect(xml).not.toContain("&#10;");
		});
	});

	describe("CDATA sections", () => {
		it("splits a value containing ]]> across two sections", () => {
			@XmlRoot({ name: "Script" })
			class Script {
				@XmlText({ useCDATA: true })
				content: string = "a]]>b";
			}

			const xml = serializer.toXml(new Script());

			expect(xml).toContain("<![CDATA[a]]]]><![CDATA[>b]]>");
			// The document must still parse, and the value must come back intact.
			expect(serializer.fromXml(xml, Script).content).toBe("a]]>b");
		});
	});

	describe("comments", () => {
		it("pads a double hyphen so the comment stays legal XML", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ name: "host" })
				host: string = "localhost";

				@XmlComment({ targetProperty: "host" })
				hostComment: string = "see RFC -- section 2";
			}

			const xml = serializer.toXml(new Config());

			expect(xml).toContain("<!--see RFC - - section 2-->");
			expect(xml).not.toContain("-- section");
		});

		it("pads a trailing hyphen so it cannot merge with the delimiter", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ name: "host" })
				host: string = "localhost";

				@XmlComment({ targetProperty: "host" })
				hostComment: string = "todo-";
			}

			expect(serializer.toXml(new Config())).toContain("<!--todo- -->");
		});
	});

	describe("entity decoding", () => {
		const parser = new XmlDecoratorParser();

		it("does not decode its own output: &amp;#65; stays the literal text &#65;", () => {
			expect(parser.parse("<v>&amp;#65;</v>").v).toBe("&#65;");
		});

		it("decodes astral character references without truncating them", () => {
			expect(parser.parse("<v>&#128512;</v>").v).toBe("\u{1F600}");
			expect(parser.parse("<v>&#x1F600;</v>").v).toBe("\u{1F600}");
		});

		it("decodes the five predefined entities", () => {
			expect(parser.parse("<v>&lt;&gt;&amp;&quot;&apos;</v>").v).toBe("<>&\"'");
		});

		it("leaves an entity it cannot resolve verbatim rather than guessing", () => {
			expect(parser.parse("<v>a&nbsp;b</v>").v).toBe("a&nbsp;b");
		});
	});

	describe("prolog", () => {
		it("reads back a document carrying processing instructions and a DOCTYPE", () => {
			@XmlRoot({ name: "doc" })
			class Doc {
				@XmlElement({ name: "title" })
				title: string = "Hello";
			}

			const withProlog = new XmlSerializer({
				processingInstructions: [
					{ target: "xml-stylesheet", data: 'type="text/xsl" href="style.xsl"' },
					{ target: "target-two", data: "value" },
				],
				docType: {
					rootElement: "doc",
					internalSubset: '<!ENTITY company "Cerios"> <!ELEMENT title (#PCDATA)>',
				},
			});

			const xml = withProlog.toXml(new Doc());

			expect(xml).toContain("<?xml-stylesheet");
			expect(xml).toContain("<!DOCTYPE doc [");
			// The internal subset contains '>' characters; a naive strip would leave
			// its tail behind to be read as an element name.
			expect(withProlog.fromXml(xml, Doc).title).toBe("Hello");
		});

		it("skips comments that precede the root element", () => {
			const parsed = new XmlDecoratorParser().parse("<!-- a note --><?pi data?>\n<root><v>1</v></root>");

			expect(parsed.root).toEqual({ v: 1 });
		});
	});

	describe("compact output", () => {
		@XmlRoot({ name: "Person" })
		class Person {
			@XmlAttribute({ name: "id" })
			id: string = "1";

			@XmlElement({ name: "name" })
			name: string = "John";
		}

		it("emits a single-line document when format is false", () => {
			const compact = new XmlSerializer({ format: false });
			const xml = compact.toXml(new Person());

			expect(xml).toBe('<?xml version="1.0" encoding="UTF-8"?><Person id="1"><name>John</name></Person>');
			expect(compact.fromXml(xml, Person).name).toBe("John");
		});

		it("honours a custom indent string", () => {
			const xml = new XmlSerializer({ indent: "\t" }).toXml(new Person());

			expect(xml).toContain("\t<name>John</name>");
		});

		it("formats by default", () => {
			expect(serializer.toXml(new Person())).toContain("  <name>John</name>");
		});
	});
});

describe("malformed input is rejected rather than half-read", () => {
	const parser = new XmlDecoratorParser();

	// A truncated transfer used to parse as a valid-but-empty object, so a response
	// cut off mid-stream looked like a success with missing data.
	it("rejects a document that ends before its elements close", () => {
		expect(() => parser.parse("<a><b>")).toThrow(/element <b> is never closed/);
		expect(() => parser.parse("<a><b><c>x")).toThrow(/element <c> is never closed/);
	});

	it("names the innermost unclosed element", () => {
		expect(() => parser.parse("<outer><inner>text")).toThrow(/<inner>/);
	});

	// An HTML or JSON error page from a gateway lands here routinely; it used to
	// parse to {} and then fail with "Root element X not found", blaming the schema.
	it("rejects input that is not XML at all, saying so", () => {
		expect(() => parser.parse("not xml at all")).toThrow(/Input is not XML/);
		expect(() => parser.parse('{"error":"bad gateway"}')).toThrow(/Input is not XML/);
	});

	it("still treats empty and whitespace-only input as an empty document", () => {
		expect(parser.parse("")).toEqual({});
		expect(parser.parse("   \n  ")).toEqual({});
	});

	it("leaves well-formed documents alone", () => {
		expect(parser.parse("<a><b>x</b></a>")).toEqual({ a: { b: "x" } });
		expect(parser.parse("<a/>")).toEqual({ a: {} });
		expect(parser.parse('<?xml version="1.0"?><a>1</a>')).toEqual({ a: 1 });
	});
});
