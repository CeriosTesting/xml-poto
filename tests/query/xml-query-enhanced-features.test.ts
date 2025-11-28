import { describe, expect, it } from "vitest";
import { XmlQuery } from "../../src/query/xml-query";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("Enhanced XML Query Features", () => {
	describe("Namespace Support", () => {
		const parser = new XmlQueryParser();

		it("should parse and expose namespace URI from xmlns declarations", () => {
			const xml = `
				<root xmlns="http://example.com/default" xmlns:ns="http://example.com/ns">
					<child>Default namespace</child>
					<ns:child>Prefixed namespace</ns:child>
				</root>
			`;

			const query = parser.parse(xml);
			const root = query.first();

			expect(root?.xmlnsDeclarations).toBeDefined();
			expect(root?.xmlnsDeclarations?.default).toBe("http://example.com/default");
			expect(root?.xmlnsDeclarations?.ns).toBe("http://example.com/ns");
			expect(root?.namespaceUri).toBe("http://example.com/default");
		});

		it("should resolve namespace URI for prefixed elements", () => {
			const xml = `
				<root xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
					<soap:Envelope>
						<soap:Body>Content</soap:Body>
					</soap:Envelope>
				</root>
			`;

			const query = parser.parse(xml);
			const envelope = query.find("Envelope").first();

			expect(envelope?.prefix).toBe("soap");
			expect(envelope?.namespaceUri).toBe("http://schemas.xmlsoap.org/soap/envelope/");
			expect(envelope?.localName).toBe("Envelope");
		});

		it("should inherit namespace URI from parent", () => {
			const xml = `
				<root xmlns:app="http://myapp.com">
					<app:container>
						<app:item id="1">Item 1</app:item>
						<app:item id="2">Item 2</app:item>
					</app:container>
				</root>
			`;

			const query = parser.parse(xml);
			const items = query.find("item");

			for (const item of items.toArray()) {
				expect(item.namespaceUri).toBe("http://myapp.com");
				expect(item.prefix).toBe("app");
			}
		});

		it("should query by namespace URI", () => {
			const xml = `
				<root>
					<item xmlns="http://ns1.com">NS1</item>
					<item xmlns="http://ns2.com">NS2</item>
					<item>No NS</item>
				</root>
			`;

			const query = parser.parse(xml);
			const ns1Items = query.namespaceUri("http://ns1.com");
			const ns2Items = query.namespaceUri("http://ns2.com");

			expect(ns1Items.count()).toBe(1);
			expect(ns1Items.first()?.text).toBe("NS1");
			expect(ns2Items.count()).toBe(1);
			expect(ns2Items.first()?.text).toBe("NS2");
		});

		it("should query by local name", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:product>Product A</a:product>
					<b:product>Product B</b:product>
					<product>Product C</product>
				</root>
			`;

			const query = parser.parse(xml);
			const allProducts = query.localName("product");

			expect(allProducts.count()).toBe(3);
		});

		it("should resolve namespace from context", () => {
			const xml = `
				<root xmlns:ns="http://example.com">
					<ns:parent>
						<ns:child>Text</ns:child>
					</ns:parent>
				</root>
			`;

			const query = parser.parse(xml);
			const child = query.find("child");

			const resolvedUri = child.resolveNamespace("ns");
			expect(resolvedUri).toBe("http://example.com");
		});

		it("should filter elements with xmlns declarations", () => {
			const xml = `
				<root>
					<item xmlns="http://a.com">A</item>
					<item>B</item>
					<item xmlns="http://c.com">C</item>
				</root>
			`;

			const query = parser.parse(xml);
			const withDeclarations = query.hasXmlnsDeclarations();

			expect(withDeclarations.count()).toBe(2);
		});
	});

	describe("Sibling and Ancestor Navigation", () => {
		const parser = new XmlQueryParser();

		it("should navigate to siblings", () => {
			const xml = `
				<root>
					<item id="1">First</item>
					<item id="2">Second</item>
					<item id="3">Third</item>
				</root>
			`;

			const query = parser.parse(xml);
			const secondItem = query.find("item").whereAttribute("id", "2");
			const siblings = secondItem.siblings();

			expect(siblings.count()).toBe(2); // Excludes self
			expect(siblings.attributes("id")).toEqual(["1", "3"]);
		});

		it("should navigate to siblings by name", () => {
			const xml = `
				<root>
					<item>Item 1</item>
					<note>Note 1</note>
					<item>Item 2</item>
					<note>Note 2</note>
				</root>
			`;

			const query = parser.parse(xml);
			const firstItem = query.find("item").first();

			expect(firstItem).toBeDefined();
			const itemSiblings = firstItem?.siblings.filter(s => s.name === "item");

			expect(itemSiblings?.length).toBe(1);
			expect(itemSiblings?.[0].text).toBe("Item 2");
		});

		it("should include self with siblingsIncludingSelf", () => {
			const xml = `
				<root>
					<item>A</item>
					<item>B</item>
					<item>C</item>
				</root>
			`;

			const query = parser.parse(xml);
			const items = query.find("item");
			const secondItem = new XmlQuery([items.toArray()[1]]);
			const allSiblings = secondItem.siblingsIncludingSelf();

			expect(allSiblings.count()).toBe(3);
		});

		it("should navigate to next sibling", () => {
			const xml = `
				<root>
					<a>1</a>
					<b>2</b>
					<c>3</c>
				</root>
			`;

			const query = parser.parse(xml);
			const a = query.find("a");
			const next = a.nextSibling();

			expect(next.count()).toBe(1);
			expect(next.first()?.name).toBe("b");
		});

		it("should navigate to previous sibling", () => {
			const xml = `
				<root>
					<a>1</a>
					<b>2</b>
					<c>3</c>
				</root>
			`;

			const query = parser.parse(xml);
			const c = query.find("c");
			const prev = c.previousSibling();

			expect(prev.count()).toBe(1);
			expect(prev.first()?.name).toBe("b");
		});

		it("should navigate to all ancestors", () => {
			const xml = `
				<root>
					<level1>
						<level2>
							<level3>Deep</level3>
						</level2>
					</level1>
				</root>
			`;

			const query = parser.parse(xml);
			const level3 = query.find("level3");
			const ancestors = level3.ancestors();

			expect(ancestors.count()).toBe(3); // level2, level1, root
			const names = ancestors.toArray().map(a => a.name);
			expect(names).toContain("level2");
			expect(names).toContain("level1");
			expect(names).toContain("root");
		});

		it("should navigate to ancestors by name", () => {
			const xml = `
				<root>
					<section>
						<subsection>
							<paragraph>
								<text>Content</text>
							</paragraph>
						</subsection>
					</section>
				</root>
			`;

			const query = parser.parse(xml);
			const text = query.find("text");
			const sections = text.ancestorsNamed("section");

			expect(sections.count()).toBe(1);
			expect(sections.first()?.name).toBe("section");
		});

		it("should find closest ancestor by name", () => {
			const xml = `
				<div class="outer">
					<div class="middle">
						<div class="inner">
							<span>Text</span>
						</div>
					</div>
				</div>
			`;

			const query = parser.parse(xml);
			const span = query.find("span");
			const closestDiv = span.closest("div");

			expect(closestDiv.count()).toBe(1);
			expect(closestDiv.first()?.attributes.class).toBe("inner");
		});

		it("should find closest ancestor by predicate", () => {
			const xml = `
				<root>
					<container type="normal">
						<container type="special">
							<item>Content</item>
						</container>
					</container>
				</root>
			`;

			const query = parser.parse(xml);
			const item = query.find("item");
			const specialContainer = item.closestWhere(el => el.attributes.type === "special");

			expect(specialContainer.count()).toBe(1);
			expect(specialContainer.first()?.attributes.type).toBe("special");
		});

		it("should handle elements without siblings", () => {
			const xml = `<root><only>Lonely</only></root>`;

			const query = parser.parse(xml);
			const only = query.find("only");
			const siblings = only.siblings();

			expect(siblings.count()).toBe(0);
		});
	});

	describe("Mixed Content Support", () => {
		const parser = new XmlQueryParser();

		it("should capture text nodes in mixed content", () => {
			const xml = `
				<p>This is <em>emphasized</em> text with <strong>bold</strong> parts.</p>
			`;

			const query = parser.parse(xml);
			const p = query.find("p").first();

			expect(p?.textNodes).toBeDefined();
			expect(p?.textNodes?.length).toBeGreaterThan(0);
			expect(p?.children.length).toBe(2); // em and strong
		});

		it("should get all text from element and descendants", () => {
			const xml = `
				<div>
					<p>First paragraph.</p>
					<p>Second paragraph.</p>
				</div>
			`;

			const query = parser.parse(xml);
			const div = query.find("div");
			const allText = div.allText();

			expect(allText.length).toBe(1);
			expect(allText[0]).toContain("First paragraph");
			expect(allText[0]).toContain("Second paragraph");
		});

		it("should capture and retrieve comments", () => {
			const xml = `
				<root>
					<!-- This is a comment -->
					<item>Content</item>
					<!-- Another comment -->
				</root>
			`;

			const query = parser.parse(xml);
			const root = query.first();

			expect(root?.comments).toBeDefined();
			expect(root?.comments?.length).toBe(2);
			expect(root?.comments?.[0]).toContain("This is a comment");
			expect(root?.comments?.[1]).toContain("Another comment");
		});

		it("should filter elements with mixed content", () => {
			const xml = `
				<root>
					<pure>Pure element content</pure>
					<mixed>Text with <em>mixed</em> content</mixed>
					<empty></empty>
				</root>
			`;

			const query = parser.parse(xml);
			const mixedElements = query.hasMixedContent();

			expect(mixedElements.count()).toBe(1);
			expect(mixedElements.first()?.name).toBe("mixed");
		});

		it("should filter elements with comments", () => {
			const xml = `
				<root>
					<a><!-- Comment -->Content</a>
					<b>No comment</b>
					<c><!-- Another -->Data</c>
				</root>
			`;

			const query = parser.parse(xml);
			const withComments = query.hasComments();

			expect(withComments.count()).toBe(2);
		});

		it("should get all text nodes flattened", () => {
			const xml = `
				<root>
					<item>Text 1 <sub>Sub</sub> Text 2</item>
					<item>Text 3</item>
				</root>
			`;

			const query = parser.parse(xml);
			const items = query.find("item");
			const allTextNodes = items.allTextNodes();

			expect(allTextNodes.length).toBeGreaterThan(0);
		});

		it("should get all comments flattened", () => {
			const xml = `
				<root>
					<a><!-- Comment 1 -->A</a>
					<b><!-- Comment 2 -->B</b>
				</root>
			`;

			const query = parser.parse(xml);
			const children = query.find("a").parent().children();
			const allComments = children.allComments();

			expect(allComments.length).toBe(2);
		});

		it("should handle CDATA in mixed content", () => {
			const xml = `
				<content>
					Text before
					<![CDATA[<script>alert('test');</script>]]>
					Text after
				</content>
			`;

			const query = parser.parse(xml);
			const content = query.find("content").first();

			expect(content?.textNodes).toBeDefined();
			expect(content?.textNodes?.some(t => t.includes("<script>"))).toBe(true);
		});

		it("should preserve text node order in mixed content", () => {
			const xml = `<p>First <b>bold</b> middle <i>italic</i> last</p>`;

			const query = parser.parse(xml);
			const p = query.find("p").first();

			expect(p?.textNodes?.length).toBeGreaterThanOrEqual(3);
			if (p?.textNodes && p.textNodes.length >= 3) {
				expect(p.textNodes[0]).toContain("First");
				expect(p.textNodes[p.textNodes.length - 1]).toContain("last");
			}
		});

		it("should handle complex nested mixed content", () => {
			const xml = `
				<article>
					<section>
						<h1>Title</h1>
						<p>Intro text with <em>emphasis</em> and <a href="#">link</a>.</p>
						<!-- Section comment -->
					</section>
				</article>
			`;

			const query = parser.parse(xml);
			const section = query.find("section").first();

			expect(section?.comments).toBeDefined();
			expect(section?.comments?.length).toBe(1);

			const p = query.find("p").first();
			expect(p?.textNodes).toBeDefined();
			expect(p?.children.length).toBe(2); // em and a
		});
	});

	describe("Combined Feature Tests", () => {
		const parser = new XmlQueryParser();

		it("should combine namespace and sibling navigation", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:item>A1</a:item>
					<b:item>B1</b:item>
					<a:item>A2</a:item>
				</root>
			`;

			const query = parser.parse(xml);
			const root = query.first();
			expect(root?.children.length).toBe(3);

			const firstChild = root?.children[0];
			const secondChild = root?.children[1];

			expect(firstChild?.prefix).toBe("a");
			expect(secondChild?.prefix).toBe("b");
			expect(secondChild?.namespaceUri).toBe("http://b.com");
		});

		it("should combine ancestor navigation with namespace resolution", () => {
			const xml = `
				<root xmlns:app="http://myapp.com">
					<app:container>
						<app:item>
							<app:detail>Value</app:detail>
						</app:item>
					</app:container>
				</root>
			`;

			const query = parser.parse(xml);
			const detail = query.find("detail");
			const container = detail.closest("container");

			expect(container.count()).toBe(1);
			expect(container.first()?.namespaceUri).toBe("http://myapp.com");
		});

		it("should handle mixed content with namespaces", () => {
			const xml = `
				<root xmlns:html="http://www.w3.org/1999/xhtml">
					<html:p>Text with <html:em>emphasis</html:em> included.</html:p>
				</root>
			`;

			const query = parser.parse(xml);
			const p = query.namespaceUri("http://www.w3.org/1999/xhtml").findFirst("p").first();

			expect(p?.textNodes).toBeDefined();
			expect(p?.children.length).toBe(1);
			expect(p?.children[0].namespaceUri).toBe("http://www.w3.org/1999/xhtml");
		});

		it("should navigate complex hierarchies with all features", () => {
			const xml = `
				<doc xmlns="http://doc.com">
					<!-- Document start -->
					<section id="1">
						First section with <term>terminology</term>.
						<subsection>
							<para>Paragraph</para>
						</subsection>
					</section>
					<section id="2">
						<!-- Section 2 -->
						Second section
					</section>
				</doc>
			`;

			const query = parser.parse(xml);

			// Test namespace
			const doc = query.first();
			expect(doc?.namespaceUri).toBe("http://doc.com");

			// Test comments
			expect(doc?.comments?.length).toBe(1);

			// Test mixed content
			const section1 = query.find("section").first();
			expect(section1?.textNodes).toBeDefined();

			// Test sibling navigation
			const sections = query.find("section");
			expect(sections.count()).toBe(2);

			// Test ancestor navigation
			const para = query.find("para");
			const ancestors = para.ancestors();
			expect(ancestors.count()).toBe(3); // subsection, section, doc
		});
	});
});
