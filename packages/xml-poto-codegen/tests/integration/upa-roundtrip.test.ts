/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * Round trip over classes generated from the real UPA 2026 pension schema.
 *
 * This schema is the most demanding fixture in the suite: 63 simpleTypes, 17
 * complexTypes, XSD declarations written unprefixed (the schema binds `xmlns` to
 * the XMLSchema namespace itself), `elementFormDefault="qualified"` paired with
 * `attributeFormDefault="unqualified"`, deeply nested anonymous types, and a
 * `<choice>` whose branches are `<sequence>`s.
 *
 * It exposed three defects that no other fixture reached:
 *  - a member of a choice's sequence branch stayed `required`, so a document
 *    taking the other branch could not be read at all;
 *  - named enum simpleTypes carried no `enumValues`, leaving every enumeration in
 *    the schema unenforced and numeric-looking tokens deserializing as numbers;
 *  - a numeric type with a lexical pattern (a Dutch BSN) lost its leading zero,
 *    silently becoming a different, invalid identifier.
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
const TMP_DIR = path.resolve(__dirname, "../tmp-upa-roundtrip");
const UPA = "upa_2026_request.xsd";
const NS = "http://www.pensioenfederatie.nl/uniformePensioenAangifte/2026/01";

function resolveUpa(): ReturnType<XsdResolver["resolve"]> {
	return new XsdResolver().resolve(new XsdParser().parseFile(path.join(FIXTURES, UPA)));
}

function generateUpa(outputDir: string): void {
	writeGeneratedFiles(outputDir, new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa()));
}

async function load(dir: string, fileBase: string, exportName: string): Promise<any> {
	const mod = await import(/* @vite-ignore */ path.join(dir, `${fileBase}.ts`));
	return mod[exportName];
}

/** A `<Bericht>` with every required member filled, using codes the schema allows. */
function berichtXml(): string {
	return (
		`<upa:Bericht><upa:IdBer>MSG-0001</upa:IdBer>` +
		`<upa:DatTdAanm>2026-07-21T09:00:00</upa:DatTdAanm><upa:ContPers>Jan Jansen</upa:ContPers>` +
		`<upa:TelNr>0612345678</upa:TelNr><upa:RelNr>12345678</upa:RelNr>` +
		`<upa:GebrSwPakket>Cerios</upa:GebrSwPakket><upa:IdLcr>LCR12345</upa:IdLcr></upa:Bericht>`
	);
}

describe("UPA 2026 round trip", () => {
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

	// ── choice with sequence branches ──────────────────────────────────────────

	describe("a <choice> of <sequence> branches", () => {
		// AdministratieveEenheidType is either (TijdvakAangifte + optional
		// TijdvakCorrectie) or (TijdvakCorrectie alone). Nothing in either branch can
		// be required at the type level.
		it("generates branch members as optional", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const ae = files.find((f) => f.fileName === "administratieve-eenheid-type.ts")!;

			expect(ae.content).toContain("tijdvakAangifte?: TijdvakAangifteType;");
			expect(ae.content).not.toContain("tijdvakAangifte: TijdvakAangifteType =");
		});

		it("keeps members of a plain sequence required", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const ae = files.find((f) => f.fileName === "administratieve-eenheid-type.ts")!;

			// LhNr/NmIP/TvkCd sit in the enclosing sequence, not in a choice branch.
			expect(ae.content).toContain("lhNr!: string;");
			expect(ae.content).toContain("nmIP!: string;");
		});

		it("reads a document taking the TijdvakCorrectie-only branch", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			// Valid per the schema: branch 2 omits TijdvakAangifte entirely.
			const xml =
				`<upa:PensioenAangifte xmlns:upa="${NS}" Version="1.0">${berichtXml()}` +
				`<upa:AdministratieveEenheid><upa:LhNr>123456789L01</upa:LhNr>` +
				`<upa:NmIP>Werkgever BV</upa:NmIP><upa:TvkCd>MND</upa:TvkCd>` +
				`<upa:TijdvakCorrectie><upa:DatAanvTv>2026-01-01</upa:DatAanvTv>` +
				`<upa:DatEindTv>2026-01-31</upa:DatEindTv><upa:CollectieveAangifte/></upa:TijdvakCorrectie>` +
				`</upa:AdministratieveEenheid></upa:PensioenAangifte>`;

			const parsed = serializer.fromXml(xml, PensioenAangifte);

			expect(parsed.administratieveEenheid.tijdvakAangifte).toBeUndefined();
			expect(parsed.administratieveEenheid.tijdvakCorrectie).toHaveLength(1);
			expect(parsed.administratieveEenheid.lhNr).toBe("123456789L01");
		});

		it("reads a document taking the TijdvakAangifte branch", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			const xml =
				`<upa:PensioenAangifte xmlns:upa="${NS}" Version="1.0">${berichtXml()}` +
				`<upa:AdministratieveEenheid><upa:LhNr>123456789L01</upa:LhNr>` +
				`<upa:NmIP>Werkgever BV</upa:NmIP><upa:TvkCd>MND</upa:TvkCd>` +
				`<upa:TijdvakAangifte><upa:DatAanvTv>2026-01-01</upa:DatAanvTv>` +
				`<upa:DatEindTv>2026-01-31</upa:DatEindTv>` +
				`<upa:VolledigeAangifte><upa:CollectieveAangifte/></upa:VolledigeAangifte>` +
				`</upa:TijdvakAangifte></upa:AdministratieveEenheid></upa:PensioenAangifte>`;

			const parsed = serializer.fromXml(xml, PensioenAangifte);

			expect(parsed.administratieveEenheid.tijdvakAangifte).toBeDefined();
			expect(parsed.administratieveEenheid.tijdvakAangifte.datAanvTv).toBe("2026-01-01");
		});
	});

	// ── anonymous inline complexTypes ──────────────────────────────────────────

	describe("an inline complexType shadowing a named one", () => {
		// TijdvakCorrectieType declares <CollectieveAangifte> with an inline type of its
		// own, narrower than the named CollectieveAangifteType the rest of the schema
		// uses. Both want the class name 'CollectieveAangifteType'.
		it("names the inline type after the type that declares it", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());

			expect(files.map((f) => f.fileName)).toContain("tijdvak-correctie-collectieve-aangifte.ts");
			expect(files.map((f) => f.fileName)).not.toContain("collectieve-aangifte-type2.ts");
		});

		it("declares the inline type anonymous, so it claims no schema type identity", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const inline = files.find((f) => f.fileName === "tijdvak-correctie-collectieve-aangifte.ts")!;
			const named = files.find((f) => f.fileName === "collectieve-aangifte-type.ts")!;

			expect(inline.content).toContain("anonymous: true");
			// The named type does name a schema type, and keeps its identity.
			expect(named.content).toContain("name: 'CollectieveAangifteType'");
			expect(named.content).not.toContain("anonymous");
		});

		it("keeps each <CollectieveAangifte> on its own content model", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			// SaldoCorrectiesVoorgaandAangifteTijdvak exists only on the named type, which
			// VolledigeAangifte uses — the inline one under TijdvakCorrectie forbids it.
			const xml =
				`<upa:PensioenAangifte xmlns:upa="${NS}" Version="1.0">${berichtXml()}` +
				`<upa:AdministratieveEenheid><upa:LhNr>123456789L01</upa:LhNr>` +
				`<upa:NmIP>Werkgever BV</upa:NmIP><upa:TvkCd>MND</upa:TvkCd>` +
				`<upa:TijdvakAangifte><upa:DatAanvTv>2026-01-01</upa:DatAanvTv>` +
				`<upa:DatEindTv>2026-01-31</upa:DatEindTv>` +
				`<upa:VolledigeAangifte><upa:CollectieveAangifte>` +
				`<upa:SaldoCorrectiesVoorgaandAangifteTijdvak><upa:DatAanvTv>2026-01-01</upa:DatAanvTv>` +
				`<upa:DatEindTv>2026-01-31</upa:DatEindTv></upa:SaldoCorrectiesVoorgaandAangifteTijdvak>` +
				`</upa:CollectieveAangifte></upa:VolledigeAangifte>` +
				`</upa:TijdvakAangifte><upa:TijdvakCorrectie><upa:DatAanvTv>2026-02-01</upa:DatAanvTv>` +
				`<upa:DatEindTv>2026-02-28</upa:DatEindTv><upa:CollectieveAangifte/></upa:TijdvakCorrectie>` +
				`</upa:AdministratieveEenheid></upa:PensioenAangifte>`;

			const parsed = serializer.fromXml(xml, PensioenAangifte);
			const volledige = parsed.administratieveEenheid.tijdvakAangifte.volledigeAangifte;
			const correctie = parsed.administratieveEenheid.tijdvakCorrectie[0];

			expect(volledige.collectieveAangifte.saldoCorrectiesVoorgaandAangifteTijdvak).toHaveLength(1);
			// The inline type has no such member to be filled in from anywhere.
			expect(correctie.collectieveAangifte.saldoCorrectiesVoorgaandAangifteTijdvak).toBeUndefined();
		});
	});

	// ── named enum vocabularies ────────────────────────────────────────────────

	describe("named enum simpleTypes", () => {
		it("emits the vocabulary on the referencing member", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const ikv = files.find((f) => f.fileName === "inkomstenperiode-type.ts")!;

			// CdAard is a NAMED simpleType; its tokens must still reach the decorator.
			expect(ikv.content).toContain("enumValues: ['1', '4', '6', '7', '11'");
		});

		it("still generates the enum as a string union type", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const cdAard = files.find((f) => f.fileName === "cd-aard.ts")!;

			expect(cdAard.content).toContain('export type CdAard = "1" | "4"');
		});

		it("rejects a token outside the enumeration", async () => {
			generateUpa(tempDir);
			const InkomstenperiodeType = await load(tempDir, "inkomstenperiode-type", "InkomstenperiodeType");

			// 99 is not one of CdAard's 14 allowed codes.
			const xml =
				`<upa:InkomstenperiodeType xmlns:upa="${NS}"><upa:DatAanv>2026-01-01</upa:DatAanv>` +
				`<upa:SrtIV>11</upa:SrtIV><upa:CdAard>99</upa:CdAard><upa:LbTab>010</upa:LbTab>` +
				`<upa:IndGenReg>J</upa:IndGenReg></upa:InkomstenperiodeType>`;

			expect(() => serializer.fromXml(xml, InkomstenperiodeType)).toThrow(/not one of the allowed values/);
		});

		it("returns a numeric-looking token as its string form, matching the union type", async () => {
			generateUpa(tempDir);
			const InkomstenperiodeType = await load(tempDir, "inkomstenperiode-type", "InkomstenperiodeType");

			const xml =
				`<upa:InkomstenperiodeType xmlns:upa="${NS}"><upa:DatAanv>2026-01-01</upa:DatAanv>` +
				`<upa:SrtIV>11</upa:SrtIV><upa:CdAard>11</upa:CdAard><upa:LbTab>010</upa:LbTab>` +
				`<upa:IndGenReg>J</upa:IndGenReg></upa:InkomstenperiodeType>`;

			const parsed = serializer.fromXml(xml, InkomstenperiodeType);

			// CdAard is "1" | "4" | ... | "11" — the number 11 does not inhabit it.
			expect(parsed.cdAard).toBe("11");
			expect(typeof parsed.cdAard).toBe("string");
			expect(serializer.toXml(parsed)).toContain("<upa:CdAard>11</upa:CdAard>");
		});
	});

	// ── lexical numeric types ──────────────────────────────────────────────────

	describe("a numeric type constrained by a pattern (Dutch BSN)", () => {
		it("generates as string so the lexical form survives", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const np = files.find((f) => f.fileName === "natuurlijk-persoon-type.ts")!;

			expect(np.content).toContain("sofiNr?: string;");
			// dataType would coerce it straight back to a number.
			expect(np.content).not.toMatch(/name: 'SofiNr'[\s\S]{0,300}?dataType:/);
		});

		it("round-trips a BSN with a leading zero unchanged", async () => {
			generateUpa(tempDir);
			const NatuurlijkPersoonType = await load(tempDir, "natuurlijk-persoon-type", "NatuurlijkPersoonType");

			const xml =
				`<upa:NatuurlijkPersoonType xmlns:upa="${NS}"><upa:SofiNr>012345678</upa:SofiNr>` +
				`<upa:SignNm>Jansen</upa:SignNm><upa:Gebdat>1980-01-01</upa:Gebdat>` +
				`<upa:Gesl>1</upa:Gesl></upa:NatuurlijkPersoonType>`;

			const parsed = serializer.fromXml(xml, NatuurlijkPersoonType);

			// As a number this was 12345678 — eight digits, a different person.
			expect(parsed.sofiNr).toBe("012345678");
			expect(serializer.toXml(parsed)).toContain("<upa:SofiNr>012345678</upa:SofiNr>");
		});

		it("enforces the pattern, which only applies to strings", async () => {
			generateUpa(tempDir);
			const NatuurlijkPersoonType = await load(tempDir, "natuurlijk-persoon-type", "NatuurlijkPersoonType");

			// The first three digits may not all be zero.
			const xml =
				`<upa:NatuurlijkPersoonType xmlns:upa="${NS}"><upa:SofiNr>000000000</upa:SofiNr>` +
				`<upa:SignNm>Jansen</upa:SignNm><upa:Gebdat>1980-01-01</upa:Gebdat>` +
				`<upa:Gesl>1</upa:Gesl></upa:NatuurlijkPersoonType>`;

			expect(() => serializer.fromXml(xml, NatuurlijkPersoonType)).toThrow(/does not match pattern/);
		});

		it("leaves a numeric type without a pattern as a number", () => {
			const files = new ClassGenerator({ xsdPath: UPA }).generatePerType(resolveUpa());
			const wg = files.find((f) => f.fileName === "werknemersgegevens-type.ts")!;

			// Bedrag10.2 is xs:decimal with digit facets but no pattern.
			expect(wg.content).toContain("dataType: 'xs:decimal'");
			expect(wg.content).toMatch(/lnLbPh[!?]?: number/);
		});
	});

	// ── whole-document round trip ──────────────────────────────────────────────

	describe("whole document", () => {
		const fullDocument = (): string =>
			`<upa:PensioenAangifte xmlns:upa="${NS}" Version="1.0">${berichtXml()}` +
			`<upa:AdministratieveEenheid><upa:LhNr>123456789L01</upa:LhNr>` +
			`<upa:NmIP>Werkgever BV</upa:NmIP><upa:TvkCd>MND</upa:TvkCd>` +
			`<upa:TijdvakAangifte><upa:DatAanvTv>2026-01-01</upa:DatAanvTv>` +
			`<upa:DatEindTv>2026-01-31</upa:DatEindTv>` +
			`<upa:VolledigeAangifte><upa:CollectieveAangifte/></upa:VolledigeAangifte>` +
			`</upa:TijdvakAangifte></upa:AdministratieveEenheid></upa:PensioenAangifte>`;

		it("round-trips without loss", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			const first = serializer.fromXml(fullDocument(), PensioenAangifte);
			const xml = serializer.toXml(first);
			const second = serializer.fromXml(xml, PensioenAangifte);

			expect(JSON.stringify(second)).toBe(JSON.stringify(first));
		});

		it("is idempotent on re-serialization", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			const once = serializer.toXml(serializer.fromXml(fullDocument(), PensioenAangifte));
			const twice = serializer.toXml(serializer.fromXml(once, PensioenAangifte));

			expect(twice).toBe(once);
		});

		it("qualifies elements but not attributes, declaring the namespace once", async () => {
			generateUpa(tempDir);
			const PensioenAangifte = await load(tempDir, "pensioen-aangifte", "PensioenAangifte");

			const xml: string = serializer.toXml(serializer.fromXml(fullDocument(), PensioenAangifte));

			// elementFormDefault="qualified" — root and locals carry the prefix.
			expect(xml).toContain("<upa:PensioenAangifte");
			expect(xml).toContain("<upa:Bericht>");
			expect(xml).toContain("<upa:IdBer>MSG-0001</upa:IdBer>");
			// attributeFormDefault="unqualified" — Version does not.
			expect(xml).toContain('Version="1.0"');
			expect(xml).not.toContain("upa:Version=");
			expect(xml.match(/xmlns:upa=/g)).toHaveLength(1);
		});
	});
});
