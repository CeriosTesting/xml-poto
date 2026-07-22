/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlArray } from "../../src/decorators/xml-array";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlType } from "../../src/decorators/xml-type";

const NS = "http://www.competent.nl/gbav/v1";
const OTHER_NS = "http://example.com/other";

/**
 * XML identifies an element by {namespace-uri, local-name}; the prefix is only a
 * document-local alias. Deserialization used to match on the literal prefixed
 * string, so a peer answering with `ns2:` or a default `xmlns=` — as JAX-WS
 * routinely does — could not be read at all.
 */
describe("Namespace prefix independence on deserialization", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	@XmlType({ name: "identificatie" })
	class Identificatie {
		@XmlElement({ name: "indicatie", required: true })
		indicatie: string = "";

		@XmlElement({ name: "gebruiker" })
		gebruiker?: string;
	}

	@XmlRoot({ name: "gbavAntwoord", namespace: { uri: NS, prefix: "tns" } })
	class GbavAntwoord {
		@XmlElement({ name: "identificatie", required: true, type: Identificatie })
		identificatie: Identificatie = new Identificatie();
	}

	const body = "<identificatie><indicatie>AFN</indicatie><gebruiker>ronald</gebruiker></identificatie>";

	const documents: Record<string, string> = {
		"the WSDL's own prefix": `<tns:gbavAntwoord xmlns:tns="${NS}">${body}</tns:gbavAntwoord>`,
		"a different prefix": `<ns2:gbavAntwoord xmlns:ns2="${NS}">${body}</ns2:gbavAntwoord>`,
		"a default namespace": `<gbavAntwoord xmlns="${NS}">${body}</gbavAntwoord>`,
	};

	it.each(Object.keys(documents))("reads a document declaring %s", (spelling) => {
		const parsed = serializer.fromXml(documents[spelling], GbavAntwoord);

		expect(parsed.identificatie.indicatie).toBe("AFN");
		expect(parsed.identificatie.gebruiker).toBe("ronald");
	});

	it("produces the same object for every spelling", () => {
		const results = Object.values(documents).map((xml) => JSON.stringify(serializer.fromXml(xml, GbavAntwoord)));

		expect(new Set(results).size).toBe(1);
	});

	it("reads qualified children even when the class declares its members unqualified", () => {
		// The service may qualify locals that our schema left unqualified. Reading
		// stays tolerant; only writing follows the schema.
		const xml =
			`<ns2:gbavAntwoord xmlns:ns2="${NS}">` +
			`<ns2:identificatie><ns2:indicatie>AFN</ns2:indicatie></ns2:identificatie>` +
			`</ns2:gbavAntwoord>`;

		const parsed = serializer.fromXml(xml, GbavAntwoord);

		expect(parsed.identificatie.indicatie).toBe("AFN");
	});

	it("still rejects a root element from a genuinely different namespace", () => {
		const xml = `<gbavAntwoord xmlns="${OTHER_NS}">${body}</gbavAntwoord>`;

		expect(() => serializer.fromXml(xml, GbavAntwoord)).toThrow(/not found in XML/);
	});
});

/**
 * A single-item array is ordinary data (one persoon, one categorie, one rubriek).
 * When the item tag was namespace-prefixed, the lookup used the bare name, missed,
 * and the element fell through to the scalar path — yielding a bare object instead
 * of a one-element array, with no error.
 */
describe("Single-item array deserialization with namespaced item names", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	@XmlType({ name: "rubriek", namespace: { uri: NS, prefix: "tns" } })
	class Rubriek {
		@XmlElement({ name: "nummer", form: "qualified" })
		nummer: string = "";
	}

	@XmlRoot({ name: "rubrieken", namespace: { uri: NS, prefix: "tns" } })
	class Rubrieken {
		@XmlArray({ itemName: "rubriek", type: Rubriek, namespace: { uri: NS, prefix: "tns" }, form: "qualified" })
		rubriek?: Rubriek[];
	}

	it.each([1, 2, 3])("keeps an unwrapped array of %i qualified item(s) an array", (count) => {
		const rubrieken = new Rubrieken();
		rubrieken.rubriek = [];
		for (let i = 0; i < count; i++) {
			const rubriek = new Rubriek();
			rubriek.nummer = `011${i}`;
			rubrieken.rubriek.push(rubriek);
		}

		const xml = serializer.toXml(rubrieken);
		const parsed = serializer.fromXml(xml, Rubrieken);

		expect(Array.isArray(parsed.rubriek)).toBe(true);
		expect(parsed.rubriek).toHaveLength(count);
		expect(parsed.rubriek![0].nummer).toBe("0110");
	});

	it("reads a single item spelled with a different prefix", () => {
		const xml = `<ns2:rubrieken xmlns:ns2="${NS}"><ns2:rubriek><ns2:nummer>0110</ns2:nummer></ns2:rubriek></ns2:rubrieken>`;

		const parsed = serializer.fromXml(xml, Rubrieken);

		expect(Array.isArray(parsed.rubriek)).toBe(true);
		expect(parsed.rubriek).toHaveLength(1);
		expect(parsed.rubriek![0].nummer).toBe("0110");
	});
});
