import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFile, writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import type { ResolvedSchema } from "../../src/xsd/xsd-resolver";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-pipeline-disk");

function runPipeline(
	fixtureName: string,
	options?: { enumStyle?: "union" | "enum" | "const-object" },
): { generator: ClassGenerator; resolved: ResolvedSchema } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({
		xsdPath: fixtureName,
		enumStyle: options?.enumStyle,
	});

	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const resolved = resolver.resolve(schema);
	return { generator, resolved };
}

describe("Full pipeline: XSD → parse → resolve → generate → write files", () => {
	let outputDir: string;

	beforeEach(() => {
		outputDir = path.join(TMP_DIR, `test-${Date.now()}`);
		mkdirSync(outputDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) {
			rmSync(TMP_DIR, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	describe("generatePerType() — one class file per XSD type", () => {
		it("simple.xsd: writes class file and barrel index with correct decorators", () => {
			const { generator, resolved } = runPipeline("simple.xsd");
			const files = generator.generatePerType(resolved);
			const { written } = writeGeneratedFiles(outputDir, files);

			// person.ts + index.ts
			expect(written).toHaveLength(2);

			const fileNames = readdirSync(outputDir).sort();
			expect(fileNames).toContain("person.ts");
			expect(fileNames).toContain("index.ts");

			const personContent = readFileSync(path.join(outputDir, "person.ts"), "utf-8");
			expect(personContent).toContain("@XmlRoot(");
			expect(personContent).toContain("@XmlElement(");
			expect(personContent).toContain("@XmlAttribute(");
			expect(personContent).toContain("class Person");
			// Required attribute: has initializer, is not optional
			expect(personContent).toContain("id: string = '';");
			expect(personContent).not.toContain("id?:");
			// Optional element
			expect(personContent).toContain("email?: string");

			const indexContent = readFileSync(path.join(outputDir, "index.ts"), "utf-8");
			expect(indexContent).toContain('export { Person } from "./person";');
		});

		it("enums.xsd: writes enum files and class file (union style)", () => {
			const { generator, resolved } = runPipeline("enums.xsd", { enumStyle: "union" });
			const files = generator.generatePerType(resolved);
			const { written } = writeGeneratedFiles(outputDir, files);

			// StatusType + PriorityType enum files + 1 class file + barrel = 4
			// (EmailType is a pattern restriction, not an enumeration → no separate file)
			expect(written).toHaveLength(4);
			expect(readdirSync(outputDir)).toContain("status-type.ts");
			expect(readdirSync(outputDir)).toContain("priority-type.ts");

			const statusContent = readFileSync(path.join(outputDir, "status-type.ts"), "utf-8");
			expect(statusContent).toContain("export type StatusType =");
			expect(statusContent).toContain('"active"');
			expect(statusContent).toContain('"inactive"');
			expect(statusContent).toContain('"pending"');
		});

		it("enums.xsd: 'enum' style generates TypeScript enum with PascalCase keys", () => {
			const { generator, resolved } = runPipeline("enums.xsd", { enumStyle: "enum" });
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const statusContent = readFileSync(path.join(outputDir, "status-type.ts"), "utf-8");
			expect(statusContent).toContain("export enum StatusType {");
			expect(statusContent).toContain('Active = "active"');
			expect(statusContent).toContain('Inactive = "inactive"');
			expect(statusContent).toContain('Pending = "pending"');
		});

		it("enums.xsd: 'const-object' style generates const object and companion type", () => {
			const { generator, resolved } = runPipeline("enums.xsd", { enumStyle: "const-object" });
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const statusContent = readFileSync(path.join(outputDir, "status-type.ts"), "utf-8");
			expect(statusContent).toContain("export const StatusType = {");
			expect(statusContent).toContain("} as const;");
			expect(statusContent).toContain("export type StatusType =");
			expect(statusContent).toContain("(typeof StatusType)[keyof typeof StatusType]");
		});

		it("inheritance.xsd: writes extends clause and local base-type imports", () => {
			const { generator, resolved } = runPipeline("inheritance.xsd");
			const files = generator.generatePerType(resolved);
			const { written } = writeGeneratedFiles(outputDir, files);

			// BaseEntityType, UserType, AdminType, UserList + index, + inline type for UserList.User
			expect(written.length).toBeGreaterThanOrEqual(4);

			const userContent = readFileSync(path.join(outputDir, "user-type.ts"), "utf-8");
			expect(userContent).toContain("extends BaseEntityType");
			expect(userContent).toContain('from "./base-entity-type"');

			const adminContent = readFileSync(path.join(outputDir, "admin-type.ts"), "utf-8");
			expect(adminContent).toContain("extends UserType");
			expect(adminContent).toContain('from "./user-type"');
		});

		it("substitution-group.xsd: generates @XmlDynamic for substitution group head ref", () => {
			const { generator, resolved } = runPipeline("substitution-group.xsd");
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const ownerContent = readFileSync(path.join(outputDir, "pet-owner.ts"), "utf-8");
			expect(ownerContent).toContain("@XmlDynamic(");
		});

		it("mixed.xsd: Price type uses @XmlText for simpleContent and @XmlAttribute for attribute", () => {
			const { generator, resolved } = runPipeline("mixed.xsd");
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const priceContent = readFileSync(path.join(outputDir, "price.ts"), "utf-8");
			expect(priceContent).toContain("@XmlText(");
			expect(priceContent).toContain("@XmlAttribute(");
			expect(priceContent).not.toContain("@XmlElement(");
		});

		it("arrays.xsd: generates @XmlArray decorator for unbounded elements", () => {
			const { generator, resolved } = runPipeline("arrays.xsd");
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const libraryContent = readFileSync(path.join(outputDir, "library.ts"), "utf-8");
			expect(libraryContent).toContain("@XmlArray(");
		});

		it("import-main.xsd: generates types from imported schema (CustomerType)", () => {
			const { generator, resolved } = runPipeline("import-main.xsd");
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const fileNames = readdirSync(outputDir);
			const hasCustomerType = fileNames.some((f) => f.includes("customer-type"));
			expect(hasCustomerType).toBe(true);

			const indexContent = readFileSync(path.join(outputDir, "index.ts"), "utf-8");
			expect(indexContent).toContain("CustomerType");
		});

		it("all generated class files are named in kebab-case", () => {
			// inheritance.xsd has types like BaseEntityType, UserType, AdminType
			const { generator, resolved } = runPipeline("inheritance.xsd");
			const files = generator.generatePerType(resolved);
			writeGeneratedFiles(outputDir, files);

			const fileNames = readdirSync(outputDir).filter((f) => f !== "index.ts");
			for (const fileName of fileNames) {
				// Must match kebab-case with .ts extension
				expect(fileName).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*\.ts$/);
			}
		});
	});

	describe("generatePerXsd() — all types merged into a single output file", () => {
		it("simple.xsd: writes single file containing all types and decorators", () => {
			const outputFile = path.join(outputDir, "output.ts");
			const { generator, resolved } = runPipeline("simple.xsd");
			const files = generator.generatePerXsd(resolved, "output");
			writeGeneratedFile(outputFile, files[0]);

			expect(existsSync(outputFile)).toBe(true);

			const content = readFileSync(outputFile, "utf-8");
			expect(content).toContain("class Person");
			expect(content).toContain("@XmlRoot(");
			expect(content).toContain("@XmlElement(");
			expect(content).toContain("@XmlAttribute(");
			// Single import line for the whole package
			expect(content).toContain("@cerios/xml-poto");
		});

		it("enums.xsd: single file contains all three enum definitions (union style)", () => {
			const outputFile = path.join(outputDir, "output.ts");
			const { generator, resolved } = runPipeline("enums.xsd");
			const files = generator.generatePerXsd(resolved, "output");
			writeGeneratedFile(outputFile, files[0]);

			const content = readFileSync(outputFile, "utf-8");
			expect(content).toContain("StatusType");
			expect(content).toContain("PriorityType");
			// EmailType is a pattern restriction, not an enum — inline on the class property
			expect(content).toContain("Task");
		});

		it("import-main.xsd: single file contains types from both the main and imported schema", () => {
			const outputFile = path.join(outputDir, "combined.ts");
			const { generator, resolved } = runPipeline("import-main.xsd");
			const files = generator.generatePerXsd(resolved, "combined");
			writeGeneratedFile(outputFile, files[0]);

			const content = readFileSync(outputFile, "utf-8");
			expect(content).toContain("CustomerType");
			expect(content).toContain("Order");
		});
	});

	describe("resolved schema metadata and generator edge cases", () => {
		it("preserves fixedValue metadata on resolved element properties", () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Build a schema with a fixed value inline
			const parser = new XsdParser();
			const resolver = new XsdResolver();
			const generator = new ClassGenerator({ xsdPath: "inline.xsd" });

			const xsdWithFixed = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Item">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Type" type="xs:string" fixed="widget"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsdWithFixed);
			const resolved = resolver.resolve(schema);

			// reportCoverageWarnings is exercised indirectly via the generate command test,
			// but here we verify the resolved schema has fixedValue set
			const typeProp = resolved.types[0]?.properties.find((p) => p.xmlName === "Type");
			expect(typeProp?.fixedValue).toBe("widget");

			generator.generatePerType(resolved);
			// No direct console.warn from generator itself — fixed-value warnings come from the command
			warnSpy.mockRestore();
		});

		it("preserves minLength and maxLength facets on resolved element properties", () => {
			const parser = new XsdParser();
			const resolver = new XsdResolver();

			const xsdWithFacets = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Product">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Code">
          <xs:simpleType>
            <xs:restriction base="xs:string">
              <xs:minLength value="3"/>
              <xs:maxLength value="20"/>
            </xs:restriction>
          </xs:simpleType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

			const schema = parser.parseString(xsdWithFacets);
			const resolved = resolver.resolve(schema);

			const codeProp = resolved.types[0]?.properties.find((p) => p.xmlName === "Code");
			expect(codeProp?.minLength).toBe(3);
			expect(codeProp?.maxLength).toBe(20);
		});
	});

	describe("toEnumKey edge cases (via class generator)", () => {
		it("enum values with hyphens produce valid PascalCase keys in 'enum' style", () => {
			const generator = new ClassGenerator({ xsdPath: "inline.xsd", enumStyle: "enum" });
			const schema = {
				types: [],
				enums: [
					{
						name: "ShippingMethod",
						xmlName: "ShippingMethod",
						values: ["standard-mail", "express-delivery", "next-day"],
						baseType: "string",
					},
				],
				namespaces: new Map<string, string>(),
				rootElements: [],
			};

			const files = generator.generatePerType(schema);
			const enumFile = files.find((f) => f.fileName === "shipping-method.ts")!;
			expect(enumFile).toBeDefined();

			const content = enumFile.content;
			expect(content).toContain('StandardMail = "standard-mail"');
			expect(content).toContain('ExpressDelivery = "express-delivery"');
			expect(content).toContain('NextDay = "next-day"');
		});

		it("enum values with spaces produce valid PascalCase keys in 'enum' style", () => {
			const generator = new ClassGenerator({ xsdPath: "inline.xsd", enumStyle: "enum" });
			const schema = {
				types: [],
				enums: [
					{
						name: "AccessLevel",
						xmlName: "AccessLevel",
						values: ["read only", "read write", "full access"],
						baseType: "string",
					},
				],
				namespaces: new Map<string, string>(),
				rootElements: [],
			};

			const files = generator.generatePerType(schema);
			const enumFile = files.find((f) => f.fileName === "access-level.ts")!;
			const content = enumFile.content;

			expect(content).toContain('ReadOnly = "read only"');
			expect(content).toContain('ReadWrite = "read write"');
			expect(content).toContain('FullAccess = "full access"');
		});

		it("enum values starting with a digit get prefixed in the key", () => {
			const generator = new ClassGenerator({ xsdPath: "inline.xsd", enumStyle: "enum" });
			const schema = {
				types: [],
				enums: [
					{
						name: "Rating",
						xmlName: "Rating",
						values: ["1star", "2star", "5star"],
						baseType: "string",
					},
				],
				namespaces: new Map<string, string>(),
				rootElements: [],
			};

			const files = generator.generatePerType(schema);
			const enumFile = files.find((f) => f.fileName === "rating.ts")!;
			const content = enumFile.content;

			// Keys starting with digit get underscore-prefixed before PascalCase transformation
			expect(content).toContain('1star = "1star"');
		});

		it("enum values with special characters (dots, slashes, at) are sanitised", () => {
			const generator = new ClassGenerator({ xsdPath: "inline.xsd", enumStyle: "const-object" });
			const schema = {
				types: [],
				enums: [
					{
						name: "MimeType",
						xmlName: "MimeType",
						values: ["text/plain", "application/json", "image/png"],
						baseType: "string",
					},
				],
				namespaces: new Map<string, string>(),
				rootElements: [],
			};

			const files = generator.generatePerType(schema);
			const enumFile = files.find((f) => f.fileName === "mime-type.ts")!;
			const content = enumFile.content;

			// Slashes become underscores → text_plain → TextPlain
			expect(content).toContain('TextPlain: "text/plain"');
			expect(content).toContain('ApplicationJson: "application/json"');
			expect(content).toContain('ImagePng: "image/png"');
		});
	});
});
