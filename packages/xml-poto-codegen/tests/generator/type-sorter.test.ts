import { describe, expect, it } from "vitest";

import { sortTypesByDependency } from "../../src/generator/type-sorter";
import type { ResolvedProperty, ResolvedType } from "../../src/xsd/xsd-resolver";

interface TypeSpec {
	name: string;
	base?: string;
	elementRefs?: string[];
	arrayRefs?: string[];
}

function makeType(spec: TypeSpec): ResolvedType {
	const properties: ResolvedProperty[] = [];
	for (const ref of spec.elementRefs ?? []) {
		properties.push({
			propertyName: ref.toLowerCase(),
			xmlName: ref,
			kind: "element",
			tsType: ref,
			initializer: `new ${ref}()`,
			complexTypeName: ref,
		});
	}
	for (const ref of spec.arrayRefs ?? []) {
		properties.push({
			propertyName: `${ref.toLowerCase()}Items`,
			xmlName: ref,
			kind: "array",
			tsType: `${ref}[]`,
			initializer: "[]",
			arrayItemType: ref,
		});
	}
	return {
		className: spec.name,
		xmlName: spec.name,
		isRootElement: false,
		properties,
		baseTypeName: spec.base,
	};
}

function sortedNames(specs: TypeSpec[]): string[] {
	return sortTypesByDependency(specs.map(makeType)).sorted.map((t) => t.className);
}

describe("sortTypesByDependency", () => {
	it("returns an empty result for no types", () => {
		const result = sortTypesByDependency([]);
		expect(result.sorted).toEqual([]);
		expect(result.lazyRefs.size).toBe(0);
	});

	it("preserves document order for independent types", () => {
		expect(sortedNames([{ name: "C" }, { name: "A" }, { name: "B" }])).toEqual(["C", "A", "B"]);
	});

	it("returns already-valid dependency order unchanged", () => {
		expect(
			sortedNames([{ name: "Base" }, { name: "Derived", base: "Base" }, { name: "Wrapper", elementRefs: ["Derived"] }]),
		).toEqual(["Base", "Derived", "Wrapper"]);
	});

	it("moves a base class before its derived class", () => {
		expect(sortedNames([{ name: "Derived", base: "Base" }, { name: "Base" }])).toEqual(["Base", "Derived"]);
	});

	it("reorders a reversed inheritance chain", () => {
		expect(sortedNames([{ name: "C", base: "B" }, { name: "B", base: "A" }, { name: "A" }])).toEqual(["A", "B", "C"]);
	});

	it("moves decorator-referenced types before their referrers", () => {
		// Mirrors an alphabetically-ordered XSD: referencing type declared first.
		expect(
			sortedNames([
				{ name: "AanvullendeAangifte", elementRefs: ["CollectieveAangifte"] },
				{ name: "CollectieveAangifte", arrayRefs: ["TotaalRegeling"] },
				{ name: "TotaalRegeling" },
			]),
		).toEqual(["TotaalRegeling", "CollectieveAangifte", "AanvullendeAangifte"]);
	});

	it("handles diamond dependencies while preserving document order among peers", () => {
		expect(
			sortedNames([
				{ name: "Top", elementRefs: ["Left", "Right"] },
				{ name: "Left", elementRefs: ["Bottom"] },
				{ name: "Right", elementRefs: ["Bottom"] },
				{ name: "Bottom" },
			]),
		).toEqual(["Bottom", "Left", "Right", "Top"]);
	});

	it("ignores base types and references outside the type set", () => {
		const result = sortTypesByDependency([
			makeType({ name: "A", base: "ExternalBase", elementRefs: ["ExternalRef"] }),
			makeType({ name: "B" }),
		]);
		expect(result.sorted.map((t) => t.className)).toEqual(["A", "B"]);
		expect(result.lazyRefs.size).toBe(0);
	});

	it("marks both directions of a two-type cycle as lazy", () => {
		const result = sortTypesByDependency([
			makeType({ name: "A", elementRefs: ["B"] }),
			makeType({ name: "B", elementRefs: ["A"] }),
		]);
		expect(result.sorted.map((t) => t.className)).toEqual(["A", "B"]);
		expect(result.lazyRefs.get("A")).toEqual(new Set(["B"]));
		expect(result.lazyRefs.get("B")).toEqual(new Set(["A"]));
	});

	it("marks a self-reference as lazy", () => {
		const result = sortTypesByDependency([makeType({ name: "Section", arrayRefs: ["Section"] })]);
		expect(result.sorted.map((t) => t.className)).toEqual(["Section"]);
		expect(result.lazyRefs.get("Section")).toEqual(new Set(["Section"]));
	});

	it("orders extends edges inside a mixed cycle and marks only the soft back-edge lazy", () => {
		// B extends A (hard), A references B via decorator (soft): one SCC.
		// The extends edge must still be satisfied by order (A before B); only
		// the decorator reference becomes a thunk.
		const result = sortTypesByDependency([
			makeType({ name: "B", base: "A" }),
			makeType({ name: "A", elementRefs: ["B"] }),
		]);
		expect(result.sorted.map((t) => t.className)).toEqual(["A", "B"]);
		expect(result.lazyRefs.get("A")).toEqual(new Set(["B"]));
		expect(result.lazyRefs.has("B")).toBe(false);
	});

	it("does not mark acyclic references as lazy even when cycles exist elsewhere", () => {
		const result = sortTypesByDependency([
			makeType({ name: "A", elementRefs: ["B"] }),
			makeType({ name: "B", elementRefs: ["A"] }),
			makeType({ name: "C", elementRefs: ["A"] }),
		]);
		expect(result.lazyRefs.has("C")).toBe(false);
		expect(result.sorted.map((t) => t.className)).toEqual(["A", "B", "C"]);
	});

	it("throws a descriptive error on an inheritance cycle", () => {
		expect(() =>
			sortTypesByDependency([makeType({ name: "A", base: "B" }), makeType({ name: "B", base: "A" })]),
		).toThrow(/extends.*A, B/s);
	});

	it("throws on a self-extending type", () => {
		expect(() => sortTypesByDependency([makeType({ name: "A", base: "A" })])).toThrow(/extends/);
	});

	it("reports no same-module clusters for acyclic input or soft-only cycles", () => {
		const acyclic = sortTypesByDependency([makeType({ name: "Base" }), makeType({ name: "Derived", base: "Base" })]);
		expect(acyclic.sameModuleClusters).toEqual([]);

		// Soft-only cycles are safe across modules (all back-refs are thunks).
		const softCycle = sortTypesByDependency([
			makeType({ name: "A", elementRefs: ["B"] }),
			makeType({ name: "B", elementRefs: ["A"] }),
		]);
		expect(softCycle.sameModuleClusters).toEqual([]);
	});

	it("clusters classes linked by an extends edge inside a cycle, base first", () => {
		const result = sortTypesByDependency([
			makeType({ name: "B", base: "A" }),
			makeType({ name: "A", elementRefs: ["B"] }),
			makeType({ name: "C" }),
		]);
		expect(result.sameModuleClusters).toEqual([["A", "B"]]);
	});

	it("clusters a whole inheritance chain that closes a cycle", () => {
		// C extends B extends A, A soft-refs C: one SCC, both extends edges inside it.
		const result = sortTypesByDependency([
			makeType({ name: "A", elementRefs: ["C"] }),
			makeType({ name: "B", base: "A" }),
			makeType({ name: "C", base: "B" }),
		]);
		expect(result.sameModuleClusters).toEqual([["A", "B", "C"]]);
	});

	it("handles a larger cycle through mixed reference kinds", () => {
		const result = sortTypesByDependency([
			makeType({ name: "A", elementRefs: ["B"] }),
			makeType({ name: "B", arrayRefs: ["C"] }),
			makeType({ name: "C", elementRefs: ["A"] }),
		]);
		expect(result.sorted.map((t) => t.className)).toEqual(["A", "B", "C"]);
		expect(result.lazyRefs.get("A")).toEqual(new Set(["B"]));
		expect(result.lazyRefs.get("B")).toEqual(new Set(["C"]));
		expect(result.lazyRefs.get("C")).toEqual(new Set(["A"]));
	});
});
