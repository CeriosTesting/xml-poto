import path from "node:path";

import { describe, expect, it } from "vitest";

import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedProperty, ResolvedSchema, ResolvedType } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

const resolved: ResolvedSchema = new XsdResolver().resolve(
	new XsdParser().parseFile(path.join(FIXTURES, "wildcards-and-simple-types.xsd")),
);

function typeNamed(className: string): ResolvedType {
	const type = resolved.types.find((t) => t.className === className);
	if (!type) throw new Error(`No generated type '${className}'`);
	return type;
}

function propNamed(type: ResolvedType, propertyName: string): ResolvedProperty {
	const prop = type.properties.find((p) => p.propertyName === propertyName);
	if (!prop) throw new Error(`No property '${propertyName}' on ${type.className}`);
	return prop;
}

const record = typeNamed("Record");

describe("xs:any inside xs:choice", () => {
	it("emits a dynamic member for the wildcard branch instead of dropping it", () => {
		const wildcard = record.properties.find((p) => p.kind === "dynamic");

		expect(wildcard).toBeDefined();
		expect(wildcard?.tsType).toBe("DynamicElement");
		expect(wildcard?.documentation).toContain('namespace="##other"');
		expect(wildcard?.documentation).toContain('processContents="lax"');
	});

	it("never marks a wildcard branch required — another branch may be taken instead", () => {
		expect(record.properties.find((p) => p.kind === "dynamic")?.required).toBeUndefined();
	});
});

describe("inline xs:union members", () => {
	it("resolves members declared inline rather than falling back to string", () => {
		expect(propNamed(record, "size").tsType).toBe("number | string");
	});

	it("combines the attribute form with inline members", () => {
		expect(propNamed(record, "mixed").tsType).toBe("boolean | string");
	});

	it("documents what the union is made of", () => {
		expect(propNamed(record, "size").documentation).toContain("xs:union of");
	});

	it("does not constrain a union whose members are not all enumerated", () => {
		// One member is a plain xs:int, which admits anything numeric — an enumValues
		// list drawn from the other member alone would reject valid documents.
		expect(propNamed(record, "size").enumValues).toBeUndefined();
	});
});

describe("inline xs:list item type", () => {
	it("resolves the inline item type and keeps list semantics", () => {
		const codes = propNamed(record, "codes");

		expect(codes.isList).toBe(true);
		expect(codes.listItemType).toBe("number");
		expect(codes.tsType).toBe("number[]");
	});
});

describe("built-in list types", () => {
	it("generates IDREFS, NMTOKENS and ENTITIES as lists, not as a single string", () => {
		for (const name of ["refs", "tokens", "entities"]) {
			const prop = propNamed(record, name);
			expect({ name, isList: prop.isList, itemType: prop.listItemType, tsType: prop.tsType }).toEqual({
				name,
				isList: true,
				itemType: "string",
				tsType: "string[]",
			});
		}
	});

	it("keeps the singular ENTITY and NOTATION scalar rather than a list", () => {
		for (const name of ["entity", "notation"]) {
			const prop = propNamed(record, name);
			expect({ name, isList: prop.isList, tsType: prop.tsType }).toEqual({
				name,
				isList: undefined,
				tsType: "string",
			});
		}
	});
});
