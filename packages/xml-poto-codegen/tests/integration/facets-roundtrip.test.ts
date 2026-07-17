/**
 * End-to-end proof that codegen output and the xml-poto runtime agree on the
 * new XSD validation options: facets, fixed values, xs:list, and choice groups.
 * Generates classes from fixture XSDs, imports them, and round-trips XML.
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
const TMP_DIR = path.resolve(__dirname, "../tmp-facets-roundtrip");

function generateFixtureToDir(fixtureName: string, outputDir: string): void {
	const parser = new XsdParser();
	const resolver = new XsdResolver();
	const generator = new ClassGenerator({ xsdPath: fixtureName });
	const schema = parser.parseFile(path.join(FIXTURES, fixtureName));
	const resolved = resolver.resolve(schema);
	const files = generator.generatePerType(resolved);
	writeGeneratedFiles(outputDir, files);
}

describe("Generated facet/list/fixed/choice options round-trip through xml-poto", () => {
	let tempDir: string;
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		tempDir = path.join(TMP_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		serializer = new XmlDecoratorSerializer();
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) {
			rmSync(TMP_DIR, { recursive: true, force: true });
		}
	});

	describe("facets.xsd", () => {
		it("emits facet options in the generated decorators", () => {
			generateFixtureToDir("facets.xsd", tempDir);
			const content = readFileSync(path.join(tempDir, "payment.ts"), "utf-8");

			expect(content).toContain("length: 2");
			expect(content).toContain('pattern: new RegExp("[A-Z]{2}")');
			expect(content).toContain("totalDigits: 8");
			expect(content).toContain("fractionDigits: 2");
			expect(content).toContain("minInclusive: 0");
			expect(content).toContain("maxExclusive: 1000000");
			expect(content).toContain("minLength: 2");
			expect(content).toContain("maxLength: 20");
			expect(content).toContain("whiteSpace: 'collapse'");
			// Combined multi-pattern from PhoneOrFax
			expect(content).toContain("(?:P[0-9]+)|(?:F[0-9]+)");
			// Attribute facet
			expect(content).toContain("maxLength: 16");
		});

		it("enforces the generated facets at runtime", async () => {
			generateFixtureToDir("facets.xsd", tempDir);
			const { Payment } = await import(/* @vite-ignore */ path.join(tempDir, "payment.ts"));

			const payment = new Payment();
			payment.reference = "REF-1";
			payment.country = "NL";
			payment.total = 100.5;
			payment.beneficiary = "Acme";

			const xml: string = serializer.toXml(payment);
			const parsed = serializer.fromXml(xml, Payment);
			expect(parsed.country).toBe("NL");
			expect(parsed.total).toBe(100.5);

			payment.country = "nl"; // violates pattern [A-Z]{2}
			expect(() => serializer.toXml(payment)).toThrow(/does not match pattern/);

			payment.country = "NL";
			payment.total = 5000000; // violates maxExclusive 1000000
			expect(() => serializer.toXml(payment)).toThrow(/maxExclusive/);
		});
	});

	describe("list.xsd", () => {
		it("emits list options in the generated decorators", () => {
			generateFixtureToDir("list.xsd", tempDir);
			const content = readFileSync(path.join(tempDir, "measurements.ts"), "utf-8");

			expect(content).toContain("list: { itemType: 'number' }");
			expect(content).toContain("sizes: number[]");
		});

		it("round-trips list values as space-separated text", async () => {
			generateFixtureToDir("list.xsd", tempDir);
			const { Measurements } = await import(/* @vite-ignore */ path.join(tempDir, "measurements.ts"));

			const measurements = new Measurements();
			measurements.sizes = [1, 2, 3];
			measurements.ids = [10, 20];

			const xml: string = serializer.toXml(measurements);
			expect(xml).toContain("<Sizes>1 2 3</Sizes>");
			expect(xml).toContain(`ids="10 20"`);

			const parsed = serializer.fromXml(xml, Measurements);
			expect(parsed.sizes).toEqual([1, 2, 3]);
			expect(parsed.ids).toEqual([10, 20]);
		});

		it("applies list itemType facets to each item", async () => {
			generateFixtureToDir("list.xsd", tempDir);
			const { Measurements } = await import(/* @vite-ignore */ path.join(tempDir, "measurements.ts"));

			const measurements = new Measurements();
			measurements.sizes = [1];
			measurements.scores = [50, 200]; // RestrictedInt maxInclusive=100

			expect(() => serializer.toXml(measurements)).toThrow(/maxInclusive 100/);
		});
	});

	describe("fixed.xsd", () => {
		it("emits fixedValue options and applies them as defaults", async () => {
			generateFixtureToDir("fixed.xsd", tempDir);
			const content = readFileSync(path.join(tempDir, "manifest.ts"), "utf-8");
			expect(content).toContain("fixedValue: 'jsonl'");
			expect(content).toContain("fixedValue: '2.1'");

			const { Manifest } = await import(/* @vite-ignore */ path.join(tempDir, "manifest.ts"));
			const parsed = serializer.fromXml('<Manifest version="2.1"><Name>test</Name></Manifest>', Manifest);
			expect(parsed.name).toBe("test");
			// Missing Format element falls back to the fixed value
			expect(parsed.format).toBe("jsonl");
		});

		it("rejects values that contradict the fixed value", async () => {
			generateFixtureToDir("fixed.xsd", tempDir);
			const { Manifest } = await import(/* @vite-ignore */ path.join(tempDir, "manifest.ts"));

			expect(() =>
				serializer.fromXml(`<Manifest version="2.1"><Format>xml</Format><Name>x</Name></Manifest>`, Manifest),
			).toThrow(/does not equal the fixed value 'jsonl'/);
		});
	});

	describe("choice.xsd", () => {
		it("emits choiceGroup options for direct choice members", () => {
			generateFixtureToDir("choice.xsd", tempDir);
			const content = readFileSync(path.join(tempDir, "notification.ts"), "utf-8");

			expect(content).toContain("choiceGroup: 'choice");
		});

		it("enforces exclusive choice at runtime", async () => {
			generateFixtureToDir("choice.xsd", tempDir);
			const { Notification } = await import(/* @vite-ignore */ path.join(tempDir, "notification.ts"));

			const notification = new Notification();
			notification.title = "Hello";
			notification.email = "a@b.c";
			notification.phone = "12345";

			expect(() => serializer.toXml(notification)).toThrow(/Choice group/);

			notification.phone = undefined;
			const xml: string = serializer.toXml(notification);
			expect(xml).toContain("<Email>a@b.c</Email>");
		});
	});
});
