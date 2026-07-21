import path from "node:path";

import { describe, expect, it } from "vitest";

import type { GeneratedFile } from "../../src/generator/class-generator";
import { ClassGenerator } from "../../src/generator/class-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedSchema } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

function pipeline(): { resolved: ResolvedSchema; perType: GeneratedFile[]; perXsd: GeneratedFile[] } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: "polymorphism.xsd" });
	const schema = parser.parseFile(path.join(FIXTURES, "polymorphism.xsd"));
	const resolved = resolver.resolve(schema);
	const perType = generator.generatePerType(resolved);
	const perXsd = generator.generatePerXsd(resolved, "shapes");
	return { resolved, perType, perXsd };
}

describe("codegen polymorphism (@XmlInclude + abstract)", () => {
	it("links subtypes onto their base type", () => {
		const { resolved } = pipeline();
		const base = resolved.types.find((t) => t.className === "ShapeType")!;
		expect(base.abstract).toBe(true);
		expect(base.derivedTypeNames?.sort()).toEqual(["CircleType", "SquareType"]);
	});

	it("emits @XmlInclude with subtype thunks and an abstract class in single-file mode", () => {
		const { perXsd } = pipeline();
		const content = perXsd[0].content;

		expect(content).toContain("import {");
		expect(content).toContain("XmlInclude");
		expect(content).toMatch(/@XmlInclude\(\(\) => CircleType, \(\) => SquareType\)/);
		expect(content).toContain("export abstract class ShapeType");
		// Subtypes carry @XmlType identity so xsi:type resolves at runtime.
		expect(content).toContain("export class CircleType extends ShapeType");
		expect(content).toContain("export class SquareType extends ShapeType");
	});

	it("keeps per-type files separate and omits @XmlInclude (subtypes self-register via @XmlType)", () => {
		const { perType } = pipeline();
		// Per-type mode preserves one file per class (no import cycle); @XmlInclude is
		// not emitted there — subtypes register their @XmlType identity on barrel load.
		const shapeFile = perType.find((f) => f.fileName === "shape-type.ts")!;
		expect(shapeFile).toBeDefined();
		expect(shapeFile.content).toContain("export abstract class ShapeType");
		expect(shapeFile.content).not.toContain("XmlInclude");

		const circleFile = perType.find((f) => f.fileName === "circle-type.ts")!;
		expect(circleFile).toBeDefined();
		expect(circleFile.content).toContain("class CircleType extends ShapeType");
		expect(circleFile.content).toContain("@XmlType(");
		expect(circleFile.content).toContain("name: 'CircleType'");
	});

	it("emits an abstract class in per-type mode too", () => {
		const { perType } = pipeline();
		const shapeFile = perType.find((f) => f.fileName === "shape-type.ts")!;
		expect(shapeFile.content).toContain("export abstract class ShapeType");
	});
});
