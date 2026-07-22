/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * XSD → generated classes → XML string → objects, asserting **value types** and
 * not just structure.
 *
 * This is the guard that was missing. A sweep of every fixture found that numeric
 * and boolean attributes deserialized as strings (`"false"` — which is truthy),
 * that `xs:boolean` lexical `1`/`0` never became a boolean, and that a
 * numeric-looking enum token came back as a number that did not inhabit its own
 * generated union type. Structural comparison alone would have missed all three,
 * because the XML on the wire was correct throughout.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { XmlDecoratorSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-roundtrip-sweep");

function generate(fixture: string, outputDir: string): void {
	const schema = new XsdParser().parseFile(path.join(FIXTURES, fixture));
	const resolved = new XsdResolver().resolve(schema);
	writeGeneratedFiles(outputDir, new ClassGenerator({ xsdPath: fixture }).generatePerType(resolved));
}

async function load(dir: string, fileBase: string, exportName: string): Promise<any> {
	const mod = await import(/* @vite-ignore */ path.join(dir, `${fileBase}.ts`));
	return mod[exportName];
}

describe("XSD round-trip sweep: values survive with their declared types", () => {
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

	// ── boolean attributes ─────────────────────────────────────────────────────

	describe("mixed.xsd — boolean attribute and numeric text content", () => {
		it("round-trips taxIncluded as a boolean, not the truthy string 'false'", async () => {
			generate("mixed.xsd", tempDir);
			const Price = await load(tempDir, "price", "Price");

			const price = new Price();
			price.currency = "EUR";
			price.taxIncluded = false;
			price.value = 9.99;

			const parsed = serializer.fromXml(serializer.toXml(price), Price);

			expect(parsed.taxIncluded).toBe(false);
			expect(typeof parsed.taxIncluded).toBe("boolean");
			expect(parsed.value).toBe(9.99);
			expect(parsed.currency).toBe("EUR");
		});

		it("emits dataType on the boolean attribute so the coercion has something to act on", () => {
			const schema = new XsdParser().parseFile(path.join(FIXTURES, "mixed.xsd"));
			const resolved = new XsdResolver().resolve(schema);
			const files = new ClassGenerator({ xsdPath: "mixed.xsd" }).generatePerType(resolved);

			const price = files.find((f) => f.fileName === "price.ts")!;
			expect(price.content).toContain("dataType: 'xs:boolean'");
		});
	});

	describe("prohibited.xsd — boolean attribute on a non-root type", () => {
		it("round-trips draft as a boolean", async () => {
			generate("prohibited.xsd", tempDir);
			const BaseDocument = await load(tempDir, "base-document", "BaseDocument");

			const doc = new BaseDocument();
			doc.body = "text";
			doc.author = "jan";
			doc.draft = false;

			const parsed = serializer.fromXml(serializer.toXml(doc), BaseDocument);

			expect(parsed.draft).toBe(false);
			// The regression in plain language: this used to be the string "false",
			// so `if (doc.draft)` was true when the document said otherwise.
			expect(Boolean(parsed.draft)).toBe(false);
		});
	});

	// ── numeric elements and attributes ────────────────────────────────────────

	describe("simple.xsd — numeric element", () => {
		it("round-trips age as a number", async () => {
			generate("simple.xsd", tempDir);
			const Person = await load(tempDir, "person", "Person");

			const person = new Person();
			person.id = "p-1";
			person.firstName = "Alice";
			person.lastName = "Jansen";
			person.age = 32;

			const parsed = serializer.fromXml(serializer.toXml(person), Person);

			expect(parsed.age).toBe(32);
			expect(typeof parsed.age).toBe("number");
			expect(parsed.id).toBe("p-1");
		});
	});

	describe("facets.xsd — numeric element under facets", () => {
		it("round-trips every member with its declared type", async () => {
			generate("facets.xsd", tempDir);
			const Payment = await load(tempDir, "payment", "Payment");

			const payment = new Payment();
			payment.country = "NL";
			payment.total = 125.5;
			payment.beneficiary = "Jan Jansen";
			payment.reference = "P123";

			const parsed = serializer.fromXml(serializer.toXml(payment), Payment);

			expect(parsed.country).toBe("NL");
			expect(parsed.total).toBe(125.5);
			expect(typeof parsed.total).toBe("number");
			expect(parsed.beneficiary).toBe("Jan Jansen");
			expect(parsed.reference).toBe("P123");
		});

		it("uses definite assignment where the facets reject an empty default", () => {
			const schema = new XsdParser().parseFile(path.join(FIXTURES, "facets.xsd"));
			const resolved = new XsdResolver().resolve(schema);
			const files = new ClassGenerator({ xsdPath: "facets.xsd" }).generatePerType(resolved);

			const payment = files.find((f) => f.fileName === "payment.ts")!;

			// Country has pattern="[A-Z]{2}" and Beneficiary minLength=2 — '' fails both.
			expect(payment.content).toContain("country!: string;");
			expect(payment.content).toContain("beneficiary!: string;");
			// Total's minInclusive=0 accepts the generated default, so it keeps it.
			expect(payment.content).toContain("total: number = 0;");
		});
	});

	// ── enums ──────────────────────────────────────────────────────────────────

	describe("enums.xsd — enum tokens survive verbatim", () => {
		it("round-trips enum values without coercing them", async () => {
			generate("enums.xsd", tempDir);
			const Task = await load(tempDir, "task", "Task");

			const task = new Task();
			task.title = "Fix login";
			task.status = "active";

			const parsed = serializer.fromXml(serializer.toXml(task), Task);

			expect(parsed.status).toBe("active");
			expect(parsed.title).toBe("Fix login");
		});
	});

	// ── lists ──────────────────────────────────────────────────────────────────

	describe("list.xsd — xs:list on elements and attributes", () => {
		it("round-trips list members as arrays with typed items", async () => {
			generate("list.xsd", tempDir);
			const Measurements = await load(tempDir, "measurements", "Measurements");

			const m = new Measurements();
			m.sizes = [10, 20, 30];
			m.scores = [1, 2];
			m.labels = ["a", "b"];
			m.ids = [7, 8];

			const parsed = serializer.fromXml(serializer.toXml(m), Measurements);

			expect(parsed.sizes).toEqual([10, 20, 30]);
			expect(parsed.scores).toEqual([1, 2]);
			expect(parsed.labels).toEqual(["a", "b"]);
			// An xs:list ATTRIBUTE, the path most likely to be forgotten.
			expect(parsed.ids).toEqual([7, 8]);
			expect(parsed.ids.every((v: unknown) => typeof v === "number")).toBe(true);
		});
	});

	// ── inheritance ────────────────────────────────────────────────────────────

	describe("inheritance.xsd — members inherited from a base type", () => {
		it("round-trips base and derived members with their declared types", async () => {
			generate("inheritance.xsd", tempDir);
			const AdminType = await load(tempDir, "admin-type", "AdminType");

			const admin = new AdminType();
			admin.id = "u1";
			admin.username = "jan";
			admin.email = "jan@example.nl";
			admin.createdAt = "2026-07-21";
			admin.role = "admin";
			admin.adminLevel = 5;
			admin.permissions = ["read", "write"];

			const parsed = serializer.fromXml(serializer.toXml(admin), AdminType);

			expect(parsed.adminLevel).toBe(5);
			expect(typeof parsed.adminLevel).toBe("number");
			expect(parsed.username).toBe("jan");
			expect(parsed.permissions).toEqual(["read", "write"]);
		});
	});

	// ── idempotency ────────────────────────────────────────────────────────────

	describe("serialization is idempotent", () => {
		it.each(["simple.xsd", "mixed.xsd", "facets.xsd", "list.xsd"])(
			"%s: toXml(fromXml(toXml(x))) equals toXml(x)",
			async (fixture) => {
				generate(fixture, tempDir);
				const roots: Record<string, [string, string]> = {
					"simple.xsd": ["person", "Person"],
					"mixed.xsd": ["price", "Price"],
					"facets.xsd": ["payment", "Payment"],
					"list.xsd": ["measurements", "Measurements"],
				};
				const [fileBase, exportName] = roots[fixture];
				const Ctor = await load(tempDir, fileBase, exportName);

				const instance = new Ctor();
				// Populate just enough for each fixture's required members.
				Object.assign(instance, {
					id: "p-1",
					firstName: "Alice",
					lastName: "Jansen",
					age: 32,
					currency: "EUR",
					taxIncluded: true,
					value: 1.5,
					country: "NL",
					total: 10,
					beneficiary: "Jan Jansen",
					reference: "P1",
					sizes: [1, 2],
				});

				const once = serializer.toXml(instance);
				const twice = serializer.toXml(serializer.fromXml(once, Ctor));

				expect(twice).toBe(once);
			},
		);
	});
});
