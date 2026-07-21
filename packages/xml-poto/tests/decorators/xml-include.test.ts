/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlInclude } from "../../src/decorators/xml-include";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlType } from "../../src/decorators/xml-type";

// A hierarchy in no namespace at all: registration falls back to the plain
// class name, so an unprefixed xsi:type still resolves to the subtype.
@XmlInclude(() => Bare)
class Unnamespaced {
	@XmlElement({ name: "id" })
	id!: string;
}

@XmlType({ name: "Bare" })
class Bare extends Unnamespaced {
	@XmlElement({ name: "extra" })
	extra!: string;
}

@XmlRoot({ name: "Holder" })
class Holder {
	@XmlElement({ name: "item", type: () => Unnamespaced })
	item!: Unnamespaced;
}

// A subtype whose identity comes from @XmlElement rather than @XmlType/@XmlRoot.
@XmlInclude(() => ElementIdentified)
class ElementBase {
	@XmlElement({ name: "id" })
	id!: string;
}

@XmlElement({ name: "ElementIdentified" })
class ElementIdentified extends ElementBase {
	@XmlElement({ name: "note" })
	note!: string;
}

@XmlRoot({ name: "ElementHolder" })
class ElementHolder {
	@XmlElement({ name: "item", type: () => ElementBase })
	item!: ElementBase;
}

describe("@XmlInclude type registration", () => {
	const serializer = new XmlDecoratorSerializer({ useXsiType: true });

	it("resolves an unprefixed xsi:type for an included type in no namespace", () => {
		const xml =
			`<Holder xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<item xsi:type="Bare"><id>a</id><extra>b</extra></item>` +
			`</Holder>`;

		const holder = serializer.fromXml(xml, Holder);

		expect(holder.item).toBeInstanceOf(Bare);
		expect((holder.item as Bare).extra).toBe("b");
	});

	it("derives an included type's identity from @XmlElement when it has no @XmlType", () => {
		const xml =
			`<ElementHolder xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<item xsi:type="ElementIdentified"><id>a</id><note>n</note></item>` +
			`</ElementHolder>`;

		const holder = serializer.fromXml(xml, ElementHolder);

		expect(holder.item).toBeInstanceOf(ElementIdentified);
		expect((holder.item as ElementIdentified).note).toBe("n");
	});

	it("falls back to the declared type when xsi:type names something unregistered", () => {
		const xml =
			`<Holder xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
			`<item xsi:type="NeverDeclared"><id>a</id></item>` +
			`</Holder>`;

		const holder = serializer.fromXml(xml, Holder);

		expect(holder.item).toBeInstanceOf(Unnamespaced);
		expect(holder.item.id).toBe("a");
	});
});
