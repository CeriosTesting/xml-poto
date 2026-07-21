/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

/**
 * Regression tests for the P1 divergence: attributes are never in the default
 * namespace. A namespaced attribute without a prefix must NOT hijack the document
 * default namespace; C# synthesizes a prefix instead.
 */
describe("Attribute namespace serialization", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it("should synthesize a prefix for a namespaced attribute with no prefix", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlAttribute({ name: "id", namespace: { uri: "http://example.com/attr" } })
			id: string = "";

			@XmlElement({ name: "child" })
			child: string = "";
		}

		const root = new Root();
		root.id = "123";
		root.child = "x";

		const xml = serializer.toXml(root);

		// The attribute is qualified with a synthesized prefix and its declaration
		expect(xml).toMatch(/<Root\s+d[0-9a-z]+:id="123"/);
		expect(xml).toMatch(/xmlns:d[0-9a-z]+="http:\/\/example\.com\/attr"/);
		// It must NOT hijack the document default namespace
		expect(xml).not.toContain('xmlns="http://example.com/attr"');
		// Root stays in no namespace
		expect(xml).not.toMatch(/<Root[^>]*\sxmlns=/);
	});

	it("should keep an explicit attribute prefix and declare it (no default-ns hijack)", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlAttribute({ name: "id", namespace: { uri: "http://example.com/attr", prefix: "a" } })
			id: string = "";
		}

		const root = new Root();
		root.id = "123";

		const xml = serializer.toXml(root);

		expect(xml).toContain('a:id="123"');
		expect(xml).toContain('xmlns:a="http://example.com/attr"');
		expect(xml).not.toContain('xmlns="http://example.com/attr"');
	});

	it("should leave an attribute with no namespace unqualified", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlAttribute({ name: "id" })
			id: string = "";
		}

		const root = new Root();
		root.id = "123";

		const xml = serializer.toXml(root);
		expect(xml).toContain('id="123"');
		expect(xml).not.toMatch(/:id="123"/);
	});

	it("should declare a nested element's attribute namespace on that element", () => {
		@XmlElement({ name: "Child" })
		class Child {
			@XmlAttribute({ name: "code", namespace: { uri: "http://example.com/c", prefix: "c" } })
			code: string = "";
		}

		@XmlRoot({ name: "Root" })
		class Root {
			@XmlElement({ name: "Child" })
			child: Child = new Child();
		}

		const root = new Root();
		root.child.code = "9";

		const xml = serializer.toXml(root);
		// The prefix is declared where the attribute lives (not left undeclared)
		expect(xml).toMatch(/<Child[^>]*\sc:code="9"/);
		expect(xml).toContain('xmlns:c="http://example.com/c"');
	});
});
