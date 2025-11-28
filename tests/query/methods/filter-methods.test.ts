import { describe, expect, it } from "vitest";
import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("FilterMethods", () => {
	// Helper function to create test elements
	const createElement = (
		name: string,
		options: {
			text?: string;
			numericValue?: number;
			booleanValue?: boolean;
			attributes?: Record<string, string>;
			children?: DynamicElement[];
			parent?: DynamicElement;
			depth?: number;
			path?: string;
			indexInParent?: number;
		} = {}
	): DynamicElement => {
		return new DynamicElement({
			name,
			text: options.text,
			numericValue: options.numericValue,
			booleanValue: options.booleanValue,
			attributes: options.attributes || {},
			children: options.children || [],
			parent: options.parent,
			depth: options.depth ?? 0,
			path: options.path || name,
			indexInParent: options.indexInParent ?? 0,
			hasChildren: (options.children?.length ?? 0) > 0,
			isLeaf: (options.children?.length ?? 0) === 0,
		});
	};

	// Build a sample tree structure
	const buildSampleTree = (): DynamicElement => {
		const root = createElement("root", { depth: 0, path: "root" });

		const child1 = createElement("child", {
			text: "Child 1",
			attributes: { id: "1", type: "text" },
			depth: 1,
			path: "root/child",
			indexInParent: 0,
		});
		child1.parent = root;

		const child2 = createElement("child", {
			text: "Child 2",
			attributes: { id: "2", type: "text" },
			depth: 1,
			path: "root/child",
			indexInParent: 1,
		});
		child2.parent = root;

		const section = createElement("section", {
			attributes: { name: "main" },
			depth: 1,
			path: "root/section",
			indexInParent: 2,
		});
		section.parent = root;

		const item1 = createElement("item", {
			text: "10",
			numericValue: 10,
			depth: 2,
			path: "root/section/item",
			indexInParent: 0,
		});
		item1.parent = section;

		const item2 = createElement("item", {
			text: "20",
			numericValue: 20,
			depth: 2,
			path: "root/section/item",
			indexInParent: 1,
		});
		item2.parent = section;

		const item3 = createElement("item", {
			text: "true",
			booleanValue: true,
			depth: 2,
			path: "root/section/item",
			indexInParent: 2,
		});
		item3.parent = section;

		section.children = [item1, item2, item3];
		section.hasChildren = true;
		section.isLeaf = false;

		root.children = [child1, child2, section];
		root.hasChildren = true;
		root.isLeaf = false;

		return root;
	};

	describe("Filter by attributes", () => {
		it("should filter by attribute existence", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withId = query.descendants().hasAttribute("id");
			expect(withId.count()).toBe(2);
		});

		it("should filter by multiple attributes existence", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withBoth = query.descendants().hasAttributes("id", "type");
			expect(withBoth.count()).toBe(2);
		});

		it("should filter by attribute value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereAttribute("id", "1");
			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("Child 1");
		});

		it("should filter by attribute pattern", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereAttributeMatches("type", "te*");
			expect(result.count()).toBe(2);
		});

		it("should filter by attribute predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereAttributePredicate("id", val => parseInt(val, 10) > 1);
			expect(result.count()).toBe(1);
			expect(result.first()?.attributes.id).toBe("2");
		});

		it("should filter elements with any attributes", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withAttrs = query.descendants().hasAnyAttribute();
			expect(withAttrs.count()).toBe(3); // child1, child2, section
		});

		it("should filter elements without attributes", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const noAttrs = query.descendants().noAttributes();
			expect(noAttrs.count()).toBe(3); // 3 items
		});
	});

	describe("Filter by text content", () => {
		it("should filter by exact text", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereText("Child 1");
			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("child");
		});

		it("should filter by text pattern", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereTextMatches("Child*");
			expect(result.count()).toBe(2);
		});

		it("should filter by text predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereTextPredicate(text => text.includes("1"));
			expect(result.count()).toBe(2); // "Child 1" and "10"
		});

		it("should filter by text contains", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereTextContains("Child");
			expect(result.count()).toBe(2);
		});

		it("should filter by text starts with", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereTextStartsWith("Child");
			expect(result.count()).toBe(2);
		});

		it("should filter by text ends with", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereTextEndsWith("2");
			expect(result.count()).toBe(1);
		});

		it("should filter elements with text", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withText = query.descendants().hasText();
			expect(withText.count()).toBe(5);
		});

		it("should filter elements without text", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const noText = query.descendants().noText();
			expect(noText.count()).toBe(1); // section
		});
	});

	describe("Filter by numeric value", () => {
		it("should filter by numeric value predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereValue(val => val > 15);
			expect(result.count()).toBe(1);
			expect(result.first()?.numericValue).toBe(20);
		});

		it("should filter by value equals", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereValueEquals(10);
			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("10");
		});

		it("should filter by value greater than", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereValueGreaterThan(10);
			expect(result.count()).toBe(1);
			expect(result.first()?.numericValue).toBe(20);
		});

		it("should filter by value less than", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereValueLessThan(15);
			expect(result.count()).toBe(1);
			expect(result.first()?.numericValue).toBe(10);
		});

		it("should filter by value between", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereValueBetween(5, 15);
			expect(result.count()).toBe(1);
			expect(result.first()?.numericValue).toBe(10);
		});

		it("should filter elements with numeric values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withValues = query.descendants().hasNumericValue();
			expect(withValues.count()).toBe(2);
		});
	});

	describe("Filter by boolean value", () => {
		it("should filter by boolean equals true", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereBooleanEquals(true);
			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("true");
		});

		it("should filter by boolean equals false", () => {
			const el = createElement("element", { text: "false", booleanValue: false });
			const query = new XmlQuery([el]);

			const result = query.whereBooleanEquals(false);
			expect(result.count()).toBe(1);
		});

		it("should filter elements with boolean values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withBooleans = query.descendants().hasBooleanValue();
			expect(withBooleans.count()).toBe(1);
		});
	});

	describe("Filter by structure", () => {
		it("should filter elements with children", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const withChildren = query.descendants().hasChildren();
			expect(withChildren.count()).toBe(1); // only section has children
		});

		it("should filter leaf nodes", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const leaves = query.descendants().isLeaf();
			expect(leaves.count()).toBe(5);
		});

		it("should filter by child count", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereChildCount(count => count === 3);
			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("section");
		});

		it("should filter by depth", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const depth1 = query.descendants().atDepth(1);
			expect(depth1.count()).toBe(3);
		});

		it("should filter by minimum depth", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const deep = query.descendants().minDepth(2);
			expect(deep.count()).toBe(3); // 3 items
		});

		it("should filter by maximum depth", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const shallow = query.descendants().maxDepth(1);
			expect(shallow.count()).toBe(3);
		});

		it("should filter by exact path", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().wherePath("root/section/item");
			expect(result.count()).toBe(3);
		});

		it("should filter by path pattern", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().wherePathMatches("root/section/*");
			expect(result.count()).toBe(3);
		});
	});

	describe("Advanced filters", () => {
		it("should filter by custom predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().where(el => el.name === "item" && el.numericValue !== undefined);
			expect(result.count()).toBe(2);
		});

		it("should filter by multiple conditions (AND)", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereAll(
				el => el.name === "child",
				el => el.attributes.id === "1"
			);
			expect(result.count()).toBe(1);
		});

		it("should filter by any condition (OR)", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereAny(
				el => el.name === "section",
				el => el.name === "child"
			);
			expect(result.count()).toBe(3);
		});

		it("should filter by complex query object", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereMatches({
				name: "child",
				"attributes.id": "1",
			});
			expect(result.count()).toBe(1);
		});

		it("should filter with regex in query object", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().whereMatches({
				name: /^(child|item)$/,
			});
			expect(result.count()).toBe(5);
		});
	});

	describe("Position filters", () => {
		function createElements(count: number): DynamicElement[] {
			return Array.from({ length: count }, (_, idx) => {
				return new DynamicElement({
					name: `item${idx}`,
					text: `value${idx}`,
				});
			});
		}

		it("should return elements at even indices", () => {
			const elements = createElements(10);
			const query = new XmlQuery(elements);
			const result = query.even().toArray();

			expect(result.length).toBe(5);
			expect(result[0].name).toBe("item0");
			expect(result[1].name).toBe("item2");
		});

		it("should return elements at odd indices", () => {
			const elements = createElements(10);
			const query = new XmlQuery(elements);
			const result = query.odd().toArray();

			expect(result.length).toBe(5);
			expect(result[0].name).toBe("item1");
			expect(result[1].name).toBe("item3");
		});

		it("should return element at specified index", () => {
			const elements = createElements(10);
			const query = new XmlQuery(elements);
			const result = query.nthChild(5).toArray();

			expect(result.length).toBe(1);
			expect(result[0].name).toBe("item5");
		});

		it("should return elements in range", () => {
			const elements = createElements(10);
			const query = new XmlQuery(elements);
			const result = query.range(2, 5).toArray();

			expect(result.length).toBe(3);
			expect(result[0].name).toBe("item2");
			expect(result[1].name).toBe("item3");
			expect(result[2].name).toBe("item4");
		});

		it("should throw error for invalid range", () => {
			const elements = createElements(10);
			const query = new XmlQuery(elements);
			expect(() => query.range(-1, 5)).toThrow("Range indices must be non-negative");
			expect(() => query.range(5, 2)).toThrow("Range end must be >= start");
		});
	});
});
