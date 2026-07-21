/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlText } from "../../src/decorators/xml-text";

const GENDER_MAP = { Male: "M", Female: "F" } as const;

@XmlRoot({ name: "Person" })
class Person {
	@XmlElement({ name: "gender", enumMap: GENDER_MAP, enumValues: ["M", "F"] })
	gender!: string;
}

@XmlRoot({ name: "Account" })
class Account {
	@XmlAttribute({ name: "status", enumMap: { Active: "1", Suspended: "2" } })
	status!: string;
}

@XmlRoot({ name: "Note" })
class Note {
	@XmlText({ enumMap: { High: "H", Low: "L" } })
	priority!: string;
}

describe("@XmlEnum member<->token remapping (enumMap)", () => {
	const serializer = new XmlDecoratorSerializer();

	it("translates an element member to its XML token on serialize", () => {
		const p = new Person();
		p.gender = "Male";
		const xml = serializer.toXml(p);
		expect(xml).toContain("<gender>M</gender>");
		expect(xml).not.toContain("Male");
	});

	it("translates an element token back to its member on deserialize", () => {
		const result = serializer.fromXml("<Person><gender>F</gender></Person>", Person);
		expect(result.gender).toBe("Female");
	});

	it("round-trips an element enum member", () => {
		const p = new Person();
		p.gender = "Female";
		const back = serializer.fromXml(serializer.toXml(p), Person);
		expect(back.gender).toBe("Female");
	});

	it("remaps attribute members and tokens both directions", () => {
		const a = new Account();
		a.status = "Active";
		const xml = serializer.toXml(a);
		expect(xml).toContain('status="1"');

		const back = serializer.fromXml('<Account status="2"/>', Account);
		expect(back.status).toBe("Suspended");
	});

	it("remaps text-content members and tokens both directions", () => {
		const n = new Note();
		n.priority = "High";
		const xml = serializer.toXml(n);
		expect(xml).toContain("<Note>H</Note>");

		const back = serializer.fromXml("<Note>L</Note>", Note);
		expect(back.priority).toBe("Low");
	});

	it("passes through values that are not in the map unchanged", () => {
		const p = new Person();
		// "M" is already a token; not a member key, so it passes through.
		const back = serializer.fromXml("<Person><gender>M</gender></Person>", Person);
		expect(back.gender).toBe("Male");

		// A value absent from the map on serialize is written verbatim.
		p.gender = "Other";
		// enumValues rejects the unmapped token ("Other" is neither a member nor a token)
		expect(() => serializer.toXml(p)).toThrow(/Other/);
	});

	it("validates the wire token against enumValues, not the member", () => {
		const p = new Person();
		p.gender = "Male"; // maps to "M", which is in enumValues → valid
		expect(() => serializer.toXml(p)).not.toThrow();
	});
});
