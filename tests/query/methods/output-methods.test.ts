import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("OutputMethods", () => {
	describe("Transformation", () => {
		it("should map elements to values", () => {
			const elements = [
				new DynamicElement({ name: "item", text: "a" }),
				new DynamicElement({ name: "item", text: "b" }),
			];
			const result = new XmlQuery(elements).map(el => el.text);
			expect(result).toEqual(["a", "b"]);
		});

		it("should execute function for each element", () => {
			const elements = [new DynamicElement({ name: "item" })];
			const names: string[] = [];
			new XmlQuery(elements).each(el => names.push(el.name));
			expect(names).toEqual(["item"]);
		});

		it("should reduce elements", () => {
			const elements = [1, 2, 3].map(n => new DynamicElement({ name: "i", numericValue: n }));
			const sum = new XmlQuery(elements).reduce((acc, el) => acc + (el.numericValue ?? 0), 0);
			expect(sum).toBe(6);
		});
	});

	describe("JSON output", () => {
		it("should convert to JSON", () => {
			const el = new DynamicElement({ name: "item", text: "content" });
			const json = new XmlQuery([el]).toJSON();
			expect(json).toBe("content"); // simplified leaf
		});

		it("should convert to JSON with metadata", () => {
			const el = new DynamicElement({ name: "item" });
			const json = new XmlQuery([el]).toJSON({ includeMetadata: true, simplifyLeaves: false });
			expect(json["@metadata"]).toBeDefined();
		});

		it("should handle empty query", () => {
			const json = new XmlQuery([]).toJSON();
			expect(json).toBeNull();
		});
	});

	describe("Utility output", () => {
		it("should convert to map", () => {
			const elements = [
				new DynamicElement({ name: "item", attributes: { id: "1" }, text: "a" }),
				new DynamicElement({ name: "item", attributes: { id: "2" }, text: "b" }),
			];
			const map = new XmlQuery(elements).toMap(el => el.attributes.id);
			expect(map["1"]).toBe("a");
			expect(map["2"]).toBe("b");
		});

		it("should print for debugging", () => {
			const el = new DynamicElement({ name: "item", attributes: { id: "1" }, text: "content" });
			const output = new XmlQuery([el]).print();
			expect(output).toContain("item");
			expect(output).toContain('id="1"');
		});

		it("should get stats", () => {
			const elements = [
				new DynamicElement({ name: "a", text: "text", attributes: { id: "1" } }),
				new DynamicElement({ name: "b" }),
			];
			const stats = new XmlQuery(elements).stats();
			expect(stats.count).toBe(2);
			expect(stats.withText).toBe(1);
			expect(stats.withAttributes).toBe(1);
		});
	});
});
