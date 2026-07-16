/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlRoot, XmlText } from "../../src";

describe("xs:list support", () => {
	it("should round-trip a number list element", () => {
		@XmlRoot({ name: "Product" })
		class Product {
			@XmlElement({ list: { itemType: "number" } })
			sizes: number[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		const product = new Product();
		product.sizes = [1, 2, 3];

		const xml = serializer.toXml(product);
		expect(xml).toContain("<sizes>1 2 3</sizes>");

		const restored = serializer.fromXml(xml, Product);
		expect(restored.sizes).toEqual([1, 2, 3]);
	});

	it("should round-trip a string list element with list: true", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ list: true })
			tags: string[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		const doc = new Doc();
		doc.tags = ["alpha", "beta", "gamma"];

		const xml = serializer.toXml(doc);
		expect(xml).toContain("<tags>alpha beta gamma</tags>");

		const restored = serializer.fromXml(xml, Doc);
		expect(restored.tags).toEqual(["alpha", "beta", "gamma"]);
	});

	it("should round-trip a list attribute", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlAttribute({ list: { itemType: "number" } })
			ids: number[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		const doc = new Doc();
		doc.ids = [10, 20];

		const xml = serializer.toXml(doc);
		expect(xml).toContain(`ids="10 20"`);

		const restored = serializer.fromXml(xml, Doc);
		expect(restored.ids).toEqual([10, 20]);
	});

	it("should round-trip list text content", () => {
		@XmlRoot({ name: "Values" })
		class Values {
			@XmlText({ list: { itemType: "boolean" } })
			flags: boolean[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		const values = new Values();
		values.flags = [true, false, true];

		const xml = serializer.toXml(values);
		expect(xml).toContain(">true false true</Values>");

		const restored = serializer.fromXml(xml, Values);
		expect(restored.flags).toEqual([true, false, true]);
	});

	it("should deserialize a single-item list to a one-element array", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ list: { itemType: "number" } })
			sizes: number[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		const doc = serializer.fromXml("<Doc><sizes>7</sizes></Doc>", Doc);
		expect(doc.sizes).toEqual([7]);
	});

	it("should apply length facets to the list item count", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ list: { itemType: "number" }, minLength: 2, maxLength: 3 })
			sizes: number[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		expect(() => serializer.fromXml("<Doc><sizes>1</sizes></Doc>", Doc)).toThrow(/at least 2/);
		expect(() => serializer.fromXml("<Doc><sizes>1 2 3 4</sizes></Doc>", Doc)).toThrow(/at most 3/);
		expect(serializer.fromXml("<Doc><sizes>1 2</sizes></Doc>", Doc).sizes).toEqual([1, 2]);
	});

	it("should validate item facets against each list item", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ list: { itemType: "number" }, maxInclusive: 10 })
			sizes: number[] = [];
		}

		const serializer = new XmlDecoratorSerializer();
		expect(() => serializer.fromXml("<Doc><sizes>5 20</sizes></Doc>", Doc)).toThrow(/greater than maxInclusive 10/);
	});
});
