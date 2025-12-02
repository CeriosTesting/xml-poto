import { beforeEach, describe, expect, it } from "vitest";
import { XmlArray } from "../../src/decorators/xml-array";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlNamespaceUtil } from "../../src/utils/xml-namespace-util";

describe("XmlNamespaceUtil", () => {
	let util: XmlNamespaceUtil;

	beforeEach(() => {
		util = new XmlNamespaceUtil();
	});

	describe("buildElementName", () => {
		it("should return plain name when no namespace", () => {
			const metadata: any = { name: "Element", required: false };

			const result = util.buildElementName(metadata);

			expect(result).toBe("Element");
		});

		it("should return prefixed name when namespace has prefix", () => {
			const metadata: any = {
				name: "Element",
				namespaces: [{ uri: "http://example.com", prefix: "ex" }],
				required: false,
			};

			const result = util.buildElementName(metadata);

			expect(result).toBe("ex:Element");
		});

		it("should return plain name for default namespace", () => {
			const metadata: any = {
				name: "Element",
				namespaces: [{ uri: "http://example.com", isDefault: true }],
				required: false,
			};

			const result = util.buildElementName(metadata);

			expect(result).toBe("Element");
		});

		it("should return plain name when namespace has no prefix", () => {
			const metadata: any = {
				name: "Element",
				namespaces: [{ uri: "http://example.com" }],
				required: false,
			};

			const result = util.buildElementName(metadata);

			expect(result).toBe("Element");
		});
	});

	describe("buildAttributeName", () => {
		it("should return plain name when no namespace", () => {
			const metadata = { name: "attr" };

			const result = util.buildAttributeName(metadata);

			expect(result).toBe("attr");
		});

		it("should return prefixed name when namespace has prefix", () => {
			const metadata = {
				name: "attr",
				namespaces: [{ uri: "http://example.com", prefix: "ex" }],
			};

			const result = util.buildAttributeName(metadata);

			expect(result).toBe("ex:attr");
		});

		it("should not prefix for default namespace", () => {
			const metadata = {
				name: "attr",
				namespaces: [{ uri: "http://example.com", isDefault: true }],
			};

			const result = util.buildAttributeName(metadata);

			expect(result).toBe("attr");
		});

		it("should return plain name when namespace has no prefix", () => {
			const metadata = {
				name: "attr",
				namespaces: [{}],
			};

			const result = util.buildAttributeName(metadata as any);

			expect(result).toBe("attr");
		});
	});

	describe("collectAllNamespaces", () => {
		it("should collect namespace from root metadata", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://example.com", prefix: "ex" },
			})
			class Root {}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("ex")).toBe("http://example.com");
		});

		it("should collect default namespace", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://example.com", isDefault: true },
			})
			class Root {}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("default")).toBe("http://example.com");
		});

		it("should collect namespace from element metadata", () => {
			@XmlElement({
				name: "Element",
				namespace: { uri: "http://example.com", prefix: "ex" },
			})
			class Element {}

			const obj = new Element();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("ex")).toBe("http://example.com");
		});

		it("should collect namespaces from attributes", () => {
			@XmlRoot({ name: "Element" })
			class Element {
				@XmlAttribute({
					name: "attr",
					namespace: { uri: "http://attr.com", prefix: "a" },
				})
				attr: string = "";
			}

			const obj = new Element();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("a")).toBe("http://attr.com");
		});

		it("should collect namespaces from array items", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlArray({
					itemName: "Item",
					namespace: { uri: "http://items.com", prefix: "i" },
				})
				items: string[] = [];
			}

			const obj = new Container();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("i")).toBe("http://items.com");
		});

		it("should collect namespaces from field-level element metadata", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement({
					name: "Field",
					namespace: { uri: "http://field.com", prefix: "f" },
				})
				field: string = "";
			}

			const obj = new Container();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("f")).toBe("http://field.com");
		});

		it("should collect multiple namespaces", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://root.com", prefix: "r" },
			})
			class Root {
				@XmlAttribute({
					name: "attr",
					namespace: { uri: "http://attr.com", prefix: "a" },
				})
				attr: string = "";

				@XmlElement({
					name: "Field",
					namespace: { uri: "http://field.com", prefix: "f" },
				})
				field: string = "";
			}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("r")).toBe("http://root.com");
			expect(namespaces.get("a")).toBe("http://attr.com");
			expect(namespaces.get("f")).toBe("http://field.com");
			expect(namespaces.size).toBe(3);
		});

		it("should collect namespaces from root and field elements only", () => {
			class Nested {
				@XmlAttribute({
					name: "attr",
					namespace: { uri: "http://nested-attr.com", prefix: "na" },
				})
				attr: string = "";
			}

			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://root.com", prefix: "r" },
			})
			class Root {
				@XmlElement({ name: "Nested", namespace: { uri: "http://nested.com", prefix: "n" } })
				nested: Nested = new Nested();
			}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			// Only collect root and field-level namespaces
			// Nested object's internal namespaces (like attributes) are declared on the nested element itself
			expect(namespaces.get("r")).toBe("http://root.com");
			expect(namespaces.get("n")).toBe("http://nested.com"); // Field-level namespace
			expect(namespaces.get("na")).toBeUndefined(); // Not collected - declared on nested element
		});

		it("should handle circular references", () => {
			@XmlRoot({ name: "Node" })
			class Node {
				@XmlElement("Next")
				next: Node | null = null;
			}

			const node1 = new Node();
			const node2 = new Node();
			node1.next = node2;
			node2.next = node1; // Circular reference

			// Should not throw error
			const namespaces = util.collectAllNamespaces(node1);

			expect(namespaces).toBeDefined();
		});

		it("should collect namespaces from arrays of objects", () => {
			class Item {}

			@XmlRoot({ name: "Container" })
			class Container {
				@XmlArray({ itemName: "Item", type: Item, namespace: { uri: "http://item.com", prefix: "i" } })
				items: Item[] = [new Item(), new Item()];
			}

			const obj = new Container();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.get("i")).toBe("http://item.com");
		});

		it("should return empty map when no namespaces", () => {
			@XmlRoot({ name: "Simple" })
			class Simple {}

			const obj = new Simple();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.size).toBe(0);
		});

		it("should deduplicate namespace prefixes", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "http://same.com", prefix: "s" },
			})
			class Root {
				@XmlAttribute({
					name: "attr",
					namespace: { uri: "http://same.com", prefix: "s" },
				})
				attr: string = "";
			}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces.size).toBe(1);
			expect(namespaces.get("s")).toBe("http://same.com");
		});
	});

	describe("addNamespaceDeclarations", () => {
		it("should add namespace declarations to root element", () => {
			const namespaces = new Map([["ex", "http://example.com"]]);
			const mappedObj = { Root: {} as Record<string, any> };

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root["@_xmlns:ex"]).toBe("http://example.com");
		});

		it("should add default namespace declaration", () => {
			const namespaces = new Map([["default", "http://example.com"]]);
			const mappedObj = { Root: {} as Record<string, any> };

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root["@_xmlns"]).toBe("http://example.com");
		});

		it("should add multiple namespace declarations", () => {
			const namespaces = new Map([
				["ex1", "http://example1.com"],
				["ex2", "http://example2.com"],
				["ex3", "http://example3.com"],
			]);
			const mappedObj = { Root: {} as Record<string, any> };

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root["@_xmlns:ex1"]).toBe("http://example1.com");
			expect(mappedObj.Root["@_xmlns:ex2"]).toBe("http://example2.com");
			expect(mappedObj.Root["@_xmlns:ex3"]).toBe("http://example3.com");
		});

		it("should handle both default and prefixed namespaces", () => {
			const namespaces = new Map([
				["default", "http://default.com"],
				["ex", "http://example.com"],
			]);
			const mappedObj = { Root: {} as Record<string, any> };

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root["@_xmlns"]).toBe("http://default.com");
			expect(mappedObj.Root["@_xmlns:ex"]).toBe("http://example.com");
		});

		it("should not modify object if namespaces is empty", () => {
			const namespaces = new Map();
			const mappedObj = { Root: { existing: "value" } };

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root).toEqual({ existing: "value" });
		});

		it("should handle non-object root element", () => {
			const namespaces = new Map([["ex", "http://example.com"]]);
			const mappedObj = { Root: "string value" };

			// Should not throw error
			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			// String value should remain unchanged
			expect(mappedObj.Root).toBe("string value");
		});

		it("should not overwrite existing attributes", () => {
			const namespaces = new Map([["ex", "http://example.com"]]);
			const mappedObj = {
				Root: {
					"@_id": "123",
					"@_name": "test",
				} as Record<string, any>,
			};

			util.addNamespaceDeclarations(mappedObj, "Root", namespaces);

			expect(mappedObj.Root["@_id"]).toBe("123");
			expect(mappedObj.Root["@_name"]).toBe("test");
			expect(mappedObj.Root["@_xmlns:ex"]).toBe("http://example.com");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty namespace object", () => {
			const metadata: any = {
				name: "Element",
				namespace: {},
				required: false,
			};

			const result = util.buildElementName(metadata);

			expect(result).toBe("Element");
		});

		it("should handle namespace with empty prefix", () => {
			const metadata: any = {
				name: "Element",
				namespace: { uri: "http://example.com", prefix: "" },
				required: false,
			};

			const result = util.buildElementName(metadata);

			expect(result).toBe("Element");
		});

		it("should handle null nested objects", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement("Nested")
				nested: any = null;
			}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces).toBeDefined();
			expect(namespaces.size).toBe(0);
		});

		it("should handle undefined nested objects", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement("Nested")
				nested: any = undefined;
			}

			const obj = new Root();
			const namespaces = util.collectAllNamespaces(obj);

			expect(namespaces).toBeDefined();
			expect(namespaces.size).toBe(0);
		});
	});
});
