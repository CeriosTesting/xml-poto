import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlQuery } from "../../src/query/xml-query";

/**
 * Integration tests for XmlQuery
 * Tests focus on mixin composition, method chaining, and end-to-end scenarios
 * Individual method tests are in tests/query/methods/ directory
 */
describe("XmlQuery - Integration & Chaining", () => {
	function buildTree(): DynamicElement {
		const root = new DynamicElement({ name: "root" });
		const child1 = new DynamicElement({ name: "child", attributes: { id: "1", type: "text" }, text: "Child 1" });
		const child2 = new DynamicElement({ name: "child", attributes: { id: "2", type: "text" }, text: "Child 2" });
		const section = new DynamicElement({ name: "section", attributes: { name: "main" } });
		const item1 = new DynamicElement({ name: "item", text: "10", numericValue: 10 });
		const item2 = new DynamicElement({ name: "item", text: "20", numericValue: 20 });
		const item3 = new DynamicElement({ name: "item", text: "30", numericValue: 30 });

		root.addChild(child1);
		root.addChild(child2);
		root.addChild(section);
		section.addChild(item1);
		section.addChild(item2);
		section.addChild(item3);

		return root;
	}

	describe("Mixin composition", () => {
		it("should have methods from all mixin categories", () => {
			const query = new XmlQuery([new DynamicElement({ name: "test" })]);

			// SelectionMethods
			expect(typeof query.find).toBe("function");
			expect(typeof query.children).toBe("function");

			// FilterMethods
			expect(typeof query.whereAttribute).toBe("function");
			expect(typeof query.whereText).toBe("function");

			// NavigationMethods
			expect(typeof query.sortByName).toBe("function");
			expect(typeof query.take).toBe("function");

			// AggregationMethods
			expect(typeof query.count).toBe("function");
			expect(typeof query.sum).toBe("function");

			// MutationMethods
			expect(typeof query.setAttr).toBe("function");
			expect(typeof query.setText).toBe("function");

			// OutputMethods
			expect(typeof query.map).toBe("function");
			expect(typeof query.toJSON).toBe("function");
		});
	});

	describe("Method chaining", () => {
		it("should chain selection, filtering, and aggregation", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const result = query
				.find("item")
				.whereValue(val => val > 10)
				.sortByValue()
				.first();

			expect(result?.numericValue).toBe(20);
		});

		it("should chain hierarchical navigation and filters", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const result = query.children().childrenNamed("item").whereValueBetween(0, 25).sum();

			expect(result).toBe(30); // 10 + 20
		});

		it("should chain sorting and slicing", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const result = query
				.descendants()
				.hasNumericValue()
				.sortByValue(false) // descending
				.take(2)
				.values();

			expect(result).toEqual([30, 20]);
		});

		it("should chain with transformations", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const result = query
				.find("child")
				.whereAttribute("type", "text")
				.sortByAttribute("id")
				.map(el => el.text);

			expect(result).toEqual(["Child 1", "Child 2"]);
		});

		it("should chain multiple filter operations", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const result = query.find("item").hasNumericValue().whereValueGreaterThan(10).whereValueLessThan(30).count();

			expect(result).toBe(1); // Only item with value 20
		});
	});

	describe("Edge cases", () => {
		it("should handle empty query gracefully", () => {
			const query = new XmlQuery([]);

			expect(query.count()).toBe(0);
			expect(query.exists()).toBe(false);
			expect(query.first()).toBeUndefined();
			expect(query.texts()).toEqual([]);
			expect(query.sum()).toBe(0);
			expect(query.toJSON()).toBeNull();
		});

		it("should handle query with no matches", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const noMatch = query.find("nonexistent");
			expect(noMatch.count()).toBe(0);
			expect(noMatch.exists()).toBe(false);
		});

		it("should handle elements without expected properties", () => {
			const el = new DynamicElement({ name: "element" });
			const query = new XmlQuery([el]);

			expect(query.texts()).toEqual([]);
			expect(query.values()).toEqual([]);
			expect(query.attributes("any")).toEqual([]);
		});
	});

	describe("Complex scenarios", () => {
		it("should support complex filtering and aggregation", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const avgOfItemsInSection = query.find("section").childrenNamed("item").hasNumericValue().average();

			expect(avgOfItemsInSection).toBe(20); // (10 + 20 + 30) / 3
		});

		it("should support grouping and transformation", () => {
			const root = buildTree();
			const query = new XmlQuery([root]);

			const grouped = query.descendants().hasText().groupByName();

			expect(grouped.get("child")?.length).toBe(2);
			expect(grouped.get("item")?.length).toBe(3);
		});

		it("should support mutation and verification", () => {
			const el = new DynamicElement({ name: "item" });
			const query = new XmlQuery([el]);

			query.setAttr("id", "123");
			query.setText("Updated");

			expect(el.attributes.id).toBe("123");
			expect(el.text).toBe("Updated");
		});
	});
});
