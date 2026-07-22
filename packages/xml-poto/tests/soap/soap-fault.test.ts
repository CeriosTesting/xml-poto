/* eslint-disable typescript/no-explicit-any -- Fault parsing operates on the untyped intermediate tree */
import { describe, expect, it } from "vitest";

import { dialectForVersion } from "../../src/soap/soap-constants";
import { parseSoapFault, SoapFaultError } from "../../src/soap/soap-fault";
import { EMPTY_NAMESPACE_SCOPE, extendNamespaceScope, findElementKey } from "../../src/utils/xml-element-lookup";
import { XmlDecoratorParser } from "../../src/xml-decorator-parser";

const parser = new XmlDecoratorParser();

/** Parse a fault document down to its `<Fault>` element and the scope it sits in. */
function locateFault(xml: string, version: "1.1" | "1.2"): { fault: any; scope: any } {
	const dialect = dialectForVersion(version);
	const parsed = parser.parse(xml);
	const envelopeKey = findElementKey(parsed, "Envelope", dialect.namespace, EMPTY_NAMESPACE_SCOPE)!;
	const envelope = parsed[envelopeKey];
	const envelopeScope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, envelope);
	const bodyKey = findElementKey(envelope, "Body", dialect.namespace, envelopeScope)!;
	const body = envelope[bodyKey];
	const bodyScope = extendNamespaceScope(envelopeScope, body);
	const faultKey = findElementKey(body, "Fault", dialect.namespace, bodyScope)!;
	return { fault: body[faultKey], scope: bodyScope };
}

describe("parseSoapFault — SOAP 1.1", () => {
	// SOAP 1.1 fault children are in NO namespace, even though Fault itself is in
	// the envelope namespace. Getting this wrong is the classic 1.1 parsing bug.
	const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
		<soapenv:Body><soapenv:Fault>
			<faultcode>soapenv:Server</faultcode>
			<faultstring>Onbekende afnemer</faultstring>
			<faultactor>http://example.com/gbav</faultactor>
			<detail><gbavFout><foutCode>042</foutCode></gbavFout></detail>
		</soapenv:Fault></soapenv:Body>
	</soapenv:Envelope>`;

	it("reads the unqualified faultcode, faultstring and faultactor", () => {
		const { fault, scope } = locateFault(xml, "1.1");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope);

		expect(parsedFault.version).toBe("1.1");
		expect(parsedFault.faultCode).toBe("soapenv:Server");
		expect(parsedFault.faultString).toBe("Onbekende afnemer");
		expect(parsedFault.faultActor).toBe("http://example.com/gbav");
	});

	it("names the detail's first child element and keeps the raw value", () => {
		const { fault, scope } = locateFault(xml, "1.1");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope);

		expect(parsedFault.detailName).toBe("gbavFout");
		expect(parsedFault.detail).toEqual({ foutCode: "042" });
		expect(parsedFault.rawDetail).toBeDefined();
	});

	it("passes the detail through a decoder when one is supplied", () => {
		const { fault, scope } = locateFault(xml, "1.1");
		const seen: string[] = [];

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope, (name) => {
			seen.push(name);
			return { decoded: true };
		});

		expect(seen).toEqual(["gbavFout"]);
		expect(parsedFault.detail).toEqual({ decoded: true });
		// The raw value survives decoding, so nothing is lost.
		expect(parsedFault.rawDetail).toEqual({ gbavFout: { foutCode: "042" } });
	});

	it("falls back to the raw detail when the decoder declines", () => {
		const { fault, scope } = locateFault(xml, "1.1");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope, () => undefined);

		expect(parsedFault.detail).toEqual({ foutCode: "042" });
	});
});

describe("parseSoapFault — SOAP 1.2", () => {
	// 1.2 renames the children AND moves them into the envelope namespace, nesting
	// the code in Code/Value and the reason in Reason/Text.
	const xml = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
		<env:Body><env:Fault>
			<env:Code><env:Value>env:Receiver</env:Value></env:Code>
			<env:Reason><env:Text xml:lang="nl">Interne fout</env:Text></env:Reason>
			<env:Role>http://example.com/gbav</env:Role>
			<env:Detail><gbavFout><foutCode>042</foutCode></gbavFout></env:Detail>
		</env:Fault></env:Body>
	</env:Envelope>`;

	it("unwraps Code/Value and Reason/Text", () => {
		const { fault, scope } = locateFault(xml, "1.2");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.2"), scope);

		expect(parsedFault.version).toBe("1.2");
		expect(parsedFault.faultCode).toBe("env:Receiver");
		expect(parsedFault.faultString).toBe("Interne fout");
	});

	it("reads Role as the fault actor", () => {
		const { fault, scope } = locateFault(xml, "1.2");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.2"), scope);

		expect(parsedFault.faultActor).toBe("http://example.com/gbav");
	});

	it("reads the qualified Detail element", () => {
		const { fault, scope } = locateFault(xml, "1.2");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.2"), scope);

		expect(parsedFault.detailName).toBe("gbavFout");
	});

	it("takes the first Text when several languages are present", () => {
		const multi = `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope">
			<env:Body><env:Fault>
				<env:Reason>
					<env:Text xml:lang="nl">Interne fout</env:Text>
					<env:Text xml:lang="en">Internal error</env:Text>
				</env:Reason>
			</env:Fault></env:Body>
		</env:Envelope>`;
		const { fault, scope } = locateFault(multi, "1.2");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.2"), scope);

		expect(parsedFault.faultString).toBe("Interne fout");
	});
});

describe("parseSoapFault — partial and malformed faults", () => {
	it("returns just the version for an empty Fault", () => {
		const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
			<soapenv:Body><soapenv:Fault></soapenv:Fault></soapenv:Body>
		</soapenv:Envelope>`;
		const { fault, scope } = locateFault(xml, "1.1");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope);

		expect(parsedFault).toEqual({ version: "1.1" });
	});

	it("reads the fields that are present when others are missing", () => {
		const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
			<soapenv:Body><soapenv:Fault><faultstring>Boom</faultstring></soapenv:Fault></soapenv:Body>
		</soapenv:Envelope>`;
		const { fault, scope } = locateFault(xml, "1.1");

		const parsedFault = parseSoapFault(fault, dialectForVersion("1.1"), scope);

		expect(parsedFault.faultString).toBe("Boom");
		expect(parsedFault.faultCode).toBeUndefined();
		expect(parsedFault.detail).toBeUndefined();
	});

	it("tolerates a non-object Fault", () => {
		expect(parseSoapFault("", dialectForVersion("1.1"), EMPTY_NAMESPACE_SCOPE)).toEqual({ version: "1.1" });
	});
});

describe("SoapFaultError", () => {
	it("summarises code and reason in its message", () => {
		const error = new SoapFaultError({ version: "1.1", faultCode: "soapenv:Server", faultString: "Boom" });

		expect(error.message).toBe("SOAP fault: soapenv:Server — Boom");
		expect(error.name).toBe("SoapFaultError");
	});

	it("falls back to a generic message when the fault carries nothing", () => {
		expect(new SoapFaultError({ version: "1.2" }).message).toBe("SOAP fault received");
	});

	it("is a real Error and survives instanceof", () => {
		const error = new SoapFaultError({ version: "1.1" });

		expect(error).toBeInstanceOf(SoapFaultError);
		expect(error).toBeInstanceOf(Error);
	});

	it("round-trips back to a plain fault object", () => {
		const fault = {
			version: "1.1" as const,
			faultCode: "soapenv:Client",
			faultString: "Bad request",
			faultActor: "actor",
			detail: { a: 1 },
			rawDetail: { wrapper: { a: 1 } },
			detailName: "wrapper",
		};

		expect(new SoapFaultError(fault).toFault()).toEqual(fault);
	});
});
