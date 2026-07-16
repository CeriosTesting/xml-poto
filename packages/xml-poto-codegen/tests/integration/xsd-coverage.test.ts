import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { GeneratedFile } from "../../src/generator/class-generator";
import { ClassGenerator } from "../../src/generator/class-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedSchema } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

function pipeline(fixtureName: string): { resolved: ResolvedSchema; files: GeneratedFile[] } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: fixtureName });
	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const resolved = resolver.resolve(schema);
	const files = generator.generatePerType(resolved);
	return { resolved, files };
}

// ── xs:annotation / xs:documentation → JSDoc ────────────────────────────────

describe("xs:documentation → JSDoc", () => {
	it("parses documentation on schema, types, elements, and attributes", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "documentation.xsd"));

		expect(schema.documentation).toBe("Schema-level documentation.");
		expect(schema.simpleTypes[0].documentation).toBe("The processing status of an order.");
		expect(schema.complexTypes[0].documentation).toContain("A customer with a name and status.");
		expect(schema.complexTypes[0].sequence!.elements[0].documentation).toBe("The full name of the customer.");
		expect(schema.complexTypes[0].attributes[0].documentation).toBe("Unique customer identifier.");
		expect(schema.elements[0].documentation).toBe("Root element for a single customer.");
	});

	it("collapses internal whitespace in multi-line documentation", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "documentation.xsd"));

		expect(schema.complexTypes[0].documentation).toBe(
			"A customer with a name and status. Spans multiple lines in the source document.",
		);
	});

	it("emits JSDoc for classes, properties, and enums", () => {
		const { files } = pipeline("documentation.xsd");

		const customer = files.find((f) => f.fileName === "customer-type.ts")!;
		expect(customer.content).toContain(
			"/** A customer with a name and status. Spans multiple lines in the source document. */",
		);
		expect(customer.content).toContain("/** The full name of the customer. */");
		expect(customer.content).toContain("/** Unique customer identifier. */");

		const status = files.find((f) => f.fileName === "status-type.ts")!;
		expect(status.content).toContain("/** The processing status of an order. */");
	});
});

// ── xs:length facet ─────────────────────────────────────────────────────────

describe("xs:length facet", () => {
	it("parses length on restrictions", () => {
		const parser = new XsdParser();
		const schema = parser.parseString(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="CountryCode">
		<xs:restriction base="xs:string">
			<xs:length value="2"/>
		</xs:restriction>
	</xs:simpleType>
</xs:schema>`);

		expect(schema.simpleTypes[0].restriction!.length).toBe(2);
	});
});

// ── Multiple xs:pattern facets ──────────────────────────────────────────────

describe("multiple xs:pattern facets", () => {
	it("ORs multiple patterns into a single combined pattern", () => {
		const parser = new XsdParser();
		const schema = parser.parseString(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="PhoneOrFax">
		<xs:restriction base="xs:string">
			<xs:pattern value="P[0-9]+"/>
			<xs:pattern value="F[0-9]+"/>
		</xs:restriction>
	</xs:simpleType>
</xs:schema>`);

		expect(schema.simpleTypes[0].restriction!.pattern).toBe("(?:P[0-9]+)|(?:F[0-9]+)");
	});
});

// ── complexContent restriction with choice/all ──────────────────────────────

describe("complexContent restriction compositors", () => {
	it("resolves choice inside a complexContent restriction", () => {
		const { resolved } = pipeline("restriction-content.xsd");

		const choiceShape = resolved.types.find((t) => t.className === "ChoiceShape")!;
		expect(choiceShape.baseTypeName).toBe("BaseShape");
		const propNames = choiceShape.properties.map((p) => p.propertyName);
		expect(propNames).toContain("circle");
		expect(propNames).toContain("square");
		for (const prop of choiceShape.properties) {
			expect(prop.required).toBe(false);
		}
	});

	it("resolves all inside a complexContent restriction", () => {
		const { resolved } = pipeline("restriction-content.xsd");

		const allShape = resolved.types.find((t) => t.className === "AllShape")!;
		const propNames = allShape.properties.map((p) => p.propertyName);
		expect(propNames).toContain("width");
		expect(propNames).toContain("height");
	});
});

// ── xs:all with minOccurs ───────────────────────────────────────────────────

describe("xs:all occurs", () => {
	it("parses minOccurs on xs:all", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "all-occurs.xsd"));

		expect(schema.elements[0].complexType!.all!.minOccurs).toBe(0);
	});

	it("makes all members optional when the all group has minOccurs=0", () => {
		const { resolved } = pipeline("all-occurs.xsd");

		const config = resolved.types.find((t) => t.className === "Config")!;
		const requiredProps = config.properties.filter((p) => p.required !== false).map((p) => p.propertyName);
		expect(requiredProps).toEqual([]);
	});
});

// ── Prohibited attributes ───────────────────────────────────────────────────

describe("prohibited attributes", () => {
	it("omits use=prohibited attributes and records a coverage note", () => {
		const { resolved } = pipeline("prohibited.xsd");

		const finalDoc = resolved.types.find((t) => t.className === "FinalDocument")!;
		const propNames = finalDoc.properties.map((p) => p.propertyName);
		expect(propNames).not.toContain("draft");
		expect(propNames).toContain("author");

		expect(resolved.coverageNotes).toContainEqual(expect.stringContaining("draft"));
	});
});

// ── Identity constraints and notations ──────────────────────────────────────

describe("identity constraints and notations", () => {
	it("parses key/unique constraints and notation declarations", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "identity-constraints.xsd"));

		expect(schema.notations).toEqual(["jpeg"]);
		const library = schema.elements[0];
		expect(library.identityConstraints).toEqual([
			{ kind: "key", name: "bookKey" },
			{ kind: "unique", name: "uniqueIsbn" },
		]);
	});

	it("emits coverage notes for identity constraints and notations", () => {
		const { resolved } = pipeline("identity-constraints.xsd");

		expect(resolved.coverageNotes).toContainEqual(expect.stringContaining("bookKey"));
		expect(resolved.coverageNotes).toContainEqual(expect.stringContaining("uniqueIsbn"));
		expect(resolved.coverageNotes).toContainEqual(expect.stringContaining("jpeg"));
	});
});

// ── xs:redefine ─────────────────────────────────────────────────────────────

describe("xs:redefine", () => {
	it("merges the redefined schema like an include and warns", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const { resolved } = pipeline("redefine-main.xsd");

			const classNames = resolved.types.map((t) => t.className);
			expect(classNames).toContain("AddressType");
			expect(classNames).toContain("Shipment");

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("xs:redefine"));
		} finally {
			warnSpy.mockRestore();
		}
	});
});

// ── Remote schemaLocation warnings ──────────────────────────────────────────

describe("remote and missing schemaLocation", () => {
	it("warns for remote URLs instead of silently skipping", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const parser = new XsdParser();
			parser.parseString(
				`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:import namespace="http://example.com/remote" schemaLocation="https://example.com/remote.xsd"/>
</xs:schema>`,
				FIXTURES,
			);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("remote URL"));
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("warns for missing local files instead of silently skipping", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const parser = new XsdParser();
			parser.parseString(
				`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:include schemaLocation="does-not-exist.xsd"/>
</xs:schema>`,
				FIXTURES,
			);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
		} finally {
			warnSpy.mockRestore();
		}
	});
});

// ── xs:union initializer preference ─────────────────────────────────────────

describe("xs:union", () => {
	it("prefers the string member initializer for mixed unions", () => {
		const parser = new XsdParser();
		const resolver = new XsdResolver();
		const schema = parser.parseString(`<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="NumberOrString">
		<xs:union memberTypes="xs:integer xs:string"/>
	</xs:simpleType>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Value" type="NumberOrString"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`);
		const resolved = resolver.resolve(schema);

		const root = resolved.types.find((t) => t.className === "Root")!;
		const value = root.properties.find((p) => p.propertyName === "value")!;
		expect(value.tsType).toBe("number | string");
		expect(value.initializer).toBe("''");
		expect(value.documentation).toContain("xs:union of xs:integer, xs:string");
	});
});
