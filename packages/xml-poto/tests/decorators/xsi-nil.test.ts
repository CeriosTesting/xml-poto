/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it, vi } from "vitest";

import { XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("xsi:nil round-trip", () => {
	@XmlRoot({ name: "Record" })
	class Record {
		@XmlElement()
		name: string = "";

		@XmlElement({ isNullable: true })
		value: string | null = null;
	}

	it("should serialize null to xsi:nil='true'", () => {
		const serializer = new XmlDecoratorSerializer();
		const record = new Record();
		record.name = "test";
		record.value = null;

		const xml = serializer.toXml(record);
		expect(xml).toContain(`xsi:nil="true"`);
	});

	it("should deserialize xsi:nil='true' back to null", () => {
		const serializer = new XmlDecoratorSerializer();
		const record = serializer.fromXml(
			`<Record><name>test</name><value xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/></Record>`,
			Record,
		);
		expect(record.name).toBe("test");
		expect(record.value).toBeNull();
	});

	it("should round-trip null through serialize + deserialize", () => {
		const serializer = new XmlDecoratorSerializer();
		const record = new Record();
		record.name = "roundtrip";
		record.value = null;

		const restored = serializer.fromXml(serializer.toXml(record), Record);
		expect(restored.name).toBe("roundtrip");
		expect(restored.value).toBeNull();
	});

	it("should handle custom xsi prefixes", () => {
		const serializer = new XmlDecoratorSerializer();
		const record = serializer.fromXml(
			`<Record><name>x</name><value custom:nil="true" xmlns:custom="http://www.w3.org/2001/XMLSchema-instance"/></Record>`,
			Record,
		);
		expect(record.value).toBeNull();
	});

	it("should not deserialize to null when isNullable is not set", () => {
		@XmlRoot({ name: "Plain" })
		class Plain {
			@XmlElement()
			value: string = "";
		}

		const serializer = new XmlDecoratorSerializer();
		const plain = serializer.fromXml(
			`<Plain><value xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/></Plain>`,
			Plain,
		);
		expect(plain.value).not.toBeNull();
	});

	it("should not treat nil='false' as null", () => {
		const serializer = new XmlDecoratorSerializer();
		const record = serializer.fromXml(
			`<Record><name>x</name><value xsi:nil="false" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">text</value></Record>`,
			Record,
		);
		expect(record.value).not.toBeNull();
	});
});

describe("array minOccurs/maxOccurs", () => {
	it("should enforce occurs bounds on arrays", async () => {
		const { XmlArray } = await import("../../src");

		@XmlRoot({ name: "Order" })
		class Order {
			@XmlArray({ itemName: "Item", minOccurs: 1, maxOccurs: 2 })
			items: string[] = [];
		}

		const serializer = new XmlDecoratorSerializer();

		expect(() => serializer.fromXml("<Order><Item>a</Item><Item>b</Item><Item>c</Item></Order>", Order)).toThrow(
			/maxOccurs is 2/,
		);

		const order = serializer.fromXml("<Order><Item>a</Item></Order>", Order);
		expect(order.items).toEqual(["a"]);

		const tooMany = new Order();
		tooMany.items = ["a", "b", "c"];
		expect(() => serializer.toXml(tooMany)).toThrow(/maxOccurs is 2/);

		const tooFew = new Order();
		tooFew.items = [];
		expect(() => serializer.toXml(tooFew)).toThrow(/minOccurs is 1/);
	});

	it("should tune minOccurs and maxOccurs independently via validationModeOverrides", async () => {
		const { XmlArray } = await import("../../src");

		@XmlRoot({ name: "Order" })
		class Order {
			@XmlArray({ itemName: "Item", minOccurs: 1, maxOccurs: 2 })
			items: string[] = [];
		}

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const serializer = new XmlDecoratorSerializer({
				validationModeOverrides: { maxOccurs: "warn" },
			});

			// maxOccurs violation only warns
			const order = serializer.fromXml("<Order><Item>a</Item><Item>b</Item><Item>c</Item></Order>", Order);
			expect(order.items).toEqual(["a", "b", "c"]);
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("maxOccurs is 2"));

			// minOccurs stays strict
			const tooFew = new Order();
			tooFew.items = [];
			expect(() => serializer.toXml(tooFew)).toThrow(/minOccurs is 1/);
		} finally {
			warnSpy.mockRestore();
		}
	});
});
