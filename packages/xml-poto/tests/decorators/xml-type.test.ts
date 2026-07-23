/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { getMetadata } from "../../src/decorators/storage";
import { findElementClass, findTypeByQualifiedName } from "../../src/decorators/storage/metadata-storage";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlType } from "../../src/decorators/xml-type";

const NS = "http://example.com/type";

describe("@XmlType decorator", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it("should store type-identity metadata (name + namespace)", () => {
		@XmlType({ name: "Person", namespace: { uri: NS, prefix: "p" } })
		class Person {
			@XmlElement({ name: "name" })
			name!: string;
		}

		const meta = getMetadata(Person);
		expect(meta.xmlType?.name).toBe("Person");
		expect(meta.xmlType?.namespaces?.[0]).toEqual({ uri: NS, prefix: "p" });
		// It is type identity, not a wrapper element declaration
		expect(meta.element).toBeUndefined();
		expect(meta.root).toBeUndefined();
	});

	it("should default the type name to the class name", () => {
		@XmlType({ namespace: { uri: NS, prefix: "p" } })
		class Address {
			@XmlElement({ name: "city" })
			city!: string;
		}

		expect(getMetadata(Address).xmlType?.name).toBe("Address");
	});

	it("should derive root name/namespace from @XmlType when used as the document root", () => {
		@XmlType({ name: "Person", namespace: { uri: NS, prefix: "p" } })
		class Person {
			@XmlElement({ name: "name" })
			name!: string;
		}

		const person = new Person();
		person.name = "John";

		const xml = serializer.toXml(person);
		// Root uses the type identity and declares its namespace (no undeclared prefix)
		expect(xml).toContain("<p:Person");
		expect(xml).toContain(`xmlns:p="${NS}"`);
		// The member declares no namespace and no form, so it is unqualified —
		// @XmlType names the schema type, it does not qualify the type's members.
		// This matches elementFormDefault="unqualified" (the XSD default) and how
		// an @XmlRoot class already treats its own members.
		expect(xml).toContain("<name>John</name>");
		expect(xml).not.toContain("<p:name>");
	});

	it("should qualify a member from the @XmlType namespace when the member opts in with form", () => {
		@XmlType({ name: "Person", namespace: { uri: NS, prefix: "p" } })
		class Person {
			@XmlElement({ name: "name", form: "qualified" })
			name!: string;
		}

		const person = new Person();
		person.name = "John";

		const xml = serializer.toXml(person);
		// form: 'qualified' says "qualify me"; the type supplies the URI/prefix,
		// mirroring what xsd.exe emits for elementFormDefault="qualified".
		expect(xml).toContain("<p:name>John</p:name>");
	});

	// An XSD complexType declared inline on an element has no type name of its own.
	// Codegen still needs the class-level namespace fallback, but the `name` it can
	// supply is the *element's* — so the class must not answer lookups under it.
	describe("anonymous: true", () => {
		it("should keep the name/namespace metadata, which stays the members' fallback", () => {
			@XmlType({ name: "Shipping", anonymous: true, namespace: { uri: NS, prefix: "p" } })
			class OrderShipping {
				@XmlElement({ name: "carrier", form: "qualified" })
				carrier!: string;
			}

			expect(getMetadata(OrderShipping).xmlType?.name).toBe("Shipping");

			const shipping = new OrderShipping();
			shipping.carrier = "PostNL";

			const xml = serializer.toXml(shipping);
			expect(xml).toContain("<p:Shipping");
			expect(xml).toContain("<p:carrier>PostNL</p:carrier>");
		});

		it("should not register the element name for auto-discovery", () => {
			@XmlType({ name: "Tracking", anonymous: true, namespace: { uri: NS, prefix: "p" } })
			class OrderTracking {
				@XmlElement({ name: "code" })
				code!: string;
			}

			expect(OrderTracking).toBeDefined();
			expect(findElementClass("p:Tracking")).toBeUndefined();
		});

		it("should not resolve an xsi:type naming it", () => {
			@XmlType({ name: "Handling", anonymous: true, namespace: { uri: NS, prefix: "p" } })
			class OrderHandling {
				@XmlElement({ name: "code" })
				code!: string;
			}

			expect(OrderHandling).toBeDefined();
			expect(findTypeByQualifiedName(NS, "Handling")).toBeUndefined();
		});

		it("should leave a named type of the same name in possession of both registries", () => {
			@XmlType({ name: "Delivery", namespace: { uri: NS, prefix: "p" } })
			class DeliveryType {
				@XmlElement({ name: "eta" })
				eta!: string;
			}

			// Declared second: without the guard this would overwrite the entry above,
			// since registerElementClass is last-writer-wins.
			@XmlType({ name: "Delivery", anonymous: true, namespace: { uri: NS, prefix: "p" } })
			class OrderDelivery {
				@XmlElement({ name: "slot" })
				slot!: string;
			}

			expect(OrderDelivery).toBeDefined();
			expect(findElementClass("p:Delivery")).toBe(DeliveryType);
			expect(findTypeByQualifiedName(NS, "Delivery")).toBe(DeliveryType);
		});
	});
});
