import { DynamicElement } from "../../../src/query/dynamic-element";
import { XmlQuery } from "../../../src/query/xml-query";

describe("AggregationMethods", () => {
	function createNumericElements(...values: number[]): DynamicElement[] {
		return values.map((val, idx) => new DynamicElement({ name: `item${idx}`, text: String(val), numericValue: val }));
	}

	describe("Basic aggregation", () => {
		it("should get first element", () => {
			const elements = createNumericElements(1, 2, 3);
			expect(new XmlQuery(elements).first()?.numericValue).toBe(1);
		});

		it("should get last element", () => {
			const elements = createNumericElements(1, 2, 3);
			expect(new XmlQuery(elements).last()?.numericValue).toBe(3);
		});

		it("should count elements", () => {
			const elements = createNumericElements(1, 2, 3);
			expect(new XmlQuery(elements).count()).toBe(3);
		});

		it("should sum values", () => {
			const elements = createNumericElements(10, 20, 30);
			expect(new XmlQuery(elements).sum()).toBe(60);
		});

		it("should calculate average", () => {
			const elements = createNumericElements(10, 20, 30);
			expect(new XmlQuery(elements).average()).toBe(20);
		});

		it("should find min", () => {
			const elements = createNumericElements(10, 5, 20);
			expect(new XmlQuery(elements).min()).toBe(5);
		});

		it("should find max", () => {
			const elements = createNumericElements(10, 5, 20);
			expect(new XmlQuery(elements).max()).toBe(20);
		});
	});

	describe("Statistical methods", () => {
		it("should calculate median for odd count", () => {
			const elements = createNumericElements(1, 2, 3, 4, 5);
			expect(new XmlQuery(elements).median()).toBe(3);
		});

		it("should calculate median for even count", () => {
			const elements = createNumericElements(1, 2, 3, 4);
			expect(new XmlQuery(elements).median()).toBe(2.5);
		});

		it("should calculate mode", () => {
			const elements = createNumericElements(1, 2, 2, 3, 3, 3, 4);
			expect(new XmlQuery(elements).mode()).toBe(3);
		});

		it("should calculate variance", () => {
			const elements = createNumericElements(2, 4, 6, 8, 10);
			expect(new XmlQuery(elements).variance()).toBe(8);
		});

		it("should calculate standard deviation", () => {
			const elements = createNumericElements(2, 4, 6, 8, 10);
			expect(new XmlQuery(elements).standardDeviation()).toBeCloseTo(Math.sqrt(8));
		});

		it("should calculate percentile", () => {
			const elements = createNumericElements(1, 2, 3, 4, 5);
			expect(new XmlQuery(elements).percentile(50)).toBe(3);
			expect(new XmlQuery(elements).percentile(0)).toBe(1);
			expect(new XmlQuery(elements).percentile(100)).toBe(5);
		});
	});

	describe("Extraction", () => {
		it("should extract texts", () => {
			const elements = [
				new DynamicElement({ name: "item", text: "a" }),
				new DynamicElement({ name: "item", text: "b" }),
			];
			expect(new XmlQuery(elements).texts()).toEqual(["a", "b"]);
		});

		it("should extract values", () => {
			const elements = createNumericElements(10, 20);
			expect(new XmlQuery(elements).values()).toEqual([10, 20]);
		});

		it("should extract attributes", () => {
			const elements = [
				new DynamicElement({ name: "item", attributes: { id: "1" } }),
				new DynamicElement({ name: "item", attributes: { id: "2" } }),
			];
			expect(new XmlQuery(elements).attributes("id")).toEqual(["1", "2"]);
		});
	});

	describe("Grouping", () => {
		it("should group by name", () => {
			const elements = [
				new DynamicElement({ name: "a" }),
				new DynamicElement({ name: "b" }),
				new DynamicElement({ name: "a" }),
			];
			const grouped = new XmlQuery(elements).groupByName();
			expect(grouped.get("a")?.length).toBe(2);
			expect(grouped.get("b")?.length).toBe(1);
		});

		it("should group by custom selector", () => {
			const elements = createNumericElements(1, 2, 3, 4, 5);
			const grouped = new XmlQuery(elements).groupBy(el => (el.numericValue ?? 0) > 2);
			expect(grouped.get(false)?.length).toBe(2);
			expect(grouped.get(true)?.length).toBe(3);
		});
	});

	describe("Predicates", () => {
		it("should check exists", () => {
			expect(new XmlQuery([]).exists()).toBe(false);
			expect(new XmlQuery(createNumericElements(1)).exists()).toBe(true);
		});

		it("should check all", () => {
			const elements = createNumericElements(2, 4, 6);
			expect(new XmlQuery(elements).all(el => (el.numericValue ?? 0) % 2 === 0)).toBe(true);
			expect(new XmlQuery(elements).all(el => (el.numericValue ?? 0) > 3)).toBe(false);
		});

		it("should check any", () => {
			const elements = createNumericElements(1, 2, 3);
			expect(new XmlQuery(elements).any(el => (el.numericValue ?? 0) > 2)).toBe(true);
			expect(new XmlQuery(elements).any(el => (el.numericValue ?? 0) > 10)).toBe(false);
		});
	});
});
