import { describe, expect, it } from "vitest";
import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("SelectionMethods", () => {
	// Helper function to create test elements
	const createElement = (
		name: string,
		options: {
			text?: string;
			numericValue?: number;
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
			const el = createElement("ns:element", { text: "content" });
			const query = new XmlQuery([el]);

			const result = query.find("ns:element");
			expect(result.count()).toBe(1);
			expect(result.first()?.name).toBe("ns:element");
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
			const ns1 = createElement("ns1:element", { text: "1" });
			const ns2 = createElement("ns2:element", { text: "2" });
			const query = new XmlQuery([ns1, ns2]);

			const result = query.namespace("ns1");
			expect(result.count()).toBe(1);
			expect(result.first()?.text).toBe("1");
		});

		it("should find elements with any namespace", () => {
			const ns1 = createElement("ns1:element");
			const noNs = createElement("element");
			const query = new XmlQuery([ns1, noNs]);

			const result = query.hasNamespace();
			expect(result.count()).toBe(1);
			expect(result.first()?.prefix).toBe("ns1");
		});

		it("should find elements without namespace", () => {
			const ns1 = createElement("ns1:element");
			const noNs = createElement("element");
			const query = new XmlQuery([ns1, noNs]);

			const result = query.noNamespace();
			expect(result.count()).toBe(1);
			expect(result.first()?.prefix).toBeUndefined();
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

	describe("selectFirst - finding first element matching any predicate", () => {
		function createTestElements(): DynamicElement[] {
			return [
				new DynamicElement({
					name: "item",
					attributes: { id: "1", status: "active", priority: "high" },
					text: "First item",
				}),
				new DynamicElement({
					name: "item",
					attributes: { id: "2", status: "inactive", priority: "low" },
					text: "Second item",
				}),
				new DynamicElement({
					name: "item",
					attributes: { id: "3", status: "active", priority: "medium" },
					text: "Third item",
				}),
				new DynamicElement({
					name: "item",
					attributes: { id: "4", status: "active", priority: "high" },
					text: "Fourth item",
				}),
				new DynamicElement({
					name: "item",
					attributes: { id: "5", status: "pending", priority: "low" },
					text: "Fifth item",
				}),
			];
		}

		it("should return first element matching any predicate", () => {
			const elements = createTestElements();
			const query = new XmlQuery(elements);

			const result = query.selectFirst(
				el => el.attributes.status === "inactive",
				el => el.attributes.priority === "high"
			);

			// First match is id="1" with priority="high"
			expect(result.count()).toBe(1);
			expect(result.first()?.attributes.id).toBe("1");
		});

		it("should return empty query when no predicates match", () => {
			const elements = createTestElements();
			const query = new XmlQuery(elements);

			const result = query.selectFirst(
				el => el.attributes.status === "deleted",
				el => el.attributes.priority === "urgent"
			);

			expect(result.count()).toBe(0);
		});

		it("should respect document order when predicates match different elements", () => {
			const elements = createTestElements();
			const query = new XmlQuery(elements);

			const result = query.selectFirst(
				el => el.attributes.id === "4",
				el => el.attributes.id === "2",
				el => el.attributes.id === "3"
			);

			// Should return id="2" as it appears first (index 1)
			expect(result.first()?.attributes.id).toBe("2");
		});
	});
});
