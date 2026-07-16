/**
 * Declaration-order regression tests.
 *
 * Generated classes reference each other at module-evaluation time (extends
 * clauses and decorator `type:` options), so importing the generated module is
 * itself the assertion: out-of-order or circular declarations throw a TDZ
 * ReferenceError at import before the fix. Each test then round-trips XML to
 * confirm the emitted decorators (including `() => Foo` thunks) behave.
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

import { XmlDecoratorSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-ordering-roundtrip");

function generateFixture(
	fixtureName: string,
	outputDir: string,
	style: "per-xsd" | "per-type",
): { fileNames: string[] } {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: fixtureName });

	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const resolved = resolver.resolve(schema);
	const files =
		style === "per-xsd" ? generator.generatePerXsd(resolved, "generated") : generator.generatePerType(resolved);
	writeGeneratedFiles(outputDir, files);
	return { fileNames: files.map((f) => f.fileName) };
}

describe("Generated code declaration order", () => {
	let tempDir: string;
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		// Unique directory per test to avoid Vitest module-cache collisions
		tempDir = path.join(TMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		serializer = new XmlDecoratorSerializer();
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) {
			rmSync(TMP_DIR, { recursive: true, force: true });
		}
	});

	describe("per-xsd output from an out-of-order XSD", () => {
		it("writes dependencies before their dependents", () => {
			generateFixture("out-of-order.xsd", tempDir, "per-xsd");
			const content = readFileSync(path.join(tempDir, "generated.ts"), "utf-8");

			const userAt = content.indexOf("class UserType");
			const adminAt = content.indexOf("class AdminType");
			const companyAt = content.indexOf("class CompanyType");
			expect(userAt).toBeGreaterThanOrEqual(0);
			expect(userAt).toBeLessThan(adminAt);
			expect(adminAt).toBeLessThan(companyAt);
		});

		it("imports without TDZ errors and round-trips XML", async () => {
			generateFixture("out-of-order.xsd", tempDir, "per-xsd");

			// Pre-fix this import throws "Cannot access 'UserType' before initialization"
			const module = await import(/* @vite-ignore */ path.join(tempDir, "generated.ts"));
			// CompanyType carries @XmlRoot({ name: 'Company' }) from the root element
			const { CompanyType, UserType, AdminType } = module;

			const owner = new UserType();
			owner.fullName = "Alice";
			const admin = new AdminType();
			admin.fullName = "Bob";
			admin.permissions = "all";

			const company = new CompanyType();
			company.name = "Acme";
			company.owner = owner;
			company.admin = admin;

			const xml: string = serializer.toXml(company);
			const parsed = serializer.fromXml(xml, CompanyType);

			expect(parsed.name).toBe("Acme");
			expect(parsed.owner).toBeInstanceOf(UserType);
			expect(parsed.owner.fullName).toBe("Alice");
			expect(parsed.admin).toBeInstanceOf(AdminType);
			expect(parsed.admin.permissions).toBe("all");
		});
	});

	describe("per-xsd output from a circular XSD", () => {
		it("imports without TDZ errors and round-trips recursive structures", async () => {
			generateFixture("circular.xsd", tempDir, "per-xsd");

			const module = await import(/* @vite-ignore */ path.join(tempDir, "generated.ts"));
			const { Document, PersonType, ManagerType, SectionType } = module;

			const manager = new ManagerType();
			manager.name = "Carol";
			manager.title = "CTO";

			const person = new PersonType();
			person.name = "Dave";
			person.manager = manager;

			const leaf = new SectionType();
			leaf.heading = "Leaf";
			const section = new SectionType();
			section.heading = "Top";
			section.section = [leaf];

			const document = new Document();
			document.person = person;
			document.section = section;

			const xml: string = serializer.toXml(document);
			const parsed = serializer.fromXml(xml, Document);

			expect(parsed.person).toBeInstanceOf(PersonType);
			expect(parsed.person.manager).toBeInstanceOf(ManagerType);
			expect(parsed.person.manager.title).toBe("CTO");
			expect(parsed.section).toBeInstanceOf(SectionType);
			expect(parsed.section.section?.[0]).toBeInstanceOf(SectionType);
			expect(parsed.section.section?.[0].heading).toBe("Leaf");
		});
	});

	describe("per-type output from a circular XSD, imported via the barrel", () => {
		it("merges the extends-cycle classes into one module and round-trips", async () => {
			const { fileNames } = generateFixture("circular.xsd", tempDir, "per-type");

			// PersonType/ManagerType form an extends cycle → one shared module.
			expect(fileNames).toContain("person-type.ts");
			expect(fileNames).not.toContain("manager-type.ts");
			// Self-recursive SectionType stays in its own file (thunk suffices).
			expect(fileNames).toContain("section-type.ts");

			const module = await import(/* @vite-ignore */ path.join(tempDir, "index.ts"));
			const { PersonType, ManagerType } = module;

			const manager = new ManagerType();
			manager.name = "Erin";
			manager.title = "Lead";

			const person = new PersonType();
			person.name = "Frank";
			person.manager = manager;

			const xml: string = serializer.toXml(person);
			const parsed = serializer.fromXml(xml, PersonType);

			expect(parsed.manager).toBeInstanceOf(ManagerType);
			expect(parsed.manager.name).toBe("Erin");
			expect(parsed.manager.title).toBe("Lead");
		});
	});
});
