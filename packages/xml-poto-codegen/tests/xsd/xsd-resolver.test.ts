import path from "node:path";

import { describe, expect, it } from "vitest";

import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("XsdResolver", () => {
	const parser = new XsdParser();
	const resolver = new XsdResolver();

	describe("simple.xsd", () => {
		it("should resolve root element as a type", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const resolved = resolver.resolve(schema);

			expect(resolved.types).toHaveLength(1);
			expect(resolved.types[0].className).toBe("Person");
			expect(resolved.types[0].isRootElement).toBe(true);
		});

		it("should resolve element properties with correct kinds", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const resolved = resolver.resolve(schema);
			const person = resolved.types[0];

			// 4 elements + 1 attribute = 5 properties
			expect(person.properties).toHaveLength(5);

			const firstName = person.properties.find((p) => p.xmlName === "FirstName")!;
			expect(firstName.kind).toBe("element");
			expect(firstName.tsType).toBe("string");
			expect(firstName.required).toBe(true);

			const email = person.properties.find((p) => p.xmlName === "Email")!;
			expect(email.required).toBe(false);
		});

		it("should resolve attribute properties", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const resolved = resolver.resolve(schema);
			const person = resolved.types[0];

			const id = person.properties.find((p) => p.xmlName === "id")!;
			expect(id.kind).toBe("attribute");
			expect(id.required).toBe(true);
			expect(id.tsType).toBe("string");
		});

		it("should set property order from sequence", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const resolved = resolver.resolve(schema);
			const person = resolved.types[0];

			const elements = person.properties.filter((p) => p.kind === "element");
			expect(elements[0].order).toBe(1);
			expect(elements[1].order).toBe(2);
			expect(elements[2].order).toBe(3);
			expect(elements[3].order).toBe(4);
		});
	});

	describe("complex.xsd", () => {
		it("should resolve named complexTypes and root element", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const resolved = resolver.resolve(schema);

			const typeNames = resolved.types.map((t) => t.className);
			expect(typeNames).toContain("AddressType");
			expect(typeNames).toContain("ProductType");
			expect(typeNames).toContain("Order");
		});

		it("should resolve references to named types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const resolved = resolver.resolve(schema);
			const order = resolved.types.find((t) => t.className === "Order")!;

			const shipping = order.properties.find((p) => p.xmlName === "ShippingAddress")!;
			expect(shipping.tsType).toBe("AddressType");
			expect(shipping.complexTypeName).toBe("AddressType");
		});

		it("should resolve array elements (unbounded)", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const resolved = resolver.resolve(schema);
			const order = resolved.types.find((t) => t.className === "Order")!;

			const items = order.properties.find((p) => p.xmlName === "Items")!;
			expect(items.kind).toBe("array");
			expect(items.arrayItemName).toBe("Items");
		});

		it("should resolve namespace info", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const resolved = resolver.resolve(schema);

			expect(resolved.targetNamespace).toBe("http://example.com/orders");
			const order = resolved.types.find((t) => t.className === "Order")!;
			expect(order.namespace).toBeDefined();
			expect(order.namespace!.uri).toBe("http://example.com/orders");
		});
	});

	describe("enums.xsd", () => {
		it("should resolve simpleTypes with enumerations as enums", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "enums.xsd"));
			const resolved = resolver.resolve(schema);

			expect(resolved.enums).toHaveLength(2);
			const status = resolved.enums.find((e) => e.name === "StatusType")!;
			expect(status.values).toEqual(["active", "inactive", "pending"]);
		});

		it("should resolve pattern restrictions", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "enums.xsd"));
			const resolved = resolver.resolve(schema);
			const task = resolved.types.find((t) => t.className === "Task")!;

			const email = task.properties.find((p) => p.xmlName === "assigneeEmail")!;
			expect(email.pattern).toBeDefined();
		});

		it("should reference enum type names on attributes", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "enums.xsd"));
			const resolved = resolver.resolve(schema);
			const task = resolved.types.find((t) => t.className === "Task")!;

			const status = task.properties.find((p) => p.xmlName === "status")!;
			expect(status.enumTypeName).toBe("StatusType");
		});
	});

	describe("arrays.xsd", () => {
		it("should resolve unbounded elements as arrays", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "arrays.xsd"));
			const resolved = resolver.resolve(schema);
			const library = resolved.types.find((t) => t.className === "Library")!;

			const book = library.properties.find((p) => p.xmlName === "Book")!;
			expect(book.kind).toBe("array");

			const tag = library.properties.find((p) => p.xmlName === "Tag")!;
			expect(tag.kind).toBe("array");
			expect(tag.tsType).toBe("string[]");
		});
	});

	describe("inheritance.xsd", () => {
		it("should resolve base type name from extension", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "inheritance.xsd"));
			const resolved = resolver.resolve(schema);

			const user = resolved.types.find((t) => t.className === "UserType")!;
			expect(user.baseTypeName).toBe("BaseEntityType");

			const admin = resolved.types.find((t) => t.className === "AdminType")!;
			expect(admin.baseTypeName).toBe("UserType");
		});

		it("should resolve extension properties only (not base)", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "inheritance.xsd"));
			const resolved = resolver.resolve(schema);

			const user = resolved.types.find((t) => t.className === "UserType")!;
			// Only extension-specific properties, not base ones
			const propNames = user.properties.map((p) => p.xmlName);
			expect(propNames).toContain("Username");
			expect(propNames).toContain("Email");
			expect(propNames).toContain("role");
		});
	});

	describe("mixed.xsd", () => {
		it("should resolve simpleContent with text + attributes", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const resolved = resolver.resolve(schema);

			const price = resolved.types.find((t) => t.className === "Price")!;
			expect(price.hasSimpleContent).toBe(true);

			const value = price.properties.find((p) => p.kind === "text")!;
			expect(value.propertyName).toBe("value");
			expect(value.tsType).toBe("number");

			const currency = price.properties.find((p) => p.xmlName === "currency")!;
			expect(currency.kind).toBe("attribute");
			expect(currency.required).toBe(true);
		});

		it("should resolve nillable elements", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const resolved = resolver.resolve(schema);

			const wrapper = resolved.types.find((t) => t.className === "Wrapper")!;
			const val = wrapper.properties.find((p) => p.xmlName === "Value")!;
			expect(val.isNullable).toBe(true);
		});

		it("should resolve default values", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const resolved = resolver.resolve(schema);

			const wrapper = resolved.types.find((t) => t.className === "Wrapper")!;
			const count = wrapper.properties.find((p) => p.xmlName === "Count")!;
			expect(count.defaultValue).toBe("0");
		});

		it("should resolve xs:any as dynamic", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const resolved = resolver.resolve(schema);

			const config = resolved.types.find((t) => t.className === "Config")!;
			const dynamic = config.properties.find((p) => p.kind === "dynamic");
			expect(dynamic).toBeDefined();
		});
	});

	describe("type mapping", () => {
		it("should map XSD built-in types to TypeScript types", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Test">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Str" type="xs:string"/>
				<xs:element name="Num" type="xs:integer"/>
				<xs:element name="Bool" type="xs:boolean"/>
				<xs:element name="Dec" type="xs:decimal"/>
				<xs:element name="Dt" type="xs:dateTime"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const test = resolved.types[0];

			expect(test.properties.find((p) => p.xmlName === "Str")!.tsType).toBe("string");
			expect(test.properties.find((p) => p.xmlName === "Num")!.tsType).toBe("number");
			expect(test.properties.find((p) => p.xmlName === "Bool")!.tsType).toBe("boolean");
			expect(test.properties.find((p) => p.xmlName === "Dec")!.tsType).toBe("number");
			expect(test.properties.find((p) => p.xmlName === "Dt")!.tsType).toBe("string");
		});
	});

	describe("union.xsd", () => {
		it("should resolve xs:union as TS union type", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "union.xsd"));
			const resolved = resolver.resolve(schema);
			const record = resolved.types.find((t) => t.className === "Record")!;

			const value = record.properties.find((p) => p.xmlName === "Value")!;
			expect(value.tsType).toBe("string | number");
		});

		it("should deduplicate union member types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "union.xsd"));
			const resolved = resolver.resolve(schema);
			const record = resolved.types.find((t) => t.className === "Record")!;

			// xs:decimal, xs:float, xs:double all map to "number"
			const amount = record.properties.find((p) => p.xmlName === "Amount")!;
			expect(amount.tsType).toBe("number");
		});
	});

	describe("import-main.xsd", () => {
		it("should resolve types from imported schema", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "import-main.xsd"));
			const resolved = resolver.resolve(schema);

			// CustomerType from imported file should be resolved
			const typeNames = resolved.types.map((t) => t.className);
			expect(typeNames).toContain("CustomerType");
		});

		it("should resolve references to imported types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "import-main.xsd"));
			const resolved = resolver.resolve(schema);
			const order = resolved.types.find((t) => t.className === "Order")!;

			const customer = order.properties.find((p) => p.xmlName === "Customer")!;
			expect(customer.tsType).toBe("CustomerType");
			expect(customer.complexTypeName).toBe("CustomerType");
		});
	});

	describe("substitution-group.xsd", () => {
		it("should resolve substitution group head as dynamic property", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "substitution-group.xsd"));
			const resolved = resolver.resolve(schema);
			const owner = resolved.types.find((t) => t.className === "PetOwner")!;

			const pet = owner.properties.find((p) => p.xmlName === "Pet")!;
			expect(pet.kind).toBe("dynamic");
			expect(pet.tsType).toBe("DynamicElement");
		});

		it("should still resolve substitute element types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "substitution-group.xsd"));
			const resolved = resolver.resolve(schema);

			const typeNames = resolved.types.map((t) => t.className);
			expect(typeNames).toContain("DogType");
			expect(typeNames).toContain("CatType");
		});
	});

	describe("namespaced.xsd", () => {
		it("should resolve namespaced schema with inline nested types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "namespaced.xsd"));
			const resolved = resolver.resolve(schema);

			expect(resolved.targetNamespace).toBe("http://example.com/ns1");
			expect(resolved.types.length).toBeGreaterThanOrEqual(1);

			const doc = resolved.types.find((t) => t.className === "Document")!;
			expect(doc).toBeDefined();
			expect(doc.isRootElement).toBe(true);
			expect(doc.namespace).toBeDefined();
			expect(doc.namespace!.uri).toBe("http://example.com/ns1");

			const title = doc.properties.find((p) => p.xmlName === "Title")!;
			expect(title.form).toBe("qualified");
			expect(title.namespace).toBeDefined();
			expect(title.namespace!.uri).toBe("http://example.com/ns1");

			const id = doc.properties.find((p) => p.xmlName === "id")!;
			expect(id.form).toBeUndefined();
			expect(id.namespace).toBeUndefined();
		});
	});

	describe("inline XSD resolver tests", () => {
		it("should treat xs:any without minOccurs as required", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Envelope">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Header" type="xs:string"/>
				<xs:any namespace="##any" processContents="lax"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const envelope = resolved.types[0];

			const dynamic = envelope.properties.find((p) => p.kind === "dynamic")!;
			expect(dynamic.required).toBe(true);
		});

		it("should treat xs:any with minOccurs=0 as optional", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Envelope">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Header" type="xs:string"/>
				<xs:any namespace="##any" processContents="lax" minOccurs="0"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const envelope = resolved.types[0];

			const dynamic = envelope.properties.find((p) => p.kind === "dynamic")!;
			expect(dynamic.required).toBeUndefined();
		});

		it("should resolve xs:all elements without order", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Config">
		<xs:complexType>
			<xs:all>
				<xs:element name="Host" type="xs:string"/>
				<xs:element name="Port" type="xs:integer"/>
			</xs:all>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const config = resolved.types[0];

			expect(config.properties).toHaveLength(2);
			const host = config.properties.find((p) => p.xmlName === "Host")!;
			expect(host.kind).toBe("element");
			expect(host.order).toBeUndefined();
		});

		it("should resolve choice elements as optional", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Shape">
		<xs:complexType>
			<xs:choice>
				<xs:element name="Circle" type="xs:string"/>
				<xs:element name="Square" type="xs:string"/>
			</xs:choice>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const shape = resolved.types[0];

			const circle = shape.properties.find((p) => p.xmlName === "Circle")!;
			expect(circle.required).toBe(false);
			const square = shape.properties.find((p) => p.xmlName === "Square")!;
			expect(square.required).toBe(false);
		});

		it("should resolve inline complexType on element", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Child">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="Value" type="xs:string"/>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types.find((t) => t.className === "Root")!;

			const child = root.properties.find((p) => p.xmlName === "Child")!;
			expect(child.complexTypeName).toBe("ChildType");
		});

		it("should materialize nested inline complex types as generated classes", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="shiporder">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="orderperson" type="xs:string"/>
				<xs:element name="shipto">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="name" type="xs:string"/>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
				<xs:element name="item" maxOccurs="unbounded">
					<xs:complexType>
						<xs:sequence>
							<xs:element name="title" type="xs:string"/>
						</xs:sequence>
					</xs:complexType>
				</xs:element>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);

			const typeNames = resolved.types.map((t) => t.className);
			expect(typeNames).toContain("Shiporder");
			expect(typeNames).toContain("ShiptoType");
			expect(typeNames).toContain("ItemType");

			const shiporder = resolved.types.find((t) => t.className === "Shiporder")!;
			const shipto = shiporder.properties.find((p) => p.xmlName === "shipto")!;
			expect(shipto.complexTypeName).toBe("ShiptoType");

			const item = shiporder.properties.find((p) => p.xmlName === "item")!;
			expect(item.kind).toBe("array");
			expect(item.arrayItemType).toBe("ItemType");
		});

		it("should resolve inline simpleType on element", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Score">
					<xs:simpleType>
						<xs:restriction base="xs:integer">
							<xs:minInclusive value="0"/>
							<xs:maxInclusive value="100"/>
						</xs:restriction>
					</xs:simpleType>
				</xs:element>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const score = root.properties.find((p) => p.xmlName === "Score")!;
			expect(score.tsType).toBe("number");
		});

		it("should resolve element with no type as string", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Unknown"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const unknown = root.properties.find((p) => p.xmlName === "Unknown")!;
			expect(unknown.tsType).toBe("string");
		});

		it("should resolve unknown type reference as string", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Data" type="tns:UnknownType"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const data = root.properties.find((p) => p.xmlName === "Data")!;
			expect(data.tsType).toBe("string");
		});

		it("should resolve xs:list as array type", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="IntList">
		<xs:list itemType="xs:integer"/>
	</xs:simpleType>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Values" type="IntList"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const values = root.properties.find((p) => p.xmlName === "Values")!;
			expect(values.tsType).toBe("number[]");
		});

		it("should resolve xs:union with empty memberTypes as string", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="EmptyUnion">
		<xs:union memberTypes=""/>
	</xs:simpleType>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Val" type="EmptyUnion"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const val = root.properties.find((p) => p.xmlName === "Val")!;
			expect(val.tsType).toBe("string");
		});

		it("should resolve attribute with default value", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:attribute name="lang" type="xs:string" default="en"/>
			<xs:attribute name="count" type="xs:integer" default="10"/>
			<xs:attribute name="active" type="xs:boolean" default="true"/>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const lang = root.properties.find((p) => p.xmlName === "lang")!;
			expect(lang.initializer).toBe("'en'");
			expect(lang.defaultValue).toBe("en");

			const count = root.properties.find((p) => p.xmlName === "count")!;
			expect(count.initializer).toBe("10");

			const active = root.properties.find((p) => p.xmlName === "active")!;
			expect(active.initializer).toBe("true");
		});

		it("should resolve attribute with inline simpleType", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:attribute name="status">
				<xs:simpleType>
					<xs:restriction base="xs:string">
						<xs:enumeration value="on"/>
						<xs:enumeration value="off"/>
					</xs:restriction>
				</xs:simpleType>
			</xs:attribute>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const status = root.properties.find((p) => p.xmlName === "status")!;
			expect(status.enumValues).toEqual(["on", "off"]);
		});

		it("should resolve attribute ref", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:attribute name="lang" type="xs:string"/>
	<xs:element name="Root">
		<xs:complexType>
			<xs:attribute ref="lang"/>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const lang = root.properties.find((p) => p.xmlName === "lang")!;
			expect(lang.kind).toBe("attribute");
			expect(lang.tsType).toBe("string");
		});

		it("should resolve anyAttribute as dynamic property", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Open">
		<xs:complexType>
			<xs:anyAttribute processContents="lax"/>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const open = resolved.types[0];

			const dynamic = open.properties.find((p) => p.kind === "dynamic");
			expect(dynamic).toBeDefined();
			expect(dynamic!.propertyName).toBe("anyAttributes");
		});

		it("should resolve simpleContent restriction", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Rating">
		<xs:complexType>
			<xs:simpleContent>
				<xs:restriction base="xs:string">
					<xs:enumeration value="good"/>
					<xs:enumeration value="bad"/>
				</xs:restriction>
			</xs:simpleContent>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const rating = resolved.types[0];

			expect(rating.hasSimpleContent).toBe(true);
			const value = rating.properties.find((p) => p.kind === "text")!;
			expect(value).toBeDefined();
			expect(value.tsType).toBe("string");
			expect(value.enumValues).toEqual(["good", "bad"]);
		});

		it("should resolve complexContent restriction with base type", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:complexType name="BaseType">
		<xs:sequence>
			<xs:element name="Name" type="xs:string"/>
		</xs:sequence>
	</xs:complexType>
	<xs:complexType name="RestrictedType">
		<xs:complexContent>
			<xs:restriction base="BaseType">
				<xs:sequence>
					<xs:element name="Name" type="xs:token"/>
				</xs:sequence>
			</xs:restriction>
		</xs:complexContent>
	</xs:complexType>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const restricted = resolved.types.find((t) => t.className === "RestrictedType")!;

			expect(restricted.baseTypeName).toBe("BaseType");
			expect(restricted.properties).toHaveLength(1);
		});

		it("should resolve group ref properties", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:group name="PersonInfo">
		<xs:sequence>
			<xs:element name="First" type="xs:string"/>
			<xs:element name="Last" type="xs:string"/>
		</xs:sequence>
	</xs:group>
	<xs:element name="Person">
		<xs:complexType>
			<xs:sequence>
				<xs:group ref="PersonInfo"/>
				<xs:element name="Age" type="xs:integer"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const person = resolved.types.find((t) => t.className === "Person")!;

			const propNames = person.properties.map((p) => p.xmlName);
			expect(propNames).toContain("First");
			expect(propNames).toContain("Last");
			expect(propNames).toContain("Age");
		});

		it("should resolve named enum type reference on property", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="StatusType">
		<xs:restriction base="xs:string">
			<xs:enumeration value="active"/>
			<xs:enumeration value="inactive"/>
		</xs:restriction>
	</xs:simpleType>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Status" type="StatusType"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types.find((t) => t.className === "Root")!;

			const status = root.properties.find((p) => p.xmlName === "Status")!;
			expect(status.enumTypeName).toBe("StatusType");
		});

		it("should resolve root element referencing named complex type", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:complexType name="PersonType">
		<xs:sequence>
			<xs:element name="Name" type="xs:string"/>
		</xs:sequence>
	</xs:complexType>
	<xs:element name="Person" type="PersonType"/>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);

			expect(resolved.rootElements).toHaveLength(1);
			expect(resolved.rootElements[0].name).toBe("Person");
			expect(resolved.rootElements[0].typeName).toBe("PersonType");
		});

		it("should resolve simple root element (wrapper class)", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Title" type="xs:string"/>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);

			const title = resolved.types.find((t) => t.className === "Title")!;
			expect(title.isRootElement).toBe(true);
			const value = title.properties.find((p) => p.kind === "text")!;
			expect(value.tsType).toBe("string");
		});

		it("should resolve elementFormDefault on properties", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Name" type="xs:string"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types[0];

			const name = root.properties.find((p) => p.xmlName === "Name")!;
			expect(name.form).toBe("qualified");
		});

		it("should resolve attributeGroup refs", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:attributeGroup name="CommonAttrs">
		<xs:attribute name="id" type="xs:string" use="required"/>
		<xs:attribute name="version" type="xs:integer"/>
	</xs:attributeGroup>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Name" type="xs:string"/>
			</xs:sequence>
			<xs:attributeGroup ref="CommonAttrs"/>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const resolved = resolver.resolve(schema);
			const root = resolved.types.find((t) => t.className === "Root")!;

			const id = root.properties.find((p) => p.xmlName === "id")!;
			expect(id.kind).toBe("attribute");
			expect(id.required).toBe(true);
			const version = root.properties.find((p) => p.xmlName === "version")!;
			expect(version.kind).toBe("attribute");
		});
	});
});
