import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Numeric Functions", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("count() function", () => {
		it("should count child elements", () => {
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

		it("should work with union expressions", () => {
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
	});

	describe("position() function", () => {
		it("should filter by position", () => {
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

		it("should work with modulo for even positions", () => {
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

			expect(result.count()).toBe(2);
		});
	});

	describe("last() function", () => {
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
	});

	describe("sum() function", () => {
		it("should calculate sum of attribute values", () => {
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
	});

	describe("number() function", () => {
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
	});

	describe("round() function", () => {
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

			expect(result.count()).toBe(2);
		});
	});

	describe("floor() function", () => {
		it("should floor numbers", () => {
			const xml = `
				<values>
					<val>2.1</val>
					<val>2.9</val>
				</values>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//val[floor(text())=2]");

			expect(result.count()).toBe(2);
		});
	});

	describe("ceiling() function", () => {
		it("should ceiling numbers", () => {
			const xml = `
				<values>
					<val>2.1</val>
					<val>2.9</val>
				</values>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//val[ceiling(text())=3]");

			expect(result.count()).toBe(2);
		});
	});
});
