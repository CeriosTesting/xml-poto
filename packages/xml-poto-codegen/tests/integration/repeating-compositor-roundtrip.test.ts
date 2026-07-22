/* eslint-disable typescript/no-explicit-any -- Generated classes are loaded dynamically and have no static types here */
/**
 * Round trip over a class generated from a repeating `xs:choice`.
 *
 * This is the acceptance test for the ordered-collection generation: a document
 * interleaving `note` and `task` must come back in the same order. Generating one
 * array per branch would read `note task note` and write `note note task` — typed,
 * but silently reordered, which a service that cares about sequence rejects.
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
const TMP_DIR = path.resolve(__dirname, "../tmp-repeating-compositor");
const FIXTURE = "repeating-compositor.xsd";

const INTERLEAVED = `<Journal>
	<owner>Ronald</owner>
	<note><body>first</body></note>
	<task done="true"><title>ship it</title></task>
	<note><body>second</body></note>
</Journal>`;

describe("repeating xs:choice round-trip", () => {
	beforeEach(() => {
		rmSync(TMP_DIR, { recursive: true, force: true });
		mkdirSync(TMP_DIR, { recursive: true });
		const resolved = new XsdResolver().resolve(new XsdParser().parseFile(path.join(FIXTURES, FIXTURE)));
		writeGeneratedFiles(TMP_DIR, new ClassGenerator({ xsdPath: FIXTURE }).generatePerType(resolved));
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
	});

	async function loadJournal(): Promise<any> {
		const mod = await import(/* @vite-ignore */ path.join(TMP_DIR, "journal.ts"));
		return mod.Journal;
	}

	it("generates one ordered collection, not an array per branch", async () => {
		const Journal = await loadJournal();
		const journal = new XmlDecoratorSerializer().fromXml(INTERLEAVED, Journal);

		expect(journal.owner).toBe("Ronald");
		expect(journal.items).toHaveLength(3);
		// A member per branch would have produced `note` and `task` properties instead.
		expect(journal.note).toBeUndefined();
		expect(journal.task).toBeUndefined();
	});

	it("reads the interleaved elements as their own types, in document order", async () => {
		const Journal = await loadJournal();
		const journal = new XmlDecoratorSerializer().fromXml(INTERLEAVED, Journal);

		expect(journal.items.map((i: any) => i.constructor.name)).toEqual(["NoteType", "TaskType", "NoteType"]);
		expect(journal.items[0].body).toBe("first");
		expect(journal.items[1].title).toBe("ship it");
		expect(journal.items[1].done).toBe(true);
		expect(journal.items[2].body).toBe("second");
	});

	it("writes them back in the same order", async () => {
		const Journal = await loadJournal();
		const serializer = new XmlDecoratorSerializer();
		const xml = serializer.toXml(serializer.fromXml(INTERLEAVED, Journal));

		expect([...xml.matchAll(/<(note|task)[\s/>]/g)].map((m) => m[1])).toEqual(["note", "task", "note"]);
	});

	it("is stable across a second round trip", async () => {
		const Journal = await loadJournal();
		const serializer = new XmlDecoratorSerializer();
		const once = serializer.toXml(serializer.fromXml(INTERLEAVED, Journal));
		const twice = serializer.toXml(serializer.fromXml(once, Journal));

		expect(twice).toBe(once);
	});
});

/**
 * The same treatment for a repeating `xs:group ref`, where the *reference* carries
 * the occurs and the group's own sequence does not. Expanding it to one member per
 * element would read `key value key value` and write back `key key value value`.
 */
describe("repeating xs:group ref round-trip", () => {
	const REPEATED = `<Settings>
	<key>a</key><value>1</value>
	<key>b</key><value>2</value>
</Settings>`;

	beforeEach(() => {
		rmSync(TMP_DIR, { recursive: true, force: true });
		mkdirSync(TMP_DIR, { recursive: true });
		const resolved = new XsdResolver().resolve(new XsdParser().parseFile(path.join(FIXTURES, FIXTURE)));
		writeGeneratedFiles(TMP_DIR, new ClassGenerator({ xsdPath: FIXTURE }).generatePerType(resolved));
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
	});

	async function loadSettings(): Promise<any> {
		const mod = await import(/* @vite-ignore */ path.join(TMP_DIR, "settings.ts"));
		return mod.Settings;
	}

	// `key` and `value` are both strings, so a written value cannot say which element
	// it came from. Collecting them would round-trip to `key key key key` — silently
	// wrong output, worse than the ordering it set out to fix. The generator refuses
	// the collection and reports why.
	it("falls back to individual members when the alternatives share a type", async () => {
		const Settings = await loadSettings();
		const settings = new XmlDecoratorSerializer().fromXml(REPEATED, Settings);

		expect(settings.items).toBeUndefined();
		expect(settings.key).toEqual(["a", "b"]);
		expect(settings.value).toEqual([1, 2]);
	});

	it("reports that the document order is not preserved for that shape", () => {
		const resolved = new XsdResolver().resolve(new XsdParser().parseFile(path.join(FIXTURES, FIXTURE)));

		expect((resolved.coverageNotes ?? []).join("\n")).toContain("key, value");
	});

	it("still writes valid XML, just regrouped", async () => {
		const Settings = await loadSettings();
		const serializer = new XmlDecoratorSerializer();
		const xml = serializer.toXml(serializer.fromXml(REPEATED, Settings));

		expect([...xml.matchAll(/<(key|value)>/g)].map((m) => m[1])).toEqual(["key", "key", "value", "value"]);
	});
});

/** The same repeating group ref, with members a written value *can* be told apart by. */
describe("repeating xs:group ref with distinguishable members", () => {
	const AUDIT = `<Audit>
	<who>ada</who><when>1</when>
	<who>alan</who><when>2</when>
</Audit>`;

	beforeEach(() => {
		rmSync(TMP_DIR, { recursive: true, force: true });
		mkdirSync(TMP_DIR, { recursive: true });
		const resolved = new XsdResolver().resolve(new XsdParser().parseFile(path.join(FIXTURES, FIXTURE)));
		writeGeneratedFiles(TMP_DIR, new ClassGenerator({ xsdPath: FIXTURE }).generatePerType(resolved));
	});

	afterEach(() => {
		if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
	});

	async function loadAudit(): Promise<any> {
		const mod = await import(/* @vite-ignore */ path.join(TMP_DIR, "audit.ts"));
		return mod.Audit;
	}

	it("collects the repeated group into one ordered collection", async () => {
		const Audit = await loadAudit();
		const audit = new XmlDecoratorSerializer().fromXml(AUDIT, Audit);

		expect(audit.items).toEqual(["ada", 1, "alan", 2]);
	});

	it("writes the group's elements back in document order", async () => {
		const Audit = await loadAudit();
		const serializer = new XmlDecoratorSerializer();
		const xml = serializer.toXml(serializer.fromXml(AUDIT, Audit));

		expect([...xml.matchAll(/<(who|when)>/g)].map((m) => m[1])).toEqual(["who", "when", "who", "when"]);
	});
});
