import { beforeEach, describe, expect, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Advanced Features", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
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

			const affordable = query.xpath("//section/book[price<30]");
			expect(affordable.count()).toBe(2);

			const firstFiction = query.xpathFirst("/library/section[@name='fiction']/book[1]");
			expect(firstFiction?.attributes.id).toBe("1");

			const populous = query.xpath("//section[count(book)>1]");
			expect(populous.count()).toBe(2);
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

		it("should work in complex lang() expressions", () => {
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

	describe("Real-World Examples", () => {
		it("should handle SOAP envelope", () => {
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

			const user = query.xpathFirst("//auth:User");
			expect(user?.text).toBe("admin");

			const userId = query.xpathFirst("//m:UserId");
			expect(userId?.text).toBe("123");

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

			const titles = query.xpath("//item/title");
			expect(titles.count()).toBe(3);

			const firstArticle = query.xpathFirst("//channel/item[1]");
			expect(firstArticle?.children[0].text).toBe("Article 1");

			const lastArticle = query.xpathFirst("//channel/item[last()]");
			expect(lastArticle?.children[0].text).toBe("Article 3");
		});
	});

	describe("Unicode and International Characters", () => {
		it("should handle Unicode in attributes", () => {
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
