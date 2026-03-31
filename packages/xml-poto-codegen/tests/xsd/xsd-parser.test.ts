import path from "node:path";

import { describe, expect, it } from "vitest";

import { XsdParser } from "../../src/xsd/xsd-parser";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("XsdParser", () => {
	const parser = new XsdParser();

	describe("simple.xsd", () => {
		it("should parse root element with inline complexType", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));

			expect(schema.elements).toHaveLength(1);
			expect(schema.elements[0].name).toBe("Person");
			expect(schema.elements[0].complexType).toBeDefined();
		});

		it("should parse sequence elements with types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const ct = schema.elements[0].complexType!;

			expect(ct.sequence).toBeDefined();
			expect(ct.sequence!.elements).toHaveLength(4);
			expect(ct.sequence!.elements[0].name).toBe("FirstName");
			expect(ct.sequence!.elements[0].type).toBe("xs:string");
			expect(ct.sequence!.elements[2].name).toBe("Age");
			expect(ct.sequence!.elements[2].type).toBe("xs:integer");
		});

		it("should parse optional element (minOccurs=0)", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const ct = schema.elements[0].complexType!;
			const email = ct.sequence!.elements[3];

			expect(email.name).toBe("Email");
			expect(email.minOccurs).toBe(0);
		});

		it("should parse required attribute", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "simple.xsd"));
			const ct = schema.elements[0].complexType!;

			expect(ct.attributes).toHaveLength(1);
			expect(ct.attributes[0].name).toBe("id");
			expect(ct.attributes[0].use).toBe("required");
		});
	});

	describe("complex.xsd", () => {
		it("should parse targetNamespace and elementFormDefault", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));

			expect(schema.targetNamespace).toBe("http://example.com/orders");
			expect(schema.elementFormDefault).toBe("qualified");
		});

		it("should parse named complexTypes", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));

			expect(schema.complexTypes).toHaveLength(2);
			expect(schema.complexTypes[0].name).toBe("AddressType");
			expect(schema.complexTypes[1].name).toBe("ProductType");
		});

		it("should parse elements referencing named types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const order = schema.elements[0].complexType!;
			const shipping = order.sequence!.elements[1];

			expect(shipping.name).toBe("ShippingAddress");
			expect(shipping.type).toBe("tns:AddressType");
		});

		it("should parse unbounded elements", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));
			const order = schema.elements[0].complexType!;
			const items = order.sequence!.elements[3];

			expect(items.name).toBe("Items");
			expect(items.maxOccurs).toBe("unbounded");
		});

		it("should parse namespace declarations", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "complex.xsd"));

			expect(schema.namespaces.get("tns")).toBe("http://example.com/orders");
			expect(schema.namespaces.get("xs")).toBe("http://www.w3.org/2001/XMLSchema");
		});
	});

	describe("enums.xsd", () => {
		it("should parse simpleType with enumerations", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "enums.xsd"));

			expect(schema.simpleTypes).toHaveLength(3);

			const status = schema.simpleTypes[0];
			expect(status.name).toBe("StatusType");
			expect(status.restriction).toBeDefined();
			expect(status.restriction!.base).toBe("xs:string");
			expect(status.restriction!.enumerations).toEqual(["active", "inactive", "pending"]);
		});

		it("should parse simpleType with pattern", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "enums.xsd"));
			const email = schema.simpleTypes[2];

			expect(email.name).toBe("EmailType");
			expect(email.restriction!.pattern).toBe("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}");
		});
	});

	describe("arrays.xsd", () => {
		it("should parse elements with maxOccurs unbounded", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "arrays.xsd"));
			const library = schema.elements[0].complexType!;
			const book = library.sequence!.elements[0];

			expect(book.name).toBe("Book");
			expect(book.maxOccurs).toBe("unbounded");
			expect(book.complexType).toBeDefined();
		});

		it("should parse nested inline types within arrays", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "arrays.xsd"));
			const library = schema.elements[0].complexType!;
			const book = library.sequence!.elements[0];
			const bookCt = book.complexType!;

			expect(bookCt.sequence!.elements).toHaveLength(3);
			expect(bookCt.sequence!.elements[1].name).toBe("Author");
			expect(bookCt.sequence!.elements[1].maxOccurs).toBe("unbounded");
		});
	});

	describe("inheritance.xsd", () => {
		it("should parse complexContent extension", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "inheritance.xsd"));

			const userType = schema.complexTypes.find((t) => t.name === "UserType")!;
			expect(userType.complexContent).toBeDefined();
			expect(userType.complexContent!.extension).toBeDefined();
			expect(userType.complexContent!.extension!.base).toBe("BaseEntityType");
		});

		it("should parse extension sequence and attributes", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "inheritance.xsd"));

			const userType = schema.complexTypes.find((t) => t.name === "UserType")!;
			const ext = userType.complexContent!.extension!;

			expect(ext.sequence!.elements).toHaveLength(2);
			expect(ext.sequence!.elements[0].name).toBe("Username");
			expect(ext.attributes).toHaveLength(1);
			expect(ext.attributes[0].name).toBe("role");
		});

		it("should parse multi-level inheritance", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "inheritance.xsd"));

			const admin = schema.complexTypes.find((t) => t.name === "AdminType")!;
			expect(admin.complexContent!.extension!.base).toBe("UserType");
		});
	});

	describe("mixed.xsd", () => {
		it("should parse simpleContent extension", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const price = schema.elements.find((e) => e.name === "Price")!;
			const ct = price.complexType!;

			expect(ct.simpleContent).toBeDefined();
			expect(ct.simpleContent!.extension).toBeDefined();
			expect(ct.simpleContent!.extension!.base).toBe("xs:decimal");
			expect(ct.simpleContent!.extension!.attributes).toHaveLength(2);
		});

		it("should parse mixed content type", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const config = schema.elements.find((e) => e.name === "Config")!;

			expect(config.complexType!.mixed).toBe(true);
		});

		it("should parse xs:any element", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const config = schema.elements.find((e) => e.name === "Config")!;
			const seq = config.complexType!.sequence!;

			expect(seq.any).toHaveLength(1);
			expect(seq.any[0].processContents).toBe("lax");
		});

		it("should parse nillable and default", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "mixed.xsd"));
			const wrapper = schema.elements.find((e) => e.name === "Wrapper")!;
			const seq = wrapper.complexType!.sequence!;

			expect(seq.elements[1].nillable).toBe(true);
			expect(seq.elements[2].defaultValue).toBe("0");
		});
	});

	describe("parseString", () => {
		it("should handle xsd: prefix", () => {
			const xsd = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
	<xsd:element name="Test" type="xsd:string"/>
</xsd:schema>`;

			const schema = parser.parseString(xsd);
			expect(schema.elements).toHaveLength(1);
			expect(schema.elements[0].name).toBe("Test");
		});

		it("should handle no prefix (default namespace)", () => {
			const xsd = `<?xml version="1.0"?>
<schema xmlns="http://www.w3.org/2001/XMLSchema">
	<element name="Test" type="string"/>
</schema>`;

			const schema = parser.parseString(xsd);
			expect(schema.elements).toHaveLength(1);
			expect(schema.elements[0].name).toBe("Test");
		});
	});

	describe("union.xsd", () => {
		it("should parse xs:union memberTypes", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "union.xsd"));

			const stringOrInt = schema.simpleTypes.find((st) => st.name === "StringOrInt")!;
			expect(stringOrInt.union).toBeDefined();
			expect(stringOrInt.union!.memberTypes).toEqual(["xs:string", "xs:integer"]);
		});
	});

	describe("import-main.xsd", () => {
		it("should resolve xs:import and merge imported types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "import-main.xsd"));

			const typeNames = schema.complexTypes.map((ct) => ct.name);
			expect(typeNames).toContain("CustomerType");
		});

		it("should preserve namespace mappings from imports", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "import-main.xsd"));

			// The types namespace should be present
			expect(schema.namespaces.has("types")).toBe(true);
		});
	});

	describe("substitution-group.xsd", () => {
		it("should parse substitutionGroup attribute on elements", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "substitution-group.xsd"));

			const dog = schema.elements.find((e) => e.name === "Dog")!;
			expect(dog.substitutionGroup).toBe("Pet");

			const cat = schema.elements.find((e) => e.name === "Cat")!;
			expect(cat.substitutionGroup).toBe("Pet");
		});

		it("should not have substitutionGroup on head element", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "substitution-group.xsd"));

			const pet = schema.elements.find((e) => e.name === "Pet")!;
			expect(pet.substitutionGroup).toBeUndefined();
		});
	});

	describe("namespaced.xsd", () => {
		it("should parse namespaced schema with nested inline types", () => {
			const schema = parser.parseFile(path.join(FIXTURES, "namespaced.xsd"));

			expect(schema.targetNamespace).toBe("http://example.com/ns1");
			expect(schema.elementFormDefault).toBe("qualified");
			expect(schema.elements).toHaveLength(1);
			expect(schema.elements[0].name).toBe("Document");

			const ct = schema.elements[0].complexType!;
			const metadata = ct.sequence!.elements[2];
			expect(metadata.name).toBe("Metadata");
			expect(metadata.complexType).toBeDefined();
			expect(metadata.complexType!.sequence!.elements).toHaveLength(2);
			expect(metadata.complexType!.attributes).toHaveLength(1);
		});
	});

	describe("parseString inline XSD", () => {
		it("should parse xs:list", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="IntList">
		<xs:list itemType="xs:integer"/>
	</xs:simpleType>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const intList = schema.simpleTypes.find((st) => st.name === "IntList")!;
			expect(intList.list).toBeDefined();
			expect(intList.list!.itemType).toBe("xs:integer");
		});

		it("should parse element with ref attribute", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Name" type="xs:string"/>
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element ref="Name"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const root = schema.elements.find((e) => e.name === "Root")!;
			const ref = root.complexType!.sequence!.elements[0];
			expect(ref.ref).toBe("Name");
		});

		it("should parse element with fixed attribute", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="Version" type="xs:string" fixed="1.0"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const root = schema.elements[0];
			const version = root.complexType!.sequence!.elements[0];
			expect(version.fixed).toBe("1.0");
		});

		it("should parse element with inline simpleType", () => {
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
			const root = schema.elements[0];
			const score = root.complexType!.sequence!.elements[0];
			expect(score.simpleType).toBeDefined();
			expect(score.simpleType!.restriction!.minInclusive).toBe(0);
			expect(score.simpleType!.restriction!.maxInclusive).toBe(100);
		});

		it("should parse attribute with ref", () => {
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
			const root = schema.elements.find((e) => e.name === "Root")!;
			const langAttr = root.complexType!.attributes[0];
			expect(langAttr.ref).toBe("lang");
		});

		it("should parse attribute with inline simpleType", () => {
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
			const root = schema.elements[0];
			const status = root.complexType!.attributes[0];
			expect(status.simpleType).toBeDefined();
			expect(status.simpleType!.restriction!.enumerations).toEqual(["on", "off"]);
		});

		it("should parse choice compositor at complexType level", () => {
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
			const shape = schema.elements[0];
			expect(shape.complexType!.choice).toBeDefined();
			expect(shape.complexType!.choice!.elements).toHaveLength(2);
		});

		it("should parse all compositor at complexType level", () => {
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
			const config = schema.elements[0];
			expect(config.complexType!.all).toBeDefined();
			expect(config.complexType!.all!.elements).toHaveLength(2);
		});

		it("should parse restriction facets", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:simpleType name="Code">
		<xs:restriction base="xs:string">
			<xs:minLength value="2"/>
			<xs:maxLength value="10"/>
			<xs:whiteSpace value="collapse"/>
		</xs:restriction>
	</xs:simpleType>
	<xs:simpleType name="Amount">
		<xs:restriction base="xs:decimal">
			<xs:totalDigits value="8"/>
			<xs:fractionDigits value="2"/>
			<xs:minExclusive value="0"/>
			<xs:maxExclusive value="1000000"/>
		</xs:restriction>
	</xs:simpleType>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const code = schema.simpleTypes.find((st) => st.name === "Code")!;
			expect(code.restriction!.minLength).toBe(2);
			expect(code.restriction!.maxLength).toBe(10);
			expect(code.restriction!.whiteSpace).toBe("collapse");

			const amount = schema.simpleTypes.find((st) => st.name === "Amount")!;
			expect(amount.restriction!.totalDigits).toBe(8);
			expect(amount.restriction!.fractionDigits).toBe(2);
			expect(amount.restriction!.minExclusive).toBe(0);
			expect(amount.restriction!.maxExclusive).toBe(1000000);
		});

		it("should parse simpleContent restriction", () => {
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
			const rating = schema.elements[0];
			expect(rating.complexType!.simpleContent).toBeDefined();
			expect(rating.complexType!.simpleContent!.restriction).toBeDefined();
			expect(rating.complexType!.simpleContent!.restriction!.base).toBe("xs:string");
			expect(rating.complexType!.simpleContent!.restriction!.enumerations).toEqual(["good", "bad"]);
		});

		it("should parse complexContent restriction", () => {
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
			const restricted = schema.complexTypes.find((ct) => ct.name === "RestrictedType")!;
			expect(restricted.complexContent).toBeDefined();
			expect(restricted.complexContent!.restriction).toBeDefined();
			expect(restricted.complexContent!.restriction!.base).toBe("BaseType");
			expect(restricted.complexContent!.restriction!.sequence!.elements).toHaveLength(1);
		});

		it("should parse complexContent extension with choice", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:complexType name="BaseType">
		<xs:sequence>
			<xs:element name="Id" type="xs:string"/>
		</xs:sequence>
	</xs:complexType>
	<xs:complexType name="ExtendedType">
		<xs:complexContent>
			<xs:extension base="BaseType">
				<xs:choice>
					<xs:element name="OptionA" type="xs:string"/>
					<xs:element name="OptionB" type="xs:integer"/>
				</xs:choice>
			</xs:extension>
		</xs:complexContent>
	</xs:complexType>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const extended = schema.complexTypes.find((ct) => ct.name === "ExtendedType")!;
			expect(extended.complexContent!.extension!.choice).toBeDefined();
			expect(extended.complexContent!.extension!.choice!.elements).toHaveLength(2);
		});

		it("should parse group definitions with choice", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:group name="NameGroup">
		<xs:choice>
			<xs:element name="First" type="xs:string"/>
			<xs:element name="Full" type="xs:string"/>
		</xs:choice>
	</xs:group>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const group = schema.groups.find((g) => g.name === "NameGroup")!;
			expect(group.choice).toBeDefined();
			expect(group.choice!.elements).toHaveLength(2);
		});

		it("should parse attributeGroup definitions", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:attributeGroup name="CommonAttrs">
		<xs:attribute name="id" type="xs:string"/>
		<xs:attribute name="version" type="xs:integer"/>
	</xs:attributeGroup>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const ag = schema.attributeGroups.find((ag) => ag.name === "CommonAttrs")!;
			expect(ag.attributes).toHaveLength(2);
			expect(ag.attributes[0].name).toBe("id");
			expect(ag.attributes[1].name).toBe("version");
		});

		it("should parse nested sequences within a sequence", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:sequence>
				<xs:element name="A" type="xs:string"/>
				<xs:sequence>
					<xs:element name="B" type="xs:string"/>
					<xs:element name="C" type="xs:string"/>
				</xs:sequence>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const root = schema.elements[0];
			expect(root.complexType!.sequence!.elements).toHaveLength(1);
			expect(root.complexType!.sequence!.sequences).toHaveLength(1);
			expect(root.complexType!.sequence!.sequences[0].elements).toHaveLength(2);
		});

		it("should parse choice with sequences", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Root">
		<xs:complexType>
			<xs:choice>
				<xs:sequence>
					<xs:element name="X" type="xs:string"/>
					<xs:element name="Y" type="xs:string"/>
				</xs:sequence>
				<xs:element name="Z" type="xs:string"/>
			</xs:choice>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const root = schema.elements[0];
			expect(root.complexType!.choice).toBeDefined();
			expect(root.complexType!.choice!.elements).toHaveLength(1);
			expect(root.complexType!.choice!.sequences).toHaveLength(1);
			expect(root.complexType!.choice!.sequences[0].elements).toHaveLength(2);
		});

		it("should parse group refs within sequence", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:group name="NameGroup">
		<xs:sequence>
			<xs:element name="First" type="xs:string"/>
			<xs:element name="Last" type="xs:string"/>
		</xs:sequence>
	</xs:group>
	<xs:element name="Person">
		<xs:complexType>
			<xs:sequence>
				<xs:group ref="NameGroup"/>
				<xs:element name="Age" type="xs:integer"/>
			</xs:sequence>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const person = schema.elements.find((e) => e.name === "Person")!;
			expect(person.complexType!.sequence!.groupRefs).toHaveLength(1);
			expect(person.complexType!.sequence!.groupRefs[0].ref).toBe("NameGroup");
		});

		it("should parse anyAttribute", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:element name="Open">
		<xs:complexType>
			<xs:anyAttribute processContents="lax"/>
		</xs:complexType>
	</xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const open = schema.elements[0];
			expect(open.complexType!.anyAttribute).toBe(true);
		});

		it("should parse abstract complexType", () => {
			const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
	<xs:complexType name="AbstractBase" abstract="true">
		<xs:sequence>
			<xs:element name="Id" type="xs:string"/>
		</xs:sequence>
	</xs:complexType>
</xs:schema>`;

			const schema = parser.parseString(xsd);
			const base = schema.complexTypes[0];
			expect(base.abstract).toBe(true);
		});
	});
});
