/**
 * Round-trip integration tests.
 *
 * These tests verify that code generated from an XSD schema can be used directly
 * with xml-poto's serializer: each test generates TypeScript class files from an
 * inline XSD, writes them to a temporary directory, dynamically imports the result
 * through Vitest's module loader (which applies the @cerios/xml-poto alias), and
 * then exercises toXml / fromXml to confirm the generated decorators are correct.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { XmlDecoratorSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const TMP_DIR = path.resolve(__dirname, "../tmp-roundtrip");

/** Run the full XSD → resolve → generate → write pipeline into a local directory. */
function generateToDir(
	xsdContent: string,
	outputDir: string,
	options?: { enumStyle?: "union" | "enum" | "const-object" },
): void {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: "inline.xsd", ...options });
	const schema = parser.parseString(xsdContent);
	const resolved = resolver.resolve(schema);
	const files = generator.generatePerType(resolved);
	writeGeneratedFiles(outputDir, files);
}

describe("Generated code usability: XSD → TypeScript classes → xml-poto round-trip", () => {
	let tempDir: string;
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		// Use a unique directory per test to avoid Vitest module-cache collisions
		tempDir = path.join(TMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		serializer = new XmlDecoratorSerializer();
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) {
			rmSync(TMP_DIR, { recursive: true, force: true });
		}
	});

	// ── Simple class with elements and a required attribute ────────────────────

	describe("simple class with elements and a required id attribute", () => {
		const personXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Person">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="FirstName" type="xs:string"/>
        <xs:element name="Age" type="xs:integer"/>
        <xs:element name="Email" type="xs:string" minOccurs="0"/>
      </xs:sequence>
      <xs:attribute name="id" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		it("serializes required attribute as an XML attribute on the root element", async () => {
			generateToDir(personXsd, tempDir);
			const { Person } = await import(/* @vite-ignore */ path.join(tempDir, "person.ts"));

			const person = new Person();
			person.id = "p-001";
			person.firstName = "Alice";
			person.age = 32;

			const xml: string = serializer.toXml(person);
			expect(xml).toContain('id="p-001"');
		});

		it("serializes required elements as child elements with the correct XML names", async () => {
			generateToDir(personXsd, tempDir);
			const { Person } = await import(/* @vite-ignore */ path.join(tempDir, "person.ts"));

			const person = new Person();
			person.id = "p-001";
			person.firstName = "Alice";
			person.age = 32;

			const xml: string = serializer.toXml(person);
			expect(xml).toContain("<FirstName>Alice</FirstName>");
			expect(xml).toContain("<Age>32</Age>");
		});

		it("round-trips: fromXml(toXml(obj)) fully restores attribute and element values", async () => {
			generateToDir(personXsd, tempDir);
			const { Person } = await import(/* @vite-ignore */ path.join(tempDir, "person.ts"));

			const person = new Person();
			person.id = "p-001";
			person.firstName = "Alice";
			person.age = 32;

			const xml: string = serializer.toXml(person);
			const parsed = serializer.fromXml(xml, Person);

			expect(parsed.id).toBe("p-001");
			expect(parsed.firstName).toBe("Alice");
			expect(parsed.age).toBe(32);
		});

		it("omits optional element from XML when the property is not set", async () => {
			generateToDir(personXsd, tempDir);
			const { Person } = await import(/* @vite-ignore */ path.join(tempDir, "person.ts"));

			const person = new Person();
			person.id = "p-002";
			person.firstName = "Bob";
			person.age = 25;
			// email is left at its default (undefined / not set)

			const xml: string = serializer.toXml(person);
			expect(xml).not.toContain("<Email>");
		});

		it("includes optional element in XML when the property is set", async () => {
			generateToDir(personXsd, tempDir);
			const { Person } = await import(/* @vite-ignore */ path.join(tempDir, "person.ts"));

			const person = new Person();
			person.id = "p-003";
			person.firstName = "Carol";
			person.age = 41;
			person.email = "carol@example.com";

			const xml: string = serializer.toXml(person);
			expect(xml).toContain("<Email>carol@example.com</Email>");
		});
	});

	// ── Enum-typed attribute (union style) ─────────────────────────────────────

	describe("class with an enum-typed attribute (union style)", () => {
		const taskXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="StatusType">
    <xs:restriction base="xs:string">
      <xs:enumeration value="active"/>
      <xs:enumeration value="inactive"/>
      <xs:enumeration value="pending"/>
    </xs:restriction>
  </xs:simpleType>
  <xs:element name="Task">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Title" type="xs:string"/>
      </xs:sequence>
      <xs:attribute name="status" type="StatusType" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		it("serializes enum attribute as the literal string value in the XML output", async () => {
			generateToDir(taskXsd, tempDir, { enumStyle: "union" });
			const { Task } = await import(/* @vite-ignore */ path.join(tempDir, "task.ts"));

			const task = new Task();
			task.status = "active";
			task.title = "Fix login bug";

			const xml: string = serializer.toXml(task);
			expect(xml).toContain('status="active"');
			expect(xml).toContain("<Title>Fix login bug</Title>");
		});

		it("round-trips: enum attribute value is preserved through toXml and fromXml", async () => {
			generateToDir(taskXsd, tempDir, { enumStyle: "union" });
			const { Task } = await import(/* @vite-ignore */ path.join(tempDir, "task.ts"));

			const task = new Task();
			task.status = "pending";
			task.title = "Deploy release";

			const xml: string = serializer.toXml(task);
			const parsed = serializer.fromXml(xml, Task);

			expect(parsed.status).toBe("pending");
			expect(parsed.title).toBe("Deploy release");
		});
	});

	// ── Array-typed child elements ─────────────────────────────────────────────

	describe("class with array-typed child elements (maxOccurs unbounded)", () => {
		const tagListXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="TagList">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Tag" type="xs:string" maxOccurs="unbounded"/>
      </xs:sequence>
      <xs:attribute name="name" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		it("serializes each array item as a sibling XML child element", async () => {
			generateToDir(tagListXsd, tempDir);
			const { TagList } = await import(/* @vite-ignore */ path.join(tempDir, "tag-list.ts"));

			const list = new TagList();
			list.name = "colors";
			list.tag = ["red", "green", "blue"];

			const xml: string = serializer.toXml(list);
			expect(xml).toContain("<Tag>red</Tag>");
			expect(xml).toContain("<Tag>green</Tag>");
			expect(xml).toContain("<Tag>blue</Tag>");
		});

		it("round-trips: all array items are fully restored after fromXml", async () => {
			generateToDir(tagListXsd, tempDir);
			const { TagList } = await import(/* @vite-ignore */ path.join(tempDir, "tag-list.ts"));

			const list = new TagList();
			list.name = "sizes";
			list.tag = ["small", "medium", "large"];

			const xml: string = serializer.toXml(list);
			const parsed = serializer.fromXml(xml, TagList);

			expect(parsed.name).toBe("sizes");
			expect(parsed.tag).toEqual(["small", "medium", "large"]);
		});
	});

	// ── Nested complex-type element ────────────────────────────────────────────

	describe("class with a nested complex-type element", () => {
		const orderXsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="AddressType">
    <xs:sequence>
      <xs:element name="Street" type="xs:string"/>
      <xs:element name="City" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  <xs:element name="Order">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="ShipTo" type="AddressType"/>
      </xs:sequence>
      <xs:attribute name="id" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		it("serializes nested complex-type element with its own child elements", async () => {
			generateToDir(orderXsd, tempDir);
			// order.ts imports AddressType from ./address-type — both are in the same tempDir
			const { Order } = await import(/* @vite-ignore */ path.join(tempDir, "order.ts"));
			const { AddressType } = await import(/* @vite-ignore */ path.join(tempDir, "address-type.ts"));

			const order = new Order();
			order.id = "ORD-1";
			const addr = new AddressType();
			addr.street = "123 Main St";
			addr.city = "Amsterdam";
			order.shipTo = addr;

			const xml: string = serializer.toXml(order);
			expect(xml).toContain("<ShipTo>");
			expect(xml).toContain("<Street>123 Main St</Street>");
			expect(xml).toContain("<City>Amsterdam</City>");
		});

		it("round-trips: nested complex type properties are restored after fromXml", async () => {
			generateToDir(orderXsd, tempDir);
			const { Order } = await import(/* @vite-ignore */ path.join(tempDir, "order.ts"));
			const { AddressType } = await import(/* @vite-ignore */ path.join(tempDir, "address-type.ts"));

			const order = new Order();
			order.id = "ORD-2";
			const addr = new AddressType();
			addr.street = "456 Oak Ave";
			addr.city = "Rotterdam";
			order.shipTo = addr;

			const xml: string = serializer.toXml(order);
			const parsed = serializer.fromXml(xml, Order);

			expect(parsed.id).toBe("ORD-2");
			expect(parsed.shipTo).toBeDefined();
			expect(parsed.shipTo.street).toBe("456 Oak Ave");
			expect(parsed.shipTo.city).toBe("Rotterdam");
		});
	});
});
