import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Boolean Functions", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("true() function", () => {
		it("should match all elements", () => {
			const xml = `
				<items>
					<item>A</item>
					<item>B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[true()]");

			expect(result.count()).toBe(2);
		});
	});

	describe("false() function", () => {
		it("should match no elements", () => {
			const xml = `
				<items>
					<item>A</item>
					<item>B</item>
				</items>
			`;
			const query = parser.parse(xml);
			const result = query.xpath("//item[false()]");

			expect(result.count()).toBe(0);
		});
	});

	describe("boolean() function", () => {
		it("should convert values to boolean", () => {
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

			expect(result.count()).toBe(3);
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

			expect(result.count()).toBe(2);
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

			expect(result.count()).toBe(0);
		});
	});
});
