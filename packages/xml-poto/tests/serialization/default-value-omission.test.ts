/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

@XmlRoot({ name: "Settings" })
class Settings {
	@XmlElement({ name: "status", defaultValue: "enabled" })
	status: string = "enabled";

	@XmlElement({ name: "retries", defaultValue: 3 })
	retries: number = 3;

	@XmlAttribute({ name: "mode", defaultValue: "auto" })
	mode: string = "auto";
}

@XmlRoot({ name: "Required" })
class RequiredWithDefault {
	@XmlElement({ name: "level", defaultValue: "info", required: true })
	level: string = "info";
}

describe("[DefaultValue] omit-on-write (omitDefaultValues)", () => {
	it("omits a scalar element equal to its default (default: omit)", () => {
		const xml = new XmlDecoratorSerializer().toXml(new Settings());
		expect(xml).not.toContain("<status>");
		expect(xml).not.toContain("<retries>");
	});

	it("omits an attribute equal to its default", () => {
		const xml = new XmlDecoratorSerializer().toXml(new Settings());
		expect(xml).not.toContain("mode=");
	});

	it("emits a member whose value differs from its default", () => {
		const s = new Settings();
		s.status = "disabled";
		s.retries = 5;
		s.mode = "manual";
		const xml = new XmlDecoratorSerializer().toXml(s);
		expect(xml).toContain("<status>disabled</status>");
		expect(xml).toContain("<retries>5</retries>");
		expect(xml).toContain('mode="manual"');
	});

	it("restores emission when omitDefaultValues is false", () => {
		const xml = new XmlDecoratorSerializer({ omitDefaultValues: false }).toXml(new Settings());
		expect(xml).toContain("<status>enabled</status>");
		expect(xml).toContain("<retries>3</retries>");
		expect(xml).toContain('mode="auto"');
	});

	it("never omits a required member even when equal to its default", () => {
		const xml = new XmlDecoratorSerializer().toXml(new RequiredWithDefault());
		expect(xml).toContain("<level>info</level>");
	});

	it("round-trips: omitted default is re-applied on deserialize", () => {
		const serializer = new XmlDecoratorSerializer();
		const xml = serializer.toXml(new Settings());
		const back = serializer.fromXml(xml, Settings);
		expect(back.status).toBe("enabled");
		expect(back.retries).toBe(3);
		expect(back.mode).toBe("auto");
	});
});
