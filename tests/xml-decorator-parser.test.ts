import { XmlDecoratorParser } from "../src/xml-decorator-parser";

describe("XmlParser", () => {
	describe("Basic XML Parsing", () => {
		it("should parse simple element with text content", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<name>John</name>";
			const result = parser.parse(xml);

			expect(result).toEqual({ name: "John" });
		});

		it("should parse element with number content", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<age>30</age>";
			const result = parser.parse(xml);

			expect(result).toEqual({ age: 30 });
		});

		it("should parse element with boolean content", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<active>true</active>";
			const result = parser.parse(xml);

			expect(result).toEqual({ active: true });
		});

		it("should parse empty element as empty string", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<empty></empty>";
			const result = parser.parse(xml);

			expect(result).toEqual({ empty: "" });
		});

		it("should parse self-closing element", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<empty/>";
			const result = parser.parse(xml);

			expect(result).toEqual({ empty: {} });
		});

		it("should return empty object for empty XML", () => {
			const parser = new XmlDecoratorParser();
			const xml = "";
			const result = parser.parse(xml);

			expect(result).toEqual({});
		});
	});

	describe("Attributes", () => {
		it("should parse element with single attribute", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<person id="123">John</person>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					"@_id": "123",
					"#text": "John",
				},
			});
		});

		it("should parse element with multiple attributes", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<person id="123" age="30">John</person>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					"@_id": "123",
					"@_age": "30",
					"#text": "John",
				},
			});
		});

		it("should parse element with attributes but no text content", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<person id="123" age="30"/>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					"@_id": "123",
					"@_age": "30",
				},
			});
		});

		it("should decode entities in attribute values", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<element attr="&lt;&gt;&amp;&quot;&apos;">content</element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					"@_attr": "<>&\"'",
					"#text": "content",
				},
			});
		});

		it("should use custom attribute prefix", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "$" });
			const xml = '<person id="123">John</person>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					$id: "123",
					"#text": "John",
				},
			});
		});
	});

	describe("Nested Elements", () => {
		it("should parse nested elements", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<person><name>John</name><age>30</age></person>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					name: "John",
					age: 30,
				},
			});
		});

		it("should parse deeply nested elements", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><level1><level2><level3>deep value</level3></level2></level1></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					level1: {
						level2: {
							level3: "deep value",
						},
					},
				},
			});
		});

		it("should parse nested elements with attributes", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<person id="1"><name lang="en">John</name></person>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				person: {
					"@_id": "1",
					name: {
						"@_lang": "en",
						"#text": "John",
					},
				},
			});
		});
	});

	describe("Arrays", () => {
		it("should parse array of elements with same tag name", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><item>one</item><item>two</item><item>three</item></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					item: ["one", "two", "three"],
				},
			});
		});

		it("should parse array of complex elements", () => {
			const parser = new XmlDecoratorParser();
			const xml =
				"<root><person><name>John</name><age>30</age></person><person><name>Jane</name><age>25</age></person></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					person: [
						{ name: "John", age: 30 },
						{ name: "Jane", age: 25 },
					],
				},
			});
		});

		it("should parse array with attributes", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<root><item id="1">first</item><item id="2">second</item></root>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					item: [
						{ "@_id": "1", "#text": "first" },
						{ "@_id": "2", "#text": "second" },
					],
				},
			});
		});

		it("should not create array for single element", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><item>only one</item></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					item: "only one",
				},
			});
		});
	});

	describe("CDATA Support", () => {
		it("should parse CDATA section", () => {
			const parser = new XmlDecoratorParser({ cdataPropName: "__cdata" });
			const xml = "<content><![CDATA[Some <xml> content]]></content>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				content: {
					__cdata: "Some <xml> content",
				},
			});
		});

		it("should parse CDATA with attributes", () => {
			const parser = new XmlDecoratorParser({ cdataPropName: "__cdata", attributeNamePrefix: "@_" });
			const xml = '<content type="html"><![CDATA[<p>Hello</p>]]></content>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				content: {
					"@_type": "html",
					__cdata: "<p>Hello</p>",
				},
			});
		});

		it("should use custom CDATA property name", () => {
			const parser = new XmlDecoratorParser({ cdataPropName: "$cdata" });
			const xml = "<content><![CDATA[raw content]]></content>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				content: {
					$cdata: "raw content",
				},
			});
		});

		it("should parse empty CDATA", () => {
			const parser = new XmlDecoratorParser({ cdataPropName: "__cdata" });
			const xml = "<content><![CDATA[]]></content>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				content: {
					__cdata: "",
				},
			});
		});

		it("should not decode entities in CDATA", () => {
			const parser = new XmlDecoratorParser({ cdataPropName: "__cdata" });
			const xml = "<content><![CDATA[&lt;&gt;&amp;]]></content>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				content: {
					__cdata: "&lt;&gt;&amp;",
				},
			});
		});

		it("should throw error for unclosed CDATA", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<content><![CDATA[unclosed</content>";

			expect(() => parser.parse(xml)).toThrow("Unclosed CDATA section");
		});
	});

	describe("Comments", () => {
		it("should skip XML comments", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><!-- This is a comment --><child>value</child></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					child: "value",
				},
			});
		});

		it("should skip multiple comments", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><!-- Comment 1 --><child>value</child><!-- Comment 2 --></root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					child: "value",
				},
			});
		});

		it("should throw error for unclosed comment", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><!-- Unclosed comment</root>";

			expect(() => parser.parse(xml)).toThrow("Unclosed comment");
		});
	});

	describe("Text Node Handling", () => {
		it("should use #text property for text content with attributes", () => {
			const parser = new XmlDecoratorParser({ textNodeName: "#text", attributeNamePrefix: "@_" });
			const xml = '<element id="1">text content</element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					"@_id": "1",
					"#text": "text content",
				},
			});
		});

		it("should use custom text node name", () => {
			const parser = new XmlDecoratorParser({ textNodeName: "$text", attributeNamePrefix: "@_" });
			const xml = '<element id="1">content</element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					"@_id": "1",
					$text: "content",
				},
			});
		});

		it("should return plain text when no attributes", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>plain text</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "plain text",
			});
		});
	});

	describe("Special Character Decoding", () => {
		it("should decode &lt; and &gt;", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>&lt;tag&gt;</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "<tag>",
			});
		});

		it("should decode &amp;", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>Tom &amp; Jerry</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "Tom & Jerry",
			});
		});

		it("should decode &quot;", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>He said &quot;Hello&quot;</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: 'He said "Hello"',
			});
		});

		it("should decode &apos;", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>It&apos;s working</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "It's working",
			});
		});

		it("should decode numeric character references", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>&#65;&#66;&#67;</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "ABC",
			});
		});

		it("should decode hexadecimal character references", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>&#x41;&#x42;&#x43;</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "ABC",
			});
		});

		it("should decode all entities together", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element>&lt;&gt;&amp;&quot;&apos;</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "<>&\"'",
			});
		});
	});

	describe("Parser Options", () => {
		it("should trim values when trimValues is true", () => {
			const parser = new XmlDecoratorParser({ trimValues: true });
			const xml = "<element>   text with spaces   </element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "text with spaces",
			});
		});

		it("should preserve spaces when trimValues is false", () => {
			const parser = new XmlDecoratorParser({ trimValues: false });
			const xml = "<element>   text with spaces   </element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "   text with spaces   ",
			});
		});

		it("should not parse values when parseTagValue is false", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: false });
			const xml = "<age>30</age>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				age: "30",
			});
		});

		it("should parse boolean values when parseTagValue is true", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<active>false</active>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				active: false,
			});
		});

		it("should preserve empty strings", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<element></element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "",
			});
		});
	});

	describe("XML Declaration and DOCTYPE", () => {
		it("should ignore XML declaration", () => {
			const parser = new XmlDecoratorParser();
			const xml = '<?xml version="1.0" encoding="UTF-8"?><root>content</root>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: "content",
			});
		});

		it("should ignore DOCTYPE", () => {
			const parser = new XmlDecoratorParser();
			const xml = '<!DOCTYPE root SYSTEM "root.dtd"><root>content</root>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: "content",
			});
		});

		it("should handle both XML declaration and DOCTYPE", () => {
			const parser = new XmlDecoratorParser();
			const xml = '<?xml version="1.0"?><!DOCTYPE root><root>content</root>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: "content",
			});
		});
	});

	describe("Whitespace Handling", () => {
		it("should skip whitespace between elements", () => {
			const parser = new XmlDecoratorParser();
			const xml = `
				<root>
					<child>value</child>
				</root>
			`;
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: {
					child: "value",
				},
			});
		});

		it("should skip whitespace in attributes", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = '<element   id = "123"   name = "test"  >content</element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					"@_id": "123",
					"@_name": "test",
					"#text": "content",
				},
			});
		});

		it("should preserve significant whitespace in text content", () => {
			const parser = new XmlDecoratorParser({ trimValues: false });
			const xml = "<element>text with   multiple   spaces</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "text with   multiple   spaces",
			});
		});
	});

	describe("Error Handling", () => {
		it("should throw error for mismatched closing tag", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><child>value</wrong></root>";

			expect(() => parser.parse(xml)).toThrow("Expected closing tag </child>, got </wrong>");
		});

		it("should throw error for mismatched tag name", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<root><child>value</other></root>";

			expect(() => parser.parse(xml)).toThrow("Expected closing tag </child>, got </other>");
		});
	});

	describe("Edge Cases", () => {
		it("should handle zero value", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<number>0</number>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				number: 0,
			});
		});

		it("should handle false value", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<flag>false</flag>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				flag: false,
			});
		});

		it("should handle negative numbers", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<temp>-10</temp>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				temp: -10,
			});
		});

		it("should handle decimal numbers", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: true });
			const xml = "<price>19.99</price>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				price: 19.99,
			});
		});

		it("should handle elements with only whitespace as text", () => {
			const parser = new XmlDecoratorParser({ trimValues: false });
			const xml = "<element>   </element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "   ",
			});
		});

		it("should handle mixed content with text and elements", () => {
			const parser = new XmlDecoratorParser();
			const xml = "<p>This is <strong>bold</strong> text</p>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				p: {
					"#mixed": [{ text: "This is " }, { element: "strong", content: "bold", attributes: {} }, { text: " text" }],
				},
			});
		});

		it("should handle text node with only whitespace when trimValues is true", () => {
			const parser = new XmlDecoratorParser({ trimValues: true });
			const xml = "<root>   \n\t   </root>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				root: "",
			});
		});
	});

	describe("Constructor Options", () => {
		it("should use default options when none provided", () => {
			const parser = new XmlDecoratorParser();
			const xml = '<element id="1">test</element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					"@_id": "1",
					"#text": "test",
				},
			});
		});

		it("should accept empty options object", () => {
			const parser = new XmlDecoratorParser({});
			const xml = "<element>test</element>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: "test",
			});
		});

		it("should allow partial options", () => {
			const parser = new XmlDecoratorParser({ parseTagValue: false });
			const xml = "<age>30</age>";
			const result = parser.parse(xml);

			expect(result).toEqual({
				age: "30",
			});
		});

		it("should override all default options", () => {
			const parser = new XmlDecoratorParser({
				attributeNamePrefix: "$attr_",
				textNodeName: "$text",
				cdataPropName: "$cdata",
				trimValues: true,
				parseTagValue: false,
			});
			const xml = '<element id="1">  30  </element>';
			const result = parser.parse(xml);

			expect(result).toEqual({
				element: {
					$attr_id: "1",
					$text: "30", // Not parsed as number
				},
			});
		});
	});

	describe("Complex Real-World Scenarios", () => {
		it("should parse complete XML document structure", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = `
				<order id="12345">
					<customer>
						<name>John Doe</name>
						<email>john@example.com</email>
					</customer>
					<items>
						<item sku="ABC123">
							<name>Widget</name>
							<price>9.99</price>
						</item>
						<item sku="XYZ789">
							<name>Gadget</name>
							<price>19.99</price>
						</item>
					</items>
					<total>29.98</total>
				</order>
			`;
			const result = parser.parse(xml);

			expect(result.order["@_id"]).toBe("12345");
			expect(result.order.customer.name).toBe("John Doe");
			expect(result.order.items.item).toHaveLength(2);
			expect(result.order.items.item[0]["@_sku"]).toBe("ABC123");
			expect(result.order.total).toBe(29.98);
		});

		it("should parse XML with mixed content and attributes", () => {
			const parser = new XmlDecoratorParser({ attributeNamePrefix: "@_" });
			const xml = `
				<book isbn="978-0-123456-78-9" lang="en">
					<title>TypeScript Guide</title>
					<author id="a1">John Smith</author>
					<chapters>
						<chapter number="1">Introduction</chapter>
						<chapter number="2">Basics</chapter>
					</chapters>
				</book>
			`;
			const result = parser.parse(xml);

			expect(result.book["@_isbn"]).toBe("978-0-123456-78-9");
			expect(result.book["@_lang"]).toBe("en");
			expect(result.book.title).toBe("TypeScript Guide");
			expect(result.book.author["@_id"]).toBe("a1");
			expect(result.book.chapters.chapter).toHaveLength(2);
		});

		it("should handle complex nesting with arrays and CDATA", () => {
			const parser = new XmlDecoratorParser({
				attributeNamePrefix: "@_",
				cdataPropName: "__cdata",
			});
			const xml = `
				<document>
					<metadata>
						<title>API Response</title>
						<date>2025-11-21</date>
					</metadata>
					<content>
						<section type="code">
							<data><![CDATA[<script>alert('test');</script>]]></data>
						</section>
						<section type="text">Regular content</section>
					</content>
				</document>
			`;
			const result = parser.parse(xml);

			expect(result.document.metadata.title).toBe("API Response");
			expect(result.document.content.section[0].data.__cdata).toBe("<script>alert('test');</script>");
			expect(result.document.content.section[1]["#text"]).toBe("Regular content");
		});
	});
});
