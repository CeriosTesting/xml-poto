import { beforeEach, describe, expect, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Predicates", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
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

	describe("Complex Predicates", () => {
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

			expect(result.count()).toBe(2);
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

		it("should handle whitespace in complex expressions", () => {
			const xml = `<root><item id="1" name="test">Value</item></root>`;
			const query = parser.parse(xml);
			const result = query.xpath(`  //item[@id='1' and @name='test']  `);

			expect(result.count()).toBe(1);
		});
	});
});
