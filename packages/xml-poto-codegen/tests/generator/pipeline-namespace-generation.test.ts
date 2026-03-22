import path from "node:path";

import { describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("Pipeline namespace generation", () => {
	it("should emit namespace options for qualified elements and omit them for unqualified attributes", () => {
		const parser = new XsdParser();
		const resolver = new XsdResolver();
		const generator = new ClassGenerator({ xsdPath: "fixtures/namespaced.xsd" });

		const schema = parser.parseFile(path.join(FIXTURES, "namespaced.xsd"));
		const resolved = resolver.resolve(schema);
		const files = generator.generatePerType(resolved);

		const documentFile = files.find((f) => f.fileName === "document.ts");
		expect(documentFile).toBeDefined();

		const content = documentFile!.content;
		expect(content).toMatch(
			/@XmlRoot\([\s\S]*name: 'Document'[\s\S]*namespace: \{ uri: 'http:\/\/example\.com\/ns1', prefix: 'tns' \}[\s\S]*\)/,
		);
		expect(content).toMatch(
			/@XmlElement\([\s\S]*name: 'Title'[\s\S]*required: true[\s\S]*order: 1[\s\S]*form: 'qualified'[\s\S]*namespace: \{ uri: 'http:\/\/example\.com\/ns1', prefix: 'tns' \}[\s\S]*\)/,
		);
		expect(content).toContain("@XmlAttribute({ name: 'id', required: true })");
		expect(content).not.toContain("@XmlAttribute({ name: 'id', required: true, namespace:");
	});

	it("should emit required XmlDynamic from xs:any with default minOccurs", () => {
		const parser = new XsdParser();
		const resolver = new XsdResolver();
		const generator = new ClassGenerator({ xsdPath: "inline-required-any.xsd" });

		const schema = parser.parseString(`<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Envelope">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Header" type="xs:string"/>
				<xs:any namespace="##any" processContents="lax"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`);

		const resolved = resolver.resolve(schema);
		const files = generator.generatePerType(resolved);

		const envelopeFile = files.find((f) => f.fileName === "envelope.ts");
		expect(envelopeFile).toBeDefined();

		const content = envelopeFile!.content;
		expect(content).toContain("DynamicElement");
		expect(content).toContain("XmlDynamic");
		expect(content).toMatch(/@XmlDynamic\([\s\S]*required: true[\s\S]*order: 2[\s\S]*\)/);
	});

	it("should omit required XmlDynamic when xs:any has minOccurs=0", () => {
		const parser = new XsdParser();
		const resolver = new XsdResolver();
		const generator = new ClassGenerator({ xsdPath: "inline-optional-any.xsd" });

		const schema = parser.parseString(`<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Envelope">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Header" type="xs:string"/>
				<xs:any namespace="##any" processContents="lax" minOccurs="0"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`);

		const resolved = resolver.resolve(schema);
		const files = generator.generatePerType(resolved);

		const envelopeFile = files.find((f) => f.fileName === "envelope.ts");
		expect(envelopeFile).toBeDefined();

		const content = envelopeFile!.content;
		expect(content).toContain("DynamicElement");
		expect(content).toContain("XmlDynamic");
		expect(content).toMatch(/@XmlDynamic\([\s\S]*order: 2[\s\S]*\)/);
		expect(content).not.toMatch(/@XmlDynamic\([\s\S]*required:\s*true[\s\S]*\)/);
	});

	it("should emit isNullable on XmlRoot when nillable root references a named complex type", () => {
		const parser = new XsdParser();
		const resolver = new XsdResolver();
		const generator = new ClassGenerator({ xsdPath: "inline-nillable-root-ref.xsd" });

		const schema = parser.parseString(`<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:complexType name="OrderType">
		<xs:sequence>
			<xs:element name="Id" type="xs:string"/>
		</xs:sequence>
	</xs:complexType>

	<xs:element name="Order" type="OrderType" nillable="true"/>
</xs:schema>`);

		const resolved = resolver.resolve(schema);
		const files = generator.generatePerType(resolved);

		const orderTypeFile = files.find((f) => f.fileName === "order-type.ts");
		expect(orderTypeFile).toBeDefined();

		const content = orderTypeFile!.content;
		expect(content).toMatch(/@XmlRoot\([\s\S]*name: 'Order'[\s\S]*isNullable: true[\s\S]*\)/);
	});
});
