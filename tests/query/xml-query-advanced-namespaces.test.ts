import { describe, expect, it } from "@jest/globals";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("Advanced Namespace Features", () => {
	const parser = new XmlQueryParser();

	describe("Default Namespace Support", () => {
		it("should query elements in default namespace", () => {
			const xml = `
				<root xmlns="http://default.com">
					<item>Item 1</item>
					<item>Item 2</item>
				</root>
			`;

			const query = parser.parse(xml);
			const defaultNsElements = query.defaultNamespace();

			expect(defaultNsElements.count()).toBeGreaterThan(0);

			// Root and items should all be in default namespace
			const root = query.first();
			expect(root?.namespaceUri).toBe("http://default.com");
			expect(root?.prefix).toBeUndefined(); // No prefix for default namespace
		});

		it("should get default namespace URI from context", () => {
			const xml = `
				<root xmlns="http://default.com">
					<item>Content</item>
				</root>
			`;

			const query = parser.parse(xml);
			const item = query.find("item");

			expect(item.getDefaultNamespace()).toBe("http://default.com");
		});

		it("should handle nested default namespace changes", () => {
			const xml = `
				<root xmlns="http://ns1.com">
					<item>In NS1</item>
					<container xmlns="http://ns2.com">
						<item>In NS2</item>
					</container>
				</root>
			`;

			const query = parser.parse(xml);
			const items = query.find("item").toArray();

			expect(items.length).toBe(2);
			expect(items[0].namespaceUri).toBe("http://ns1.com");
			expect(items[1].namespaceUri).toBe("http://ns2.com");
		});
	});

	describe("Namespace Prefix Discovery", () => {
		it("should get all namespace prefixes in context", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:item xmlns:c="http://c.com">
						<b:child />
					</a:item>
				</root>
			`;

			const query = parser.parse(xml);
			const item = query.find("item");

			const prefixes = item.getNamespacePrefixes();

			expect(prefixes).toContain("a");
			expect(prefixes).toContain("b");
			expect(prefixes).toContain("c");
		});

		it("should get namespace mappings", () => {
			const xml = `
				<root xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
					<soap:Envelope>
						<soap:Body />
					</soap:Envelope>
				</root>
			`;

			const query = parser.parse(xml);
			const envelope = query.find("Envelope");

			const mappings = envelope.getNamespaceMappings();

			expect(mappings.soap).toBe("http://schemas.xmlsoap.org/soap/envelope/");
			expect(mappings.xsi).toBe("http://www.w3.org/2001/XMLSchema-instance");
		});

		it("should get prefix for namespace URI", () => {
			const xml = `
				<root xmlns:myapp="http://myapp.com">
					<myapp:item></myapp:item>
				</root>
			`;

			const query = parser.parse(xml);
			const item = query.find("item");

			const prefix = item.getPrefixForNamespace("http://myapp.com");
			expect(prefix).toBe("myapp");
		});

		it("should return undefined for unknown namespace URI", () => {
			const xml = `<root xmlns:a="http://a.com"><item /></root>`;

			const query = parser.parse(xml);
			const item = query.find("item");

			const prefix = item.getPrefixForNamespace("http://unknown.com");
			expect(prefix).toBeUndefined();
		});
	});

	describe("Namespace-Aware Querying", () => {
		it("should query by namespace URI and local name", () => {
			const xml = `
				<root xmlns:a="http://a.com" xmlns:b="http://b.com">
					<a:item>A1</a:item>
					<b:item>B1</b:item>
					<a:item>A2</a:item>
				</root>
			`;

			const query = parser.parse(xml);
			const aItems = query.inNamespace("http://a.com", "item");
			const bItems = query.inNamespace("http://b.com", "item");

			expect(aItems.count()).toBe(2);
			expect(bItems.count()).toBe(1);
			expect(aItems.texts()).toEqual(["A1", "A2"]);
			expect(bItems.texts()).toEqual(["B1"]);
		});

		it("should distinguish elements with same local name but different namespaces", () => {
			const xml = `
				<root>
					<item xmlns="http://ns1.com">NS1 Item</item>
					<item xmlns="http://ns2.com">NS2 Item</item>
					<item>No NS Item</item>
				</root>
			`;

			const query = parser.parse(xml);

			const ns1Items = query.inNamespace("http://ns1.com", "item");
			const ns2Items = query.inNamespace("http://ns2.com", "item");

			expect(ns1Items.count()).toBe(1);
			expect(ns2Items.count()).toBe(1);
			expect(ns1Items.first()?.text).toBe("NS1 Item");
			expect(ns2Items.first()?.text).toBe("NS2 Item");
		});
	});

	describe("Namespace Context and Aliases", () => {
		it("should create namespace context with aliases", () => {
			const xml = `
				<root xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
					<soap:Envelope>
						<soap:Header>
							<soap:Action>Test</soap:Action>
						</soap:Header>
						<soap:Body>
							<soap:Data>Content</soap:Data>
						</soap:Body>
					</soap:Envelope>
				</root>
			`;

			const query = parser.parse(xml);
			const ns = query.withNamespaces({
				s: "http://schemas.xmlsoap.org/soap/envelope/",
			});

			const envelope = ns.find("s:Envelope");
			expect(envelope.count()).toBe(1);

			const body = ns.find("s:Body");
			expect(body.count()).toBe(1);

			const action = ns.find("s:Action");
			expect(action.first()?.text).toBe("Test");
		});

		it("should query by namespace alias", () => {
			const xml = `
				<root xmlns:app="http://myapp.com">
					<app:users>
						<app:user>Alice</app:user>
						<app:user>Bob</app:user>
					</app:users>
				</root>
			`;

			const query = parser.parse(xml);
			const ns = query.withNamespaces({ a: "http://myapp.com" });

			const users = ns.namespace("a");
			expect(users.count()).toBeGreaterThan(0);
		});

		it("should find first element with namespace alias", () => {
			const xml = `
				<root xmlns:x="http://example.com">
					<x:item>First</x:item>
					<x:item>Second</x:item>
				</root>
			`;

			const query = parser.parse(xml);
			const ns = query.withNamespaces({ ex: "http://example.com" });

			const first = ns.findFirst("ex:item");
			expect(first.count()).toBe(1);
			expect(first.first()?.text).toBe("First");
		});

		it("should resolve alias to URI", () => {
			const query = parser.parse("<root />");
			const ns = query.withNamespaces({
				soap: "http://schemas.xmlsoap.org/soap/envelope/",
				xsi: "http://www.w3.org/2001/XMLSchema-instance",
			});

			expect(ns.resolve("soap")).toBe("http://schemas.xmlsoap.org/soap/envelope/");
			expect(ns.resolve("xsi")).toBe("http://www.w3.org/2001/XMLSchema-instance");
			expect(ns.resolve("unknown")).toBeUndefined();
		});

		it("should get all defined aliases", () => {
			const query = parser.parse("<root />");
			const ns = query.withNamespaces({
				a: "http://a.com",
				b: "http://b.com",
				c: "http://c.com",
			});

			const aliases = ns.getAliases();
			expect(aliases).toContain("a");
			expect(aliases).toContain("b");
			expect(aliases).toContain("c");
			expect(aliases.length).toBe(3);
		});

		it("should add new alias to context", () => {
			const query = parser.parse("<root />");
			const ns1 = query.withNamespaces({ a: "http://a.com" });
			const ns2 = ns1.withAlias("b", "http://b.com");

			expect(ns1.getAliases()).toEqual(["a"]);
			expect(ns2.getAliases()).toHaveLength(2);
			expect(ns2.getAliases()).toContain("a");
			expect(ns2.getAliases()).toContain("b");
		});

		it("should remove alias from context", () => {
			const query = parser.parse("<root />");
			const ns1 = query.withNamespaces({
				a: "http://a.com",
				b: "http://b.com",
			});
			const ns2 = ns1.withoutAlias("a");

			expect(ns1.getAliases()).toHaveLength(2);
			expect(ns2.getAliases()).toEqual(["b"]);
		});

		it("should throw error for unknown alias in find", () => {
			const xml = `<root xmlns:a="http://a.com"><a:item /></root>`;
			const query = parser.parse(xml);
			const ns = query.withNamespaces({ x: "http://x.com" });

			expect(() => ns.find("unknown:item")).toThrow("Unknown namespace alias: unknown");
		});

		it("should handle unprefixed names in namespace context", () => {
			const xml = `
				<root xmlns:a="http://a.com">
					<a:item>A</a:item>
					<item>B</item>
				</root>
			`;

			const query = parser.parse(xml);
			const ns = query.withNamespaces({ a: "http://a.com" });

			// Should find prefixed items
			const prefixedItems = ns.find("a:item");
			expect(prefixedItems.count()).toBe(1);

			// Should find all items by local name
			const unprefixedItems = ns.find("item");
			expect(unprefixedItems.count()).toBe(2); // Both items have local name "item"
		});
	});

	describe("Complex Namespace Scenarios", () => {
		it("should handle multiple namespace declarations on same element", () => {
			const xml = `
				<root
					xmlns="http://default.com"
					xmlns:a="http://a.com"
					xmlns:b="http://b.com"
					xmlns:c="http://c.com">
					<item>Default</item>
					<a:item>A</a:item>
					<b:item>B</b:item>
					<c:item>C</c:item>
				</root>
			`;

			const query = parser.parse(xml);

			const mappings = query.getNamespaceMappings();
			expect(mappings[""]).toBe("http://default.com");
			expect(mappings.a).toBe("http://a.com");
			expect(mappings.b).toBe("http://b.com");
			expect(mappings.c).toBe("http://c.com");
		});

		it("should handle namespace inheritance with overrides", () => {
			const xml = `
				<root xmlns:x="http://v1.com">
					<x:item>V1</x:item>
					<container xmlns:x="http://v2.com">
						<x:item>V2</x:item>
					</container>
				</root>
			`;

			const query = parser.parse(xml);
			const items = query.find("item").toArray();

			expect(items[0].namespaceUri).toBe("http://v1.com");
			expect(items[1].namespaceUri).toBe("http://v2.com");
		});

		it("should query across namespace boundaries", () => {
			const xml = `
				<root>
					<data xmlns="http://data.com">
						<record id="1">Data 1</record>
						<record id="2">Data 2</record>
					</data>
					<metadata xmlns="http://meta.com">
						<record id="A">Meta A</record>
					</metadata>
				</root>
			`;

			const query = parser.parse(xml);

			// All records regardless of namespace
			const allRecords = query.find("record");
			expect(allRecords.count()).toBe(3);

			// Records in specific namespace
			const dataRecords = query.inNamespace("http://data.com", "record");
			const metaRecords = query.inNamespace("http://meta.com", "record");

			expect(dataRecords.count()).toBe(2);
			expect(metaRecords.count()).toBe(1);
		});

		it("should work with real-world SOAP example", () => {
			const xml = `
				<soap:Envelope
					xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
					xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
					<soap:Header>
						<soap:Authentication>
							<soap:Username>admin</soap:Username>
							<soap:Password>secret</soap:Password>
						</soap:Authentication>
					</soap:Header>
					<soap:Body>
						<GetUserRequest xmlns="http://example.com/api">
							<UserId xsi:type="xsd:int">12345</UserId>
						</GetUserRequest>
					</soap:Body>
				</soap:Envelope>
			`;

			const query = parser.parse(xml);
			const ns = query.withNamespaces({
				soap: "http://schemas.xmlsoap.org/soap/envelope/",
				api: "http://example.com/api",
			});

			const envelope = ns.find("soap:Envelope");
			expect(envelope.count()).toBe(1);

			const username = ns.find("soap:Username");
			expect(username.first()?.text).toBe("admin");

			const request = ns.find("api:GetUserRequest");
			expect(request.count()).toBe(1);

			// UserId is in default namespace within Body
			const userId = query.find("UserId");
			expect(userId.first()?.text).toBe("12345");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty namespace declarations", () => {
			const xml = `<root xmlns=""><item>No namespace</item></root>`;

			const query = parser.parse(xml);
			const root = query.first();

			// Empty namespace means no namespace
			expect(root?.namespaceUri).toBeUndefined();
		});

		it("should handle missing namespace prefix", () => {
			const xml = `<root><item>Text</item></root>`;

			const query = parser.parse(xml);
			const prefixes = query.getNamespacePrefixes();

			expect(prefixes).toEqual([]);
		});

		it("should handle namespace query on empty results", () => {
			const query = parser.parse("<root />");
			const empty = query.find("nonexistent");

			expect(empty.getNamespacePrefixes()).toEqual([]);
			expect(empty.getNamespaceMappings()).toEqual({});
			expect(empty.getDefaultNamespace()).toBeUndefined();
		});

		it("should handle multiple default namespace declarations", () => {
			const xml = `
				<root xmlns="http://outer.com">
					<outer>Outer NS</outer>
					<middle xmlns="http://middle.com">
						<inner>Middle NS</inner>
					</middle>
				</root>
			`;

			const query = parser.parse(xml);

			const outer = query.find("outer").first();
			const inner = query.find("inner").first();

			expect(outer?.namespaceUri).toBe("http://outer.com");
			expect(inner?.namespaceUri).toBe("http://middle.com");
		});
	});
});
