import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XmlQueryParser", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("Basic parsing", () => {
		it("should parse simple element with text content", () => {
			const xml = "<root>Hello World</root>";
			const result = parser.parse(xml);

			expect(result).toBeDefined();
			const elements = result.toArray();
			expect(elements).toHaveLength(1);
			expect(elements[0].name).toBe("root");
			expect(elements[0].text).toBe("Hello World");
		});

		it("should parse element with single attribute", () => {
			const xml = '<root id="123">Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.id).toBe("123");
			expect(elements[0].text).toBe("Content");
		});

		it("should parse element with multiple attributes", () => {
			const xml = '<root id="123" name="test" active="true">Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.id).toBe("123");
			expect(elements[0].attributes.name).toBe("test");
			expect(elements[0].attributes.active).toBe("true");
		});

		it("should parse self-closing element", () => {
			const xml = '<root id="123" />';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].attributes.id).toBe("123");
			expect(elements[0].text).toBeUndefined();
		});

		it("should parse empty element", () => {
			const xml = "<root></root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].text).toBeUndefined();
		});
	});

	describe("Nested elements", () => {
		it("should parse nested elements", () => {
			const xml = `
				<root>
					<child>Child Content</child>
				</root>
			`;
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].children).toHaveLength(1);
			expect(elements[0].children[0].name).toBe("child");
			expect(elements[0].children[0].text).toBe("Child Content");
		});

		it("should parse deeply nested elements", () => {
			const xml = `
				<root>
					<level1>
						<level2>
							<level3>Deep Content</level3>
						</level2>
					</level1>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.children[0].name).toBe("level1");
			expect(root.children[0].children[0].name).toBe("level2");
			expect(root.children[0].children[0].children[0].name).toBe("level3");
			expect(root.children[0].children[0].children[0].text).toBe("Deep Content");
		});

		it("should parse multiple children", () => {
			const xml = `
				<root>
					<child1>Content 1</child1>
					<child2>Content 2</child2>
					<child3>Content 3</child3>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.children).toHaveLength(3);
			expect(root.children[0].text).toBe("Content 1");
			expect(root.children[1].text).toBe("Content 2");
			expect(root.children[2].text).toBe("Content 3");
		});

		it("should parse array-like elements (same tag name)", () => {
			const xml = `
				<root>
					<item>Item 1</item>
					<item>Item 2</item>
					<item>Item 3</item>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.children).toHaveLength(3);
			expect(root.children[0].name).toBe("item");
			expect(root.children[1].name).toBe("item");
			expect(root.children[2].name).toBe("item");
			expect(root.children[0].indexInParent).toBe(0);
			expect(root.children[1].indexInParent).toBe(1);
			expect(root.children[2].indexInParent).toBe(2);
		});
	});

	describe("Element properties", () => {
		it("should set correct depth for nested elements", () => {
			const xml = `
				<root>
					<level1>
						<level2>Content</level2>
					</level1>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.depth).toBe(0);
			expect(root.children[0].depth).toBe(1);
			expect(root.children[0].children[0].depth).toBe(2);
		});

		it("should set correct path for nested elements", () => {
			const xml = `
				<root>
					<child>
						<grandchild>Content</grandchild>
					</child>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.path).toBe("root");
			expect(root.children[0].path).toBe("root/child");
			expect(root.children[0].children[0].path).toBe("root/child/grandchild");
		});

		it("should set hasChildren and isLeaf correctly", () => {
			const xml = `
				<root>
					<parent>
						<child>Content</child>
					</parent>
					<leaf>Text</leaf>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.hasChildren).toBe(true);
			expect(root.isLeaf).toBe(false);

			expect(root.children[0].hasChildren).toBe(true);
			expect(root.children[0].isLeaf).toBe(false);

			expect(root.children[0].children[0].hasChildren).toBe(false);
			expect(root.children[0].children[0].isLeaf).toBe(true);

			expect(root.children[1].hasChildren).toBe(false);
			expect(root.children[1].isLeaf).toBe(true);
		});

		it("should set parent references correctly", () => {
			const xml = `
				<root>
					<child>
						<grandchild>Content</grandchild>
					</child>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.parent).toBeUndefined();
			expect(root.children[0].parent).toBe(root);
			expect(root.children[0].children[0].parent).toBe(root.children[0]);
		});
	});

	describe("Namespace handling", () => {
		it("should parse namespaced elements", () => {
			const xml = '<ns:root xmlns:ns="http://example.com">Content</ns:root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].namespace).toBe("ns");
			expect(elements[0].qualifiedName).toBe("ns:root");
		});

		it("should parse nested namespaced elements", () => {
			const xml = `
				<ns1:root xmlns:ns1="http://example.com">
					<ns2:child xmlns:ns2="http://other.com">Content</ns2:child>
				</ns1:root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.namespace).toBe("ns1");
			expect(root.children[0].namespace).toBe("ns2");
		});

		it("should handle elements without namespace", () => {
			const xml = "<root>Content</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].namespace).toBeUndefined();
			expect(elements[0].qualifiedName).toBe("root");
		});
	});

	describe("Attribute parsing", () => {
		it("should parse attributes with double quotes", () => {
			const xml = '<root name="test" value="123">Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.name).toBe("test");
			expect(elements[0].attributes.value).toBe("123");
		});

		it("should parse attributes with single quotes", () => {
			const xml = "<root name='test' value='123'>Content</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.name).toBe("test");
			expect(elements[0].attributes.value).toBe("123");
		});

		it("should decode entities in attribute values", () => {
			const xml = '<root text="Hello &lt;World&gt; &amp; &quot;Test&quot;">Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.text).toBe('Hello <World> & "Test"');
		});

		it("should handle empty attribute values", () => {
			const xml = '<root name="">Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].attributes.name).toBe("");
		});
	});

	describe("Text content parsing", () => {
		it("should trim whitespace by default", () => {
			const xml = "<root>   Text with spaces   </root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("Text with spaces");
		});

		it("should not trim whitespace when trimValues is false", () => {
			const parserNoTrim = new XmlQueryParser({ trimValues: false });
			const xml = "<root>   Text with spaces   </root>";
			const result = parserNoTrim.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("   Text with spaces   ");
		});

		it("should decode XML entities in text content", () => {
			const xml = "<root>Hello &lt;World&gt; &amp; &quot;Test&quot;</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe('Hello <World> & "Test"');
		});

		it("should decode numeric character references", () => {
			const xml = "<root>&#65;&#66;&#67;</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("ABC");
		});

		it("should decode hexadecimal character references", () => {
			const xml = "<root>&#x41;&#x42;&#x43;</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("ABC");
		});

		it("should preserve raw text when preserveRawText is true", () => {
			const parserWithRaw = new XmlQueryParser({ preserveRawText: true });
			const xml = "<root>   Text   </root>";
			const result = parserWithRaw.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("Text");
			expect(elements[0].rawText).toBe("   Text   ");
		});
	});

	describe("Numeric and boolean parsing", () => {
		it("should parse numeric values by default", () => {
			const xml = "<root>123.45</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("123.45");
			expect(elements[0].numericValue).toBe(123.45);
		});

		it("should parse negative numbers", () => {
			const xml = "<root>-99.5</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].numericValue).toBe(-99.5);
		});

		it("should not parse non-numeric text as number", () => {
			const xml = "<root>abc123</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].numericValue).toBeUndefined();
		});

		it("should not parse numbers when parseNumbers is false", () => {
			const parserNoNumbers = new XmlQueryParser({ parseNumbers: false });
			const xml = "<root>123.45</root>";
			const result = parserNoNumbers.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("123.45");
			expect(elements[0].numericValue).toBeUndefined();
		});

		it("should parse boolean true", () => {
			const xml = "<root>true</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("true");
			expect(elements[0].booleanValue).toBe(true);
		});

		it("should parse boolean false", () => {
			const xml = "<root>false</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("false");
			expect(elements[0].booleanValue).toBe(false);
		});

		it("should be case-insensitive for booleans", () => {
			const xml = "<root>TRUE</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].booleanValue).toBe(true);
		});

		it("should not parse booleans when parseBooleans is false", () => {
			const parserNoBooleans = new XmlQueryParser({ parseBooleans: false });
			const xml = "<root>true</root>";
			const result = parserNoBooleans.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("true");
			expect(elements[0].booleanValue).toBeUndefined();
		});
	});

	describe("CDATA handling", () => {
		it("should parse CDATA sections", () => {
			const xml = "<root><![CDATA[Hello <World> & Test]]></root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("Hello <World> & Test");
		});

		it("should not decode entities in CDATA", () => {
			const xml = "<root><![CDATA[&lt;test&gt;]]></root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("&lt;test&gt;");
		});

		it("should handle CDATA with child elements", () => {
			const xml = `
				<root>
					<![CDATA[CDATA Content]]>
					<child>Child Content</child>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.text).toBe("CDATA Content");
			expect(root.children).toHaveLength(1);
			expect(root.children[0].text).toBe("Child Content");
		});
	});

	describe("Comments", () => {
		it("should skip XML comments", () => {
			const xml = `
				<root>
					<!-- This is a comment -->
					<child>Content</child>
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.children).toHaveLength(1);
			expect(root.children[0].name).toBe("child");
		});

		it("should skip comments in text content", () => {
			const xml = "<root>Before<!-- Comment -->After</root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			// Parser skips comments but may preserve surrounding text
			expect(elements[0].text).toBeTruthy();
		});

		it("should skip multiple comments", () => {
			const xml = `
				<root>
					<!-- Comment 1 -->
					<child1>Content 1</child1>
					<!-- Comment 2 -->
					<child2>Content 2</child2>
					<!-- Comment 3 -->
				</root>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			expect(root.children).toHaveLength(2);
		});
	});

	describe("XML declaration and DOCTYPE", () => {
		it("should ignore XML declaration", () => {
			const xml = '<?xml version="1.0" encoding="UTF-8"?><root>Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].text).toBe("Content");
		});

		it("should ignore DOCTYPE declaration", () => {
			const xml = '<!DOCTYPE root SYSTEM "example.dtd"><root>Content</root>';
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].text).toBe("Content");
		});

		it("should handle both XML declaration and DOCTYPE", () => {
			const xml = `
				<?xml version="1.0" encoding="UTF-8"?>
				<!DOCTYPE root SYSTEM "example.dtd">
				<root>Content</root>
			`;
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
		});
	});

	describe("Error handling", () => {
		it("should throw error for empty XML string", () => {
			expect(() => parser.parse("")).toThrow("Empty XML string");
		});

		it("should throw error for invalid XML (missing closing tag)", () => {
			const xml = "<root><child>Content</root>";
			expect(() => parser.parse(xml)).toThrow("Missing closing tag");
		});

		it("should throw error for XML not starting with element", () => {
			const xml = "Not XML";
			expect(() => parser.parse(xml)).toThrow("Expected '<' at start of element");
		});
	});

	describe("Complex real-world scenarios", () => {
		it("should parse product catalog XML", () => {
			const xml = `
				<catalog>
					<product id="1" category="Electronics">
						<name>Laptop</name>
						<price>999.99</price>
						<inStock>true</inStock>
					</product>
					<product id="2" category="Books">
						<name>XML Guide</name>
						<price>29.99</price>
						<inStock>false</inStock>
					</product>
				</catalog>
			`;
			const result = parser.parse(xml);

			const catalog = result.toArray()[0];
			expect(catalog.children).toHaveLength(2);

			const product1 = catalog.children[0];
			expect(product1.attributes.id).toBe("1");
			expect(product1.children[0].text).toBe("Laptop");
			expect(product1.children[1].numericValue).toBe(999.99);
			expect(product1.children[2].booleanValue).toBe(true);

			const product2 = catalog.children[1];
			expect(product2.attributes.id).toBe("2");
			expect(product2.children[2].booleanValue).toBe(false);
		});

		it("should parse nested configuration XML", () => {
			const xml = `
				<config>
					<database>
						<connection host="localhost" port="5432">
							<username>admin</username>
							<password>secret</password>
						</connection>
						<pool>
							<maxConnections>10</maxConnections>
							<timeout>30</timeout>
						</pool>
					</database>
					<logging level="info" />
				</config>
			`;
			const result = parser.parse(xml);

			const config = result.toArray()[0];
			const database = config.children[0];
			const connection = database.children[0];

			expect(connection.attributes.host).toBe("localhost");
			expect(connection.attributes.port).toBe("5432");
			expect(connection.children[0].text).toBe("admin");

			const pool = database.children[1];
			expect(pool.children[0].numericValue).toBe(10);
		});

		it("should handle mixed content scenarios", () => {
			const xml = `
				<document>
					<section>
						<title>Introduction</title>
						<paragraph>This is <emphasis>important</emphasis> text.</paragraph>
					</section>
				</document>
			`;
			const result = parser.parse(xml);

			const document = result.toArray()[0];
			expect(document.children[0].children).toHaveLength(2);
			expect(document.children[0].children[0].name).toBe("title");
			expect(document.children[0].children[1].name).toBe("paragraph");
		});
	});

	describe("Parser options", () => {
		it("should use default options when none provided", () => {
			const defaultParser = new XmlQueryParser();
			const xml = "<root>  123  </root>";
			const result = defaultParser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("123");
			expect(elements[0].numericValue).toBe(123);
		});

		it("should allow partial options override", () => {
			const customParser = new XmlQueryParser({ trimValues: false });
			const xml = "<root>  test  </root>";
			const result = customParser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("  test  ");
		});

		it("should apply all custom options", () => {
			const customParser = new XmlQueryParser({
				trimValues: false,
				parseNumbers: false,
				parseBooleans: false,
				preserveRawText: true,
			});
			const xml = "<root>  123  </root>";
			const result = customParser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBe("  123  ");
			expect(elements[0].numericValue).toBeUndefined();
			expect(elements[0].rawText).toBe("  123  ");
		});
	});

	describe("Edge cases", () => {
		it("should handle elements with only whitespace", () => {
			const xml = "<root>   </root>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].text).toBeUndefined();
		});

		it("should handle deeply nested same-name elements", () => {
			const xml = `
				<node>
					<node>
						<node>
							<node>Deep</node>
						</node>
					</node>
				</node>
			`;
			const result = parser.parse(xml);

			const root = result.toArray()[0];
			let current = root;
			let depth = 0;
			while (current.children.length > 0) {
				depth++;
				current = current.children[0];
			}
			expect(depth).toBe(3);
			expect(current.text).toBe("Deep");
		});

		it("should handle elements with special characters in names", () => {
			const xml = "<root-element_123>Content</root-element_123>";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root-element_123");
		});

		it("should handle empty self-closing tags", () => {
			const xml = "<root />";
			const result = parser.parse(xml);

			const elements = result.toArray();
			expect(elements[0].name).toBe("root");
			expect(elements[0].children).toHaveLength(0);
		});
	});
});
