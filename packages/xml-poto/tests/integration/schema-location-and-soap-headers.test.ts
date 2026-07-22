/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { SoapSerializer, XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("xsi:schemaLocation", () => {
	@XmlRoot({ name: "doc", namespace: { uri: "http://example.com/v1", prefix: "tns" } })
	class Doc {
		@XmlElement({ name: "title" })
		title: string = "hello";
	}

	it("writes namespace/location pairs as one space-separated attribute", () => {
		const xml = new XmlSerializer({
			schemaLocation: { "http://example.com/v1": "https://example.com/v1.xsd" },
		}).toXml(new Doc());

		expect(xml).toContain('xsi:schemaLocation="http://example.com/v1 https://example.com/v1.xsd"');
	});

	it("declares the xsi namespace it just used", () => {
		const xml = new XmlSerializer({
			schemaLocation: { "http://example.com/v1": "https://example.com/v1.xsd" },
		}).toXml(new Doc());

		expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
	});

	it("joins several namespaces into one flat list", () => {
		const xml = new XmlSerializer({
			schemaLocation: { "http://a": "a.xsd", "http://b": "b.xsd" },
		}).toXml(new Doc());

		expect(xml).toContain('xsi:schemaLocation="http://a a.xsd http://b b.xsd"');
	});

	it("writes noNamespaceSchemaLocation on its own", () => {
		expect(new XmlSerializer({ noNamespaceSchemaLocation: "local.xsd" }).toXml(new Doc())).toContain(
			'xsi:noNamespaceSchemaLocation="local.xsd"',
		);
	});

	it("writes nothing when neither option is set", () => {
		expect(new XmlSerializer().toXml(new Doc())).not.toContain("schemaLocation");
	});
});

describe("SOAP header control attributes", () => {
	@XmlRoot({ name: "Auth", namespace: { uri: "http://example.com/hdr", prefix: "h" } })
	class Auth {
		@XmlElement({ name: "token" })
		token: string = "abc";
	}

	@XmlRoot({ name: "Ping", namespace: { uri: "http://example.com/v1", prefix: "tns" } })
	class Ping {
		@XmlElement({ name: "value" })
		value: string = "1";
	}

	it("writes SOAP 1.1 mustUnderstand as 1/0 and names the target actor", () => {
		const xml = new SoapSerializer({ soapVersion: "1.1" }).toXml(new Ping(), {
			headers: [{ value: new Auth(), mustUnderstand: true, actor: "http://example.com/router" }],
		});

		expect(xml).toContain('soapenv:mustUnderstand="1"');
		expect(xml).toContain('soapenv:actor="http://example.com/router"');
	});

	it("writes SOAP 1.2 mustUnderstand as true/false and names the target role", () => {
		const xml = new SoapSerializer({ soapVersion: "1.2" }).toXml(new Ping(), {
			headers: [{ value: new Auth(), mustUnderstand: true, actor: "http://example.com/router", relay: true }],
		});

		expect(xml).toContain('soapenv:mustUnderstand="true"');
		expect(xml).toContain('soapenv:role="http://example.com/router"');
		expect(xml).toContain('soapenv:relay="true"');
	});

	it("writes mustUnderstand=0 when explicitly disabled", () => {
		const xml = new SoapSerializer({ soapVersion: "1.1" }).toXml(new Ping(), {
			headers: [{ value: new Auth(), mustUnderstand: false }],
		});

		expect(xml).toContain('soapenv:mustUnderstand="0"');
	});

	it("still accepts a bare header object, with no control attributes", () => {
		const xml = new SoapSerializer().toXml(new Ping(), { headers: [new Auth()] });

		expect(xml).toContain("<h:Auth");
		expect(xml).not.toContain("mustUnderstand");
	});

	it("keeps the header payload intact alongside the attributes", () => {
		const xml = new SoapSerializer().toXml(new Ping(), {
			headers: [{ value: new Auth(), mustUnderstand: true }],
		});

		// The header element carries the control attribute; its own members are
		// unqualified, as elementFormDefault dictates for locals.
		expect(xml).toContain('<h:Auth xmlns:h="http://example.com/hdr" soapenv:mustUnderstand="1">');
		expect(xml).toContain("<token>abc</token>");
	});
});
