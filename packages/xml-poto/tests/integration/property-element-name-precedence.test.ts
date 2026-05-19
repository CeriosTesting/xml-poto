import { beforeEach, describe, expect, it } from "vitest";

import { XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("Property-level @XmlElement name precedence over class-level name", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	@XmlElement({ name: "DateRange_Type" })
	class DateRange {
		@XmlElement({ name: "from", required: true, order: 1 })
		from: string = "";

		@XmlElement({ name: "to", required: true, order: 2 })
		to: string = "";
	}

	@XmlRoot({ name: "Booking" })
	class Booking {
		@XmlElement({ name: "id", required: true, order: 1 })
		id: string = "";

		@XmlElement({ name: "range", required: true, order: 2, type: DateRange })
		range: DateRange = new DateRange();

		@XmlElement({ name: "window", required: true, order: 3, type: DateRange })
		window: DateRange = new DateRange();
	}

	function makeBooking(): Booking {
		const b = new Booking();
		b.id = "B-1";
		b.range.from = "2025-01-01";
		b.range.to = "2025-01-02";
		b.window.from = "2025-02-01";
		b.window.to = "2025-02-02";
		return b;
	}

	it("serializes the property-level name, not the class-level name, when they collide with the property key", () => {
		const xml = serializer.toXml(makeBooking());

		expect(xml).toContain("<range>");
		expect(xml).toContain("</range>");
		expect(xml).not.toContain("<DateRange_Type");
		expect(xml).not.toContain("</DateRange_Type>");
	});

	it("serializes the property-level name when the property key differs from it", () => {
		const xml = serializer.toXml(makeBooking());

		expect(xml).toContain("<window>");
		expect(xml).toContain("</window>");
	});

	it("round-trips: parse → serialize produces the same XML and populates fields", () => {
		const original = makeBooking();
		const xml1 = serializer.toXml(original);

		const parsed = serializer.fromXml(xml1, Booking);

		expect(parsed.id).toBe("B-1");
		expect(parsed.range).toBeInstanceOf(DateRange);
		expect(parsed.range.from).toBe("2025-01-01");
		expect(parsed.range.to).toBe("2025-01-02");
		expect(parsed.window).toBeInstanceOf(DateRange);
		expect(parsed.window.from).toBe("2025-02-01");
		expect(parsed.window.to).toBe("2025-02-02");

		const xml2 = serializer.toXml(parsed);
		expect(xml2).toBe(xml1);
	});
});
