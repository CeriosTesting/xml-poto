/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it, vi } from "vitest";

import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlRoot, XmlText } from "../../src";

describe("XSD Facets", () => {
	describe("element facets", () => {
		it("should throw on element pattern violation during deserialization", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[A-Z]{2}$/ })
				code: string = "";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><code>abc</code></Doc>", Doc)).toThrow(/does not match pattern/);
			expect(serializer.fromXml("<Doc><code>NL</code></Doc>", Doc).code).toBe("NL");
		});

		it("should throw on element enumValues violation during serialization", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ enumValues: ["red", "green"] })
				color: string = "red";
			}

			const serializer = new XmlDecoratorSerializer();
			const doc = new Doc();
			doc.color = "blue";
			expect(() => serializer.toXml(doc)).toThrow(/is not one of the allowed values/);

			doc.color = "green";
			expect(serializer.toXml(doc)).toContain("<color>green</color>");
		});

		it("should enforce minLength/maxLength/length on elements", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ minLength: 2, maxLength: 4 })
				name: string = "ab";

				@XmlElement({ length: 2 })
				iso: string = "NL";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><name>a</name><iso>NL</iso></Doc>", Doc)).toThrow(/at least 2/);
			expect(() => serializer.fromXml("<Doc><name>abcde</name><iso>NL</iso></Doc>", Doc)).toThrow(/at most 4/);
			expect(() => serializer.fromXml("<Doc><name>abc</name><iso>NLD</iso></Doc>", Doc)).toThrow(/exactly 2/);

			const doc = serializer.fromXml("<Doc><name>abc</name><iso>BE</iso></Doc>", Doc);
			expect(doc.name).toBe("abc");
			expect(doc.iso).toBe("BE");
		});

		it("should enforce numeric bounds facets", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ minInclusive: 0, maxInclusive: 100 })
				score: number = 0;

				@XmlElement({ minExclusive: 0, maxExclusive: 10 })
				rating: number = 5;
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><score>-1</score><rating>5</rating></Doc>", Doc)).toThrow(
				/less than minInclusive 0/,
			);
			expect(() => serializer.fromXml("<Doc><score>101</score><rating>5</rating></Doc>", Doc)).toThrow(
				/greater than maxInclusive 100/,
			);
			expect(() => serializer.fromXml("<Doc><score>50</score><rating>0</rating></Doc>", Doc)).toThrow(
				/not greater than minExclusive 0/,
			);
			expect(() => serializer.fromXml("<Doc><score>50</score><rating>10</rating></Doc>", Doc)).toThrow(
				/not less than maxExclusive 10/,
			);

			const doc = serializer.fromXml("<Doc><score>100</score><rating>9.5</rating></Doc>", Doc);
			expect(doc.score).toBe(100);
			expect(doc.rating).toBe(9.5);
		});

		it("should enforce totalDigits and fractionDigits", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ totalDigits: 5, fractionDigits: 2 })
				amount: number = 0;
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><amount>123456</amount></Doc>", Doc)).toThrow(/more than 5 total digits/);
			expect(() => serializer.fromXml("<Doc><amount>1.234</amount></Doc>", Doc)).toThrow(/more than 2 fraction digits/);
			expect(serializer.fromXml("<Doc><amount>123.45</amount></Doc>", Doc).amount).toBe(123.45);
		});

		it("should apply whiteSpace normalization before validation", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ whiteSpace: "collapse", pattern: /^[a-z]+ [a-z]+$/ })
				text: string = "";
			}

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml("<Doc><text>  hello\t\n   world  </text></Doc>", Doc);
			expect(doc.text).toBe("hello world");
		});
	});

	describe("attribute facets (extended)", () => {
		it("should keep existing pattern/enumValues attribute behavior (throws by default)", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlAttribute({ pattern: /^\d+$/ })
				id: string = "1";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml(`<Doc id="abc"/>`, Doc)).toThrow(/Invalid value 'abc' for attribute 'id'/);
			expect(serializer.fromXml(`<Doc id="42"/>`, Doc).id).toBe("42");
		});

		it("should enforce new facets on attributes", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlAttribute({ maxLength: 3 })
				tag: string = "";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml(`<Doc tag="abcd"/>`, Doc)).toThrow(/at most 3/);
			expect(serializer.fromXml(`<Doc tag="abc"/>`, Doc).tag).toBe("abc");
		});
	});

	describe("text facets", () => {
		it("should enforce facets on @XmlText content", () => {
			@XmlRoot({ name: "Code" })
			class Code {
				@XmlText({ pattern: /^[A-Z]+$/ })
				value: string = "";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Code>abc</Code>", Code)).toThrow(/does not match pattern/);
			expect(serializer.fromXml("<Code>ABC</Code>", Code).value).toBe("ABC");
		});
	});

	describe("fixedValue", () => {
		it("should use fixedValue as default when element is missing", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ fixedValue: "1.0" })
				version: string = "";

				@XmlElement()
				name: string = "";
			}

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml("<Doc><name>x</name></Doc>", Doc);
			expect(doc.version).toBe("1.0");
		});

		it("should throw when a value does not equal the fixed value", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ fixedValue: "v1" })
				version: string = "v1";
			}

			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><version>v2</version></Doc>", Doc)).toThrow(
				/does not equal the fixed value 'v1'/,
			);
			expect(serializer.fromXml("<Doc><version>v1</version></Doc>", Doc).version).toBe("v1");
		});

		it("should match numeric fixed values regardless of formatting", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ fixedValue: "1.0" })
				version: string = "1.0";
			}

			// The parser coerces "1.0" to 1; the fixed-value check compares numerically
			const serializer = new XmlDecoratorSerializer();
			expect(() => serializer.fromXml("<Doc><version>1.0</version></Doc>", Doc)).not.toThrow();
			expect(() => serializer.fromXml("<Doc><version>2.0</version></Doc>", Doc)).toThrow(
				/does not equal the fixed value '1.0'/,
			);
		});

		it("should serialize fixedValue for missing attribute values", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlAttribute({ fixedValue: "fixed" })
				kind?: string;
			}

			const serializer = new XmlDecoratorSerializer();
			expect(serializer.toXml(new Doc())).toContain(`kind="fixed"`);
		});
	});

	describe("validationMode", () => {
		it("should warn instead of throw with serializer validationMode 'warn'", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[A-Z]+$/ })
				code: string = "";
			}

			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const serializer = new XmlDecoratorSerializer({ validationMode: "warn" });
				const doc = serializer.fromXml("<Doc><code>abc</code></Doc>", Doc);
				expect(doc.code).toBe("abc");
				expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does not match pattern"));
			} finally {
				warnSpy.mockRestore();
			}
		});

		it("should skip validation entirely with validationMode 'off'", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[A-Z]+$/ })
				code: string = "";
			}

			const serializer = new XmlDecoratorSerializer({ validationMode: "off" });
			expect(serializer.fromXml("<Doc><code>abc</code></Doc>", Doc).code).toBe("abc");
		});

		it("should relax existing attribute pattern validation via validationMode", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlAttribute({ pattern: /^\d+$/ })
				id: string = "";
			}

			const serializer = new XmlDecoratorSerializer({ validationMode: "off" });
			expect(serializer.fromXml(`<Doc id="abc"/>`, Doc).id).toBe("abc");
		});
	});

	describe("validationModeOverrides", () => {
		it("should apply a per-rule override while other rules follow the global mode", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[a-z ]+$/, maxLength: 5 })
				code: string = "";
			}

			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			try {
				const serializer = new XmlDecoratorSerializer({
					validationModeOverrides: { pattern: "warn" },
				});

				// Violates only pattern → warns, keeps value
				const doc = serializer.fromXml("<Doc><code>UP</code></Doc>", Doc);
				expect(doc.code).toBe("UP");
				expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does not match pattern"));

				// Violates maxLength (not overridden) → still throws
				expect(() => serializer.fromXml("<Doc><code>toolongvalue</code></Doc>", Doc)).toThrow(/at most 5/);
			} finally {
				warnSpy.mockRestore();
			}
		});

		it("should still enforce other rules when one rule is 'off' and both are violated", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[a-z]+$/, maxLength: 5 })
				code: string = "";
			}

			const serializer = new XmlDecoratorSerializer({
				validationModeOverrides: { pattern: "off" },
			});

			// "TOOLONGVALUE" violates both pattern (off) and maxLength (strict)
			expect(() => serializer.fromXml("<Doc><code>TOOLONGVALUE</code></Doc>", Doc)).toThrow(/at most 5/);

			// Violating only the disabled rule passes
			expect(serializer.fromXml("<Doc><code>ABC</code></Doc>", Doc).code).toBe("ABC");
		});

		it("should let a per-rule override win over a lenient global validationMode", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ pattern: /^[A-Z]+$/ })
				code: string = "";
			}

			const serializer = new XmlDecoratorSerializer({
				validationMode: "off",
				validationModeOverrides: { pattern: "strict" },
			});
			expect(() => serializer.fromXml("<Doc><code>abc</code></Doc>", Doc)).toThrow(/does not match pattern/);
		});

		it("should relax the existing attribute pattern check per rule", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlAttribute({ pattern: /^\d+$/, maxLength: 10 })
				id: string = "";
			}

			const serializer = new XmlDecoratorSerializer({
				validationModeOverrides: { pattern: "off" },
			});
			expect(serializer.fromXml(`<Doc id="abc"/>`, Doc).id).toBe("abc");
		});

		it("should apply overrides to fixedValue independently", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ fixedValue: "v1" })
				version: string = "v1";
			}

			const serializer = new XmlDecoratorSerializer({
				validationModeOverrides: { fixedValue: "off" },
			});
			expect(serializer.fromXml("<Doc><version>v2</version></Doc>", Doc).version).toBe("v2");
		});
	});

	describe("dataType coercion", () => {
		it("should coerce optional untyped properties based on dataType", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlElement({ dataType: "xs:int" })
				count?: number;

				@XmlElement({ dataType: "xs:boolean" })
				active?: boolean;
			}

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml("<Doc><count>42</count><active>true</active></Doc>", Doc);
			expect(doc.count).toBe(42);
			expect(doc.active).toBe(true);
		});
	});
});
