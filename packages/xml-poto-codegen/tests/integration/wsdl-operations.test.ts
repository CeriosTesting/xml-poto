/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * WSDL operation generation, verified end to end against the real GBAV WSDL:
 * the generated `operations.ts` must drive `SoapSerializer` without the caller
 * hand-writing a soapAction or naming the response class.
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { SoapFaultError, SoapSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { generateOperationsFile } from "../../src/generator/operations-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";
import type { WsdlDefinitions } from "../../src/xsd/xsd-types";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-wsdl-operations");
const WSDL = "gbav_v1_0.1.wsdl";

describe("WSDL operations", () => {
	let wsdl: WsdlDefinitions | undefined;

	beforeEach(() => {
		rmSync(TMP_DIR, { recursive: true, force: true });
		mkdirSync(TMP_DIR, { recursive: true });

		const parser = new XsdParser();
		const schema = parser.parseFile(path.join(FIXTURES, WSDL));
		wsdl = parser.getWsdlDefinitions();
		const resolved = new XsdResolver().resolve(schema);

		const files = new ClassGenerator({ xsdPath: WSDL }).generatePerType(resolved);
		const operations = generateOperationsFile(wsdl!, resolved, { xsdPath: WSDL, singleFile: false }, []);
		if (operations) files.push(operations);
		writeGeneratedFiles(TMP_DIR, files);
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
	});

	describe("parsing", () => {
		it("reads messages, portType operations and the binding's soapAction", () => {
			const operation = wsdl!.portTypes[0].operations[0];

			expect(wsdl!.portTypes[0].name).toBe("CompetentPort");
			expect(operation.name).toBe("stelGbavVraag");
			expect(operation.soapAction).toBe("stelGbavVraag");
			expect(operation.style).toBe("document");
			expect(operation.use).toBe("literal");
			expect(operation.inputMessage).toBe("gbavVraag");
			expect(operation.outputMessage).toBe("gbavAntwoord");
			expect(operation.faults).toEqual({ gbavException: "gbavException" });
		});

		it("leaves a plain XSD without any operations", () => {
			const parser = new XsdParser();
			parser.parseFile(path.join(FIXTURES, "simple.xsd"));

			expect(parser.getWsdlDefinitions()).toBeUndefined();
		});
	});

	describe("generation", () => {
		it("maps each message's element to the class it generated", () => {
			const content = readFileSync(path.join(TMP_DIR, "operations.ts"), "utf-8");

			expect(content).toContain("export const CompetentPortOperations");
			expect(content).toContain('soapAction: "stelGbavVraag"');
			expect(content).toContain("input: GbavVraag,");
			expect(content).toContain("output: GbavAntwoord,");
			expect(content).toContain("gbavException: GbavFout,");
		});

		it("keeps operations.ts out of the barrel, which it imports from", () => {
			const index = readFileSync(path.join(TMP_DIR, "index.ts"), "utf-8");

			expect(index).not.toContain("operations");
		});
	});

	describe("driving SoapSerializer", () => {
		async function loadOperations(): Promise<any> {
			const mod = await import(/* @vite-ignore */ path.join(TMP_DIR, "operations.ts"));
			return mod.CompetentPortOperations.stelGbavVraag;
		}

		it("supplies the request class the envelope is built from", async () => {
			const operation = await loadOperations();
			const request = new operation.input();

			const xml = new SoapSerializer().toXml(request);

			expect(xml).toContain("<soapenv:Envelope");
			expect(xml).toContain("gbavVraag");
		});

		it("supplies the response class a reply deserializes into", async () => {
			const operation = await loadOperations();
			const soap = new SoapSerializer();

			// Round-tripping the class's own output proves `output` names the class the
			// response body maps to, without hand-writing this schema's deep required tree.
			const envelope = soap.toXml(new operation.output());
			const result = soap.fromXml(envelope, operation.output);

			expect(envelope).toContain("gbavAntwoord");
			expect(result).toBeInstanceOf(operation.output);
		});

		it("names a different class for the request than for the response", async () => {
			const operation = await loadOperations();

			expect(operation.input).not.toBe(operation.output);
			expect(operation.input.name).toBe("GbavVraag");
			expect(operation.output.name).toBe("GbavAntwoord");
		});

		it("supplies faults in the shape faultDetailTypes expects", async () => {
			const operation = await loadOperations();
			// `faults` is keyed by fault name; faultDetailTypes is keyed by the detail
			// element's local name, which for this service is the same shape.
			const soap = new SoapSerializer({ faultDetailTypes: { gbavFout: operation.faults.gbavException } });

			const fault = `<?xml version="1.0"?>
				<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
					<soapenv:Body>
						<soapenv:Fault>
							<faultcode>soapenv:Server</faultcode>
							<faultstring>boom</faultstring>
							<detail><gbavFout/></detail>
						</soapenv:Fault>
					</soapenv:Body>
				</soapenv:Envelope>`;

			expect(() => soap.fromXml(fault, operation.output)).toThrow(SoapFaultError);
		});
	});
});
