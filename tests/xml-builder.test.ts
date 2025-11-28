import { describe, expect, it } from "vitest";
import { XmlBuilder } from "../src/xml-builder";

describe("XmlBuilder", () => {
	describe("Basic XML Building", () => {
		it("should build simple element with text content", () => {
			const builder = new XmlBuilder();
			const obj = { name: "John" };
			const xml = builder.build(obj);

			expect(xml).toBe("<name>John</name>");
		});

		it("should build element with number content", () => {
			const builder = new XmlBuilder();
			const obj = { age: 30 };
			const xml = builder.build(obj);

			expect(xml).toBe("<age>30</age>");
		});

		it("should build element with boolean content", () => {
			const builder = new XmlBuilder();
			const obj = { active: true };
			const xml = builder.build(obj);

			expect(xml).toBe("<active>true</active>");
		});

		it("should build empty element for empty string", () => {
			const builder = new XmlBuilder();
			const obj = { empty: "" };
			const xml = builder.build(obj);

			expect(xml).toBe("<empty/>");
		});
		it("should build empty element for null value", () => {
			const builder = new XmlBuilder();
			const obj = { empty: null };
			const xml = builder.build(obj);

			expect(xml).toBe("<empty/>");
		});

		it("should build empty element for undefined value", () => {
			const builder = new XmlBuilder();
			const obj = { empty: undefined };
			const xml = builder.build(obj);

			expect(xml).toBe("<empty/>");
		});
	});

	describe("Attributes", () => {
		it("should build element with single attribute", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = { person: { "@_id": "123", "#text": "John" } };
			const xml = builder.build(obj);

			expect(xml).toBe('<person id="123">John</person>');
		});

		it("should build element with multiple attributes", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = { person: { "@_id": "123", "@_age": "30", "#text": "John" } };
			const xml = builder.build(obj);

			expect(xml).toContain('id="123"');
			expect(xml).toContain('age="30"');
			expect(xml).toContain(">John</person>");
		});

		it("should build element with attributes but no text content", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = { person: { "@_id": "123", "@_age": "30" } };
			const xml = builder.build(obj);

			expect(xml).toContain('id="123"');
			expect(xml).toContain('age="30"');
			expect(xml).toContain("/>");
		});

		it("should escape special characters in attributes", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = { element: { "@_attr": "<>&\"'", "#text": "content" } };
			const xml = builder.build(obj);

			expect(xml).toBe('<element attr="&lt;&gt;&amp;&quot;&apos;">content</element>');
		});

		it("should use custom attribute prefix", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "$" });
			const obj = { person: { $id: "123", "#text": "John" } };
			const xml = builder.build(obj);

			expect(xml).toBe('<person id="123">John</person>');
		});
	});

	describe("Nested Elements", () => {
		it("should build nested elements", () => {
			const builder = new XmlBuilder();
			const obj = { person: { name: "John", address: { city: "NYC" } } };
			const xml = builder.build(obj);

			expect(xml).toBe("<person><name>John</name><address><city>NYC</city></address></person>");
		});

		it("should build deeply nested elements", () => {
			const builder = new XmlBuilder();
			const obj = {
				root: {
					level1: {
						level2: {
							level3: "deep value",
						},
					},
				},
			};
			const xml = builder.build(obj);

			expect(xml).toBe("<root><level1><level2><level3>deep value</level3></level2></level1></root>");
		});

		it("should build nested elements with attributes", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = {
				person: {
					"@_id": "1",
					name: { "@_lang": "en", "#text": "John" },
				},
			};
			const xml = builder.build(obj);

			expect(xml).toContain('<person id="1">');
			expect(xml).toContain('<name lang="en">John</name>');
		});
	});

	describe("Arrays", () => {
		it("should build array of simple elements", () => {
			const builder = new XmlBuilder();
			const obj = { item: ["one", "two", "three"] };
			const xml = builder.build(obj);

			expect(xml).toBe("<item>one</item><item>two</item><item>three</item>");
		});

		it("should build array of complex elements", () => {
			const builder = new XmlBuilder();
			const obj = {
				person: [
					{ name: "John", age: 30 },
					{ name: "Jane", age: 25 },
				],
			};
			const xml = builder.build(obj);

			expect(xml).toContain("<person><name>John</name><age>30</age></person>");
			expect(xml).toContain("<person><name>Jane</name><age>25</age></person>");
		});

		it("should build array with attributes", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_" });
			const obj = {
				item: [
					{ "@_id": "1", "#text": "first" },
					{ "@_id": "2", "#text": "second" },
				],
			};
			const xml = builder.build(obj);

			expect(xml).toContain('<item id="1">first</item>');
			expect(xml).toContain('<item id="2">second</item>');
		});

		it("should handle empty array", () => {
			const builder = new XmlBuilder();
			const obj = { items: [] };
			const xml = builder.build(obj);

			expect(xml).toBe("");
		});
	});

	describe("CDATA Support", () => {
		it("should wrap content in CDATA section", () => {
			const builder = new XmlBuilder({ cdataPropName: "__cdata" });
			const obj = { content: { __cdata: "Some <xml> content" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<content><![CDATA[Some <xml> content]]></content>");
		});

		it("should handle CDATA with attributes", () => {
			const builder = new XmlBuilder({ cdataPropName: "__cdata", attributeNamePrefix: "@_" });
			const obj = { content: { "@_type": "html", __cdata: "<p>Hello</p>" } };
			const xml = builder.build(obj);

			expect(xml).toBe('<content type="html"><![CDATA[<p>Hello</p>]]></content>');
		});

		it("should use custom CDATA property name", () => {
			const builder = new XmlBuilder({ cdataPropName: "$cdata" });
			const obj = { content: { $cdata: "raw content" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<content><![CDATA[raw content]]></content>");
		});

		it("should handle empty CDATA", () => {
			const builder = new XmlBuilder({ cdataPropName: "__cdata" });
			const obj = { content: { __cdata: "" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<content><![CDATA[]]></content>");
		});

		it("should not escape content inside CDATA", () => {
			const builder = new XmlBuilder({ cdataPropName: "__cdata" });
			const obj = { content: { __cdata: "<>&\"'test" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<content><![CDATA[<>&\"'test]]></content>");
		});
	});

	describe("Comments", () => {
		it("should add comment as child element", () => {
			const builder = new XmlBuilder();
			const obj = { root: { "?": "This is a comment", child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toContain("<!--This is a comment-->");
			expect(xml).toContain("<child>value</child>");
		});

		it("should add comment in formatted output", () => {
			const builder = new XmlBuilder({ format: true, indentBy: "  " });
			const obj = { root: { "?": "Comment", child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toContain("<!--Comment-->");
			expect(xml).toContain("<child>value</child>");
		});

		it("should handle comment without other children", () => {
			const builder = new XmlBuilder();
			const obj = { root: { "?": "Only comment" } };
			const xml = builder.build(obj);

			expect(xml).toContain("<root>");
			expect(xml).toContain("<!--Only comment-->");
			expect(xml).toContain("</root>");
		});
	});

	describe("Text Node Handling", () => {
		it("should use #text property for text content", () => {
			const builder = new XmlBuilder({ textNodeName: "#text" });
			const obj = { element: { "#text": "text content" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>text content</element>");
		});

		it("should use custom text node name", () => {
			const builder = new XmlBuilder({ textNodeName: "$text" });
			const obj = { element: { $text: "text content" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>text content</element>");
		});

		it("should handle text with attributes", () => {
			const builder = new XmlBuilder({ textNodeName: "#text", attributeNamePrefix: "@_" });
			const obj = { element: { "@_id": "1", "#text": "content" } };
			const xml = builder.build(obj);

			expect(xml).toBe('<element id="1">content</element>');
		});

		it("should prioritize CDATA over text node", () => {
			const builder = new XmlBuilder({ textNodeName: "#text", cdataPropName: "__cdata" });
			const obj = { element: { "#text": "text", __cdata: "cdata" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<element><![CDATA[cdata]]></element>");
		});
	});

	describe("Special Character Escaping", () => {
		it("should escape < and >", () => {
			const builder = new XmlBuilder();
			const obj = { element: "<tag>" };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>&lt;tag&gt;</element>");
		});

		it("should escape ampersand", () => {
			const builder = new XmlBuilder();
			const obj = { element: "Tom & Jerry" };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>Tom &amp; Jerry</element>");
		});

		it("should escape quotes", () => {
			const builder = new XmlBuilder();
			const obj = { element: 'He said "Hello"' };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>He said &quot;Hello&quot;</element>");
		});

		it("should escape apostrophe", () => {
			const builder = new XmlBuilder();
			const obj = { element: "It's working" };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>It&apos;s working</element>");
		});

		it("should escape all special characters together", () => {
			const builder = new XmlBuilder();
			const obj = { element: "<>&\"'" };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>&lt;&gt;&amp;&quot;&apos;</element>");
		});
	});

	describe("Formatting Options", () => {
		it("should format with indentation", () => {
			const builder = new XmlBuilder({ format: true, indentBy: "  " });
			const obj = { root: { child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<root>\n  <child>value</child>\n</root>\n");
		});

		it("should format nested elements", () => {
			const builder = new XmlBuilder({ format: true, indentBy: "  " });
			const obj = { root: { level1: { level2: "value" } } };
			const xml = builder.build(obj);

			expect(xml).toContain("<root>\n");
			expect(xml).toContain("  <level1>\n");
			expect(xml).toContain("    <level2>value</level2>\n");
			expect(xml).toContain("  </level1>\n");
			expect(xml).toContain("</root>\n");
		});

		it("should use custom indentation string", () => {
			const builder = new XmlBuilder({ format: true, indentBy: "\t" });
			const obj = { root: { child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<root>\n\t<child>value</child>\n</root>\n");
		});

		it("should not format when format is false", () => {
			const builder = new XmlBuilder({ format: false });
			const obj = { root: { child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toBe("<root><child>value</child></root>");
			expect(xml).not.toContain("\n");
		});

		it("should format arrays", () => {
			const builder = new XmlBuilder({ format: true, indentBy: "  " });
			const obj = { root: { item: ["one", "two"] } };
			const xml = builder.build(obj);

			expect(xml).toContain("<root>\n");
			expect(xml).toContain("  <item>one</item>\n");
			expect(xml).toContain("  <item>two</item>\n");
			expect(xml).toContain("</root>\n");
		});
	});

	describe("Edge Cases", () => {
		it("should handle null object", () => {
			const builder = new XmlBuilder();
			const xml = builder.build(null);

			expect(xml).toBe("null");
		});

		it("should handle undefined object", () => {
			const builder = new XmlBuilder();
			const xml = builder.build(undefined);

			expect(xml).toBe("undefined");
		});

		it("should handle primitive string", () => {
			const builder = new XmlBuilder();
			const xml = builder.build("test");

			expect(xml).toBe("test");
		});

		it("should handle primitive number", () => {
			const builder = new XmlBuilder();
			const xml = builder.build(123);

			expect(xml).toBe("123");
		});

		it("should handle empty object", () => {
			const builder = new XmlBuilder();
			const xml = builder.build({});

			expect(xml).toBe("");
		});

		it("should handle zero value", () => {
			const builder = new XmlBuilder();
			const obj = { number: 0 };
			const xml = builder.build(obj);

			expect(xml).toBe("<number>0</number>");
		});

		it("should handle false value", () => {
			const builder = new XmlBuilder();
			const obj = { flag: false };
			const xml = builder.build(obj);

			expect(xml).toBe("<flag>false</flag>");
		});

		it("should handle whitespace-only content", () => {
			const builder = new XmlBuilder();
			const obj = { element: "   " };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>   </element>");
		});

		it("should ignore special properties in iteration", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_", textNodeName: "#text" });
			const obj = { element: { "@_id": "1", "#text": "text", "?": "comment" } };
			const xml = builder.build(obj);

			// Should only produce the element itself, not iterate over special properties
			expect(xml).toBe('<element id="1">text</element>');
		});
	});

	describe("Complex Real-World Scenarios", () => {
		it("should build complete XML document structure", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_", textNodeName: "#text" });
			const obj = {
				order: {
					"@_id": "12345",
					customer: {
						name: "John Doe",
						email: "john@example.com",
					},
					items: {
						item: [
							{ "@_sku": "ABC123", name: "Widget", price: 9.99 },
							{ "@_sku": "XYZ789", name: "Gadget", price: 19.99 },
						],
					},
					total: 29.98,
				},
			};
			const xml = builder.build(obj);

			expect(xml).toContain('<order id="12345">');
			expect(xml).toContain("<customer>");
			expect(xml).toContain("<name>John Doe</name>");
			expect(xml).toContain('<item sku="ABC123">');
			expect(xml).toContain("<total>29.98</total>");
		});

		it("should build XML with mixed attributes and nested elements", () => {
			const builder = new XmlBuilder({ attributeNamePrefix: "@_", format: true, indentBy: "  " });
			const obj = {
				book: {
					"@_isbn": "978-0-123456-78-9",
					"@_lang": "en",
					title: "TypeScript Guide",
					author: {
						"@_id": "a1",
						"#text": "John Smith",
					},
					chapters: {
						chapter: [
							{ "@_number": "1", "#text": "Introduction" },
							{ "@_number": "2", "#text": "Basics" },
						],
					},
				},
			};
			const xml = builder.build(obj);

			expect(xml).toContain('isbn="978-0-123456-78-9"');
			expect(xml).toContain('lang="en"');
			expect(xml).toContain("<title>TypeScript Guide</title>");
			expect(xml).toContain('<author id="a1">John Smith</author>');
			expect(xml).toContain('<chapter number="1">Introduction</chapter>');
		});

		it("should handle complex nesting with arrays and CDATA", () => {
			const builder = new XmlBuilder({
				attributeNamePrefix: "@_",
				textNodeName: "#text",
				cdataPropName: "__cdata",
			});
			const obj = {
				document: {
					metadata: {
						title: "API Response",
						date: "2025-11-21",
					},
					content: {
						section: [
							{
								"@_type": "code",
								data: { __cdata: "<script>alert('test');</script>" },
							},
							{
								"@_type": "text",
								"#text": "Regular content",
							},
						],
					},
				},
			};
			const xml = builder.build(obj);

			expect(xml).toContain("<![CDATA[<script>alert('test');</script>]]>");
			expect(xml).toContain('<section type="text">Regular content</section>');
			expect(xml).toContain("<title>API Response</title>");
		});
	});

	describe("Constructor Options", () => {
		it("should use default options when none provided", () => {
			const builder = new XmlBuilder();
			const obj = { element: { "@_id": "1", "#text": "test" } };
			const xml = builder.build(obj);

			// Default prefix is @_, so attribute should work
			expect(xml).toContain('id="1"');
		});

		it("should accept empty options object", () => {
			const builder = new XmlBuilder({});
			const obj = { element: "test" };
			const xml = builder.build(obj);

			expect(xml).toBe("<element>test</element>");
		});

		it("should allow partial options", () => {
			const builder = new XmlBuilder({ format: true });
			const obj = { root: { child: "value" } };
			const xml = builder.build(obj);

			expect(xml).toContain("\n");
		});

		it("should override all default options", () => {
			const builder = new XmlBuilder({
				format: true,
				indentBy: "\t",
				attributeNamePrefix: "$attr_",
				textNodeName: "$text",
				cdataPropName: "$cdata",
			});
			const obj = { root: { element: { $attr_id: "1", $text: "test" } } };
			const xml = builder.build(obj);

			expect(xml).toContain('<element id="1">test</element>');
			expect(xml).toContain("\t"); // Verify tab indentation is used
		});

		it("should not treat text node name as attribute when prefix matches", () => {
			// Regression test: When attributePrefix is "$" and textNodeName is "$text",
			// $text should NOT be treated as an attribute
			const builder = new XmlBuilder({
				attributeNamePrefix: "$",
				textNodeName: "$text",
			});
			const obj = { element: { $id: "1", $text: "content" } };
			const xml = builder.build(obj);

			// Should only have id attribute, not text="content"
			expect(xml).toBe('<element id="1">content</element>');
			expect(xml).not.toContain("text=");
		});

		it("should not treat CDATA property as attribute when prefix matches", () => {
			const builder = new XmlBuilder({
				attributeNamePrefix: "$",
				cdataPropName: "$cdata",
			});
			const obj = { element: { $id: "1", $cdata: "raw data" } };
			const xml = builder.build(obj);

			// Should only have id attribute, not cdata="raw data"
			expect(xml).toBe('<element id="1"><![CDATA[raw data]]></element>');
			expect(xml).not.toContain("cdata=");
		});
	});
});
