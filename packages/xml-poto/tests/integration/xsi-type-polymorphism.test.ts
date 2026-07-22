/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlArray } from "../../src/decorators/xml-array";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlInclude } from "../../src/decorators/xml-include";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlType } from "../../src/decorators/xml-type";

const NS = "urn:shapes";

// ── Polymorphic hierarchy ──────────────────────────────────────────────
@XmlType({ name: "Shape", namespace: { uri: NS, prefix: "s" } })
@XmlInclude(() => Circle, () => Square)
class Shape {
	@XmlElement({ name: "id" })
	id!: string;
}

@XmlType({ name: "Circle", namespace: { uri: NS, prefix: "s" } })
class Circle extends Shape {
	@XmlElement({ name: "radius" })
	radius!: number;
}

@XmlType({ name: "Square", namespace: { uri: NS, prefix: "s" } })
class Square extends Shape {
	@XmlElement({ name: "side" })
	side!: number;
}

@XmlType({ name: "Unrelated", namespace: { uri: NS, prefix: "s" } })
class Unrelated {
	@XmlElement({ name: "x" })
	x!: string;
}

@XmlRoot({ name: "Drawing", namespace: { uri: NS, prefix: "s" } })
class Drawing {
	@XmlElement({ name: "shape", type: () => Shape })
	shape!: Shape;
}

@XmlRoot({ name: "Gallery", namespace: { uri: NS, prefix: "s" } })
class Gallery {
	@XmlArray({ itemName: "shape", type: () => Shape, form: "qualified" })
	shapes!: Shape[];
}

describe("xsi:type polymorphic deserialization", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer({ useXsiType: true });
	});

	it("deserializes a base-typed property to the concrete subtype named by xsi:type", () => {
		const xml =
			`<s:Drawing xmlns:s="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<s:shape xsi:type="s:Circle"><s:id>c1</s:id><s:radius>5</s:radius></s:shape>` +
			`</s:Drawing>`;

		const result = serializer.fromXml(xml, Drawing);

		expect(result.shape).toBeInstanceOf(Circle);
		expect((result.shape as Circle).radius).toBe(5);
		expect(result.shape.id).toBe("c1");
	});

	it("round-trips a polymorphic property (serialize derived + xsi:type, deserialize back)", () => {
		const drawing = new Drawing();
		const circle = new Circle();
		circle.id = "c1";
		circle.radius = 7;
		drawing.shape = circle;

		const xml = serializer.toXml(drawing);
		expect(xml).toContain('xsi:type="s:Circle"');

		const back = serializer.fromXml(xml, Drawing);
		expect(back.shape).toBeInstanceOf(Circle);
		expect((back.shape as Circle).radius).toBe(7);
	});

	it("round-trips a polymorphic array with mixed concrete item types", () => {
		const gallery = new Gallery();
		const circle = new Circle();
		circle.id = "c";
		circle.radius = 3;
		const square = new Square();
		square.id = "sq";
		square.side = 4;
		gallery.shapes = [circle, square];

		const xml = serializer.toXml(gallery);
		expect(xml).toContain('xsi:type="s:Circle"');
		expect(xml).toContain('xsi:type="s:Square"');

		const back = serializer.fromXml(xml, Gallery);
		expect(back.shapes).toHaveLength(2);
		expect(back.shapes[0]).toBeInstanceOf(Circle);
		expect(back.shapes[1]).toBeInstanceOf(Square);
		expect((back.shapes[0] as Circle).radius).toBe(3);
		expect((back.shapes[1] as Square).side).toBe(4);
	});

	it("resolves xsi:type by namespace URI even when the document uses a different prefix", () => {
		// Foreign prefix "foo" bound to the shapes namespace on the element itself.
		const xml =
			`<s:Drawing xmlns:s="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<s:shape xmlns:foo="${NS}" xsi:type="foo:Square"><s:id>x</s:id><s:side>9</s:side></s:shape>` +
			`</s:Drawing>`;

		const result = serializer.fromXml(xml, Drawing);

		expect(result.shape).toBeInstanceOf(Square);
		expect((result.shape as Square).side).toBe(9);
	});

	it("falls back to the declared type when xsi:type names an unknown type", () => {
		const xml =
			`<s:Drawing xmlns:s="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<s:shape xsi:type="s:Triangle"><s:id>t1</s:id></s:shape>` +
			`</s:Drawing>`;

		const result = serializer.fromXml(xml, Drawing);

		// Unknown type → the declared Shape is used (never redirected).
		expect(result.shape).toBeInstanceOf(Shape);
		expect(result.shape).not.toBeInstanceOf(Circle);
		expect(result.shape.id).toBe("t1");
	});

	it("reports a non-subtype xsi:type under strict validation and ignores it under 'off'", () => {
		const xml =
			`<s:Drawing xmlns:s="${NS}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<s:shape xsi:type="s:Unrelated"><s:id>u1</s:id></s:shape>` +
			`</s:Drawing>`;

		// Strict (default): a resolved-but-non-subtype xsi:type is a schema inconsistency.
		expect(() => serializer.fromXml(xml, Drawing)).toThrow(/not a subtype/);

		// Off: ignore the mismatch and keep the declared type.
		const lenient = new XmlDecoratorSerializer({ useXsiType: true, validationMode: "off" });
		const result = lenient.fromXml(xml, Drawing);
		expect(result.shape).toBeInstanceOf(Shape);
		expect(result.shape).not.toBeInstanceOf(Unrelated as any);
	});
});
