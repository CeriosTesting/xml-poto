/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlArray } from "../../src/decorators/xml-array";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlType } from "../../src/decorators/xml-type";

const GBAV_NS = "http://www.competent.nl/gbav/v1";
const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";

/**
 * Regression tests for issue #96 case 2: when a property has an explicit name but
 * no namespace and the referenced class carries a namespace, the wrapper must be
 * qualified consistently with its children (no unqualified wrapper around prefixed
 * content), and the namespace must be declared once.
 */
describe("Nested namespace reconciliation", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it("should qualify the wrapper from the class namespace when the property omits it", () => {
		@XmlType({ name: "Identificatie", namespace: { uri: GBAV_NS, prefix: "tns" } })
		class Identificatie {
			@XmlElement({ name: "indicatie" })
			indicatie!: string;

			@XmlElement({ name: "gebruiker" })
			gebruiker!: string;
		}

		@XmlType({ name: "GbavAntwoord", namespace: { uri: GBAV_NS, prefix: "tns" } })
		class GbavAntwoord {
			@XmlElement({ name: "identificatie" })
			identificatie!: Identificatie;
		}

		@XmlRoot({ name: "Envelope", namespace: { uri: SOAP_NS, prefix: "S" } })
		class Envelope {
			@XmlElement({ name: "gbavAntwoord" })
			gbavAntwoord!: GbavAntwoord;
		}

		const envelope = new Envelope();
		envelope.gbavAntwoord = new GbavAntwoord();
		envelope.gbavAntwoord.identificatie = new Identificatie();
		envelope.gbavAntwoord.identificatie.indicatie = "802001";
		envelope.gbavAntwoord.identificatie.gebruiker = "xmlbevr";

		const xml = serializer.toXml(envelope);

		// One coherent shape: wrapper and children all qualified with tns
		expect(xml).toContain("<tns:gbavAntwoord");
		expect(xml).toContain("<tns:identificatie");
		expect(xml).toContain("<tns:indicatie>802001</tns:indicatie>");
		expect(xml).toContain("<tns:gebruiker>xmlbevr</tns:gebruiker>");

		// No unqualified wrapper around prefixed children
		expect(xml).not.toMatch(/<gbavAntwoord[\s>]/);
		expect(xml).not.toMatch(/<identificatie[\s>]/);

		// tns declared once (highest necessary point), not repeated per nested object
		expect(xml.match(/xmlns:tns=/g)?.length).toBe(1);
	});

	it("should qualify array container AND items consistently for complex items", () => {
		@XmlType({ name: "Rubriek", namespace: { uri: GBAV_NS, prefix: "tns" } })
		class Rubriek {
			@XmlElement({ name: "nummer" })
			nummer!: string;
		}

		@XmlRoot({ name: "Categorie", namespace: { uri: GBAV_NS, prefix: "tns" } })
		class Categorie {
			@XmlArray({
				containerName: "rubrieken",
				itemName: "rubriek",
				type: Rubriek,
				namespace: { uri: GBAV_NS, prefix: "tns" },
				form: "qualified",
			})
			rubrieken: Rubriek[] = [];
		}

		const categorie = new Categorie();
		const rubriek = new Rubriek();
		rubriek.nummer = "0120";
		categorie.rubrieken = [rubriek];

		const xml = serializer.toXml(categorie);

		// Container, item, and child all qualified with tns — one coherent shape
		expect(xml).toContain("<tns:rubrieken>");
		expect(xml).toContain("<tns:rubriek>");
		expect(xml).toContain("<tns:nummer>0120</tns:nummer>");
		// No bare (unqualified) container/item leaking through
		expect(xml).not.toMatch(/<rubrieken[\s>]/);
		expect(xml).not.toMatch(/<rubriek[\s>]/);
		// tns declared once
		expect(xml.match(/xmlns:tns=/g)?.length).toBe(1);

		// Round-trips
		const parsed = serializer.fromXml(xml, Categorie);
		expect(parsed.rubrieken).toHaveLength(1);
		expect(parsed.rubrieken[0].nummer).toBe("0120");
	});

	it("should let an explicit property namespace win over the class namespace", () => {
		@XmlType({ name: "Inner", namespace: { uri: GBAV_NS, prefix: "tns" } })
		class Inner {
			@XmlElement({ name: "value" })
			value!: string;
		}

		@XmlRoot({ name: "Root", namespace: { uri: "http://example.com/root", prefix: "r" } })
		class Root {
			@XmlElement({ name: "inner", namespace: { uri: "http://example.com/prop", prefix: "p" } })
			inner!: Inner;
		}

		const root = new Root();
		root.inner = new Inner();
		root.inner.value = "x";

		const xml = serializer.toXml(root);

		// Property namespace wins for the wrapper element name
		expect(xml).toContain("<p:inner");
		expect(xml).not.toContain("<tns:inner");
	});
});
