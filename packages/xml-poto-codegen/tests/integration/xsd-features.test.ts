import path from "node:path";

import { describe, expect, it } from "vitest";

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

function pipelineString(xsdContent: string): { resolved: ResolvedSchema; files: GeneratedFile[] } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: "inline.xsd" });
	const schema = parser.parseString(xsdContent);
	const resolved = resolver.resolve(schema);
	const files = generator.generatePerType(resolved);
	return { resolved, files };
}

// ── xs:choice ──────────────────────────────────────────────────────────────

describe("xs:choice compositor", () => {
	it("parses choice elements into the schema", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "choice.xsd"));

		const rootEl = schema.elements[0];
		expect(rootEl.name).toBe("Notification");
		expect(rootEl.complexType?.sequence?.choices).toHaveLength(1);
		expect(rootEl.complexType?.sequence?.choices[0].elements).toHaveLength(3);
	});

	it("resolves choice elements as optional properties", () => {
		const { resolved } = pipeline("choice.xsd");

		const notification = resolved.types.find((t) => t.className === "Notification");
		expect(notification).toBeDefined();

		// xs:choice elements are all optional (only one appears at a time)
		const choiceProps = notification!.properties.filter((p) => ["email", "phone", "address"].includes(p.propertyName));
		expect(choiceProps).toHaveLength(3);
		for (const prop of choiceProps) {
			expect(prop.required).toBe(false);
		}
	});

	it("generates optional @XmlElement decorators for choice members", () => {
		const { files } = pipeline("choice.xsd");

		const notificationFile = files.find((f) => f.fileName === "notification.ts")!;
		expect(notificationFile).toBeDefined();

		const content = notificationFile.content;
		// Choice elements should result in optional properties
		expect(content).toContain("email?: string");
		expect(content).toContain("phone?: string");
		expect(content).toContain("address?: string");
	});

	it("preserves the sequence element (Title) as required alongside choice members", () => {
		const { resolved } = pipeline("choice.xsd");

		const notification = resolved.types.find((t) => t.className === "Notification");
		const titleProp = notification!.properties.find((p) => p.propertyName === "title");
		expect(titleProp?.required).toBe(true);
	});
});

// ── xs:all ──────────────────────────────────────────────────────────────────

describe("xs:all compositor", () => {
	it("parses all elements into the schema", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "all.xsd"));

		const rootEl = schema.elements[0];
		expect(rootEl.name).toBe("ContactInfo");
		expect(rootEl.complexType?.all).toBeDefined();
		expect(rootEl.complexType?.all?.elements).toHaveLength(3);
	});

	it("resolves xs:all elements as properties without an order constraint", () => {
		const { resolved } = pipeline("all.xsd");

		const contactInfo = resolved.types.find((t) => t.className === "ContactInfo");
		expect(contactInfo).toBeDefined();

		// xs:all elements get no `order` assigned
		for (const prop of contactInfo!.properties) {
			expect(prop.order).toBeUndefined();
		}
	});

	it("respects minOccurs=0 for optional xs:all elements", () => {
		const { resolved } = pipeline("all.xsd");

		const contactInfo = resolved.types.find((t) => t.className === "ContactInfo");
		const fullNameProp = contactInfo!.properties.find((p) => p.propertyName === "fullName");
		const emailProp = contactInfo!.properties.find((p) => p.propertyName === "email");

		expect(fullNameProp?.required).toBe(true);
		expect(emailProp?.required).toBe(false);
	});

	it("generates TypeScript class with optional properties for minOccurs=0 members", () => {
		const { files } = pipeline("all.xsd");

		const contactInfoFile = files.find((f) => f.fileName === "contact-info.ts")!;
		expect(contactInfoFile).toBeDefined();

		const content = contactInfoFile.content;
		expect(content).toContain("email?: string");
		expect(content).toContain("phone?: string");
		// fullName has no minOccurs=0, so it is required
		expect(content).toMatch(/fullName:\s*string/);
	});
});

// ── xs:include ──────────────────────────────────────────────────────────────

describe("xs:include (intra-namespace schema merging)", () => {
	it("parses xs:include directive from main schema", () => {
		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, "include-main.xsd"));

		// After merging, the schema should contain types from include-base.xsd too
		const typeNames = schema.complexTypes.map((t) => t.name);
		expect(typeNames).toContain("AddressType");
	});

	it("merges enums from included schema into the resolved output", () => {
		const { resolved } = pipeline("include-main.xsd");

		const countryEnum = resolved.enums.find((e) => e.name === "CountryCodeType");
		expect(countryEnum).toBeDefined();
		expect(countryEnum!.values).toContain("US");
		expect(countryEnum!.values).toContain("UK");
		expect(countryEnum!.values).toContain("DE");
	});

	it("generates classes for types defined in the included schema", () => {
		const { files } = pipeline("include-main.xsd");

		const fileNames = files.map((f) => f.fileName);
		expect(fileNames).toContain("address-type.ts");
		expect(fileNames).toContain("country-code-type.ts");
		expect(fileNames).toContain("customer.ts");
	});

	it("generates a local import in Customer for the included AddressType", () => {
		const { files } = pipeline("include-main.xsd");

		const customerFile = files.find((f) => f.fileName === "customer.ts")!;
		expect(customerFile).toBeDefined();
		expect(customerFile.content).toContain('from "./address-type"');
	});

	it("generates barrel index that re-exports all types including included ones", () => {
		const { files } = pipeline("include-main.xsd");

		const indexFile = files.find((f) => f.fileName === "index.ts")!;
		expect(indexFile.content).toContain("AddressType");
		expect(indexFile.content).toContain("CountryCodeType");
		expect(indexFile.content).toContain("Customer");
	});
});

// ── xs:anyAttribute ─────────────────────────────────────────────────────────

describe("xs:anyAttribute — wildcard attribute support", () => {
	const xsdWithAnyAttribute = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="ExtensibleElement">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Title" type="xs:string"/>
      </xs:sequence>
      <xs:anyAttribute namespace="##any" processContents="lax"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

	it("parses xs:anyAttribute from the schema", () => {
		const parser = new XsdParser();
		const schema = parser.parseString(xsdWithAnyAttribute);

		const rootEl = schema.elements[0];
		expect(rootEl.complexType?.anyAttribute).toBeDefined();
	});

	it("resolves xs:anyAttribute as a 'dynamic' kind property named anyAttributes", () => {
		const { resolved } = pipelineString(xsdWithAnyAttribute);

		const type = resolved.types.find((t) => t.className === "ExtensibleElement");
		expect(type).toBeDefined();

		const anyAttrProp = type!.properties.find((p) => p.propertyName === "anyAttributes");
		expect(anyAttrProp).toBeDefined();
		expect(anyAttrProp!.kind).toBe("dynamic");
		expect(anyAttrProp!.tsType).toBe("DynamicElement");
	});

	it("generates @XmlDynamic decorator for anyAttributes property", () => {
		const { files } = pipelineString(xsdWithAnyAttribute);

		const typeFile = files.find((f) => f.fileName === "extensible-element.ts")!;
		expect(typeFile).toBeDefined();
		expect(typeFile.content).toContain("@XmlDynamic(");
		expect(typeFile.content).toContain("anyAttributes");
	});

	// A wildcard is legal wherever attributes are, and each position used to be
	// dropped silently — the class simply came out without a member for it.
	describe("beyond a bare complexType", () => {
		it.each([
			["a complexContent extension", "ExtendedType", "extended-type.ts"],
			["a complexContent restriction", "RestrictedType", "restricted-type.ts"],
			["a nested attributeGroup reference", "GroupedType", "grouped-type.ts"],
			["a simpleContent extension's attributeGroup", "MeasurementType", "measurement-type.ts"],
			["a simpleContent restriction", "CodeType", "code-type.ts"],
		])("honours a wildcard on %s", (_position, className, fileName) => {
			const { resolved, files } = pipeline("any-attribute.xsd");

			const type = resolved.types.find((t) => t.className === className)!;
			expect(type).toBeDefined();

			const wildcards = type.properties.filter((p) => p.propertyName === "anyAttributes");
			expect(wildcards).toHaveLength(1);
			expect(wildcards[0].kind).toBe("dynamic");

			const typeFile = files.find((f) => f.fileName === fileName)!;
			expect(typeFile.content).toContain("@XmlDynamic(");
			expect(typeFile.content).toContain("anyAttributes");
		});

		it("emits one member for a type that declares the wildcard twice over", () => {
			const { resolved } = pipeline("any-attribute.xsd");

			const type = resolved.types.find((t) => t.className === "DoubleType")!;
			expect(type.properties.filter((p) => p.propertyName === "anyAttributes")).toHaveLength(1);
		});

		it("leaves a type without a wildcard alone", () => {
			const { resolved } = pipeline("any-attribute.xsd");

			const type = resolved.types.find((t) => t.className === "BaseType")!;
			expect(type.properties.some((p) => p.propertyName === "anyAttributes")).toBe(false);
		});

		it("pulls in the attributes of a simpleContent attributeGroup reference", () => {
			const { resolved } = pipeline("any-attribute.xsd");

			// The refs were never parsed for simpleContent, so 'id'/'lang' were lost.
			const type = resolved.types.find((t) => t.className === "MeasurementType")!;
			const attributes = type.properties.filter((p) => p.kind === "attribute").map((p) => p.xmlName);
			expect(attributes).toEqual(expect.arrayContaining(["unit", "id", "lang"]));
		});
	});
});

// ── Abstract types ───────────────────────────────────────────────────────────

describe("abstract complex types", () => {
	const xsdWithAbstract = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="ShapeType" abstract="true">
    <xs:sequence>
      <xs:element name="Color" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="CircleType">
    <xs:complexContent>
      <xs:extension base="ShapeType">
        <xs:sequence>
          <xs:element name="Radius" type="xs:decimal"/>
        </xs:sequence>
      </xs:extension>
    </xs:complexContent>
  </xs:complexType>

  <xs:element name="Circle" type="CircleType"/>
</xs:schema>`;

	it("marks the abstract flag as true on abstract complex types", () => {
		const { resolved } = pipelineString(xsdWithAbstract);

		const shapeType = resolved.types.find((t) => t.className === "ShapeType");
		expect(shapeType).toBeDefined();
		expect(shapeType!.abstract).toBe(true);
	});

	it("concrete subtype does not carry the abstract flag", () => {
		const { resolved } = pipelineString(xsdWithAbstract);

		const circleType = resolved.types.find((t) => t.className === "CircleType");
		expect(circleType).toBeDefined();
		expect(circleType!.abstract).toBeFalsy();
	});

	it("abstract base type is not promoted to a root element even when referenced", () => {
		const { resolved } = pipelineString(xsdWithAbstract);

		const shapeType = resolved.types.find((t) => t.className === "ShapeType");
		// ShapeType has no xs:element at root level, so it stays non-root
		expect(shapeType!.isRootElement).toBe(false);
	});

	it("concrete subtype referenced by root element gets @XmlRoot in generated output", () => {
		const { files } = pipelineString(xsdWithAbstract);

		const circleFile = files.find((f) => f.fileName === "circle-type.ts")!;
		expect(circleFile).toBeDefined();
		expect(circleFile.content).toContain("@XmlRoot(");
	});

	it("abstract base type generates @XmlElement (not @XmlRoot) in generated output", () => {
		const { files } = pipelineString(xsdWithAbstract);

		const shapeFile = files.find((f) => f.fileName === "shape-type.ts")!;
		expect(shapeFile).toBeDefined();
		expect(shapeFile.content).toContain("@XmlElement(");
		expect(shapeFile.content).not.toContain("@XmlRoot(");
	});
});

// ── xs:complexContent restriction ───────────────────────────────────────────

describe("xs:complexContent restriction", () => {
	const xsdWithRestriction = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="FullAddressType">
    <xs:sequence>
      <xs:element name="Street" type="xs:string"/>
      <xs:element name="City" type="xs:string"/>
      <xs:element name="Country" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="DomesticAddressType">
    <xs:complexContent>
      <xs:restriction base="FullAddressType">
        <xs:sequence>
          <xs:element name="Street" type="xs:string"/>
          <xs:element name="City" type="xs:string"/>
        </xs:sequence>
      </xs:restriction>
    </xs:complexContent>
  </xs:complexType>

  <xs:element name="ShipTo" type="DomesticAddressType"/>
</xs:schema>`;

	it("flattens the restricted type to a standalone class (no extends, narrowed members)", () => {
		const { resolved } = pipelineString(xsdWithRestriction);

		const domesticType = resolved.types.find((t) => t.className === "DomesticAddressType");
		expect(domesticType).toBeDefined();
		// Restriction restates the full narrowed model: no extends, and the dropped
		// member (Country) is absent — emitting `extends` would wrongly re-inherit it.
		expect(domesticType!.baseTypeName).toBeUndefined();
		const propNames = domesticType!.properties.map((p) => p.propertyName);
		expect(propNames).toEqual(["street", "city"]);
		expect(propNames).not.toContain("country");
	});

	it("generates a standalone class (no extends clause) for a restriction-based subtype", () => {
		const { files } = pipelineString(xsdWithRestriction);

		const domesticFile = files.find((f) => f.fileName === "domestic-address-type.ts")!;
		expect(domesticFile).toBeDefined();
		expect(domesticFile.content).not.toContain("extends FullAddressType");
		expect(domesticFile.content).toContain("export class DomesticAddressType {");
	});
});

// ── Multi-target-namespace import fidelity ──────────────────────────────────

describe("xs:import of a different target namespace", () => {
	it("qualifies each type with its OWN source namespace, not the importer's", () => {
		const { resolved, files } = pipeline("import-main.xsd");

		// Order is defined in the main schema.
		const order = resolved.types.find((t) => t.className === "Order")!;
		expect(order.namespace?.uri).toBe("http://example.com/main");

		// CustomerType is imported from a different namespace and must keep it,
		// rather than adopting the importing schema's namespace.
		const customer = resolved.types.find((t) => t.className === "CustomerType")!;
		expect(customer.namespace?.uri).toBe("http://example.com/types");

		// Its members are qualified from the imported namespace too.
		for (const prop of customer.properties) {
			expect(prop.namespace?.uri).toBe("http://example.com/types");
		}

		const customerFile = files.find((f) => f.fileName === "customer-type.ts")!;
		expect(customerFile.content).toContain("uri: 'http://example.com/types'");
	});
});
