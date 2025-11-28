import { describe, expect, it } from "vitest";
import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("MutationMethods", () => {
	describe("Attribute mutations", () => {
		it("should set attribute", () => {
			const el = new DynamicElement({ name: "item" });
			const query = new XmlQuery([el]);
			query.setAttr("id", "123");
			expect(el.attributes.id).toBe("123");
		});

		it("should remove attribute", () => {
			const el = new DynamicElement({ name: "item", attributes: { id: "123" } });
			const query = new XmlQuery([el]);
			query.removeAttr("id");
			expect(el.attributes.id).toBeUndefined();
		});
	});

	describe("Text mutations", () => {
		it("should set text on all elements", () => {
			const el1 = new DynamicElement({ name: "item" });
			const el2 = new DynamicElement({ name: "item" });
			const query = new XmlQuery([el1, el2]);
			query.setText("same");
			expect(el1.text).toBe("same");
			expect(el2.text).toBe("same");
		});

		it("should set text with function", () => {
			const el = new DynamicElement({ name: "item", attributes: { id: "1" } });
			const query = new XmlQuery([el]);
			query.setText(e => `text-${e.attributes.id}`);
			expect(el.text).toBe("text-1");
		});
	});

	describe("Structure mutations", () => {
		it("should append child element", () => {
			const parent = new DynamicElement({ name: "parent" });
			const child = new DynamicElement({ name: "child" });
			const query = new XmlQuery([parent]);
			query.appendChild(child);
			expect(parent.children.length).toBe(1);
		});

		it("should clear all children", () => {
			const parent = new DynamicElement({ name: "parent" });
			const child = new DynamicElement({ name: "child" });
			parent.addChild(child);
			const query = new XmlQuery([parent]);
			query.clearChildren();
			expect(parent.children.length).toBe(0);
		});
	});

	describe("Bulk mutations", () => {
		it("should update elements with object", () => {
			const el = new DynamicElement({ name: "item" });
			const query = new XmlQuery([el]);
			query.updateElements({ text: "updated" });
			expect(el.text).toBe("updated");
		});

		it("should update elements with function", () => {
			const el = new DynamicElement({ name: "item", attributes: { id: "1" } });
			const query = new XmlQuery([el]);
			query.updateElements(() => ({ attributes: { id: "updated" } }));
			expect(el.attributes.id).toBe("updated");
		});

		it("should remove elements from parent", () => {
			const parent = new DynamicElement({ name: "parent" });
			const child1 = new DynamicElement({ name: "child" });
			const child2 = new DynamicElement({ name: "child" });
			parent.addChild(child1);
			parent.addChild(child2);

			const query = new XmlQuery([child1]);
			query.removeElements();
			expect(parent.children).not.toContain(child1);
			expect(parent.children).toContain(child2);
		});
	});
});
