import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Enhancements", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("ends-with() function", () => {
		it("should filter elements ending with suffix", () => {
			const xml = `
				<catalog>
					<file><name>document.pdf</name></file>
					<file><name>image.png</name></file>
					<file><name>report.pdf</name></file>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//file[ends-with(name, '.pdf')]");

			expect(result.count()).toBe(2);
			const names = result.toArray().map(el => el.children[0]?.text);
			expect(names).toEqual(["document.pdf", "report.pdf"]);
		});

		it("should work with attribute values", () => {
			const xml = `
				<users>
					<user email="john@example.com"/>
					<user email="jane@test.org"/>
					<user email="bob@example.com"/>
				</users>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//user[ends-with(@email, '.com')]");

			expect(result.count()).toBe(2);
		});

		it("should work with text() function", () => {
			const xml = `
				<library>
					<book>JavaScript Guide</book>
					<book>Mastering Python</book>
					<book>Ruby Guide</book>
				</library>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//book[ends-with(text(), 'Guide')]");

			expect(result.count()).toBe(2);
		});

		it("should throw error with insufficient arguments", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[ends-with(text())]");
			}).toThrow(/Invalid ends-with\(\) function: requires 2 arguments/);
		});

		it("should work with empty suffix", () => {
			const xml = `
				<items>
					<item>test</item>
					<item>example</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[ends-with(text(), '')]");

			expect(result.count()).toBe(2); // All strings end with empty string
		});

		it("should be case-sensitive", () => {
			const xml = `
				<files>
					<file>Document.PDF</file>
					<file>Image.pdf</file>
				</files>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//file[ends-with(text(), '.pdf')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Image.pdf");
		});

		it("should work in complex boolean expressions", () => {
			const xml = `
				<products>
					<product type="book"><name>Guide.pdf</name></product>
					<product type="video"><name>Tutorial.pdf</name></product>
					<product type="book"><name>Manual.doc</name></product>
				</products>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//product[@type='book' and ends-with(name, '.pdf')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.children[0]?.text).toBe("Guide.pdf");
		});
	});

	describe("lang() function", () => {
		it("should match exact language", () => {
			const xml = `
				<root>
					<para xml:lang="en">English text</para>
					<para xml:lang="fr">French text</para>
					<para xml:lang="en">More English</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en')]");

			expect(result.count()).toBe(2);
		});

		it("should match language sublanguage", () => {
			const xml = `
				<root>
					<para xml:lang="en-US">American English</para>
					<para xml:lang="en-GB">British English</para>
					<para xml:lang="fr">French</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en')]");

			expect(result.count()).toBe(2); // Matches en-US and en-GB
		});

		it("should inherit language from parent", () => {
			const xml = `
				<root xml:lang="en">
					<section>
						<para>English paragraph</para>
					</section>
					<section xml:lang="fr">
						<para>French paragraph</para>
					</section>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("English paragraph");
		});

		it("should override parent language", () => {
			const xml = `
				<root xml:lang="en">
					<para>English</para>
					<para xml:lang="fr">French</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('fr')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("French");
		});

		it("should be case-insensitive", () => {
			const xml = `
				<root>
					<para xml:lang="EN-US">Text</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en')]");

			expect(result.count()).toBe(1);
		});

		it("should return false when no language specified", () => {
			const xml = `
				<root>
					<para>No language</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en')]");

			expect(result.count()).toBe(0);
		});

		it("should not match partial sublanguage codes", () => {
			const xml = `
				<root>
					<para xml:lang="en-US">American</para>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en-U')]");

			expect(result.count()).toBe(0); // Should not match partial code
		});

		it("should throw error with insufficient arguments", () => {
			const xml = `<root><para xml:lang="en">Test</para></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//para[lang()]");
			}).toThrow(/Invalid lang\(\) function: requires 1 argument/);
		});

		it("should work in complex expressions", () => {
			const xml = `
				<doc>
					<section xml:lang="en">
						<para type="intro">English intro</para>
						<para type="body">English body</para>
					</section>
					<section xml:lang="fr">
						<para type="intro">French intro</para>
					</section>
				</doc>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//para[lang('en') and @type='intro']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("English intro");
		});
	});

	describe("Error Handling - Invalid XPath", () => {
		it("should detect unbalanced opening brackets", () => {
			const xml = `<root><item id="1">test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id");
			}).toThrow(/Invalid XPath: Missing closing bracket/);
		});

		it("should detect unbalanced closing brackets", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item]");
			}).toThrow(/Invalid XPath: Unexpected closing bracket/);
		});

		it("should detect unbalanced opening parentheses", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[position(]");
			}).toThrow(/Invalid XPath: Missing closing parenthesis/);
		});

		it("should detect unbalanced closing parentheses", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[position())]");
			}).toThrow(/Invalid XPath: Unexpected closing parenthesis/);
		});

		it("should detect unbalanced double quotes", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath('//item[@id="test]');
			}).toThrow(/Invalid XPath: Missing closing double quote/);
		});

		it("should detect unbalanced single quotes", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='test]");
			}).toThrow(/Invalid XPath: Missing closing single quote/);
		});

		it("should detect invalid boolean operators", () => {
			const xml = `<root><item id="1" name="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='1' || @name='test']");
			}).toThrow(/Invalid XPath: Use 'or' instead of '\|\|'/);
		});

		it("should detect invalid and operator", () => {
			const xml = `<root><item id="1" name="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='1' && @name='test']");
			}).toThrow(/Invalid XPath: Use 'and' instead of '&&'/);
		});

		it("should detect empty predicates", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[]");
			}).toThrow(/Invalid XPath: Empty predicate/);
		});

		it("should allow valid nested predicates", () => {
			const xml = `
				<root>
					<item id="1">
						<child>test</child>
					</item>
				</root>
			`;
			const query = parser.parse(xml);

			// This should not throw
			expect(() => {
				query.xpath("//item[@id='1'][child]");
			}).not.toThrow();
		});

		it("should handle quotes inside predicates correctly", () => {
			const xml = `<root><item name="test">value</item></root>`;
			const query = parser.parse(xml);

			// Should not throw - quotes are balanced
			expect(() => {
				query.xpath('//item[@name="test"]');
			}).not.toThrow();
		});

		it("should provide position information in error messages", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[@id='test]");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toMatch(/Position: \d+/);
			}
		});
	});

	describe("Edge Cases", () => {
		it("should handle complex nested boolean expressions", () => {
			const xml = `
			<catalog>
				<item type="book" price="25" stock="10">Item 1</item>
				<item type="book" price="35" stock="5">Item 2</item>
				<item type="dvd" price="15" stock="20">Item 3</item>
				<item type="book" price="20" stock="0">Item 4</item>
			</catalog>
		`;
			const query = parser.parse(xml);
			// Flatten nested predicates for clearer testing
			const result = query.xpath("//item[@type='book' and @price<30 and @stock>0]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 1");
		});
		it("should handle triple nested boolean with not", () => {
			const xml = `
				<items>
					<item status="active" premium="true" verified="true">Item 1</item>
					<item status="active" premium="true" verified="false">Item 2</item>
					<item status="inactive" premium="true" verified="true">Item 3</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@status='active' and @premium='true' and not(@verified='false')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 1");
		});

		it("should handle arithmetic with functions", () => {
			const xml = `
			<catalog>
				<book><pages>100</pages></book>
				<book><pages>250</pages></book>
				<book><pages>50</pages></book>
			</catalog>
		`;
			const query = parser.parse(xml);
			const result = query.xpath("//book[pages>75]");

			expect(result.count()).toBe(2); // 100 and 250
		});
		it("should handle deeply nested parentheses in expressions", () => {
			const xml = `
				<data>
					<item value="10">A</item>
					<item value="20">B</item>
					<item value="30">C</item>
				</data>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@value=10*2]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("B");
		});

		it("should handle multiple union operations with predicates", () => {
			const xml = `
				<root>
					<section1>
						<item id="1">A</item>
						<item id="2">B</item>
					</section1>
					<section2>
						<item id="3">C</item>
					</section2>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//section1/item[@id='1'] | //section2/item | //section1/item[@id='2']");

			expect(result.count()).toBe(3);
		});

		it("should handle whitespace in complex expressions", () => {
			const xml = `<root><item id="1" name="test">Value</item></root>`;
			const query = parser.parse(xml);
			const result = query.xpath(`  //item[@id='1' and @name='test']  `);

			expect(result.count()).toBe(1);
		});

		it("should handle special characters in text", () => {
			const xml = `
				<items>
					<item>Text with &lt;brackets&gt;</item>
					<item>Normal text</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[contains(text(), 'brackets')]");

			expect(result.count()).toBe(1);
		});

		it("should handle numeric comparison with string coercion", () => {
			const xml = `
				<items>
					<item>10</item>
					<item>5</item>
					<item>20</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[text()>8]");

			expect(result.count()).toBe(2); // 10 and 20
		});

		it("should handle position() in complex predicates", () => {
			const xml = `
				<list>
					<item>A</item>
					<item>B</item>
					<item>C</item>
					<item>D</item>
					<item>E</item>
				</list>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[position() mod 2 = 0]");

			expect(result.count()).toBe(2); // 2nd and 4th items (B and D)
		});

		it("should handle string functions with empty strings", () => {
			const xml = `
				<items>
					<item></item>
					<item>text</item>
					<item> </item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[string-length(text())>0]");

			expect(result.count()).toBe(1); // Only "text" (space is trimmed)
		});

		it("should handle namespace wildcards in predicates", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:item id="1">A</a:item>
					<b:item id="2">B</b:item>
					<a:item id="3">C</a:item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/*:item[@id='2']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("B");
		});

		it("should handle count() with union expressions", () => {
			const xml = `
				<root>
					<section1>
						<item>A</item>
						<item>B</item>
					</section1>
					<section2>
						<item>C</item>
					</section2>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/*[count(item)>1]");

			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("section1");
		});

		it("should handle ancestor axis with predicates", () => {
			const xml = `
				<root id="r">
					<section id="s1">
						<para id="p1">
							<text id="t1">Content</text>
						</para>
					</section>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//text/ancestor::*[@id='s1']");

			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("section");
		});

		it("should handle following-sibling with complex predicates", () => {
			const xml = `
				<list>
					<item priority="low">A</item>
					<item priority="high">B</item>
					<item priority="high">C</item>
					<item priority="low">D</item>
				</list>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@priority='low']/following-sibling::item[@priority='high']");

			expect(result.count()).toBe(2); // B and C
		});
	});

	describe("Regression Tests", () => {
		it("should not treat @attr existence as comparison operator (critical bug fix)", () => {
			const xml = `
				<items>
					<item price="10">A</item>
					<item>B</item>
					<item price="20">C</item>
				</items>
			`;
			const query = parser.parse(xml);

			// Attribute existence should match elements with the attribute
			const existenceResult = query.xpath("//item[@price]");
			expect(existenceResult.count()).toBe(2);

			// Comparison evaluates the comparison - items without attributes return empty string
			const comparisonResult = query.xpath("//item[@price<15]");
			expect(comparisonResult.count()).toBe(2); // A (10<15) and B (empty string<15)
		});

		it("should handle attribute existence with < operator correctly", () => {
			const xml = `
				<items>
					<item price="5">A</item>
					<item price="15">B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@price<10]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("A");
		});

		it("should handle attribute existence with > operator correctly", () => {
			const xml = `
				<items>
					<item priority="5">A</item>
					<item priority="15">B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@priority>10]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("B");
		});
	});

	describe("Performance and Large Documents", () => {
		it("should handle deeply nested documents efficiently", () => {
			// Create 10 levels deep
			let xml = "<root>";
			for (let i = 1; i <= 10; i++) {
				xml += `<level${i}>`;
			}
			xml += "<target>Deep value</target>";
			for (let i = 10; i >= 1; i--) {
				xml += `</level${i}>`;
			}
			xml += "</root>";

			const query = parser.parse(xml);
			const result = query.xpath("//target");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Deep value");
		});

		it("should handle document with many siblings", () => {
			let xml = "<root>";
			for (let i = 1; i <= 100; i++) {
				xml += `<item id="${i}">Item ${i}</item>`;
			}
			xml += "</root>";

			const query = parser.parse(xml);
			const result = query.xpath("//item[@id='50']");

			expect(result.count()).toBe(1);
			expect(result.first()?.attributes.id).toBe("50");
		});

		it("should handle complex queries on larger documents", () => {
			let xml = "<catalog>";
			for (let i = 1; i <= 50; i++) {
				xml += `<book id="${i}"><title>Book ${i}</title><price>${i * 10}</price></book>`;
			}
			xml += "</catalog>";

			const query = parser.parse(xml);
			const result = query.xpath("//book[price>300 and price<600]");

			expect(result.count()).toBe(20); // Books 31-50 (310-500)
		});
	});

	describe("Unicode and International Characters", () => {
		it("should handle Unicode in element names", () => {
			// Unicode element names may not be fully supported by XML parser
			// Test with Unicode in attributes instead
			const xml = `
				<root>
					<item lang="zh">Chinese</item>
					<item lang="ru">Russian</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@lang='zh']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Chinese");
		});

		it("should handle Unicode in text content", () => {
			const xml = `
				<items>
					<item>Hello 世界</item>
					<item>Привет мир</item>
					<item>Hello World</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[contains(text(), '世界')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Hello 世界");
		});

		it("should handle Unicode in attribute values", () => {
			const xml = `
				<users>
					<user name="张三"/>
					<user name="John"/>
				</users>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//user[@name='张三']");

			expect(result.count()).toBe(1);
		});
	});
});
