import { beforeEach, describe, expect, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath String Functions", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("text() function", () => {
		it("should filter by text content", () => {
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
	});

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

		it("should handle special characters", () => {
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

		it("should work with empty suffix", () => {
			const xml = `
				<items>
					<item>test</item>
					<item>example</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[ends-with(text(), '')]");

			expect(result.count()).toBe(2);
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

			expect(result.count()).toBe(3);
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

			expect(longNames.count()).toBe(1);
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

		it("should work with empty strings", () => {
			const xml = `
				<items>
					<item></item>
					<item>text</item>
					<item> </item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[string-length(text())>0]");

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

		it("should extract substring from date", () => {
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

	describe("substring-before() function", () => {
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

	describe("substring-after() function", () => {
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
		});
	});
});
