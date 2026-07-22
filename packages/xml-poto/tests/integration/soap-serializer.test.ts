/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { SoapFaultError, SoapSerializer, XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlType } from "../../src/decorators/xml-type";

const GBAV_NS = "http://www.competent.nl/gbav/v1";
const SOAP_1_1 = "http://schemas.xmlsoap.org/soap/envelope/";
const SOAP_1_2 = "http://www.w3.org/2003/05/soap-envelope";
const WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";

@XmlType({ name: "identificatie" })
class Identificatie {
	@XmlElement({ name: "indicatie", required: true })
	indicatie: string = "";

	@XmlElement({ name: "gebruiker" })
	gebruiker?: string;
}

@XmlRoot({ name: "gbavVraag", namespace: { uri: GBAV_NS, prefix: "tns" } })
class GbavVraag {
	@XmlElement({ name: "identificatie", required: true, type: Identificatie })
	identificatie: Identificatie = new Identificatie();
}

@XmlRoot({ name: "gbavAntwoord", namespace: { uri: GBAV_NS, prefix: "tns" } })
class GbavAntwoord {
	@XmlElement({ name: "identificatie", required: true, type: Identificatie })
	identificatie: Identificatie = new Identificatie();
}

@XmlType({ name: "gbavFout", namespace: { uri: GBAV_NS, prefix: "tns" } })
class GbavFout {
	@XmlElement({ name: "foutCode" })
	foutCode?: string;

	@XmlElement({ name: "foutOmschrijving" })
	foutOmschrijving?: string;
}

@XmlRoot({ name: "Security", namespace: { uri: WSSE_NS, prefix: "wsse" } })
class Security {
	@XmlElement({ name: "Username" })
	username: string = "";
}

function buildVraag(gebruiker = "xmlbevr"): GbavVraag {
	const vraag = new GbavVraag();
	vraag.identificatie.indicatie = "AFN";
	vraag.identificatie.gebruiker = gebruiker;
	return vraag;
}

/** The gbavAntwoord payload, shared by the prefix-variation cases. */
const ANTWOORD_BODY = "<identificatie><indicatie>AFN</indicatie><gebruiker>xmlbevr</gebruiker></identificatie>";

/** Run `fn`, expecting it to raise a SoapFaultError, and hand the fault back. */
function captureFault(fn: () => unknown): SoapFaultError {
	try {
		fn();
	} catch (error) {
		if (error instanceof SoapFaultError) return error;
		throw error;
	}
	throw new Error("Expected a SoapFaultError to be thrown, but nothing was");
}

describe("SoapSerializer — writing", () => {
	let soap: SoapSerializer;

	beforeEach(() => {
		soap = new SoapSerializer();
	});

	it("wraps the payload in Envelope > Body", () => {
		const xml = soap.toXml(buildVraag());

		expect(xml).toContain(`<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}">`);
		expect(xml).toContain("<soapenv:Body>");
		expect(xml).toContain(`<tns:gbavVraag xmlns:tns="${GBAV_NS}">`);
		expect(xml).toContain("</soapenv:Envelope>");
	});

	it("declares the envelope namespace exactly once, on the Envelope", () => {
		const xml = soap.toXml(buildVraag());

		expect(xml.match(/xmlns:soapenv=/g)).toHaveLength(1);
	});

	it("keeps the payload's own namespace on the payload element", () => {
		const xml = soap.toXml(buildVraag());

		// The envelope stays clean; tns belongs to the payload, not the SOAP frame.
		expect(xml).not.toMatch(/<soapenv:Envelope[^>]*xmlns:tns/);
		expect(xml.match(/xmlns:tns=/g)).toHaveLength(1);
	});

	it("omits the Header entirely when no headers are given", () => {
		const xml = soap.toXml(buildVraag());

		expect(xml).not.toContain("Header");
	});

	it("writes a SOAP 1.2 envelope when configured for 1.2", () => {
		const xml = new SoapSerializer({ soapVersion: "1.2" }).toXml(buildVraag());

		expect(xml).toContain(`xmlns:soapenv="${SOAP_1_2}"`);
	});

	it("honours a custom envelope prefix", () => {
		const xml = new SoapSerializer({ soapPrefix: "S" }).toXml(buildVraag());

		expect(xml).toContain(`<S:Envelope xmlns:S="${SOAP_1_1}">`);
		expect(xml).toContain("<S:Body>");
	});

	it("still honours the inherited serialization options", () => {
		const xml = new SoapSerializer({ omitXmlDeclaration: true }).toXml(buildVraag());

		expect(xml).not.toContain("<?xml");
		expect(xml.startsWith("<soapenv:Envelope")).toBe(true);
	});
});

describe("SoapSerializer — reading", () => {
	let soap: SoapSerializer;

	beforeEach(() => {
		soap = new SoapSerializer();
	});

	it("round-trips its own output", () => {
		const xml = soap.toXml(buildVraag("ronald"));

		const parsed = soap.fromXml(xml, GbavVraag);

		expect(parsed.identificatie.indicatie).toBe("AFN");
		expect(parsed.identificatie.gebruiker).toBe("ronald");
	});

	// The envelope is matched on its namespace URI, so the peer's prefix is irrelevant.
	const envelopePrefixes: Record<string, string> = {
		soapenv: `<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}"><soapenv:Body><tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord></soapenv:Body></soapenv:Envelope>`,
		soap: `<soap:Envelope xmlns:soap="${SOAP_1_1}"><soap:Body><tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord></soap:Body></soap:Envelope>`,
		S: `<S:Envelope xmlns:S="${SOAP_1_1}"><S:Body><tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord></S:Body></S:Envelope>`,
		env: `<env:Envelope xmlns:env="${SOAP_1_1}"><env:Body><tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord></env:Body></env:Envelope>`,
		"default xmlns": `<Envelope xmlns="${SOAP_1_1}"><Body><gbavAntwoord xmlns="${GBAV_NS}">${ANTWOORD_BODY}</gbavAntwoord></Body></Envelope>`,
	};

	it.each(Object.keys(envelopePrefixes))("reads a response using the %s envelope prefix", (prefix) => {
		const parsed = soap.fromXml(envelopePrefixes[prefix], GbavAntwoord);

		expect(parsed.identificatie.indicatie).toBe("AFN");
		expect(parsed.identificatie.gebruiker).toBe("xmlbevr");
	});

	it("resolves a payload prefix that is declared on the Envelope, not the payload", () => {
		// How JAX-WS actually answers: every namespace hoisted to the Envelope. The
		// payload's tns: prefix is only resolvable via the inherited scope.
		const xml =
			`<S:Envelope xmlns:S="${SOAP_1_1}" xmlns:ns2="${GBAV_NS}">` +
			`<S:Body><ns2:gbavAntwoord>${ANTWOORD_BODY}</ns2:gbavAntwoord></S:Body></S:Envelope>`;

		const parsed = soap.fromXml(xml, GbavAntwoord);

		expect(parsed.identificatie.indicatie).toBe("AFN");
	});

	it("reads a SOAP 1.2 response on a 1.1-configured serializer", () => {
		const xml =
			`<env:Envelope xmlns:env="${SOAP_1_2}"><env:Body>` +
			`<tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord>` +
			`</env:Body></env:Envelope>`;

		const parsed = soap.fromXml(xml, GbavAntwoord);

		expect(parsed.identificatie.indicatie).toBe("AFN");
	});

	it("rejects a document that is not a SOAP envelope", () => {
		const xml = `<tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${ANTWOORD_BODY}</tns:gbavAntwoord>`;

		expect(() => soap.fromXml(xml, GbavAntwoord)).toThrow(/No SOAP Envelope found/);
	});

	it("reports a missing Body rather than failing obscurely", () => {
		const xml = `<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}"></soapenv:Envelope>`;

		expect(() => soap.fromXml(xml, GbavAntwoord)).toThrow(/Body element not found/);
	});

	it("still reports a payload that is absent from the Body", () => {
		const xml =
			`<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}"><soapenv:Body>` +
			`<tns:ietsAnders xmlns:tns="${GBAV_NS}"/></soapenv:Body></soapenv:Envelope>`;

		expect(() => soap.fromXml(xml, GbavAntwoord)).toThrow(/not found in XML/);
	});
});

describe("SoapSerializer — faults", () => {
	const faultXml = (detail = "") =>
		`<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}"><soapenv:Body><soapenv:Fault>` +
		`<faultcode>soapenv:Server</faultcode><faultstring>Onbekende afnemer</faultstring>` +
		`${detail}</soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

	it("throws SoapFaultError instead of reporting a missing payload", () => {
		const soap = new SoapSerializer();

		expect(() => soap.fromXml(faultXml(), GbavAntwoord)).toThrow(SoapFaultError);
	});

	it("exposes the fault code and reason", () => {
		const soap = new SoapSerializer();

		const fault = captureFault(() => soap.fromXml(faultXml(), GbavAntwoord));

		expect(fault.version).toBe("1.1");
		expect(fault.faultCode).toBe("soapenv:Server");
		expect(fault.faultString).toBe("Onbekende afnemer");
	});

	it("deserializes the detail into a registered class", () => {
		const soap = new SoapSerializer({ faultDetailTypes: { gbavFout: GbavFout } });
		const detail =
			`<detail><gbavFout xmlns="${GBAV_NS}">` +
			`<foutCode>042</foutCode><foutOmschrijving>Afnemer onbekend</foutOmschrijving>` +
			`</gbavFout></detail>`;

		const fault = captureFault(() => soap.fromXml(faultXml(detail), GbavAntwoord));

		expect(fault.detailName).toBe("gbavFout");
		expect(fault.detail).toBeInstanceOf(GbavFout);
		expect((fault.detail as GbavFout).foutCode).toBe("042");
		expect((fault.detail as GbavFout).foutOmschrijving).toBe("Afnemer onbekend");
	});

	it("leaves the detail raw when no class is registered for it", () => {
		const soap = new SoapSerializer();
		const detail = `<detail><gbavFout xmlns="${GBAV_NS}"><foutCode>042</foutCode></gbavFout></detail>`;

		const fault = captureFault(() => soap.fromXml(faultXml(detail), GbavAntwoord));

		expect(fault.detail).not.toBeInstanceOf(GbavFout);
		expect(fault.detailName).toBe("gbavFout");
	});

	it("throws for a SOAP 1.2 fault with its qualified Code/Reason shape", () => {
		const soap = new SoapSerializer();
		const xml =
			`<env:Envelope xmlns:env="${SOAP_1_2}"><env:Body><env:Fault>` +
			`<env:Code><env:Value>env:Receiver</env:Value></env:Code>` +
			`<env:Reason><env:Text xml:lang="nl">Interne fout</env:Text></env:Reason>` +
			`</env:Fault></env:Body></env:Envelope>`;

		const fault = captureFault(() => soap.fromXml(xml, GbavAntwoord));

		expect(fault.version).toBe("1.2");
		expect(fault.faultCode).toBe("env:Receiver");
		expect(fault.faultString).toBe("Interne fout");
	});
});

describe("SoapSerializer — headers", () => {
	let soap: SoapSerializer;

	beforeEach(() => {
		soap = new SoapSerializer();
	});

	it("writes typed headers into the SOAP Header", () => {
		const security = new Security();
		security.username = "xmlbevr";

		const xml = soap.toXml(buildVraag(), { headers: [security] });

		expect(xml).toContain("<soapenv:Header>");
		expect(xml).toContain(`<wsse:Security xmlns:wsse="${WSSE_NS}">`);
		expect(xml).toContain("<Username>xmlbevr</Username>");
		// Header precedes Body, as SOAP requires.
		expect(xml.indexOf("<soapenv:Header>")).toBeLessThan(xml.indexOf("<soapenv:Body>"));
	});

	it("does not leak headers into a subsequent call", () => {
		const security = new Security();
		security.username = "xmlbevr";
		soap.toXml(buildVraag(), { headers: [security] });

		const second = soap.toXml(buildVraag());

		expect(second).not.toContain("Header");
	});

	it("reads headers back with fromEnvelope", () => {
		const security = new Security();
		security.username = "xmlbevr";
		const xml = soap.toXml(buildVraag("ronald"), { headers: [security] });

		const result = soap.fromEnvelope(xml, { body: GbavVraag, headers: [Security] });

		expect(result.body.identificatie.gebruiker).toBe("ronald");
		expect((result.headers[0] as Security).username).toBe("xmlbevr");
	});

	it("returns undefined for a header the response does not carry", () => {
		const xml = soap.toXml(buildVraag());

		const result = soap.fromEnvelope(xml, { body: GbavVraag, headers: [Security] });

		expect(result.headers[0]).toBeUndefined();
	});

	it("returns no headers when none were requested", () => {
		const xml = soap.toXml(buildVraag());

		const result = soap.fromEnvelope(xml, { body: GbavVraag });

		expect(result.headers).toEqual([]);
		expect(result.body.identificatie.indicatie).toBe("AFN");
	});

	it("throws on a fault from fromEnvelope too", () => {
		const xml =
			`<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}"><soapenv:Body><soapenv:Fault>` +
			`<faultstring>Boom</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`;

		expect(() => soap.fromEnvelope(xml, { body: GbavAntwoord })).toThrow(SoapFaultError);
	});
});

describe("XmlDecoratorSerializer is unaffected by the SOAP seams", () => {
	it("produces the bare payload with no envelope", () => {
		const xml = new XmlDecoratorSerializer().toXml(buildVraag());

		expect(xml).toContain(`<tns:gbavVraag xmlns:tns="${GBAV_NS}">`);
		expect(xml).not.toContain("Envelope");
		expect(xml).not.toContain("Body");
	});

	it("still round-trips a plain document", () => {
		const plain = new XmlDecoratorSerializer();

		const parsed = plain.fromXml(plain.toXml(buildVraag("ronald")), GbavVraag);

		expect(parsed.identificatie.gebruiker).toBe("ronald");
	});
});
