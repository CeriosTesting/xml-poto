import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlQuery } from "../../src/query/xml-query";

describe("XmlQuery", () => {
	// Helper function to create test elements
	const createElement = (
		name: string,
		options: {
			namespace?: string;
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
			qualifiedName: options.namespace ? `${options.namespace}:${name}` : name,
			namespace: options.namespace,
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

	describe("Selection by name", () => {
		it("should find all descendants by name", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const items = query.find("item");
			expect(items.count()).toBe(3);
			expect(items.toArray().every(el => el.name === "item")).toBe(true);
		});

		it("should find by qualified name", () => {
			const el = createElement("element", { namespace: "ns", text: "content" });
			const query = new XmlQuery([el]);

			const result = query.findQualified("ns:element");
			expect(result.count()).toBe(1);
			expect(result.first()?.qualifiedName).toBe("ns:element");
		});

		it("should find by name pattern with wildcard", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.findPattern("chi*");
			expect(result.count()).toBe(2);
			expect(result.toArray().every(el => el.name === "child")).toBe(true);
		});

		it("should find by name pattern with regex", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.findPattern(/^(child|item)$/);
			expect(result.count()).toBe(5);
		});

		it("should find first occurrence", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const first = query.findFirst("item");
			expect(first.count()).toBe(1);
			expect(first.first()?.text).toBe("10");
		});

		it("should return empty for non-existent element", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.find("nonexistent");
			expect(result.exists()).toBe(false);
		});
	});

	describe("Selection by namespace", () => {
		it("should find by namespace prefix", () => {
			const ns1 = createElement("element", { namespace: "ns1", text: "1" });
			const ns2 = createElement("element", { namespace: "ns2", text: "2" });
			const query = new XmlQuery([ns1, ns2]);

			const result = query.namespace("ns1");
			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("1");
		});

		it("should find elements with any namespace", () => {
			const ns1 = createElement("element", { namespace: "ns1" });
			const noNs = createElement("element");
			const query = new XmlQuery([ns1, noNs]);

			const result = query.hasNamespace();
			expect(result.count()).toBe(1);
			expect(result.first()?.namespace).toBe("ns1");
		});

		it("should find elements without namespace", () => {
			const ns1 = createElement("element", { namespace: "ns1" });
			const noNs = createElement("element");
			const query = new XmlQuery([ns1, noNs]);

			const result = query.noNamespace();
			expect(result.count()).toBe(1);
			expect(result.first()?.namespace).toBeUndefined();
		});
	});

	describe("Hierarchical selection", () => {
		it("should select all direct children", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const children = query.children();
			expect(children.count()).toBe(3);
		});

		it("should select children by name", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const children = query.childrenNamed("child");
			expect(children.count()).toBe(2);
		});

		it("should select first child", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const first = query.firstChild();
			expect(first.count()).toBe(1);
			expect(first.first()?.attributes.id).toBe("1");
		});

		it("should select last child", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const last = query.lastChild();
			expect(last.count()).toBe(1);
			expect(last.first()?.name).toBe("section");
		});

		it("should select child at index", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const child = query.childAt(1);
			expect(child.count()).toBe(1);
			expect(child.first()?.attributes.id).toBe("2");
		});

		it("should select parent elements", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const items = query.find("item");
			const parents = items.parent();
			expect(parents.count()).toBe(1);
			expect(parents.first()?.name).toBe("section");
		});

		it("should select all ancestors", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const items = query.find("item");
			const ancestors = items.ancestors();
			expect(ancestors.count()).toBe(2); // section and root
		});

		it("should select all descendants", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const descendants = query.descendants();
			expect(descendants.count()).toBe(6); // All children recursively
		});

		it("should select siblings", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const child1 = query.children().at(0);

			if (!child1) throw new Error("child1 is undefined");

			const siblings = new XmlQuery([child1]).siblings();
			expect(siblings.count()).toBe(2); // child2 and section
		});

		it("should select next sibling", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const child1 = query.children().at(0);

			if (!child1) throw new Error("child1 is undefined");

			const next = new XmlQuery([child1]).nextSibling();
			expect(next.count()).toBe(1);
			expect(next.first()?.attributes.id).toBe("2");
		});

		it("should select previous sibling", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const child2 = query.children().at(1);

			if (!child2) throw new Error("child2 is undefined");

			const prev = new XmlQuery([child2]).previousSibling();
			expect(prev.count()).toBe(1);
			expect(prev.first()?.attributes.id).toBe("1");
		});
	});

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
			expect(result.count()).toBe(1); // "Child 2" ("20" is numeric text but doesn't match)
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

	describe("Sorting and ordering", () => {
		it("should sort by name ascending", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.children().sortByName();
			const names = sorted.map(el => el.name);
			expect(names).toEqual(["child", "child", "section"]);
		});

		it("should sort by name descending", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.children().sortByName(false);
			const names = sorted.map(el => el.name);
			expect(names).toEqual(["section", "child", "child"]);
		});

		it("should sort by attribute value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.find("child").sortByAttribute("id");
			const ids = sorted.attributes("id");
			expect(ids).toEqual(["1", "2"]);
		});

		it("should sort by text content", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.find("child").sortByText();
			const texts = sorted.texts();
			expect(texts).toEqual(["Child 1", "Child 2"]);
		});

		it("should sort by numeric value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.find("item").hasNumericValue().sortByValue();
			const values = sorted.values();
			expect(values).toEqual([10, 20]);
		});

		it("should sort by depth", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.descendants().sortByDepth();
			const depths = sorted.map(el => el.depth);
			expect(depths[0]).toBe(1);
			expect(depths[depths.length - 1]).toBe(2);
		});

		it("should sort by custom comparator", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sorted = query.find("item").sortBy((a, b) => {
				const aVal = a.numericValue ?? 999;
				const bVal = b.numericValue ?? 999;
				return bVal - aVal;
			});
			const values = sorted.values();
			expect(values).toEqual([20, 10]);
		});

		it("should reverse order", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const reversed = query.children().reverse();
			const names = reversed.map(el => el.name);
			expect(names[0]).toBe("section");
		});
	});

	describe("Slicing and pagination", () => {
		it("should take first n elements", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const first2 = query.descendants().take(2);
			expect(first2.count()).toBe(2);
		});

		it("should skip first n elements", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const skipped = query.descendants().skip(3);
			expect(skipped.count()).toBe(3);
		});

		it("should slice elements", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sliced = query.descendants().slice(1, 4);
			expect(sliced.count()).toBe(3);
		});

		it("should get distinct elements by name", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const distinct = query.descendants().distinctBy(el => el.name);
			expect(distinct.count()).toBe(3); // child, section, item
		});
	});

	describe("Extraction and aggregation", () => {
		it("should get first element", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const first = query.children().first();
			expect(first?.attributes.id).toBe("1");
		});

		it("should get last element", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const last = query.children().last();
			expect(last?.name).toBe("section");
		});

		it("should get element at positive index", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const element = query.children().at(1);
			expect(element?.attributes.id).toBe("2");
		});

		it("should get element at negative index", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const element = query.children().at(-1);
			expect(element?.name).toBe("section");
		});

		it("should convert to array", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const array = query.children().toArray();
			expect(Array.isArray(array)).toBe(true);
			expect(array.length).toBe(3);
		});

		it("should count elements", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			expect(query.descendants().count()).toBe(6);
		});

		it("should check if elements exist", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			expect(query.find("item").exists()).toBe(true);
			expect(query.find("nonexistent").exists()).toBe(false);
		});

		it("should check if all elements match predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const items = query.find("item");
			expect(items.all(el => el.name === "item")).toBe(true);
			expect(items.all(el => el.numericValue !== undefined)).toBe(false);
		});

		it("should check if any element matches predicate", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const items = query.find("item");
			expect(items.any(el => el.numericValue === 20)).toBe(true);
			expect(items.any(el => el.numericValue === 999)).toBe(false);
		});

		it("should get all text values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const texts = query.descendants().texts();
			expect(texts.length).toBe(5);
			expect(texts).toContain("Child 1");
		});

		it("should get all numeric values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const values = query.descendants().values();
			expect(values).toEqual([10, 20]);
		});

		it("should get all attribute values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const ids = query.descendants().attributes("id");
			expect(ids).toEqual(["1", "2"]);
		});

		it("should get distinct attribute values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const types = query.descendants().distinctAttributes("type");
			expect(types).toEqual(["text"]);
		});

		it("should sum numeric values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sum = query.find("item").sum();
			expect(sum).toBe(30);
		});

		it("should calculate average of numeric values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const avg = query.find("item").hasNumericValue().average();
			expect(avg).toBe(15);
		});

		it("should get minimum value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const min = query.find("item").min();
			expect(min).toBe(10);
		});

		it("should get maximum value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const max = query.find("item").max();
			expect(max).toBe(20);
		});
	});

	describe("Transformation and mapping", () => {
		it("should map elements to values", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const mapped = query.find("child").map(el => el.text);
			expect(mapped).toEqual(["Child 1", "Child 2"]);
		});

		it("should execute function for each element", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const names: string[] = [];
			query.find("child").each(el => names.push(el.name));
			expect(names).toEqual(["child", "child"]);
		});

		it("should reduce elements to single value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const sum = query
				.find("item")
				.hasNumericValue()
				.reduce((acc, el) => acc + (el.numericValue ?? 0), 0);
			expect(sum).toBe(30);
		});
	});

	describe("Grouping", () => {
		it("should group by name", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const grouped = query.descendants().groupByName();
			expect(grouped.get("child")?.length).toBe(2);
			expect(grouped.get("item")?.length).toBe(3);
		});

		it("should group by namespace", () => {
			const ns1 = createElement("element", { namespace: "ns1" });
			const ns2 = createElement("element", { namespace: "ns1" });
			const noNs = createElement("element");
			const query = new XmlQuery([ns1, ns2, noNs]);

			const grouped = query.groupByNamespace();
			expect(grouped.get("ns1")?.length).toBe(2);
			expect(grouped.get("(no-namespace)")?.length).toBe(1);
		});

		it("should group by attribute value", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const grouped = query.descendants().groupByAttribute("type");
			expect(grouped.get("text")?.length).toBe(2);
		});

		it("should group by depth", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const grouped = query.descendants().groupByDepth();
			expect(grouped.get(1)?.length).toBe(3);
			expect(grouped.get(2)?.length).toBe(3);
		});

		it("should group by custom selector", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const grouped = query
				.descendants()
				.hasText()
				.groupBy(el => (el.text?.length ?? 0) > 5);
			expect(grouped.get(true)?.length).toBe(2); // "Child 1", "Child 2"
			expect(grouped.get(false)?.length).toBe(3); // "10", "20", "true"
		});
	});

	describe("Utility and output", () => {
		it("should convert to key-value map", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const map = query.find("child").toMap(el => el.attributes.id);
			expect(map["1"]).toBe("Child 1");
			expect(map["2"]).toBe("Child 2");
		});

		it("should convert to map with custom value selector", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const map = query.find("child").toMap(
				el => el.attributes.id,
				el => el.text?.toUpperCase()
			);
			expect(map["1"]).toBe("CHILD 1");
		});

		it("should convert to JSON with default options", () => {
			const el = createElement("element", {
				text: "content",
				attributes: { id: "1" },
			});
			const query = new XmlQuery([el]);

			const json = query.toJSON();
			// With simplifyLeaves: true (default), leaf nodes return text directly
			expect(json).toBe("content");
		});

		it("should convert to JSON including metadata", () => {
			const el = createElement("element", { text: "content", namespace: "ns" });
			const query = new XmlQuery([el]);

			const json = query.toJSON({ includeMetadata: true, simplifyLeaves: false });
			expect(json["@metadata"]).toBeDefined();
			expect(json["@metadata"].qualifiedName).toBe("ns:element");
		});

		it("should convert to JSON without flattening", () => {
			const el = createElement("element", { text: "content" });
			const query = new XmlQuery([el, el]);

			const json = query.toJSON({ flattenSingle: false });
			expect(Array.isArray(json)).toBe(true);
		});

		it("should convert to JSON with complex structure", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const json = query.toJSON();
			expect(json.child).toBeDefined();
			expect(json.section).toBeDefined();
		});

		it("should print elements for debugging", () => {
			const el = createElement("element", {
				text: "content",
				attributes: { id: "1" },
			});
			const query = new XmlQuery([el]);

			const output = query.print();
			expect(output).toContain("element");
			expect(output).toContain('id="1"');
			expect(output).toContain("content");
		});

		it("should print without attributes", () => {
			const el = createElement("element", {
				text: "content",
				attributes: { id: "1" },
			});
			const query = new XmlQuery([el]);

			const output = query.print(false);
			expect(output).not.toContain('id="1"');
		});

		it("should get summary statistics", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const stats = query.descendants().stats();
			expect(stats.count).toBe(6);
			expect(stats.withText).toBe(5);
			expect(stats.withAttributes).toBe(3);
			expect(stats.withChildren).toBe(1);
			expect(stats.leafNodes).toBe(5);
			expect(stats.depths.size).toBe(2);
		});
	});

	describe("Edge cases", () => {
		it("should handle empty query", () => {
			const query = new XmlQuery([]);

			expect(query.count()).toBe(0);
			expect(query.exists()).toBe(false);
			expect(query.first()).toBeUndefined();
			expect(query.texts()).toEqual([]);
		});

		it("should handle query with undefined text", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			expect(query.texts()).toEqual([]);
			expect(query.whereText("anything").count()).toBe(0);
		});

		it("should handle query with undefined attributes", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			expect(query.hasAttribute("any").count()).toBe(0);
			expect(query.attributes("any")).toEqual([]);
		});

		it("should handle elements without parent", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			expect(query.parent().count()).toBe(0);
			expect(query.ancestors().count()).toBe(0);
		});

		it("should handle single element without siblings", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			expect(query.siblings().count()).toBe(0);
			expect(query.nextSibling().count()).toBe(0);
			expect(query.previousSibling().count()).toBe(0);
		});

		it("should handle elements without children", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			expect(query.children().count()).toBe(0);
			expect(query.descendants().count()).toBe(0);
		});

		it("should handle average with no numeric values", () => {
			const el = createElement("element", { text: "text" });
			const query = new XmlQuery([el]);

			expect(query.average()).toBe(0);
		});

		it("should handle min/max with no values", () => {
			const el = createElement("element", { text: "text" });
			const query = new XmlQuery([el]);

			expect(query.min()).toBeUndefined();
			expect(query.max()).toBeUndefined();
		});

		it("should handle toJSON with empty query", () => {
			const query = new XmlQuery([]);

			const json = query.toJSON();
			expect(json).toBeNull();
		});

		it("should handle nested property access for undefined values", () => {
			const el = createElement("element");
			const query = new XmlQuery([el]);

			const result = query.whereMatches({ "attributes.nonexistent": "value" });
			expect(result.count()).toBe(0);
		});
	});

	describe("Chaining operations", () => {
		it("should chain multiple filters", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.find("item").hasNumericValue().whereValueGreaterThan(10).sortByValue();
			expect(result.count()).toBe(1);
			expect(result.first()?.numericValue).toBe(20);
		});

		it("should chain hierarchical and filter operations", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.children().childrenNamed("item").whereValueBetween(0, 15);
			expect(result.count()).toBe(1);
		});

		it("should chain sorting and slicing", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query.descendants().sortByName().take(3);
			expect(result.count()).toBe(3);
		});

		it("should chain with transformations", () => {
			const root = buildSampleTree();
			const query = new XmlQuery([root]);

			const result = query
				.find("item")
				.hasNumericValue()
				.sortByValue()
				.map(el => el.numericValue);
			expect(result).toEqual([10, 20]);
		});
	});
});
