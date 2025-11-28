import { describe, expect, it } from "vitest";
import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("NavigationMethods", () => {
	const createElement = (name: string, attrs: Record<string, string> = {}, numericValue?: number) =>
		new DynamicElement({ name, attributes: attrs, numericValue, text: numericValue?.toString() });

	function buildTree(): DynamicElement {
		const root = new DynamicElement({ name: "root" });
		const a = new DynamicElement({ name: "A" });
		const b = new DynamicElement({ name: "B" });
		const a1 = new DynamicElement({ name: "A1" });
		const a2 = new DynamicElement({ name: "A2" });
		const a1a = new DynamicElement({ name: "A1a" });

		root.addChild(a);
		root.addChild(b);
		a.addChild(a1);
		a.addChild(a2);
		a1.addChild(a1a);

		return root;
	}

	describe("Sorting", () => {
		it("should sort by name", () => {
			const el1 = createElement("zebra");
			const el2 = createElement("apple");
			const query = new XmlQuery([el1, el2]);

			const sorted = query.sortByName();
			expect(sorted.map(el => el.name)).toEqual(["apple", "zebra"]);
		});

		it("should sort by numeric value", () => {
			const items = [createElement("i", {}, 20), createElement("i", {}, 10)];
			const sorted = new XmlQuery(items).sortByValue();
			expect(sorted.values()).toEqual([10, 20]);
		});

		it("should reverse order", () => {
			const items = [createElement("a"), createElement("b"), createElement("c")];
			const reversed = new XmlQuery(items).reverse();
			expect(reversed.map(el => el.name)).toEqual(["c", "b", "a"]);
		});
	});

	describe("Slicing", () => {
		it("should take first n elements", () => {
			const items = [1, 2, 3, 4, 5].map(n => createElement("i", {}, n));
			const result = new XmlQuery(items).take(3);
			expect(result.count()).toBe(3);
		});

		it("should skip first n elements", () => {
			const items = [1, 2, 3, 4, 5].map(n => createElement("i", {}, n));
			const result = new XmlQuery(items).skip(2);
			expect(result.count()).toBe(3);
		});

		it("should slice elements", () => {
			const items = [1, 2, 3, 4, 5].map(n => createElement("i", {}, n));
			const result = new XmlQuery(items).slice(1, 4);
			expect(result.count()).toBe(3);
			expect(result.values()).toEqual([2, 3, 4]);
		});
	});

	describe("Tree traversal", () => {
		it("should walk up ancestors", () => {
			const root = buildTree();
			const a1a = root.children[0].children[0].children[0];
			const ancestors = new XmlQuery([a1a]).walkUp();
			expect(ancestors.map(el => el.name)).toEqual(["A1", "A", "root"]);
		});

		it("should walk down descendants", () => {
			const root = buildTree();
			const a = root.children[0];
			const descendants = new XmlQuery([a]).walkDown();
			expect(descendants.length).toBe(3); // A1, A2, A1a
		});

		it("should traverse breadth-first", () => {
			const root = buildTree();
			const result = new XmlQuery([root]).breadthFirst().toArray();
			expect(result[0].name).toBe("root");
			expect(result[1].name).toBe("A");
			expect(result[2].name).toBe("B");
		});

		it("should traverse depth-first", () => {
			const root = buildTree();
			const result = new XmlQuery([root]).depthFirst().toArray();
			expect(result.map(el => el.name)).toEqual(["root", "A", "A1", "A1a", "A2", "B"]);
		});

		it("should get following nodes", () => {
			const root = buildTree();
			const a = root.children[0];
			const following = new XmlQuery([a]).followingNodes().toArray();
			expect(following.length).toBeGreaterThan(0);
			expect(following[0].name).toBe("B");
		});

		it("should get preceding nodes", () => {
			const root = buildTree();
			const b = root.children[1];
			const preceding = new XmlQuery([b]).precedingNodes().toArray();
			expect(preceding.length).toBeGreaterThan(0);
		});
	});
});
