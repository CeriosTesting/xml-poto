/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * End-to-end SOAP round-trip over classes generated from the real GBAV WSDL.
 *
 * Where soap-serializer.test.ts exercises SoapSerializer against hand-written
 * classes, this drives the whole chain the way production does: WSDL → codegen →
 * decorated classes → SOAP envelope, and back from a response shaped the way the
 * live JAX-WS endpoint actually answers.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { SoapFaultError, SoapSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-wsdl-soap");
const GBAV_NS = "http://www.competent.nl/gbav/v1";
const SOAP_1_1 = "http://schemas.xmlsoap.org/soap/envelope/";

/** The real WSDL, not a trimmed fixture — it is the artifact being consumed. */
const WSDL = "gbav_v1_0.1.wsdl";

function generate(outputDir: string): void {
	const schema = new XsdParser().parseFile(path.join(FIXTURES, WSDL));
	const resolved = new XsdResolver().resolve(schema);
	const files = new ClassGenerator({ xsdPath: WSDL }).generatePerType(resolved);
	writeGeneratedFiles(outputDir, files);
}

async function loadGbav(dir: string): Promise<Record<string, any>> {
	const names: Record<string, string> = {
		GbavVraag: "gbav-vraag",
		GbavAntwoord: "gbav-antwoord",
		GbavFout: "gbav-fout",
		Identificatie: "identificatie",
		Categorieen: "categorieen",
		Categorie: "categorie",
	};
	const loaded: Record<string, any> = {};
	for (const [exportName, fileBase] of Object.entries(names)) {
		const mod = await import(/* @vite-ignore */ path.join(dir, `${fileBase}.ts`));
		loaded[exportName] = mod[exportName];
	}
	return loaded;
}

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

function buildVraag(c: Record<string, any>): any {
	const vraag = new c.GbavVraag();
	const identificatie = new c.Identificatie();
	identificatie.indicatie = "AFN";
	identificatie.gebruiker = "xmlbevr";
	vraag.identificatie = identificatie;

	const categorieen = new c.Categorieen();
	const categorie = new c.Categorie();
	categorie.nummer = "01";
	categorieen.categorie = [categorie];
	vraag.categorieen = categorieen;

	return vraag;
}

describe("SOAP round-trip over classes generated from the GBAV WSDL", () => {
	let tempDir: string;
	let soap: SoapSerializer;
	let c: Record<string, any>;

	beforeEach(async () => {
		tempDir = path.join(TMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		generate(tempDir);
		c = await loadGbav(tempDir);
		soap = new SoapSerializer({ faultDetailTypes: { gbavFout: c.GbavFout } });
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) {
			rmSync(TMP_DIR, { recursive: true, force: true });
		}
	});

	it("produces the request a JAX-WS peer expects", () => {
		const xml: string = soap.toXml(buildVraag(c));

		// Envelope wraps the qualified global element; locals stay unqualified,
		// because the schema declares no elementFormDefault.
		expect(xml).toContain(`<soapenv:Envelope xmlns:soapenv="${SOAP_1_1}">`);
		expect(xml).toContain("<soapenv:Body>");
		expect(xml).toContain(`<tns:gbavVraag xmlns:tns="${GBAV_NS}">`);
		expect(xml).toContain("<identificatie>");
		expect(xml).toContain("<indicatie>AFN</indicatie>");
		expect(xml).not.toContain("<tns:identificatie>");

		// Each namespace declared exactly once, at the point that needs it.
		expect(xml.match(/xmlns:soapenv=/g)).toHaveLength(1);
		expect(xml.match(/xmlns:tns=/g)).toHaveLength(1);
	});

	it("round-trips its own request", () => {
		const xml: string = soap.toXml(buildVraag(c));

		const parsed = soap.fromXml(xml, c.GbavVraag);

		expect(parsed.identificatie.indicatie).toBe("AFN");
		expect(parsed.identificatie.gebruiker).toBe("xmlbevr");
		expect(parsed.categorieen.categorie).toHaveLength(1);
		expect(parsed.categorieen.categorie[0].nummer).toBe("01");
	});

	it("reads a realistic JAX-WS response with namespaces hoisted to the Envelope", () => {
		// How Metro/JAX-WS actually answers: S: for the envelope, ns2: for the
		// payload, both declared on the Envelope, and single-item arrays throughout.
		const response = `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${SOAP_1_1}" xmlns:ns2="${GBAV_NS}">
  <S:Body>
    <ns2:gbavAntwoord>
      <identificatie><indicatie>AFN</indicatie><gebruiker>xmlbevr</gebruiker></identificatie>
      <resultaten><persoon><categorieen><categorie>
        <nummer>01</nummer>
        <rubrieken><rubriek><nummer>0110</nummer><waarde>Jan</waarde></rubriek></rubrieken>
      </categorie></categorieen></persoon></resultaten>
      <indicatieVerzoekResultaat>OK</indicatieVerzoekResultaat>
    </ns2:gbavAntwoord>
  </S:Body>
</S:Envelope>`;

		const antwoord = soap.fromXml(response, c.GbavAntwoord);

		expect(antwoord.identificatie.gebruiker).toBe("xmlbevr");
		expect(antwoord.indicatieVerzoekResultaat).toBe("OK");
		expect(antwoord.resultaten.persoon).toHaveLength(1);

		const categorie = antwoord.resultaten.persoon[0].categorieen.categorie[0];
		expect(Array.isArray(antwoord.resultaten.persoon[0].categorieen.categorie)).toBe(true);
		expect(categorie.nummer).toBe("01");
		expect(categorie.rubrieken.rubriek).toHaveLength(1);
		expect(categorie.rubrieken.rubriek[0].waarde).toBe("Jan");
	});

	it("raises a gbavFout fault response as a typed error", () => {
		// The fault this WSDL declares, carried in a SOAP 1.1 fault detail.
		const faultResponse = `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="${SOAP_1_1}">
  <S:Body>
    <S:Fault>
      <faultcode>S:Server</faultcode>
      <faultstring>Onbekende afnemer</faultstring>
      <detail>
        <gbavFout xmlns="${GBAV_NS}">
          <foutLetter>X</foutLetter>
          <foutCode>042</foutCode>
          <foutOmschrijving>Afnemer onbekend</foutOmschrijving>
        </gbavFout>
      </detail>
    </S:Fault>
  </S:Body>
</S:Envelope>`;

		const fault = captureFault(() => soap.fromXml(faultResponse, c.GbavAntwoord));

		expect(fault.faultCode).toBe("S:Server");
		expect(fault.faultString).toBe("Onbekende afnemer");
		// The detail is deserialized into the generated GbavFout class.
		expect(fault.detail).toBeInstanceOf(c.GbavFout);
		expect((fault.detail as any).foutCode).toBe("042");
		expect((fault.detail as any).foutOmschrijving).toBe("Afnemer onbekend");
	});
});
