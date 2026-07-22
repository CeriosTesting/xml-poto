import path from "node:path";

import { describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedProperty, ResolvedSchema, ResolvedType } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

function resolveFixture(fixtureName: string): ResolvedSchema {
	const schema = new XsdParser().parseFile(path.join(FIXTURES, fixtureName));
	return new XsdResolver().resolve(schema);
}

function resolveInline(xsd: string): ResolvedSchema {
	return new XsdResolver().resolve(new XsdParser().parseString(xsd));
}

function typeNamed(resolved: ResolvedSchema, className: string): ResolvedType {
	const type = resolved.types.find((t) => t.className === className);
	if (!type)
		throw new Error(`No generated type '${className}' in [${resolved.types.map((t) => t.className).join(", ")}]`);
	return type;
}

function propNamed(type: ResolvedType, propertyName: string): ResolvedProperty {
	const prop = type.properties.find((p) => p.propertyName === propertyName);
	if (!prop) throw new Error(`No property '${propertyName}' on ${type.className}`);
	return prop;
}

describe("xs:element ref", () => {
	const resolved = resolveFixture("element-refs.xsd");
	const customer = typeNamed(resolved, "Customer");

	it("takes the referenced declaration's complex type instead of falling back to string", () => {
		const prop = propNamed(customer, "homeAddress");

		expect(prop.tsType).toBe("AddressType");
		expect(prop.complexTypeName).toBe("AddressType");
	});

	it("carries the referenced declaration's simple type and facets", () => {
		const prop = propNamed(customer, "country");

		expect(prop.pattern).toBe("[A-Z]{2}");
	});

	it("carries the referenced declaration's nillable and default", () => {
		expect(propNamed(customer, "country").isNullable).toBe(true);
		expect(propNamed(customer, "quantity").defaultValue).toBe("1");
		expect(propNamed(customer, "quantity").tsType).toBe("number");
	});

	it("qualifies a referenced element even when local elements are unqualified", () => {
		// A global element declaration is always namespace-qualified; elementFormDefault
		// governs local declarations only.
		expect(propNamed(customer, "name").form).not.toBe("qualified");
		expect(propNamed(customer, "homeAddress").form).toBe("qualified");
		expect(propNamed(customer, "homeAddress").namespace?.uri).toBe("http://example.com/refs");
	});

	it("reuses the class generated for a global element with an inline complex type", () => {
		// The top-level element loop already generates `Inline` for this content
		// model; a reference must point at it rather than mint a second `InlineType`.
		expect(propNamed(customer, "inline").complexTypeName).toBe("Inline");
		expect(resolved.types.map((t) => t.className)).not.toContain("InlineType");
	});

	it("keeps the occurrence constraints from the reference, not the declaration", () => {
		expect(propNamed(customer, "country").required).toBe(false);
		expect(propNamed(customer, "homeAddress").required).toBe(true);
	});
});

describe("xs:attribute ref", () => {
	const customer = typeNamed(resolveFixture("element-refs.xsd"), "Customer");

	it("takes the referenced declaration's type", () => {
		const prop = propNamed(customer, "revision");

		expect(prop.tsType).toBe("number");
		expect(prop.required).toBe(true);
	});

	it("resolves the ref prefix to a namespace instead of dropping it", () => {
		const prop = propNamed(customer, "lang");

		// ref="xml:lang" must land in the XML namespace, which no schema declares.
		expect(prop.xmlName).toBe("lang");
		expect(prop.namespace).toEqual({ uri: "http://www.w3.org/XML/1998/namespace", prefix: "xml" });
		expect(prop.form).toBe("qualified");
	});
});

describe("cyclic schema references", () => {
	it("merges a mutual xs:include once instead of recursing forever", () => {
		const resolved = resolveFixture("cyclic-a.xsd");

		const classNames = resolved.types.map((t) => t.className);
		expect(classNames).toContain("AType");
		expect(classNames).toContain("BType");
		// Merged once: the type from the other file appears a single time.
		expect(classNames.filter((n) => n === "BType")).toHaveLength(1);
	});
});

describe("class name collisions", () => {
	it("keeps two distinct inline types apart instead of collapsing them", () => {
		const resolved = resolveInline(`
			<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
				<xs:element name="Order">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="Shipping">
								<xs:complexType>
									<xs:sequence><xs:element name="Street" type="xs:string"/></xs:sequence>
								</xs:complexType>
							</xs:element>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
				<xs:element name="Invoice">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="Shipping">
								<xs:complexType>
									<xs:sequence><xs:element name="Carrier" type="xs:string"/></xs:sequence>
								</xs:complexType>
							</xs:element>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
			</xs:schema>`);

		const order = propNamed(typeNamed(resolved, "Order"), "shipping");
		const invoice = propNamed(typeNamed(resolved, "Invoice"), "shipping");

		// Both are named ShippingType by default; each must keep its own content model.
		expect(order.complexTypeName).not.toBe(invoice.complexTypeName);
		expect(typeNamed(resolved, order.complexTypeName!).properties.map((p) => p.propertyName)).toEqual(["street"]);
		expect(typeNamed(resolved, invoice.complexTypeName!).properties.map((p) => p.propertyName)).toEqual(["carrier"]);
		expect(resolved.coverageNotes?.join("\n")).toContain("ShippingType");
	});

	it("keeps an inline type apart from the named type it shadows (real UPA schema)", () => {
		// upa_2026_request.xsd declares complexType CollectieveAangifteType with two
		// members, and separately an element CollectieveAangifte whose inline type has
		// only one. Both map to the name 'CollectieveAangifteType': the inline one used
		// to be dropped, leaving that element typed with a member the schema forbids there.
		const resolved = resolveFixture("upa_2026_request.xsd");

		const named = typeNamed(resolved, "CollectieveAangifteType");
		const inline = typeNamed(resolved, "CollectieveAangifteType2");

		expect(named.properties.map((p) => p.propertyName)).toEqual([
			"totaalRegelingen",
			"saldoCorrectiesVoorgaandAangifteTijdvak",
		]);
		expect(inline.properties.map((p) => p.propertyName)).toEqual(["totaalRegelingen"]);
		expect(resolved.coverageNotes?.join("\n")).toContain("CollectieveAangifteType");
	});

	it("does not split an xs:redefine pair, whose shared name is intentional", () => {
		const resolved = resolveFixture("redefine-main.xsd");

		expect(resolved.types.map((t) => t.className)).not.toContain("AddressType2");
	});
});

describe("abstract complex types as member types", () => {
	const ABSTRACT_MEMBER_XSD = `
		<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
			<xs:complexType name="ShapeType" abstract="true">
				<xs:sequence><xs:element name="Id" type="xs:string"/></xs:sequence>
			</xs:complexType>
			<xs:element name="Drawing">
				<xs:complexType>
					<xs:sequence><xs:element name="Shape" type="ShapeType"/></xs:sequence>
				</xs:complexType>
			</xs:element>
		</xs:schema>`;

	it("never initializes a member with new AbstractClass()", () => {
		const resolved = resolveInline(ABSTRACT_MEMBER_XSD);
		const shape = propNamed(typeNamed(resolved, "Drawing"), "shape");

		expect(shape.isAbstractType).toBe(true);
		expect(shape.initializer).not.toContain("new ShapeType()");
	});

	it("emits a definite-assignment assertion instead, so the output compiles", () => {
		const resolved = resolveInline(ABSTRACT_MEMBER_XSD);
		const files = new ClassGenerator({ xsdPath: "inline.xsd" }).generatePerXsd(resolved);

		expect(files[0].content).toContain("export abstract class ShapeType");
		expect(files[0].content).toContain("shape!: ShapeType;");
		expect(files[0].content).not.toContain("new ShapeType()");
	});
});

describe("xs:pattern translation", () => {
	function patternFor(facet: string): { pattern?: string; notes: string[] } {
		const resolved = resolveInline(`
			<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
				<xs:element name="Doc">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="Code">
								<xs:simpleType>
									<xs:restriction base="xs:string">${facet}</xs:restriction>
								</xs:simpleType>
							</xs:element>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
			</xs:schema>`);

		return {
			pattern: propNamed(typeNamed(resolved, "Doc"), "code").pattern,
			notes: resolved.coverageNotes ?? [],
		};
	}

	it("expands the XSD name-character escapes JavaScript lacks", () => {
		const { pattern } = patternFor('<xs:pattern value="\\i\\c*"/>');

		expect(pattern).not.toContain("\\i");
		expect(pattern).not.toContain("\\c");
		// Whatever it expanded to must be a regex JavaScript accepts.
		expect(() => new RegExp(pattern!)).not.toThrow();
		expect(new RegExp(`^(?:${pattern})$`).test("my-name")).toBe(true);
		expect(new RegExp(`^(?:${pattern})$`).test("1bad")).toBe(false);
	});

	it("drops character-class subtraction with a coverage note rather than emitting a wrong regex", () => {
		const { pattern, notes } = patternFor('<xs:pattern value="[a-z-[aeiou]]+"/>');

		expect(pattern).toBeUndefined();
		expect(notes.join("\n")).toContain("subtraction");
	});

	it("drops Unicode block escapes with a coverage note", () => {
		const { pattern, notes } = patternFor('<xs:pattern value="\\p{IsBasicLatin}+"/>');

		expect(pattern).toBeUndefined();
		expect(notes.join("\n")).toContain("Unicode block");
	});

	it("leaves an ordinary pattern untouched", () => {
		expect(patternFor('<xs:pattern value="[0-9]{9}"/>').pattern).toBe("[0-9]{9}");
	});
});

describe("unresolvable references", () => {
	function schemaWith(body: string): ResolvedSchema {
		return resolveInline(`<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">${body}</xs:schema>`);
	}

	function notesFor(body: string): string {
		return (schemaWith(body).coverageNotes ?? []).join("\n");
	}

	// A reference the schema does not define is a real situation, not a bug in the
	// document: an xs:import whose schemaLocation is remote is never fetched. What
	// must not happen is losing the members without saying anything.
	it("reports an unknown type reference and the string it fell back to", () => {
		const notes = notesFor(
			`<xs:element name="R"><xs:complexType><xs:sequence>
				<xs:element name="a" type="tns:Nope"/>
			</xs:sequence></xs:complexType></xs:element>`,
		);

		expect(notes).toContain("tns:Nope");
		expect(notes).toContain("string");
	});

	it("reports an unknown group reference, whose elements vanish entirely", () => {
		expect(
			notesFor(
				`<xs:element name="R"><xs:complexType><xs:sequence><xs:group ref="Nope"/></xs:sequence></xs:complexType></xs:element>`,
			),
		).toContain("xs:group ref='Nope'");
	});

	it("reports an unknown attributeGroup reference", () => {
		expect(
			notesFor(`<xs:element name="R"><xs:complexType><xs:attributeGroup ref="Nope"/></xs:complexType></xs:element>`),
		).toContain("xs:attributeGroup ref='Nope'");
	});

	it("reports an unknown element reference", () => {
		expect(
			notesFor(
				`<xs:element name="R"><xs:complexType><xs:sequence><xs:element ref="Nope"/></xs:sequence></xs:complexType></xs:element>`,
			),
		).toContain("xs:element ref='Nope'");
	});

	describe("unknown base type", () => {
		const BODY = `<xs:element name="R"><xs:complexType><xs:complexContent>
			<xs:extension base="Nope"><xs:sequence><xs:element name="y" type="xs:string"/></xs:sequence></xs:extension>
		</xs:complexContent></xs:complexType></xs:element>`;

		it("drops the extends clause instead of naming a class that does not exist", () => {
			const resolved = schemaWith(BODY);

			expect(typeNamed(resolved, "R").baseTypeName).toBeUndefined();
			expect((resolved.coverageNotes ?? []).join("\n")).toContain("Nope");
		});

		it("generates a module that compiles — the whole point of dropping it", () => {
			const content = new ClassGenerator({ xsdPath: "inline.xsd" }).generatePerXsd(schemaWith(BODY))[0].content;

			// `extends Nope` would reference a class that is never declared or imported.
			expect(content).not.toContain("extends");
			expect(content).toContain("export class R {");
			// The type's own members survive; only the inheritance link is gone.
			expect(content).toContain("y: string");
		});
	});

	it("says nothing when every reference resolves", () => {
		const notes = notesFor(
			`<xs:complexType name="T"><xs:sequence><xs:element name="a" type="xs:string"/></xs:sequence></xs:complexType>
			 <xs:element name="R"><xs:complexType><xs:sequence><xs:element name="t" type="T"/></xs:sequence></xs:complexType></xs:element>`,
		);

		expect(notes).toBe("");
	});
});

describe("repeating xs:group ref", () => {
	function groupOf(members: string): ResolvedSchema {
		return resolveInline(`
			<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
				<xs:group name="Entry"><xs:sequence>${members}</xs:sequence></xs:group>
				<xs:element name="Map">
					<xs:complexType><xs:sequence><xs:group ref="Entry" maxOccurs="unbounded"/></xs:sequence></xs:complexType>
				</xs:element>
			</xs:schema>`);
	}

	// The reference repeats even though the group's own compositor does not, which
	// makes its content an interleaved run just the same.
	const resolved = groupOf(`<xs:element name="who" type="xs:string"/><xs:element name="when" type="xs:int"/>`);

	it("generates one ordered collection rather than a member per element", () => {
		const map = typeNamed(resolved, "Map");

		expect(map.properties).toHaveLength(1);
		expect(map.properties[0].kind).toBe("array");
		expect(map.properties[0].arrayItems?.map((i) => i.xmlName)).toEqual(["who", "when"]);
	});

	it("emits both alternatives as items on one decorator", () => {
		const content = new ClassGenerator({ xsdPath: "inline.xsd" }).generatePerXsd(resolved)[0].content;

		expect(content).toContain("{ name: 'who'");
		expect(content).toContain("{ name: 'when'");
	});

	it("refuses the collection when the alternatives share a type, and says why", () => {
		// Two strings: a written value cannot say which element it came from, so a
		// collection would round-trip to the wrong names.
		const ambiguous = groupOf(`<xs:element name="key" type="xs:string"/><xs:element name="value" type="xs:string"/>`);

		expect(typeNamed(ambiguous, "Map").properties.map((p) => p.propertyName)).toEqual(["key", "value"]);
		expect((ambiguous.coverageNotes ?? []).join("\n")).toContain("key, value");
	});
});
