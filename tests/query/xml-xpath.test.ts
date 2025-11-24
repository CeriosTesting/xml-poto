import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Support", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("Basic Path Queries", () => {
		it("should query simple child path", () => {
			const xml = `
				<root>
					<child>Child Text</child>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/child");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Child Text");
		});

		it("should query nested path", () => {
			const xml = `
				<catalog>
					<book>
						<title>Book 1</title>
					</book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/catalog/book/title");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Book 1");
		});

		it("should query multiple matching elements", () => {
			const xml = `
				<catalog>
					<book><title>Book 1</title></book>
					<book><title>Book 2</title></book>
					<book><title>Book 3</title></book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/catalog/book");

			expect(result.count()).toBe(3);
		});

		it("should handle relative paths", () => {
			const xml = `
				<root>
					<section>
						<item>Item 1</item>
						<item>Item 2</item>
					</section>
				</root>
			`;
			const query = parser.parse(xml);
			const section = query.find("section");
			const result = section.xpath("item");

			expect(result.count()).toBe(2);
		});

		it("should use xpathFirst for convenience", () => {
			const xml = `
				<root>
					<child id="1">First</child>
					<child id="2">Second</child>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpathFirst("/root/child");

			expect(result?.text).toBe("First");
		});
	});

	describe("Descendant-or-Self Axis (//)", () => {
		it("should find all descendants with //", () => {
			const xml = `
				<root>
					<section>
						<item>Item 1</item>
					</section>
					<item>Item 2</item>
					<container>
						<item>Item 3</item>
					</container>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item");

			expect(result.count()).toBe(3);
		});

		it("should combine // with path", () => {
			const xml = `
				<root>
					<section>
						<book><title>Title 1</title></book>
					</section>
					<library>
						<book><title>Title 2</title></book>
						<archive>
							<book><title>Title 3</title></book>
						</archive>
					</library>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//book/title");

			expect(result.count()).toBe(3);
		});

		it("should use // from absolute path", () => {
			const xml = `
				<catalog>
					<section>
						<book>Book 1</book>
					</section>
					<book>Book 2</book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/catalog//book");

			expect(result.count()).toBe(2);
		});
	});

	describe("Wildcards", () => {
		it("should match all children with *", () => {
			const xml = `
				<root>
					<book>Book 1</book>
					<magazine>Magazine 1</magazine>
					<newspaper>News 1</newspaper>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/*");

			expect(result.count()).toBe(3);
		});

		it("should use * in middle of path", () => {
			const xml = `
				<root>
					<section>
						<item>Item 1</item>
					</section>
					<category>
						<item>Item 2</item>
					</category>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/*/item");

			expect(result.count()).toBe(2);
		});
	});

	describe("Position Predicates", () => {
		it("should select by numeric position", () => {
			const xml = `
				<root>
					<item>Item 1</item>
					<item>Item 2</item>
					<item>Item 3</item>
				</root>
			`;
			const query = parser.parse(xml);

			expect(query.xpath("/root/item[1]").first()?.text).toBe("Item 1");
			expect(query.xpath("/root/item[2]").first()?.text).toBe("Item 2");
			expect(query.xpath("/root/item[3]").first()?.text).toBe("Item 3");
		});

		it("should select last element", () => {
			const xml = `
				<root>
					<item>First</item>
					<item>Middle</item>
					<item>Last</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[last()]");

			expect(result.first()?.text).toBe("Last");
		});

		it("should handle out-of-range positions", () => {
			const xml = `
				<root>
					<item>Item 1</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[5]");

			expect(result.count()).toBe(0);
		});
	});

	describe("Attribute Predicates", () => {
		it("should filter by attribute existence", () => {
			const xml = `
				<root>
					<item id="1">Item 1</item>
					<item>Item 2</item>
					<item id="3">Item 3</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[@id]");

			expect(result.count()).toBe(2);
		});

		it("should filter by attribute value", () => {
			const xml = `
				<catalog>
					<book id="1" category="fiction">Book 1</book>
					<book id="2" category="science">Book 2</book>
					<book id="3" category="fiction">Book 3</book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/catalog/book[@category='fiction']");

			expect(result.count()).toBe(2);
			expect(result.toArray()[0].text).toBe("Book 1");
			expect(result.toArray()[1].text).toBe("Book 3");
		});

		it("should filter by attribute with double quotes", () => {
			const xml = `
				<root>
					<item type="A">Item A</item>
					<item type="B">Item B</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath('/root/item[@type="A"]');

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item A");
		});

		it("should filter by numeric attribute comparison", () => {
			const xml = `
				<catalog>
					<book id="1"><price>25</price></book>
					<book id="2"><price>35</price></book>
					<book id="3"><price>15</price></book>
				</catalog>
			`;
			const query = parser.parse(xml);

			const under30 = query.xpath("//book[price<30]");
			expect(under30.count()).toBe(2);

			const over20 = query.xpath("//book[price>20]");
			expect(over20.count()).toBe(2);
		});
	});

	describe("Comparison Operators", () => {
		it("should use equality operator", () => {
			const xml = `
				<catalog>
					<book><title>XML Guide</title></book>
					<book><title>JSON Guide</title></book>
					<book><title>XML Guide</title></book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//book[title='XML Guide']");

			expect(result.count()).toBe(2);
		});

		it("should use inequality operator", () => {
			const xml = `
				<root>
					<item status="active">Item 1</item>
					<item status="inactive">Item 2</item>
					<item status="active">Item 3</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[@status!='active']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 2");
		});

		it("should use less than operator", () => {
			const xml = `
				<products>
					<product><price>10</price></product>
					<product><price>25</price></product>
					<product><price>50</price></product>
				</products>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//product[price<30]");

			expect(result.count()).toBe(2);
		});

		it("should use greater than operator", () => {
			const xml = `
				<products>
					<product><stock>5</stock></product>
					<product><stock>15</stock></product>
					<product><stock>25</stock></product>
				</products>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//product[stock>10]");

			expect(result.count()).toBe(2);
		});

		it("should use less than or equal operator", () => {
			const xml = `
				<items>
					<item><qty>10</qty></item>
					<item><qty>20</qty></item>
					<item><qty>30</qty></item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[qty<=20]");

			expect(result.count()).toBe(2);
		});

		it("should use greater than or equal operator", () => {
			const xml = `
				<items>
					<item><value>100</value></item>
					<item><value>200</value></item>
					<item><value>150</value></item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[value>=150]");

			expect(result.count()).toBe(2);
		});
	});

	describe("Functions", () => {
		it("should use text() function", () => {
			const xml = `
				<root>
					<item>Apple</item>
					<item>Banana</item>
					<item>Apple</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[text()='Apple']");

			expect(result.count()).toBe(2);
		});

		it("should use count() function", () => {
			const xml = `
				<library>
					<book><chapter>Ch 1</chapter><chapter>Ch 2</chapter></book>
					<book><chapter>Ch 1</chapter></book>
					<book><chapter>Ch 1</chapter><chapter>Ch 2</chapter><chapter>Ch 3</chapter></book>
				</library>
			`;
			const query = parser.parse(xml);

			const twoChapters = query.xpath("//book[count(chapter)=2]");
			expect(twoChapters.count()).toBe(1);

			const threeChapters = query.xpath("//book[count(chapter)=3]");
			expect(threeChapters.count()).toBe(1);
		});

		it("should use position() function", () => {
			const xml = `
				<root>
					<item>Item 1</item>
					<item>Item 2</item>
					<item>Item 3</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[position()=2]");

			expect(result.first()?.text).toBe("Item 2");
		});
	});

	describe("Axes", () => {
		it("should handle self axis (.)", () => {
			const xml = `
				<root>
					<child>Text</child>
				</root>
			`;
			const query = parser.parse(xml);
			const child = query.find("child");
			const result = child.xpath(".");

			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("child");
		});

		it("should handle parent axis (..)", () => {
			const xml = `
				<root>
					<parent>
						<child>Text</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const child = query.find("child");
			const result = child.xpath("..");

			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("parent");
		});

		it("should handle following-sibling axis with wildcard", () => {
			const xml = `
				<root>
					<item>First</item>
					<item>Second</item>
					<item>Third</item>
					<item>Fourth</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[2]/following-sibling::*");

			expect(result.count()).toBe(2);
			const texts = result.toArray().map((e: any) => e.text);
			expect(texts).toEqual(["Third", "Fourth"]);
		});

		it("should handle following-sibling axis with node test", () => {
			const xml = `
				<root>
					<item>First</item>
					<note>A note</note>
					<item>Second</item>
					<note>Another note</note>
					<item>Third</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[1]/following-sibling::item");

			expect(result.count()).toBe(2);
			const texts = result.toArray().map((e: any) => e.text);
			expect(texts).toEqual(["Second", "Third"]);
		});

		it("should handle preceding-sibling axis with wildcard", () => {
			const xml = `
				<root>
					<item>First</item>
					<item>Second</item>
					<item>Third</item>
					<item>Fourth</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[3]/preceding-sibling::*");

			expect(result.count()).toBe(2);
			const texts = result.toArray().map((e: any) => e.text);
			expect(texts).toEqual(["First", "Second"]);
		});

		it("should handle preceding-sibling axis with node test", () => {
			const xml = `
				<root>
					<item>First</item>
					<note>A note</note>
					<item>Second</item>
					<note>Another note</note>
					<item>Third</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[3]/preceding-sibling::item");

			expect(result.count()).toBe(2);
			const texts = result.toArray().map((e: any) => e.text);
			expect(texts).toEqual(["First", "Second"]);
		});

		it("should combine sibling axes with predicates", () => {
			const xml = `
				<root>
					<item id="1">First</item>
					<item id="2">Second</item>
					<item id="3">Third</item>
					<item id="4">Fourth</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[2]/following-sibling::item[@id='4']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Fourth");
		});

		it("should handle sibling axes from absolute paths", () => {
			const xml = `
				<root>
					<section>
						<item>A</item>
						<item>B</item>
						<item>C</item>
					</section>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/section/item[1]/following-sibling::*");

			expect(result.count()).toBe(2);
			const texts = result.toArray().map((e: any) => e.text);
			expect(texts).toEqual(["B", "C"]);
		});
	});

	describe("Namespaces", () => {
		it("should query namespaced elements", () => {
			const xml = `
				<root xmlns:bk="http://books.com">
					<bk:book>Book 1</bk:book>
					<bk:book>Book 2</bk:book>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/bk:book");

			expect(result.count()).toBe(2);
		});

		it("should handle namespace wildcards", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:item>Item A</a:item>
					<b:item>Item B</b:item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/*:item");

			expect(result.count()).toBe(2);
		});
	});

	describe("Complex Queries", () => {
		it("should combine multiple features", () => {
			const xml = `
				<library>
					<section name="fiction">
						<book id="1"><title>Book 1</title><price>25</price></book>
						<book id="2"><title>Book 2</title><price>35</price></book>
					</section>
					<section name="science">
						<book id="3"><title>Book 3</title><price>15</price></book>
						<book id="4"><title>Book 4</title><price>45</price></book>
					</section>
				</library>
			`;
			const query = parser.parse(xml);

			// Find books under $30 in any section
			const affordable = query.xpath("//section/book[price<30]");
			expect(affordable.count()).toBe(2);

			// Find first book in fiction section
			const firstFiction = query.xpathFirst("/library/section[@name='fiction']/book[1]");
			expect(firstFiction?.attributes.id).toBe("1");

			// Find sections with more than 1 book
			const populous = query.xpath("//section[count(book)>1]");
			expect(populous.count()).toBe(2);
		});

		it("should handle real-world SOAP example", () => {
			const xml = `
				<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
					<soap:Header>
						<auth:Authentication xmlns:auth="http://example.com/auth">
							<auth:User>admin</auth:User>
							<auth:Token>abc123</auth:Token>
						</auth:Authentication>
					</soap:Header>
					<soap:Body>
						<m:GetUserRequest xmlns:m="http://example.com/api">
							<m:UserId>123</m:UserId>
						</m:GetUserRequest>
					</soap:Body>
				</soap:Envelope>
			`;
			const query = parser.parse(xml);

			// Get user from authentication
			const user = query.xpathFirst("//auth:User");
			expect(user?.text).toBe("admin");

			// Get user ID from request
			const userId = query.xpathFirst("//m:UserId");
			expect(userId?.text).toBe("123");

			// Find all Body children
			const bodyChildren = query.xpath("//soap:Body/*");
			expect(bodyChildren.count()).toBe(1);
		});

		it("should work with RSS feed structure", () => {
			const xml = `
				<rss version="2.0">
					<channel>
						<title>News Feed</title>
						<item><title>Article 1</title><pubDate>2024-01-01</pubDate></item>
						<item><title>Article 2</title><pubDate>2024-01-02</pubDate></item>
						<item><title>Article 3</title><pubDate>2024-01-03</pubDate></item>
					</channel>
				</rss>
			`;
			const query = parser.parse(xml);

			// Get all article titles
			const titles = query.xpath("//item/title");
			expect(titles.count()).toBe(3);

			// Get first article
			const firstArticle = query.xpathFirst("//channel/item[1]");
			expect(firstArticle?.children[0].text).toBe("Article 1");

			// Get last article
			const lastArticle = query.xpathFirst("//channel/item[last()]");
			expect(lastArticle?.children[0].text).toBe("Article 3");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty result sets", () => {
			const xml = `<root><child>Text</child></root>`;
			const query = parser.parse(xml);
			const result = query.xpath("//nonexistent");

			expect(result.count()).toBe(0);
			expect(result.first()).toBeUndefined();
		});

		it("should handle root-only query", () => {
			const xml = `<root>Text</root>`;
			const query = parser.parse(xml);
			const result = query.xpath("/");

			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("root");
		});

		it("should handle deeply nested paths", () => {
			const xml = `
				<level1>
					<level2>
						<level3>
							<level4>
								<level5>Deep</level5>
							</level4>
						</level3>
					</level2>
				</level1>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/level1/level2/level3/level4/level5");

			expect(result.first()?.text).toBe("Deep");
		});

		it("should handle predicates with no matches", () => {
			const xml = `
				<root>
					<item id="1">Item 1</item>
					<item id="2">Item 2</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/item[@id='999']");

			expect(result.count()).toBe(0);
		});

		it("should handle empty string expressions", () => {
			const xml = `<root><child>Text</child></root>`;
			const query = parser.parse(xml);
			const result = query.xpath("");

			expect(result.count()).toBe(0);
		});

		it("should handle whitespace in expressions", () => {
			const xml = `<root><child id="1">Text</child></root>`;
			const query = parser.parse(xml);
			const result = query.xpath("  /root/child[@id='1']  ");

			expect(result.count()).toBe(1);
		});
	});

	describe("Performance with Large Documents", () => {
		it("should efficiently query large document", () => {
			// Create a document with 100 items
			let xml = "<catalog>";
			for (let i = 1; i <= 100; i++) {
				xml += `<item id="${i}"><name>Item ${i}</name><price>${i * 10}</price></item>`;
			}
			xml += "</catalog>";

			const query = parser.parse(xml);

			// Find specific items
			const item50 = query.xpathFirst("//item[@id='50']");
			expect(item50?.attributes.id).toBe("50");

			// Find items with price > 500
			const expensive = query.xpath("//item[price>500]");
			expect(expensive.count()).toBe(50); // Items 51-100

			// Use descendant axis
			const allNames = query.xpath("//name");
			expect(allNames.count()).toBe(100);
		});
	});

	describe("Extended String Functions", () => {
		describe("contains() function", () => {
			it("should filter elements containing substring", () => {
				const xml = `
					<catalog>
						<book><title>JavaScript Guide</title></book>
						<book><title>TypeScript Handbook</title></book>
						<book><title>Python Basics</title></book>
						<book><title>Java Fundamentals</title></book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[contains(title, 'Script')]");

				expect(result.count()).toBe(2);
				const titles = result.first()?.children.filter(c => c.name === "title");
				expect(titles?.[0]?.text).toBe("JavaScript Guide");
			});

			it("should work with attribute values", () => {
				const xml = `
					<catalog>
						<book category="programming">Book 1</book>
						<book category="fiction">Book 2</book>
						<book category="programming-advanced">Book 3</book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[contains(@category, 'programming')]");

				expect(result.count()).toBe(2);
			});

			it("should work with text() function", () => {
				const xml = `
					<library>
						<book>Learning JavaScript</book>
						<book>Mastering Python</book>
						<book>JavaScript Patterns</book>
					</library>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[contains(text(), 'JavaScript')]");

				expect(result.count()).toBe(2);
			});
		});

		describe("starts-with() function", () => {
			it("should filter elements starting with prefix", () => {
				const xml = `
					<catalog>
						<book><isbn>978-1234567890</isbn></book>
						<book><isbn>979-1234567890</isbn></book>
						<book><isbn>978-0987654321</isbn></book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[starts-with(isbn, '978')]");

				expect(result.count()).toBe(2);
			});

			it("should work with attribute values", () => {
				const xml = `
					<files>
						<file name="test_one.js"/>
						<file name="prod_two.js"/>
						<file name="test_three.js"/>
					</files>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//file[starts-with(@name, 'test')]");

				expect(result.count()).toBe(2);
			});
		});

		describe("string-length() function", () => {
			it("should filter by string length", () => {
				const xml = `
					<words>
						<word>cat</word>
						<word>dog</word>
						<word>elephant</word>
						<word>ant</word>
					</words>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//word[string-length(text())=3]");

				expect(result.count()).toBe(3); // cat, dog, ant
			});

			it("should compare string lengths", () => {
				const xml = `
					<names>
						<name>Jo</name>
						<name>John</name>
						<name>Jonathan</name>
					</names>
				`;
				const query = parser.parse(xml);
				const longNames = query.xpath("//name[string-length(text())>4]");

				expect(longNames.count()).toBe(1); // Jonathan (8 chars, John is exactly 4)
			});

			it("should work with attribute values", () => {
				const xml = `
					<users>
						<user id="AB"/>
						<user id="ABCD"/>
						<user id="ABCDEF"/>
					</users>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//user[string-length(@id)=4]");

				expect(result.count()).toBe(1);
			});
		});

		describe("substring() function", () => {
			it("should extract substring with start and length", () => {
				const xml = `
					<data>
						<code>ABCD1234</code>
					</data>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//code[substring(text(), 1, 4)='ABCD']");

				expect(result.count()).toBe(1);
			});

			it("should extract substring from start to end", () => {
				const xml = `
					<items>
						<item>2024-01-15</item>
						<item>2024-02-20</item>
					</items>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//item[substring(text(), 6, 2)='01']");

				expect(result.count()).toBe(1);
			});
		});

		describe("concat() function", () => {
			it("should concatenate strings", () => {
				const xml = `
					<person>
						<first>John</first>
						<last>Doe</last>
					</person>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//person[concat(first, ' ', last)='John Doe']");

				expect(result.count()).toBe(1);
			});

			it("should work with multiple values", () => {
				const xml = `
					<product>
						<code>A</code>
						<number>123</number>
					</product>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//product[concat(code, '-', number)='A-123']");

				expect(result.count()).toBe(1);
			});
		});

		describe("normalize-space() function", () => {
			it("should normalize whitespace", () => {
				const xml = `
					<data>
						<text>  Hello   World  </text>
						<text>Hello World</text>
					</data>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//text[normalize-space(text())='Hello World']");

				expect(result.count()).toBe(2);
			});

			it("should trim and collapse spaces", () => {
				const xml = `
					<items>
						<item>
							Multiple
							Lines
						</item>
					</items>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//item[contains(normalize-space(text()), 'Multiple Lines')]");

				expect(result.count()).toBe(1);
			});
		});

		describe("translate() function", () => {
			it("should translate characters", () => {
				const xml = `
					<data>
						<text>HELLO</text>
						<text>WORLD</text>
					</data>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//text[translate(text(), 'HELLO', 'hello')='hello']");

				expect(result.count()).toBe(1);
			});

			it("should remove characters when to-chars is shorter", () => {
				const xml = `
					<codes>
						<code>ABC-123</code>
						<code>XYZ-456</code>
					</codes>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//code[translate(text(), '-', '')='ABC123']");

				expect(result.count()).toBe(1);
			});
		});
	});

	describe("Boolean Operators", () => {
		describe("and operator", () => {
			it("should combine multiple conditions with AND", () => {
				const xml = `
					<catalog>
						<book category="fiction" year="2020">Book 1</book>
						<book category="fiction" year="2021">Book 2</book>
						<book category="tech" year="2020">Book 3</book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[@category='fiction' and @year='2020']");

				expect(result.count()).toBe(1);
				expect(result.first()?.text).toBe("Book 1");
			});

			it("should work with function calls", () => {
				const xml = `
					<products>
						<item><name>Laptop</name><price>1000</price></item>
						<item><name>Mouse</name><price>25</price></item>
						<item><name>Keyboard</name><price>75</price></item>
					</products>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//item[price>50 and contains(name, 'board')]");

				expect(result.count()).toBe(1);
				const names = result.first()?.children.filter(c => c.name === "name");
				expect(names?.[0]?.text).toBe("Keyboard");
			});
		});

		describe("or operator", () => {
			it("should combine multiple conditions with OR", () => {
				const xml = `
					<catalog>
						<book category="fiction">Book 1</book>
						<book category="tech">Book 2</book>
						<book category="history">Book 3</book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[@category='fiction' or @category='history']");

				expect(result.count()).toBe(2);
			});

			it("should work with numeric comparisons", () => {
				const xml = `
					<numbers>
						<num>5</num>
						<num>15</num>
						<num>25</num>
						<num>50</num>
					</numbers>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//num[text()<10 or text()>40]");

				expect(result.count()).toBe(2); // 5 and 50
			});
		});

		describe("not() operator", () => {
			it("should negate a condition", () => {
				const xml = `
					<catalog>
						<book status="available">Book 1</book>
						<book status="sold">Book 2</book>
						<book status="available">Book 3</book>
					</catalog>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//book[not(@status='sold')]");

				expect(result.count()).toBe(2);
			});

			it("should work with contains()", () => {
				const xml = `
					<files>
						<file>document.pdf</file>
						<file>image.png</file>
						<file>text.pdf</file>
					</files>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//file[not(contains(text(), 'pdf'))]");

				expect(result.count()).toBe(1);
				expect(result.first()?.text).toBe("image.png");
			});
		});

		describe("combined boolean operators", () => {
			it("should handle complex boolean expressions", () => {
				const xml = `
					<products>
						<item type="book" price="20">Item 1</item>
						<item type="book" price="30">Item 2</item>
						<item type="dvd" price="15">Item 3</item>
					</products>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//item[@type='book' and @price<25]");

				expect(result.count()).toBe(1); // Item 1 only
			});

			it("should handle nested not() with and/or", () => {
				const xml = `
					<users>
						<user role="admin" active="true">User 1</user>
						<user role="user" active="true">User 2</user>
						<user role="admin" active="false">User 3</user>
						<user role="user" active="false">User 4</user>
					</users>
				`;
				const query = parser.parse(xml);
				const result = query.xpath("//user[@role='admin' and not(@active='false')]");

				expect(result.count()).toBe(1);
				expect(result.first()?.text).toBe("User 1");
			});
		});
	});

	describe("Union Operator", () => {
		it("should combine results from multiple paths", () => {
			const xml = `
				<library>
					<books>
						<book>Book 1</book>
						<book>Book 2</book>
					</books>
					<magazines>
						<magazine>Mag 1</magazine>
					</magazines>
				</library>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//book | //magazine");

			expect(result.count()).toBe(3);
		});

		it("should eliminate duplicates", () => {
			const xml = `
				<catalog>
					<book id="1">Book 1</book>
					<book id="2">Book 2</book>
				</catalog>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//book | //book[@id='1']");

			expect(result.count()).toBe(2); // Not 3
		});

		it("should work with complex paths", () => {
			const xml = `
				<store>
					<electronics>
						<phone>Phone 1</phone>
						<laptop>Laptop 1</laptop>
					</electronics>
					<books>
						<book>Book 1</book>
					</books>
				</store>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//electronics/* | //books/*");

			expect(result.count()).toBe(3);
		});

		it("should work with predicates", () => {
			const xml = `
				<inventory>
					<item type="A" price="100">Item 1</item>
					<item type="B" price="200">Item 2</item>
					<item type="A" price="300">Item 3</item>
					<item type="C" price="150">Item 4</item>
				</inventory>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@type='A'] | //item[@price>150]");

			expect(result.count()).toBe(3); // Item 1, Item 2, Item 3
		});

		it("should handle multiple unions", () => {
			const xml = `
				<data>
					<section1><item>A</item></section1>
					<section2><item>B</item></section2>
					<section3><item>C</item></section3>
				</data>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//section1/item | //section2/item | //section3/item");

			expect(result.count()).toBe(3);
		});
	});

	describe("Arithmetic Operators", () => {
		it("should handle addition", () => {
			const xml = `
				<math>
					<value>10</value>
				</math>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//value[text()=5+5]");

			expect(result.count()).toBe(1);
		});

		it("should handle subtraction", () => {
			const xml = `
				<items>
					<item price="15">Item 1</item>
					<item price="20">Item 2</item>
					<item price="25">Item 3</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@price=30-5]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 3");
		});

		it("should handle multiplication", () => {
			const xml = `
				<products>
					<product quantity="3" price="10">Product 1</product>
					<product quantity="5" price="6">Product 2</product>
				</products>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//product[@quantity*@price=30]");

			expect(result.count()).toBe(2);
		});

		it("should handle division with div operator", () => {
			const xml = `
				<data>
					<value>20</value>
					<value>40</value>
					<value>60</value>
				</data>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//value[text()=100 div 5]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("20");
		});

		it("should handle modulo with mod operator", () => {
			const xml = `
				<numbers>
					<num>1</num>
					<num>2</num>
					<num>3</num>
					<num>4</num>
					<num>5</num>
				</numbers>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//num[text() mod 2=1]");

			expect(result.count()).toBe(3); // 1, 3, 5
		});

		it("should handle operator precedence", () => {
			const xml = `
				<calc>
					<result>14</result>
				</calc>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//result[text()=2+3*4]");

			expect(result.count()).toBe(1); // 2 + (3 * 4) = 14
		});

		it("should handle complex arithmetic", () => {
			const xml = `
				<items>
					<item base="100" discount="10" tax="5">Item 1</item>
					<item base="200" discount="20" tax="10">Item 2</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[@base-@discount+@tax=95]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 1"); // 100 - 10 + 5 = 95
		});

		it("should handle arithmetic in position predicates", () => {
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
			const result = query.xpath("//item[position()=2+1]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("C");
		});
	});

	describe("Additional Number Functions", () => {
		it("should calculate sum of values", () => {
			const xml = `
				<cart>
					<item price="10">Item 1</item>
					<item price="20">Item 2</item>
					<item price="30">Item 3</item>
				</cart>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//cart[sum(item/@price)=60]");

			expect(result.count()).toBe(1);
		});

		it("should calculate sum with text nodes", () => {
			const xml = `
				<numbers>
					<num>5</num>
					<num>10</num>
					<num>15</num>
				</numbers>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//numbers[sum(num)=30]");

			expect(result.count()).toBe(1);
		});

		it("should convert string to number", () => {
			const xml = `
				<data>
					<value>42.5</value>
				</data>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//value[number(text())>40]");

			expect(result.count()).toBe(1);
		});

		it("should round numbers", () => {
			const xml = `
				<values>
					<val>2.4</val>
					<val>2.5</val>
					<val>2.6</val>
				</values>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//val[round(text())=3]");

			expect(result.count()).toBe(2); // 2.5 and 2.6 round to 3
		});

		it("should floor numbers", () => {
			const xml = `
				<values>
					<val>2.1</val>
					<val>2.9</val>
				</values>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//val[floor(text())=2]");

			expect(result.count()).toBe(2); // Both floor to 2
		});

		it("should ceiling numbers", () => {
			const xml = `
				<values>
					<val>2.1</val>
					<val>2.9</val>
				</values>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//val[ceiling(text())=3]");

			expect(result.count()).toBe(2); // Both ceiling to 3
		});
	});

	describe("Additional String Functions", () => {
		it("should extract substring before delimiter", () => {
			const xml = `
				<emails>
					<email>john@example.com</email>
					<email>jane@test.org</email>
				</emails>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//email[substring-before(text(),'@')='john']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("john@example.com");
		});

		it("should extract substring after delimiter", () => {
			const xml = `
				<emails>
					<email>user@example.com</email>
					<email>admin@test.org</email>
				</emails>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//email[substring-after(text(),'@')='example.com']");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("user@example.com");
		});

		it("should return empty string when delimiter not found", () => {
			const xml = `
				<items>
					<item>no-delimiter</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[substring-before(text(),'@')='']");

			expect(result.count()).toBe(1);
		});
	});

	describe("Boolean Functions", () => {
		it("should use true() literal", () => {
			const xml = `
				<items>
					<item>A</item>
					<item>B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[true()]");

			expect(result.count()).toBe(2); // All items match
		});

		it("should use false() literal", () => {
			const xml = `
				<items>
					<item>A</item>
					<item>B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[false()]");

			expect(result.count()).toBe(0); // No items match
		});

		it("should convert to boolean with boolean()", () => {
			const xml = `
				<items>
					<item value="">Empty</item>
					<item value="0">Zero</item>
					<item value="1">One</item>
					<item value="text">Text</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[boolean(@value)]");

			expect(result.count()).toBe(3); // "0", "1" and "text" are truthy (non-empty strings)
		});
	});

	describe("Additional Axes", () => {
		it("should use child:: axis explicitly", () => {
			const xml = `
				<root>
					<parent>
						<child>A</child>
						<child>B</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/parent/child::child");

			expect(result.count()).toBe(2);
		});

		it("should use descendant:: axis", () => {
			const xml = `
				<root>
					<level1>
						<level2>
							<item>Deep</item>
						</level2>
						<item>Mid</item>
					</level1>
					<item>Top</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/descendant::item");

			expect(result.count()).toBe(3); // All items at any depth
		});

		it("should use ancestor:: axis", () => {
			const xml = `
				<root id="r">
					<parent id="p">
						<child id="c">
							<grandchild id="gc">Text</grandchild>
						</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//grandchild/ancestor::*");

			expect(result.count()).toBe(3); // child, parent, root
		});

		it("should use ancestor-or-self:: axis", () => {
			const xml = `
				<root>
					<parent>
						<child>Text</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//child/ancestor-or-self::*");

			expect(result.count()).toBe(3); // child (self), parent, root
		});

		it("should use descendant-or-self:: axis", () => {
			const xml = `
				<root>
					<parent>
						<child>Text</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("/root/descendant-or-self::*");

			expect(result.count()).toBe(3); // root, parent, child
		});

		it("should use following:: axis", () => {
			const xml = `
				<root>
					<section1>
						<data>A</data>
					</section1>
					<item>B</item>
					<item>C</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//section1/following::item");

			expect(result.count()).toBe(2); // B and C come after section1
		});

		it("should use preceding:: axis", () => {
			const xml = `
				<root>
					<section1>
						<item>A</item>
					</section1>
					<section2>
						<item>B</item>
					</section2>
					<section3>
						<item>C</item>
					</section3>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//section3/preceding::item");

			expect(result.count()).toBe(2); // A and B come before section3
		});

		it("should use parent:: axis explicitly", () => {
			const xml = `
				<root>
					<parent name="p1">
						<child>A</child>
					</parent>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//child/parent::parent");

			expect(result.count()).toBe(1);
			expect(result.first()?.attributes.name).toBe("p1");
		});

		it("should use self:: axis explicitly", () => {
			const xml = `
				<root>
					<item>Text</item>
				</root>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item/self::item");

			expect(result.count()).toBe(1);
		});
	});
});
