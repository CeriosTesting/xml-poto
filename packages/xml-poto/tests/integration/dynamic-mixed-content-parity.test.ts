/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { DynamicElement, XmlDynamic, XmlRoot, XmlSerializer } from "../../src";

/**
 * A DynamicElement can be serialized two ways: directly via `DynamicElement.toXml`,
 * or through the decorator pipeline when it is a member of a decorated class. The
 * second path used to drop text that sat alongside child elements, so the same tree
 * produced different XML depending on how it was written.
 */
describe("DynamicElement mixed content is serialized the same by both paths", () => {
	function mixedTree(): DynamicElement {
		const root = new DynamicElement({ name: "para", attributes: {} });
		root.textNodes = ["Hello ", " world"];
		root.createChild({ name: "em", text: "there" });
		return root;
	}

	it("DynamicElement.toXml keeps the text alongside children", () => {
		expect(mixedTree().toXml()).toContain("Hello ");
		expect(mixedTree().toXml()).toContain(" world");
	});

	it("the decorator pipeline keeps it too", () => {
		@XmlRoot({ name: "doc" })
		class Doc {
			@XmlDynamic()
			content!: DynamicElement;
		}

		const doc = new Doc();
		const wrapper = new DynamicElement({ name: "wrapper", attributes: {} });
		const para = mixedTree();
		para.parent = wrapper;
		wrapper.children.push(para);
		doc.content = wrapper;

		const xml = new XmlSerializer().toXml(doc);

		expect(xml).toContain("<em>there</em>");
		// The regression: text vanished as soon as the element also had children.
		expect(xml).toContain("Hello ");
		expect(xml).toContain(" world");
	});

	it("still self-closes an element with neither text nor children", () => {
		@XmlRoot({ name: "doc" })
		class Doc {
			@XmlDynamic()
			content!: DynamicElement;
		}

		const doc = new Doc();
		const wrapper = new DynamicElement({ name: "wrapper", attributes: {} });
		wrapper.createChild({ name: "empty" });
		doc.content = wrapper;

		expect(new XmlSerializer().toXml(doc)).toContain("<empty/>");
	});
});
