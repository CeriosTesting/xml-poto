/**
 * A WSDL split over several files with `wsdl:import`.
 *
 * The service half names the binding, the imported half holds `<types>`,
 * `<message>` and `<portType>` — so nothing usable comes out unless both halves
 * are read as one document.
 */

import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { GeneratedFile } from "../../src/generator/class-generator";
import { ClassGenerator } from "../../src/generator/class-generator";
import { generateOperationsFile } from "../../src/generator/operations-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedSchema } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";
import type { WsdlDefinitions } from "../../src/xsd/xsd-types";

const FIXTURES = path.resolve(__dirname, "../fixtures");

interface Pipeline {
	resolved: ResolvedSchema;
	files: GeneratedFile[];
	wsdl: WsdlDefinitions | undefined;
	operations: GeneratedFile | undefined;
	notes: string[];
}

function pipeline(fixtureName: string): Pipeline {
	const parser = new XsdParser();
	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const wsdl = parser.getWsdlDefinitions();
	const resolved = new XsdResolver().resolve(schema);
	const files = new ClassGenerator({ xsdPath: fixtureName }).generatePerType(resolved);

	const notes: string[] = [];
	const operations = wsdl
		? generateOperationsFile(wsdl, resolved, { xsdPath: fixtureName, singleFile: false }, notes)
		: undefined;

	return { resolved, files, wsdl, operations, notes };
}

describe("wsdl:import", () => {
	it("generates the types declared in the imported half", () => {
		const { resolved } = pipeline("split-service.wsdl");

		const classNames = resolved.types.map((t) => t.className);
		expect(classNames).toContain("LookupCustomerRequest");
		expect(classNames).toContain("LookupCustomerResponse");
	});

	it("reads the messages and portType of the imported half", () => {
		const { wsdl } = pipeline("split-service.wsdl");

		expect(wsdl!.portTypes.map((p) => p.name)).toEqual(["SplitPort"]);
		expect(wsdl!.messages.map((m) => m.name)).toEqual(["lookupCustomerRequest", "lookupCustomerResponse"]);
		// The <definitions> that names the service is the one whose namespace counts.
		expect(wsdl!.targetNamespace).toBe("http://example.com/split/v1");
	});

	it("pairs an imported portType's operation with the importing file's binding", () => {
		const { wsdl } = pipeline("split-service.wsdl");

		const operation = wsdl!.portTypes[0].operations[0];
		expect(operation.name).toBe("lookupCustomer");
		// soapAction lives in split-service.wsdl, the operation in split-interface.wsdl.
		expect(operation.soapAction).toBe("urn:lookupCustomer");
		expect(operation.style).toBe("document");
		expect(operation.use).toBe("literal");
		expect(operation.inputMessage).toBe("lookupCustomerRequest");
		expect(operation.outputMessage).toBe("lookupCustomerResponse");
		expect(operation.documentation).toBe("Looks a customer up by id.");
	});

	it("generates an operations.ts wiring the operation to its generated classes", () => {
		const { operations, notes } = pipeline("split-service.wsdl");

		expect(notes).toEqual([]);
		expect(operations).toBeDefined();
		expect(operations!.exports).toEqual(["SplitPortOperations"]);
		expect(operations!.content).toContain("urn:lookupCustomer");
		expect(operations!.content).toContain("LookupCustomerRequest");
		expect(operations!.content).toContain("LookupCustomerResponse");
	});

	it("follows a wsdl:import that names a bare XSD, keeping its own namespace", () => {
		const { resolved } = pipeline("split-service.wsdl");

		// split-types.xsd is reached only through split-interface.wsdl's wsdl:import.
		const auditInfo = resolved.types.find((t) => t.className === "AuditInfo")!;
		expect(auditInfo).toBeDefined();
		expect(auditInfo.namespace?.uri).toBe("http://example.com/split/ext");
		expect(auditInfo.properties.map((p) => p.propertyName)).toEqual(["requestedBy", "requestedAt"]);

		// …and the element that references it is typed by it, not left a string.
		const request = resolved.types.find((t) => t.className === "LookupCustomerRequest")!;
		expect(request.properties.find((p) => p.xmlName === "audit")?.complexTypeName).toBe("AuditInfo");
	});

	it("terminates on a mutual import, merging each file once", () => {
		const { resolved, wsdl } = pipeline("wsdl-import-cycle-a.wsdl");

		expect(resolved.types.map((t) => t.className)).toEqual(["PingRequest"]);
		expect(wsdl!.portTypes).toHaveLength(1);
		expect(wsdl!.portTypes[0].operations[0].soapAction).toBe("urn:ping");
	});

	it("warns and keeps the local half when an import location is missing", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const parser = new XsdParser();
			const schema = parser.parseString(
				`<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="http://example.com/partial">
	<import namespace="http://example.com/other" location="does-not-exist.wsdl"/>
	<types>
		<xsd:schema targetNamespace="http://example.com/partial">
			<xsd:element name="local" type="xsd:string"/>
		</xsd:schema>
	</types>
</definitions>`,
				FIXTURES,
			);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("wsdl:import"));
			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
			expect(schema.elements.map((e) => e.name)).toEqual(["local"]);
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("warns instead of fetching a remote import location", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			const parser = new XsdParser();
			parser.parseString(
				`<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="http://example.com/partial">
	<import namespace="http://example.com/other" location="https://example.com/other.wsdl"/>
	<types>
		<xsd:schema targetNamespace="http://example.com/partial">
			<xsd:element name="local" type="xsd:string"/>
		</xsd:schema>
	</types>
</definitions>`,
				FIXTURES,
			);

			expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("remote URL"));
		} finally {
			warnSpy.mockRestore();
		}
	});

	it("still reports a WSDL that reaches no schema at all", () => {
		const parser = new XsdParser();

		expect(() =>
			parser.parseString(
				`<?xml version="1.0"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/" targetNamespace="http://example.com/empty">
	<portType name="EmptyPort"/>
</definitions>`,
				FIXTURES,
			),
		).toThrow(/contains no XSD schemas/);
	});
});
