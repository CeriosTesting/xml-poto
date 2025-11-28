import { describe, expect, it } from "@jest/globals";
import { DynamicElement, XmlArray, XmlAttribute, XmlDecoratorSerializer, XmlDynamic, XmlElement } from "../../src";

/**
 * Helper function to extract namespace URIs from a queryable element
 * (Similar to the user's extractNamespaces function)
 */
function extractNamespaces(query: DynamicElement, excludeNamespaces: string[] = []): Map<string, string> {
	const namespaces = new Map<string, string>();
	if (!query.xmlnsDeclarations) return namespaces;
	const excluded = new Set(excludeNamespaces);
	for (const [prefix, uri] of Object.entries(query.xmlnsDeclarations)) {
		if (!excluded.has(prefix)) {
			namespaces.set(prefix, uri);
		}
	}
	return namespaces;
}
describe("XmlDynamic with Namespace Declarations", () => {
	const serializer = new XmlDecoratorSerializer();
	describe("xmlnsDeclarations property", () => {
		@XmlElement("document")
		class SimpleDocument {
			@XmlAttribute() title?: string;
			@XmlDynamic()
			query!: DynamicElement;
		}
		it("should populate xmlnsDeclarations on DynamicElement", () => {
			const xml = `
                <document
                    xmlns:ns1="http://example.com/ns1"
                    xmlns:ns2="http://example.com/ns2"
                    title="Test Doc">
                    <ns1:child>Content</ns1:child>
                </document>
            `;
			const doc = serializer.fromXml(xml, SimpleDocument);
			expect(doc.query).toBeDefined();
			expect(doc.query.xmlnsDeclarations).toBeDefined();
			expect(doc.query.xmlnsDeclarations).toEqual({
				ns1: "http://example.com/ns1",
				ns2: "http://example.com/ns2",
			});
		});
		it("should keep xmlns in attributes for backward compatibility", () => {
			const xml = `
                <document
                    xmlns:ns1="http://example.com/ns1"
                    xmlns:ns2="http://example.com/ns2">
                </document>
            `;
			const doc = serializer.fromXml(xml, SimpleDocument);
			expect(doc.query.attributes).toEqual({
				"xmlns:ns1": "http://example.com/ns1",
				"xmlns:ns2": "http://example.com/ns2",
			});
		});
		it("should handle default namespace (xmlns)", () => {
			const xml = `
                <document
                    xmlns="http://example.com/default"
                    xmlns:ns1="http://example.com/ns1">
                </document>
            `;
			const doc = serializer.fromXml(xml, SimpleDocument);
			expect(doc.query.xmlnsDeclarations).toEqual({
				"": "http://example.com/default",
				ns1: "http://example.com/ns1",
			});
		});
		it("should return undefined xmlnsDeclarations when no namespaces present", () => {
			const xml = `<document title="No NS"></document>`;
			const doc = serializer.fromXml(xml, SimpleDocument);
			expect(doc.query).toBeDefined();
			expect(doc.query.xmlnsDeclarations).toBeUndefined();
		});
	});
	describe("extractNamespaces helper function", () => {
		@XmlElement("root")
		class DocumentWithNamespaces {
			@XmlDynamic()
			query!: DynamicElement;
		}
		it("should extract all namespaces", () => {
			const xml = `
                <root
                    xmlns:ns1="http://example.com/ns1"
                    xmlns:ns2="http://example.com/ns2"
                    xmlns:ns3="http://example.com/ns3">
                </root>
            `;
			const doc = serializer.fromXml(xml, DocumentWithNamespaces);
			const namespaces = extractNamespaces(doc.query);
			expect(namespaces.size).toBe(3);
			expect(namespaces.get("ns1")).toBe("http://example.com/ns1");
			expect(namespaces.get("ns2")).toBe("http://example.com/ns2");
			expect(namespaces.get("ns3")).toBe("http://example.com/ns3");
		});
		it("should exclude specified namespaces", () => {
			const xml = `
                <root
                    xmlns:ns1="http://example.com/ns1"
                    xmlns:ns2="http://example.com/ns2"
                    xmlns:exclude="http://example.com/exclude">
                </root>
            `;
			const doc = serializer.fromXml(xml, DocumentWithNamespaces);
			const namespaces = extractNamespaces(doc.query, ["exclude", "ns2"]);
			expect(namespaces.size).toBe(1);
			expect(namespaces.get("ns1")).toBe("http://example.com/ns1");
			expect(namespaces.has("ns2")).toBe(false);
			expect(namespaces.has("exclude")).toBe(false);
		});
		it("should return empty map when no xmlnsDeclarations", () => {
			const xml = `<root></root>`;
			const doc = serializer.fromXml(xml, DocumentWithNamespaces);
			const namespaces = extractNamespaces(doc.query);
			expect(namespaces.size).toBe(0);
		});
	});
	describe("XBRL-like scenario (real-world use case)", () => {
		@XmlElement("xbrli:context")
		class XBRLContext {
			@XmlAttribute() id?: string;
		}
		@XmlElement("xbrli:unit")
		class XBRLUnit {
			@XmlAttribute() id?: string;
		}
		@XmlElement("xbrli:xbrl")
		class XBRLRoot {
			@XmlArray({ itemName: "xbrli:context", type: XBRLContext })
			contexts: XBRLContext[] = [];
			@XmlArray({ itemName: "xbrli:unit", type: XBRLUnit })
			units: XBRLUnit[] = [];
			@XmlDynamic()
			query!: DynamicElement;
		}
		@XmlElement("document")
		class XBRLDocument {
			@XmlElement({ name: "xbrli:xbrl", type: XBRLRoot })
			xbrl!: XBRLRoot;
		}
		it("should handle XBRL document with multiple namespaces", () => {
			const xml = `
                <document>
                    <xbrli:xbrl
                        xmlns:xbrli="http://www.xbrl.org/2003/instance"
                        xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
                        xmlns:custom="http://example.com/custom">
                        <xbrli:context id="ctx1"></xbrli:context>
                        <xbrli:unit id="u1"></xbrli:unit>
                        <custom:DataPoint>Value1</custom:DataPoint>
                        <custom:DataPoint2>Value2</custom:DataPoint2>
                    </xbrli:xbrl>
                </document>
            `;
			const doc = serializer.fromXml(xml, XBRLDocument);
			expect(doc.xbrl).toBeDefined();
			expect(doc.xbrl.query).toBeDefined();
			expect(doc.xbrl.query.xmlnsDeclarations).toBeDefined();
			expect(doc.xbrl.query.xmlnsDeclarations).toEqual({
				xbrli: "http://www.xbrl.org/2003/instance",
				iso4217: "http://www.xbrl.org/2003/iso4217",
				custom: "http://example.com/custom",
			});
		});
		it("should extract non-xbrli namespaces for datapoints", () => {
			const xml = `
                <document>
                    <xbrli:xbrl
                        xmlns:xbrli="http://www.xbrl.org/2003/instance"
                        xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
                        xmlns:pwc-vt="urn:pwc-vt:types"
                        xmlns:nl-cd="http://www.nltaxonomie.nl/nt17/sbr/20220301/dictionary/nl-common-data">
                        <xbrli:context id="ctx1"></xbrli:context>
                        <pwc-vt:EntitySeller contextRef="ctx1">Seller Name</pwc-vt:EntitySeller>
                        <nl-cd:PropertyAddress contextRef="ctx1">123 Main St</nl-cd:PropertyAddress>
                    </xbrli:xbrl>
                </document>
            `;
			const doc = serializer.fromXml(xml, XBRLDocument);
			// Extract namespaces excluding xbrli (as user does)
			const namespaces = extractNamespaces(doc.xbrl.query, ["xbrli"]);
			expect(namespaces.size).toBe(3);
			expect(namespaces.has("xbrli")).toBe(false);
			expect(namespaces.get("iso4217")).toBe("http://www.xbrl.org/2003/iso4217");
			expect(namespaces.get("pwc-vt")).toBe("urn:pwc-vt:types");
			expect(namespaces.get("nl-cd")).toBe("http://www.nltaxonomie.nl/nt17/sbr/20220301/dictionary/nl-common-data");
		});
		it("should allow querying child elements with namespaces", () => {
			const xml = `
                <document>
                    <xbrli:xbrl
                        xmlns:xbrli="http://www.xbrl.org/2003/instance"
                        xmlns:custom="http://example.com/custom">
                        <xbrli:context id="ctx1"></xbrli:context>
                        <custom:DataPoint contextRef="ctx1">Value1</custom:DataPoint>
                        <custom:DataPoint2 contextRef="ctx1">Value2</custom:DataPoint2>
                    </xbrli:xbrl>
                </document>
            `;
			const doc = serializer.fromXml(xml, XBRLDocument);
			const query = doc.xbrl.query;
			// Query should have children
			expect(query.children.length).toBeGreaterThan(0);
			// Find children with custom namespace
			const customChildren = query.children.filter(child => child.name.startsWith("custom:"));
			expect(customChildren.length).toBe(2);
			expect(customChildren[0].name).toBe("custom:DataPoint");
			expect(customChildren[0].text).toBe("Value1");
			expect(customChildren[0].attributes.contextRef).toBe("ctx1");
		});
	});
	describe("XmlDynamic with @XmlElement class decorator", () => {
		// Test that the workaround (PENDING_QUERYABLES_SYMBOL) works
		@XmlElement("testRoot")
		class TestClass {
			@XmlAttribute() id?: string;
			@XmlDynamic()
			query!: DynamicElement;
		}
		it("should create query property via class decorator workaround", () => {
			const xml = `
                <testRoot id="123" xmlns:test="http://test.com">
                    <child>Content</child>
                </testRoot>
            `;
			const result = serializer.fromXml(xml, TestClass);
			expect(result).toBeDefined();
			expect(result.id).toBe("123");
			expect(result.query).toBeDefined();
			expect(result.query.name).toBe("testRoot");
			expect(result.query.children.length).toBe(1);
			expect(result.query.xmlnsDeclarations).toEqual({
				test: "http://test.com",
			});
		});
		it("should cache query results when cache is enabled", () => {
			const xml = `<testRoot><child>Test</child></testRoot>`;
			const result = serializer.fromXml(xml, TestClass);
			const query1 = result.query;
			const query2 = result.query;
			// Should be the same instance (cached)
			expect(query1).toBe(query2);
		});
	});
	describe("Multiple @XmlDynamic properties", () => {
		@XmlElement("item")
		class Item {
			@XmlAttribute() name?: string;
		}
		@XmlElement("container")
		class Container {
			@XmlElement({ name: "item", type: Item })
			item!: Item;
			@XmlDynamic()
			rootQuery!: DynamicElement;
			@XmlDynamic({ targetProperty: "item" })
			itemQuery?: DynamicElement;
		}
		it("should support multiple queryable properties on same class", () => {
			const xml = `
                <container xmlns:ns1="http://example.com/ns1">
                    <item name="test" xmlns:ns2="http://example.com/ns2">
                        <subitem>Value</subitem>
                    </item>
                </container>
            `;
			const result = serializer.fromXml(xml, Container);
			expect(result.rootQuery).toBeDefined();
			expect(result.rootQuery.name).toBe("container");
			expect(result.rootQuery.xmlnsDeclarations).toEqual({
				ns1: "http://example.com/ns1",
			});
			expect(result.itemQuery).toBeDefined();
			expect(result.itemQuery?.name).toBe("item");
			expect(result.itemQuery?.xmlnsDeclarations).toEqual({
				ns2: "http://example.com/ns2",
			});
		});
	});
	describe("Edge cases", () => {
		@XmlElement("edge")
		class EdgeCase {
			@XmlDynamic()
			query!: DynamicElement;
		}
		it("should handle elements with no namespaces gracefully", () => {
			const xml = `<edge><child>Test</child></edge>`;
			const result = serializer.fromXml(xml, EdgeCase);
			expect(result.query).toBeDefined();
			expect(result.query.xmlnsDeclarations).toBeUndefined();
			expect(extractNamespaces(result.query).size).toBe(0);
		});
		it("should handle empty elements with namespaces", () => {
			const xml = `<edge xmlns:test="http://test.com"></edge>`;
			const result = serializer.fromXml(xml, EdgeCase);
			expect(result.query).toBeDefined();
			expect(result.query.xmlnsDeclarations).toEqual({
				test: "http://test.com",
			});
			expect(result.query.children.length).toBe(0);
		});
		it("should handle many namespaces", () => {
			const xml = `
                <edge
                    xmlns:ns1="http://example.com/ns1"
                    xmlns:ns2="http://example.com/ns2"
                    xmlns:ns3="http://example.com/ns3"
                    xmlns:ns4="http://example.com/ns4"
                    xmlns:ns5="http://example.com/ns5"
                    xmlns:ns6="http://example.com/ns6"
                    xmlns:ns7="http://example.com/ns7"
                    xmlns:ns8="http://example.com/ns8"
                    xmlns:ns9="http://example.com/ns9"
                    xmlns:ns10="http://example.com/ns10">
                </edge>
            `;
			const result = serializer.fromXml(xml, EdgeCase);
			if (!result.query.xmlnsDeclarations) throw new Error("xmlnsDeclarations is undefined");
			expect(Object.keys(result.query.xmlnsDeclarations).length).toBe(10);
			expect(extractNamespaces(result.query).size).toBe(10);
		});
	});
});
