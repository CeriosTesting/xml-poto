import { describe, expect, it } from "vitest";
import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlQuery } from "../../src/query/xml-query";

describe("DynamicElement.query() method", () => {
	it("should return XmlQuery instance with proper type", () => {
		const element = new DynamicElement({
			name: "root",
			attributes: {},
			children: [],
		});

		// Type assertion - this should compile without errors
		const query: XmlQuery = element.query();
		expect(query).toBeDefined();
		expect(typeof query.find).toBe("function");
		expect(typeof query.children).toBe("function");
		expect(typeof query.where).toBe("function");
		expect(typeof query.toArray).toBe("function");
	});

	it("should query child elements", () => {
		const child1 = new DynamicElement({
			name: "item",
			text: "Item 1",
			attributes: { id: "1" },
			children: [],
		});

		const child2 = new DynamicElement({
			name: "item",
			text: "Item 2",
			attributes: { id: "2" },
			children: [],
		});

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: [child1, child2],
		});

		// Set parent references
		child1.parent = root;
		child2.parent = root;

		const items = root.query().find("item");
		expect(items.count()).toBe(2);
		expect(items.texts()).toEqual(["Item 1", "Item 2"]);
	});

	it("should support mutation operations", () => {
		const child = new DynamicElement({
			name: "price",
			text: "100",
			numericValue: 100,
			attributes: {},
			children: [],
		});

		const root = new DynamicElement({
			name: "product",
			attributes: {},
			children: [child],
		});

		child.parent = root;

		// Mutate via query
		root.query().find("price").setText("200");

		expect(child.text).toBe("200");
	});

	it("should support attribute operations via query", () => {
		const element = new DynamicElement({
			name: "item",
			attributes: { id: "123" },
			children: [],
		});

		// Set attribute via query
		element.query().setAttr("status", "active");
		expect(element.attributes.status).toBe("active");

		// Remove attribute via query
		element.query().removeAttr("id");
		expect(element.attributes.id).toBeUndefined();
	});

	it("should support XPath queries", () => {
		const title = new DynamicElement({
			name: "title",
			text: "Book Title",
			attributes: {},
			children: [],
			path: "book/title",
			depth: 1,
		});

		const book = new DynamicElement({
			name: "book",
			attributes: { id: "123" },
			children: [title],
			path: "book",
			depth: 0,
		});

		title.parent = book;

		const result = book.query().xpath("//title");
		expect(result.count()).toBe(1);
		expect(result.first()?.text).toBe("Book Title");
	});

	it("should be lazy - multiple calls create new query instances", () => {
		const element = new DynamicElement({
			name: "root",
			attributes: {},
			children: [],
		});

		const query1 = element.query();
		const query2 = element.query();

		// Should be different instances
		expect(query1).not.toBe(query2);

		// But should have same functionality
		expect(query1.count()).toBe(query2.count());
	});

	it("should support chaining operations", () => {
		const item1 = new DynamicElement({
			name: "item",
			text: "50",
			numericValue: 50,
			attributes: { category: "A" },
			children: [],
		});

		const item2 = new DynamicElement({
			name: "item",
			text: "150",
			numericValue: 150,
			attributes: { category: "B" },
			children: [],
		});

		const item3 = new DynamicElement({
			name: "item",
			text: "200",
			numericValue: 200,
			attributes: { category: "A" },
			children: [],
		});

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: [item1, item2, item3],
		});

		item1.parent = root;
		item2.parent = root;
		item3.parent = root;

		// Chain: find items, filter by attribute, filter by value, get texts
		const result = root.query().find("item").whereAttribute("category", "A").whereValueGreaterThan(100).texts();

		expect(result).toEqual(["200"]);
	});

	it("should work with toXml() serialization after mutations", () => {
		const element = new DynamicElement({
			name: "root",
			text: "original",
			attributes: { version: "1.0" },
			children: [],
		});

		// Mutate via query
		element.query().setText("modified").setAttr("version", "2.0");

		const xml = element.toXml();
		expect(xml).toContain('version="2.0"');
		expect(xml).toContain("modified");
	});

	it("should handle nested queries", () => {
		const grandchild = new DynamicElement({
			name: "value",
			text: "nested",
			attributes: {},
			children: [],
			path: "root/child/value",
			depth: 2,
		});

		const child = new DynamicElement({
			name: "child",
			attributes: {},
			children: [grandchild],
			path: "root/child",
			depth: 1,
		});

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: [child],
			path: "root",
			depth: 0,
		});

		grandchild.parent = child;
		child.parent = root;

		// Query from root
		const values = root.query().find("value");
		expect(values.count()).toBe(1);
		expect(values.first()?.text).toBe("nested");

		// Query from child
		const childValues = child.query().find("value");
		expect(childValues.count()).toBe(1);
		expect(childValues.first()?.text).toBe("nested");
	});

	it("should have correct return type for query chaining", () => {
		const item1 = new DynamicElement({
			name: "item",
			text: "10",
			numericValue: 10,
			attributes: { status: "active" },
			children: [],
		});

		const item2 = new DynamicElement({
			name: "item",
			text: "20",
			numericValue: 20,
			attributes: { status: "inactive" },
			children: [],
		});

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: [item1, item2],
		});

		item1.parent = root;
		item2.parent = root;

		// Verify that the query chain returns XmlQuery at each step
		const query1: XmlQuery = root.query();
		const query2: XmlQuery = query1.find("item");
		const query3: XmlQuery = query2.whereAttribute("status", "active");
		const query4: XmlQuery = query3.sortByValue();

		expect(query4.count()).toBe(1);
		expect(query4.first()?.text).toBe("10");
	});

	it("should support all query methods with proper types", () => {
		const price1 = new DynamicElement({
			name: "price",
			text: "100",
			numericValue: 100,
			attributes: { currency: "USD" },
			children: [],
		});

		const price2 = new DynamicElement({
			name: "price",
			text: "200",
			numericValue: 200,
			attributes: { currency: "EUR" },
			children: [],
		});

		const root = new DynamicElement({
			name: "catalog",
			attributes: {},
			children: [price1, price2],
		});

		price1.parent = root;
		price2.parent = root;

		const query: XmlQuery = root.query();

		// Test various query methods return correct types
		const found: XmlQuery = query.find("price");
		const filtered: XmlQuery = found.whereValueGreaterThan(50);
		const sorted: XmlQuery = filtered.sortByValue();
		const taken: XmlQuery = sorted.take(1);

		// Test extraction methods
		const array: DynamicElement[] = taken.toArray();
		const first: DynamicElement | undefined = taken.first();
		const count: number = taken.count();
		const texts: string[] = taken.texts();
		const values: number[] = taken.values();

		expect(array).toHaveLength(1);
		expect(first?.text).toBe("100");
		expect(count).toBe(1);
		expect(texts).toEqual(["100"]);
		expect(values).toEqual([100]);
	});

	it("should support namespace-aware queries with proper types", () => {
		const element = new DynamicElement({
			name: "ns:item",
			namespaceUri: "http://example.com",
			text: "value",
			attributes: {},
			children: [],
			xmlnsDeclarations: { ns: "http://example.com" },
		});

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: [element],
		});

		element.parent = root;

		const query: XmlQuery = root.query();
		const byNamespace: XmlQuery = query.namespace("ns");
		const byUri: XmlQuery = query.namespaceUri("http://example.com");
		const byQualified: XmlQuery = query.find("ns:item");

		expect(byNamespace.count()).toBe(1);
		expect(byUri.count()).toBe(1);
		expect(byQualified.count()).toBe(1);
	});

	it("should support aggregation methods with proper return types", () => {
		const items = [10, 20, 30, 40, 50].map(
			(val, idx) =>
				new DynamicElement({
					name: "item",
					text: String(val),
					numericValue: val,
					attributes: { id: String(idx + 1) },
					children: [],
				})
		);

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: items,
		});

		for (const item of items) {
			item.parent = root;
		}

		const query: XmlQuery = root.query().find("item");

		// Test aggregation methods with proper types
		const sum: number = query.sum();
		const avg: number = query.average();
		const min: number | undefined = query.min();
		const max: number | undefined = query.max();
		const exists: boolean = query.exists();
		const all: boolean = query.all((el: DynamicElement) => el.numericValue !== undefined && el.numericValue > 0);
		const any: boolean = query.any((el: DynamicElement) => el.numericValue !== undefined && el.numericValue > 40);

		expect(sum).toBe(150);
		expect(avg).toBe(30);
		expect(min).toBe(10);
		expect(max).toBe(50);
		expect(exists).toBe(true);
		expect(all).toBe(true);
		expect(any).toBe(true);
	});

	it("should support mutation operations returning XmlQuery for chaining", () => {
		const items = [1, 2, 3].map(
			val =>
				new DynamicElement({
					name: "item",
					text: String(val),
					numericValue: val,
					attributes: {},
					children: [],
				})
		);

		const root = new DynamicElement({
			name: "root",
			attributes: {},
			children: items,
		});

		for (const item of items) {
			item.parent = root;
		}

		// Mutation methods should return XmlQuery for chaining
		const result: XmlQuery = root
			.query()
			.find("item")
			.setAttr("processed", "true")
			.setText((el: DynamicElement) => `Updated ${el.text}`);

		expect(result.count()).toBe(3);
		expect(items[0].attributes.processed).toBe("true");
		expect(items[0].text).toBe("Updated 1");
		expect(items[1].text).toBe("Updated 2");
		expect(items[2].text).toBe("Updated 3");
	});

	it("should support map and reduce operations with proper types", () => {
		const items = [5, 10, 15].map(
			val =>
				new DynamicElement({
					name: "price",
					text: String(val),
					numericValue: val,
					attributes: {},
					children: [],
				})
		);

		const root = new DynamicElement({
			name: "catalog",
			attributes: {},
			children: items,
		});

		for (const item of items) {
			item.parent = root;
		}

		const query: XmlQuery = root.query().find("price");

		// map should return proper type
		const doubled: number[] = query.map((el: DynamicElement) => (el.numericValue || 0) * 2);
		expect(doubled).toEqual([10, 20, 30]);

		// reduce should return proper type
		const total: number = query.reduce((acc: number, el: DynamicElement) => acc + (el.numericValue || 0), 0);
		expect(total).toBe(30);
	});
});
