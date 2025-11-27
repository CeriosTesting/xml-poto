import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Performance Tests", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("Large Documents", () => {
		it("should efficiently query large document with 100 items", () => {
			let xml = "<catalog>";
			for (let i = 1; i <= 100; i++) {
				xml += `<item id="${i}"><name>Item ${i}</name><price>${i * 10}</price></item>`;
			}
			xml += "</catalog>";

			const query = parser.parse(xml);

			const item50 = query.xpathFirst("//item[@id='50']");
			expect(item50?.attributes.id).toBe("50");

			const expensive = query.xpath("//item[price>500]");
			expect(expensive.count()).toBe(50);

			const allNames = query.xpath("//name");
			expect(allNames.count()).toBe(100);
		});

		it("should handle deeply nested documents efficiently", () => {
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

			expect(result.count()).toBe(20);
		});
	});
});
