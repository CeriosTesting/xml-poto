import { describe, expect, it } from "vitest";

import { XmlArray, XmlDecoratorSerializer, XmlDynamic, XmlElement, XmlRoot } from "../../src";
import { DynamicElement } from "../../src/query/dynamic-element";

describe("Decorator ordering during serialization", () => {
	it("should serialize XmlArray and XmlElement based on order values", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ name: "second", order: 2 })
			second: string = "B";

			@XmlArray({ itemName: "firstItem", order: 1 })
			firstItems: string[] = ["A"];

			@XmlElement({ name: "third" })
			third: string = "C";
		}

		const serializer = new XmlDecoratorSerializer();
		const xml = serializer.toXml(new Doc());

		const firstItemIndex = xml.indexOf("<firstItem>");
		const secondIndex = xml.indexOf("<second>");
		const thirdIndex = xml.indexOf("<third>");

		expect(firstItemIndex).toBeGreaterThan(-1);
		expect(secondIndex).toBeGreaterThan(-1);
		expect(thirdIndex).toBeGreaterThan(-1);
		expect(firstItemIndex).toBeLessThan(secondIndex);
		expect(secondIndex).toBeLessThan(thirdIndex);
	});

	it("should serialize XmlDynamic based on order values", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ name: "late", order: 3 })
			late: string = "L";

			@XmlDynamic({ order: 1 })
			dynamic?: DynamicElement;

			@XmlElement({ name: "middle", order: 2 })
			middle: string = "M";
		}

		const serializer = new XmlDecoratorSerializer();
		const doc = new Doc();
		Object.defineProperty(doc, "dynamic", {
			value: "D",
			enumerable: true,
			configurable: true,
			writable: true,
		});
		const xml = serializer.toXml(doc);

		const dynamicIndex = xml.indexOf("<dynamic>");
		const middleIndex = xml.indexOf("<middle>");
		const lateIndex = xml.indexOf("<late>");

		expect(dynamicIndex).toBeGreaterThan(-1);
		expect(middleIndex).toBeGreaterThan(-1);
		expect(lateIndex).toBeGreaterThan(-1);
		expect(dynamicIndex).toBeLessThan(middleIndex);
		expect(middleIndex).toBeLessThan(lateIndex);
	});
});
