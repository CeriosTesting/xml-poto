import { beforeEach, describe, expect, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Core Features", () => {
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

		it("should handle empty result sets", () => {
			const xml = `<root><child>Text</child></root>`;
			const query = parser.parse(xml);
			const result = query.xpath("//nonexistent");

			expect(result.count()).toBe(0);
			expect(result.first()).toBeUndefined();
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

			expect(result.count()).toBe(3);
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

			expect(result.count()).toBe(3);
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

			expect(result.count()).toBe(3);
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

			expect(result.count()).toBe(3);
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

			expect(result.count()).toBe(2);
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

			expect(result.count()).toBe(2);
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

	describe("Edge Cases", () => {
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
});
