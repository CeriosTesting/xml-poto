/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * WSDL → generated classes → XmlDecoratorSerializer round-trip tests.
 *
 * Regression coverage for the GBAV WSDL breakage: generated classes emitted XML
 * whose local elements were namespace-qualified even though the schema is
 * elementFormDefault="unqualified", the qualification was inconsistent within one
 * document, `fromXml` could not read back what `toXml` wrote, a response using a
 * different prefix (or a default xmlns) could not be read at all, and a single-item
 * array deserialized to a bare object.
 *
 * Like generated-code-roundtrip.test.ts, these generate into a temp directory and
 * dynamically import the result so Vitest's `@cerios/xml-poto` alias applies.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

import { XmlDecoratorSerializer } from "@cerios/xml-poto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ElementForm } from "../../src/config/config-types";
import { ClassGenerator } from "../../src/generator/class-generator";
import { writeGeneratedFiles } from "../../src/generator/file-writer";
import { XsdParser } from "../../src/xsd/xsd-parser";
import { XsdResolver } from "../../src/xsd/xsd-resolver";

const FIXTURES = path.resolve(__dirname, "../fixtures");
const TMP_DIR = path.resolve(__dirname, "../tmp-wsdl-roundtrip");
const GBAV_NS = "http://www.competent.nl/gbav/v1";

/** Run the full WSDL → resolve → generate → write pipeline into a local directory. */
function generateFixture(fixtureName: string, outputDir: string, elementForm?: ElementForm): void {
	const schema = new XsdParser().parseFile(path.join(FIXTURES, fixtureName));
	const resolved = new XsdResolver({ elementForm }).resolve(schema);
	const files = new ClassGenerator({ xsdPath: fixtureName }).generatePerType(resolved);
	writeGeneratedFiles(outputDir, files);
}

/** Load the classes a GBAV fixture generates. */
async function loadGbav(dir: string): Promise<Record<string, any>> {
	const names: Record<string, string> = {
		GbavVraag: "gbav-vraag",
		GbavAntwoord: "gbav-antwoord",
		Identificatie: "identificatie",
		Categorieen: "categorieen",
		Categorie: "categorie",
		Rubrieken: "rubrieken",
		Rubriek: "rubriek",
		Resultaten: "resultaten",
		Persoon: "persoon",
	};
	const loaded: Record<string, any> = {};
	for (const [exportName, fileBase] of Object.entries(names)) {
		const mod = await import(/* @vite-ignore */ path.join(dir, `${fileBase}.ts`));
		loaded[exportName] = mod[exportName];
	}
	return loaded;
}

/** Build a populated gbavVraag with `categorieCount` categories, each holding one rubriek. */
function buildVraag(c: Record<string, any>, categorieCount: number): any {
	const vraag = new c.GbavVraag();

	const identificatie = new c.Identificatie();
	identificatie.indicatie = "AFN";
	identificatie.gebruiker = "ronald";
	vraag.identificatie = identificatie;

	const categorieen = new c.Categorieen();
	categorieen.categorie = [];
	for (let i = 0; i < categorieCount; i++) {
		const categorie = new c.Categorie();
		categorie.nummer = `0${i + 1}`;
		const rubrieken = new c.Rubrieken();
		const rubriek = new c.Rubriek();
		rubriek.nummer = "0110";
		rubriek.waarde = "Jan";
		rubrieken.rubriek = [rubriek];
		categorie.rubrieken = rubrieken;
		categorieen.categorie.push(categorie);
	}
	vraag.categorieen = categorieen;
	vraag.adresVraag = true;

	return vraag;
}

describe("WSDL round-trip: generated classes ↔ XmlDecoratorSerializer", () => {
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

	// ── Qualification follows elementFormDefault ───────────────────────────────

	describe("elementFormDefault=unqualified (the XSD default)", () => {
		it("qualifies only the root element, leaving every local element bare", async () => {
			generateFixture("gbav-unqualified.wsdl", tempDir);
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, 1));

			// The global element declaration is qualified and declares the namespace.
			expect(xml).toContain(`<tns:gbavVraag xmlns:tns="${GBAV_NS}">`);

			// Every local element — nested complex types, array containers, array items
			// and primitives alike — is unqualified. Before the fix this document mixed
			// <tns:identificatie>, <categorie> and <adresVraag> in one response.
			for (const local of [
				"identificatie",
				"indicatie",
				"gebruiker",
				"categorieen",
				"categorie",
				"nummer",
				"rubrieken",
				"rubriek",
				"adresVraag",
			]) {
				expect(xml).toContain(`<${local}>`);
				expect(xml).not.toContain(`<tns:${local}>`);
			}

			// The namespace is declared exactly once, on the root.
			expect(xml.match(/xmlns:tns=/g)).toHaveLength(1);
		});
	});

	describe('elementFormDefault="qualified"', () => {
		it("qualifies the root and every local element consistently", async () => {
			generateFixture("gbav-qualified.wsdl", tempDir);
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, 1));

			expect(xml).toContain(`<tns:gbavVraag xmlns:tns="${GBAV_NS}">`);
			for (const local of [
				"identificatie",
				"indicatie",
				"categorieen",
				"categorie",
				"nummer",
				"rubrieken",
				"rubriek",
				"adresVraag",
			]) {
				expect(xml).toContain(`<tns:${local}>`);
			}
			// No bare local leaking through alongside the prefixed ones.
			expect(xml).not.toMatch(/<identificatie[\s>]/);
			expect(xml).not.toMatch(/<categorie[\s>]/);
			expect(xml.match(/xmlns:tns=/g)).toHaveLength(1);
		});
	});

	// ── toXml output must be readable by fromXml ───────────────────────────────

	describe.each([
		["gbav-unqualified.wsdl", "unqualified"],
		["gbav-qualified.wsdl", "qualified"],
	])("%s", (fixture) => {
		it("round-trips its own output through fromXml without loss", async () => {
			generateFixture(fixture, tempDir);
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, 2));
			const parsed = serializer.fromXml(xml, c.GbavVraag);

			expect(parsed.identificatie.indicatie).toBe("AFN");
			expect(parsed.identificatie.gebruiker).toBe("ronald");
			expect(parsed.adresVraag).toBe(true);
			expect(parsed.categorieen.categorie).toHaveLength(2);
			expect(parsed.categorieen.categorie[0].nummer).toBe("01");
			expect(parsed.categorieen.categorie[1].nummer).toBe("02");
			expect(parsed.categorieen.categorie[0].rubrieken.rubriek[0].waarde).toBe("Jan");
		});
	});

	// ── Reading real-world responses regardless of prefix ──────────────────────

	describe("reading a service response whatever prefix it uses", () => {
		// The same gbavAntwoord payload spelled three ways. A JAX-WS peer commonly
		// answers with ns2: or a default xmlns, neither of which matches the tns:
		// spelling in the WSDL — they are nonetheless the same element.
		const body =
			`<identificatie><indicatie>AFN</indicatie><gebruiker>ronald</gebruiker></identificatie>` +
			`<resultaten><persoon><categorieen><categorie><nummer>01</nummer>` +
			`<rubrieken><rubriek><nummer>0110</nummer><waarde>Jan</waarde></rubriek></rubrieken>` +
			`</categorie></categorieen></persoon></resultaten>`;

		const documents: Record<string, string> = {
			"default xmlns": `<gbavAntwoord xmlns="${GBAV_NS}">${body}</gbavAntwoord>`,
			"tns prefix": `<tns:gbavAntwoord xmlns:tns="${GBAV_NS}">${body}</tns:gbavAntwoord>`,
			"ns2 prefix": `<ns2:gbavAntwoord xmlns:ns2="${GBAV_NS}">${body}</ns2:gbavAntwoord>`,
		};

		it.each(Object.keys(documents))("deserializes a response using the %s", async (spelling) => {
			generateFixture("gbav-unqualified.wsdl", tempDir);
			const c = await loadGbav(tempDir);

			const parsed = serializer.fromXml(documents[spelling], c.GbavAntwoord);

			expect(parsed.identificatie.indicatie).toBe("AFN");
			expect(parsed.resultaten.persoon).toHaveLength(1);
			const categorie = parsed.resultaten.persoon[0].categorieen.categorie[0];
			expect(categorie.nummer).toBe("01");
			expect(categorie.rubrieken.rubriek[0].waarde).toBe("Jan");
		});

		it("yields identical objects for all three spellings", async () => {
			generateFixture("gbav-unqualified.wsdl", tempDir);
			const c = await loadGbav(tempDir);

			const results = Object.values(documents).map((xml) => JSON.stringify(serializer.fromXml(xml, c.GbavAntwoord)));
			expect(new Set(results).size).toBe(1);
		});
	});

	// ── Array cardinality ──────────────────────────────────────────────────────

	describe("array cardinality", () => {
		// A single persoon / categorie / rubriek is completely ordinary GBAV data.
		// It used to deserialize to a bare object instead of a one-element array,
		// silently producing the wrong shape rather than an error.
		it.each([1, 2, 3])("keeps an array of %i item(s) an array", async (count) => {
			generateFixture("gbav-qualified.wsdl", tempDir);
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, count));
			const parsed = serializer.fromXml(xml, c.GbavVraag);

			expect(Array.isArray(parsed.categorieen.categorie)).toBe(true);
			expect(parsed.categorieen.categorie).toHaveLength(count);
			for (const categorie of parsed.categorieen.categorie) {
				expect(Array.isArray(categorie.rubrieken.rubriek)).toBe(true);
				expect(categorie.rubrieken.rubriek).toHaveLength(1);
			}
		});
	});

	// ── elementForm override ───────────────────────────────────────────────────

	describe("elementForm override", () => {
		it("forces qualified locals for a schema that declares none", async () => {
			generateFixture("gbav-unqualified.wsdl", tempDir, "qualified");
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, 1));

			expect(xml).toContain("<tns:identificatie>");
			expect(xml).toContain("<tns:indicatie>AFN</tns:indicatie>");

			// Still round-trips under the forced form.
			const parsed = serializer.fromXml(xml, c.GbavVraag);
			expect(parsed.identificatie.indicatie).toBe("AFN");
		});

		it("forces unqualified locals for a schema declaring elementFormDefault=qualified", async () => {
			generateFixture("gbav-qualified.wsdl", tempDir, "unqualified");
			const c = await loadGbav(tempDir);

			const xml: string = serializer.toXml(buildVraag(c, 1));

			expect(xml).toContain("<identificatie>");
			expect(xml).not.toContain("<tns:identificatie>");
		});
	});

	// ── Generated source shape ─────────────────────────────────────────────────

	describe("generated source", () => {
		it("indents class-level decorators at column 0", () => {
			const schema = new XsdParser().parseFile(path.join(FIXTURES, "gbav-unqualified.wsdl"));
			const resolved = new XsdResolver().resolve(schema);
			const files = new ClassGenerator({ xsdPath: "gbav-unqualified.wsdl" }).generatePerType(resolved);

			const identificatie = files.find((f) => f.fileName === "identificatie.ts")!;

			// A class decorator sits at column 0, so its options are one tab in and the
			// closing brace is flush left — not indented as if it were on a property.
			expect(identificatie.content).toContain("@XmlType({\n\tname: 'identificatie',");
			expect(identificatie.content).toContain("\n})\nexport class Identificatie {");
			expect(identificatie.content).not.toContain("@XmlType({\n\t\tname:");
		});
	});
});
