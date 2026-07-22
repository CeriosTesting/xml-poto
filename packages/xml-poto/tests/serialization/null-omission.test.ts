/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

/**
 * P4: null/undefined non-nullable members are omitted by default (C# XmlSerializer);
 * isNullable members still emit xsi:nil; omitNullValues:false restores empty elements.
 */
describe("Null omission (C# alignment)", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it("omits null and undefined non-nullable members by default", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlElement({ name: "a" })
			a: string | null = null;

			@XmlElement({ name: "b" })
			b: string | undefined = undefined;

			@XmlElement({ name: "c" })
			c: string = "present";
		}

		const xml = serializer.toXml(new Root());
		expect(xml).not.toContain("<a");
		expect(xml).not.toContain("<b");
		expect(xml).toContain("<c>present</c>");
	});

	it("still emits an empty element for an empty string", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlElement({ name: "a" })
			a: string = "";
		}

		expect(serializer.toXml(new Root())).toContain("<a/>");
	});

	it("emits xsi:nil for a nullable null member", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlElement({ name: "a", isNullable: true })
			a: string | null = null;
		}

		const xml = serializer.toXml(new Root());
		expect(xml).toContain('xsi:nil="true"');
	});

	it("omits a null attribute by default", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlAttribute({ name: "id" })
			id: string | null = null;
		}

		const xml = serializer.toXml(new Root());
		expect(xml).not.toContain("id=");
	});

	it("restores empty elements with omitNullValues: false", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlElement({ name: "a" })
			a: string | null = null;
		}

		const legacy = new XmlDecoratorSerializer({ omitNullValues: false });
		expect(legacy.toXml(new Root())).toMatch(/<a\/>|<a><\/a>/);
	});
});
