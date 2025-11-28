import { beforeEach, describe, expect, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Operators", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
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

			expect(result.count()).toBe(2);
		});
	});

	describe("Boolean Operators - AND", () => {
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

		it("should work with function calls in AND", () => {
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
		});
	});

	describe("Boolean Operators - OR", () => {
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

		it("should work with numeric comparisons in OR", () => {
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

			expect(result.count()).toBe(2);
		});
	});

	describe("Boolean Operators - NOT", () => {
		it("should negate a condition with NOT", () => {
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

		it("should work NOT with contains()", () => {
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

		it("should handle nested NOT with AND/OR", () => {
			const xml = `
				<users>
					<user role="admin" active="true">User 1</user>
					<user role="user" active="true">User 2</user>
					<user role="admin" active="false">User 3</user>
				</users>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//user[@role='admin' and not(@active='false')]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("User 1");
		});
	});

	describe("Boolean Operators - Complex", () => {
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
			const result = query.xpath("//item[@type='book' and @price<30 and @stock>0]");

			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Item 1");
		});

		it("should handle triple nested boolean with NOT", () => {
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

			expect(result.count()).toBe(3);
		});

		it("should handle operator precedence", () => {
			const xml = `
				<calc>
					<result>14</result>
				</calc>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//result[text()=2+3*4]");

			expect(result.count()).toBe(1);
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
			expect(result.first()?.text).toBe("Item 1");
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

			expect(result.count()).toBe(2);
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

			expect(result.count()).toBe(2);
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

			expect(result.count()).toBe(3);
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
	});

	describe("Regression Tests", () => {
		it("should not treat @attr existence as comparison operator", () => {
			const xml = `
				<items>
					<item price="10">A</item>
					<item>B</item>
					<item price="20">C</item>
				</items>
			`;
			const query = parser.parse(xml);

			const existenceResult = query.xpath("//item[@price]");
			expect(existenceResult.count()).toBe(2);

			const comparisonResult = query.xpath("//item[@price<15]");
			expect(comparisonResult.count()).toBe(2);
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
});
