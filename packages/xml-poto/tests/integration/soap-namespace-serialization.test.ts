/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";

/**
 * Regression tests for issue #96 case 1: a nested element must not re-declare a
 * namespace prefix/URI pair that an ancestor already declared.
 */
describe("SOAP namespace serialization (dedup)", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it("should not repeat the SOAP namespace on a nested Body element", () => {
		@XmlElement({ name: "Body", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Body {
			@XmlElement({ name: "message" })
			message!: string;
		}

		@XmlRoot({ name: "Envelope", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Envelope {
			@XmlElement({ name: "Body" })
			body!: Body;
		}

		const envelope = new Envelope();
		envelope.body = new Body();
		envelope.body.message = "hello";

		const xml = serializer.toXml(envelope);

		// Declared exactly once, on the root Envelope
		expect(xml.match(/xmlns:S=/g)?.length).toBe(1);
		expect(xml).toContain(`<S:Envelope xmlns:S="${SOAP_NS}"`);
		// Body is qualified (property name + ancestor prefix) but does NOT re-declare xmlns:S
		expect(xml).toContain("<S:Body>");
		expect(xml).not.toMatch(/<S:Body[^>]*xmlns:S/);
	});

	it("should deduplicate a repeated prefix across three nesting levels", () => {
		@XmlElement({ name: "Detail", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Detail {
			@XmlElement({ name: "code" })
			code!: string;
		}

		@XmlElement({ name: "Body", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Body {
			@XmlElement({ name: "Detail" })
			detail!: Detail;
		}

		@XmlRoot({ name: "Envelope", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Envelope {
			@XmlElement({ name: "Body" })
			body!: Body;
		}

		const envelope = new Envelope();
		envelope.body = new Body();
		envelope.body.detail = new Detail();
		envelope.body.detail.code = "42";

		const xml = serializer.toXml(envelope);

		expect(xml.match(/xmlns:S=/g)?.length).toBe(1);
		expect(xml).toContain("<S:Body>");
		expect(xml).toContain("<S:Detail>");
	});

	it("should keep a distinct namespace bound to the same prefix (rebinding)", () => {
		const OTHER_NS = "http://example.com/other";

		@XmlElement({ name: "Body", namespace: { uri: OTHER_NS, prefix: "S" } })
		class Body {
			@XmlElement({ name: "message" })
			message!: string;
		}

		@XmlRoot({ name: "Envelope", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Envelope {
			@XmlElement({ name: "Body" })
			body!: Body;
		}

		const envelope = new Envelope();
		envelope.body = new Body();
		envelope.body.message = "hi";

		const xml = serializer.toXml(envelope);

		// Different URI on the same prefix is a legal rebinding and must be kept
		expect(xml).toContain(`xmlns:S="${SOAP_NS}"`);
		expect(xml).toContain(`xmlns:S="${OTHER_NS}"`);
	});
});
