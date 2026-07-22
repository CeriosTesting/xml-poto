/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlText } from "../../src/decorators/xml-text";

/**
 * A member's declared `dataType` decides the TypeScript type its value comes back
 * as. Without it a numeric or boolean **attribute** deserialized as a string —
 * and `"false"` is truthy, so `if (doc.draft)` was true when the XML said false.
 *
 * Elements largely escaped that because the parser auto-parses tag values, but
 * not entirely: `007` is not a canonical number so it stayed a string, and the
 * `xs:boolean` lexical forms `1`/`0` arrived as numbers the boolean branch never
 * saw.
 */
describe("dataType coercion", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	// ── xs:boolean across every lexical form and every member kind ─────────────

	describe("xs:boolean", () => {
		@XmlRoot({ name: "Flags" })
		class Flags {
			@XmlAttribute({ name: "attr", dataType: "xs:boolean" })
			attr?: boolean;

			@XmlElement({ name: "elem", dataType: "xs:boolean" })
			elem?: boolean;
		}

		@XmlRoot({ name: "Flag" })
		class TextFlag {
			@XmlText({ dataType: "xs:boolean" })
			value?: boolean;
		}

		// All four are valid xs:boolean lexical representations.
		const truthy = ["true", "1"];
		const falsy = ["false", "0"];

		it.each(truthy)("reads the attribute form %s as true", (lexical) => {
			const parsed = serializer.fromXml(`<Flags attr="${lexical}"/>`, Flags);

			expect(parsed.attr).toBe(true);
		});

		it.each(falsy)("reads the attribute form %s as false", (lexical) => {
			const parsed = serializer.fromXml(`<Flags attr="${lexical}"/>`, Flags);

			expect(parsed.attr).toBe(false);
		});

		it.each(truthy)("reads the element form %s as true", (lexical) => {
			const parsed = serializer.fromXml(`<Flags><elem>${lexical}</elem></Flags>`, Flags);

			expect(parsed.elem).toBe(true);
		});

		it.each(falsy)("reads the element form %s as false", (lexical) => {
			const parsed = serializer.fromXml(`<Flags><elem>${lexical}</elem></Flags>`, Flags);

			expect(parsed.elem).toBe(false);
		});

		it.each([...truthy, ...falsy])("reads the text-content form %s as a boolean", (lexical) => {
			const parsed = serializer.fromXml(`<Flag>${lexical}</Flag>`, TextFlag);

			expect(typeof parsed.value).toBe("boolean");
			expect(parsed.value).toBe(lexical === "true" || lexical === "1");
		});

		it("never yields the truthy string 'false'", () => {
			const parsed = serializer.fromXml(`<Flags attr="false"><elem>false</elem></Flags>`, Flags);

			// The regression that motivated this: `if (parsed.attr)` used to be true.
			expect(parsed.attr).not.toBe("false");
			expect(parsed.elem).not.toBe("false");
			expect([parsed.attr, parsed.elem].some(Boolean)).toBe(false);
		});

		it("round-trips a false value", () => {
			const flags = new Flags();
			flags.attr = false;
			flags.elem = false;

			const parsed = serializer.fromXml(serializer.toXml(flags), Flags);

			expect(parsed.attr).toBe(false);
			expect(parsed.elem).toBe(false);
		});
	});

	// ── numeric types ──────────────────────────────────────────────────────────

	describe("numeric types", () => {
		@XmlRoot({ name: "Numbers" })
		class Numbers {
			@XmlAttribute({ name: "count", dataType: "xs:int" })
			count?: number;

			@XmlElement({ name: "amount", dataType: "xs:decimal" })
			amount?: number;
		}

		it("reads a numeric attribute as a number", () => {
			const parsed = serializer.fromXml(`<Numbers count="42"/>`, Numbers);

			expect(parsed.count).toBe(42);
			expect(typeof parsed.count).toBe("number");
		});

		it("reads a non-canonical numeric element as a number", () => {
			// The parser leaves "007" a string because it is not canonical; the
			// declared xs:decimal says it means 7.
			const parsed = serializer.fromXml(`<Numbers><amount>007</amount></Numbers>`, Numbers);

			expect(parsed.amount).toBe(7);
		});

		it("reads negative and fractional values", () => {
			const parsed = serializer.fromXml(`<Numbers count="-5"><amount>3.25</amount></Numbers>`, Numbers);

			expect(parsed.count).toBe(-5);
			expect(parsed.amount).toBe(3.25);
		});

		it("leaves a non-numeric value untouched rather than producing NaN", () => {
			const parsed = serializer.fromXml(`<Numbers count="abc"/>`, Numbers);

			// Coercion never invents NaN — validation is what reports the mismatch.
			expect(parsed.count).toBe("abc");
			expect(Number.isNaN(parsed.count as any)).toBe(false);
		});

		it("leaves an empty value untouched rather than coercing it to 0", () => {
			const parsed = serializer.fromXml(`<Numbers count=""/>`, Numbers);

			expect(parsed.count).toBe("");
		});

		it("round-trips zero without losing it", () => {
			const numbers = new Numbers();
			numbers.count = 0;
			numbers.amount = 0;

			const parsed = serializer.fromXml(serializer.toXml(numbers), Numbers);

			expect(parsed.count).toBe(0);
			expect(parsed.amount).toBe(0);
		});
	});

	// ── string members must NOT be auto-parsed ─────────────────────────────────

	describe("string members keep their exact lexical value", () => {
		@XmlRoot({ name: "Codes" })
		class Codes {
			@XmlAttribute({ name: "id" })
			id?: string;

			@XmlElement({ name: "ref" })
			ref?: string;

			@XmlAttribute({ name: "flag" })
			flag?: string;
		}

		it("does not turn a numeric-looking string attribute into a number", () => {
			// The reason attributes are not blanket auto-parsed: an identifier like
			// "007" must survive as written.
			const parsed = serializer.fromXml(`<Codes id="007" flag="true"/>`, Codes);

			expect(parsed.id).toBe("007");
			expect(typeof parsed.id).toBe("string");
			expect(parsed.flag).toBe("true");
		});

		it("round-trips a leading-zero identifier unchanged", () => {
			const codes = new Codes();
			codes.id = "007";

			const xml = serializer.toXml(codes);
			const parsed = serializer.fromXml(xml, Codes);

			expect(xml).toContain('id="007"');
			expect(parsed.id).toBe("007");
		});
	});

	// ── enum tokens must survive verbatim ──────────────────────────────────────

	describe("enum members are never coerced", () => {
		@XmlRoot({ name: "Choice" })
		class Choice {
			// An xs:int-based enumeration: the tokens are still wire strings, and the
			// generated union type is '1' | '2', so coercing them to numbers would
			// break the declared type. Codegen suppresses dataType for enum members.
			@XmlAttribute({ name: "level", enumValues: ["1", "2"] })
			level?: string;

			@XmlElement({ name: "grade", enumValues: ["1", "2"] })
			grade?: string;
		}

		it("keeps a numeric-looking enum token a string", () => {
			const parsed = serializer.fromXml(`<Choice level="1"><grade>2</grade></Choice>`, Choice);

			expect(parsed.level).toBe("1");
			expect(parsed.grade).toBe("2");
		});
	});

	// ── absence of dataType is still respected ─────────────────────────────────

	describe("members without dataType", () => {
		@XmlRoot({ name: "Plain" })
		class Plain {
			@XmlAttribute({ name: "a" })
			a?: string;
		}

		it("leaves an attribute exactly as parsed", () => {
			const parsed = serializer.fromXml(`<Plain a="1"/>`, Plain);

			expect(parsed.a).toBe("1");
		});
	});

	// ── lexical forms that must survive verbatim ───────────────────────────────

	describe("xs:dateTime keeps its exact lexical form", () => {
		// xs:dateTime permits an optional timezone and fractional seconds. All are
		// distinct lexical forms of the same instant, and a peer that sent an offset
		// expects it back — so the value is carried as a string, never normalised.
		@XmlRoot({ name: "Stamp" })
		class Stamp {
			@XmlElement({ name: "at", dataType: "xs:dateTime" })
			at?: string;
		}

		it.each([
			"2026-07-21T09:00:00",
			"2026-07-21T09:00:00Z",
			"2026-07-21T09:00:00+02:00",
			"2026-07-21T09:00:00-05:00",
			"2026-07-21T09:00:00.123Z",
		])("round-trips %s unchanged", (lexical) => {
			const parsed = serializer.fromXml(`<Stamp><at>${lexical}</at></Stamp>`, Stamp);

			expect(parsed.at).toBe(lexical);
			expect(serializer.toXml(parsed)).toContain(`<at>${lexical}</at>`);
		});
	});

	describe("entity references and non-ASCII content", () => {
		@XmlRoot({ name: "Text" })
		class Text {
			@XmlElement({ name: "body" })
			body?: string;
		}

		it("decodes the five predefined entities and re-encodes on the way out", () => {
			const parsed = serializer.fromXml(`<Text><body>A&amp;B &lt;c&gt; &quot;d&quot;</body></Text>`, Text);

			expect(parsed.body).toBe('A&B <c> "d"');

			const xml = serializer.toXml(parsed);
			expect(xml).toContain("&amp;");
			expect(xml).toContain("&lt;");
			expect(serializer.fromXml(xml, Text).body).toBe('A&B <c> "d"');
		});

		it("round-trips non-ASCII characters losslessly", () => {
			const parsed = serializer.fromXml(`<Text><body>Jansen–Müller ë ü 日本 🎉</body></Text>`, Text);

			expect(parsed.body).toBe("Jansen–Müller ë ü 日本 🎉");
			expect(serializer.fromXml(serializer.toXml(parsed), Text).body).toBe("Jansen–Müller ë ü 日本 🎉");
		});
	});
});
