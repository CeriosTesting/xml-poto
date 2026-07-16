import path from "node:path";

import { describe, expect, it } from "vitest";

import type { GeneratedFile } from "../../src/generator/class-generator";
import { ClassGenerator } from "../../src/generator/class-generator";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedSchema } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");

function pipeline(fixtureName: string): { resolved: ResolvedSchema; files: GeneratedFile[] } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: fixtureName });
	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const resolved = resolver.resolve(schema);
	const files = generator.generatePerType(resolved);
	return { resolved, files };
}

describe("WSDL generation pipeline (service.wsdl)", () => {
	it("resolves types from all embedded schemas", () => {
		const { resolved } = pipeline("service.wsdl");

		const classNames = resolved.types.map((t) => t.className);
		expect(classNames).toContain("Identification");
		expect(classNames).toContain("Record");
		expect(classNames).toContain("ServiceRequest");
		// From the second embedded schema
		expect(classNames).toContain("ServiceFault");
	});

	it("resolves non-empty properties (guards against silent-empty output)", () => {
		const { resolved } = pipeline("service.wsdl");

		const emptyTypes = resolved.types.filter((t) => t.properties.length === 0).map((t) => t.className);
		expect(emptyTypes).toEqual([]);

		const identification = resolved.types.find((t) => t.className === "Identification")!;
		const propNames = identification.properties.map((p) => p.propertyName);
		expect(propNames).toContain("indicator");
		expect(propNames).toContain("user");
	});

	it("generates decorated classes with the WSDL target namespace", () => {
		const { files } = pipeline("service.wsdl");

		const requestFile = files.find((f) => f.fileName === "service-request.ts");
		expect(requestFile).toBeDefined();
		expect(requestFile!.content).toContain("@XmlRoot(");
		expect(requestFile!.content).toContain("http://example.com/service/v1");
	});

	it("resolves cross-schema tns type references to generated classes", () => {
		const { resolved } = pipeline("service.wsdl");

		const request = resolved.types.find((t) => t.className === "ServiceRequest")!;
		const identificationProp = request.properties.find((p) => p.propertyName === "identification")!;
		expect(identificationProp.tsType).toBe("Identification");
	});
});
