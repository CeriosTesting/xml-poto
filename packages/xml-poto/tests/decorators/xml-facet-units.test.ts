/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { XmlDecoratorSerializer, XmlElement, XmlRoot, XmlText } from "../../src";

describe("bounds facets on ordered non-numeric types", () => {
	@XmlRoot({ name: "Booking" })
	class Booking {
		// The canonical lexical form of xs:date sorts chronologically as a string,
		// which is what makes a string bound work without parsing dates.
		@XmlElement({ name: "day", dataType: "xs:date", minInclusive: "2000-01-01", maxInclusive: "2029-12-31" })
		day: string = "";
	}

	const serializer = new XmlDecoratorSerializer();

	it("rejects a date below minInclusive", () => {
		expect(() => serializer.fromXml("<Booking><day>1999-12-31</day></Booking>", Booking)).toThrow(
			/less than minInclusive 2000-01-01/,
		);
	});

	it("rejects a date above maxInclusive", () => {
		expect(() => serializer.fromXml("<Booking><day>2030-01-01</day></Booking>", Booking)).toThrow(
			/greater than maxInclusive 2029-12-31/,
		);
	});

	it("accepts a date inside the range, including the bounds themselves", () => {
		expect(serializer.fromXml("<Booking><day>2000-01-01</day></Booking>", Booking).day).toBe("2000-01-01");
		expect(serializer.fromXml("<Booking><day>2015-06-30</day></Booking>", Booking).day).toBe("2015-06-30");
		expect(serializer.fromXml("<Booking><day>2029-12-31</day></Booking>", Booking).day).toBe("2029-12-31");
	});

	it("still compares numerically when both sides are numbers", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			// "9" > "10" lexically, so a numeric bound must not be compared as text.
			@XmlElement({ name: "n", minInclusive: 10 })
			n: number = 0;
		}

		expect(() => serializer.fromXml("<Doc><n>9</n></Doc>", Doc)).toThrow(/less than minInclusive 10/);
		expect(serializer.fromXml("<Doc><n>10</n></Doc>", Doc).n).toBe(10);
	});

	it("honours exclusive string bounds", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ name: "day", dataType: "xs:date", minExclusive: "2000-01-01" })
			day: string = "";
		}

		expect(() => serializer.fromXml("<Doc><day>2000-01-01</day></Doc>", Doc)).toThrow(/not greater than minExclusive/);
		expect(serializer.fromXml("<Doc><day>2000-01-02</day></Doc>", Doc).day).toBe("2000-01-02");
	});
});

describe("xs:length units", () => {
	const serializer = new XmlDecoratorSerializer();

	it("counts characters, not UTF-16 code units", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlElement({ name: "s", length: 3 })
			s: string = "";
		}

		// Three code points, but five UTF-16 units — two of these are astral.
		expect(serializer.fromXml("<Doc><s>a\u{1F600}\u{1F601}</s></Doc>", Doc).s).toBe("a\u{1F600}\u{1F601}");
		expect(() => serializer.fromXml("<Doc><s>ab</s></Doc>", Doc)).toThrow(/exactly 3/);
	});

	it("counts octets for xs:hexBinary", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlText({ dataType: "xs:hexBinary", length: 4 })
			data: string = "";
		}

		// 8 hex digits = 4 octets
		expect(serializer.fromXml("<Doc>DEADBEEF</Doc>", Doc).data).toBe("DEADBEEF");
		expect(() => serializer.fromXml("<Doc>DEAD</Doc>", Doc)).toThrow(/octet count 2, expected exactly 4/);
	});

	it("counts octets for xs:base64Binary", () => {
		@XmlRoot({ name: "Doc" })
		class Doc {
			@XmlText({ dataType: "xs:base64Binary", maxLength: 3 })
			data: string = "";
		}

		// "YWJj" is 3 octets ("abc"); "YWJjZA==" is 4.
		expect(serializer.fromXml("<Doc>YWJj</Doc>", Doc).data).toBe("YWJj");
		expect(() => serializer.fromXml("<Doc>YWJjZA==</Doc>", Doc)).toThrow(/octet count 4, expected at most 3/);
	});
});
