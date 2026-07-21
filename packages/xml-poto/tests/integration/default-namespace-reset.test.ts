/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with inline decorated classes */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

/**
 * Regression tests for the P2 divergence: a nested element whose type is in NO
 * namespace, nested under a default-namespace ancestor, must be reset with
 * xmlns="" so it is not pulled into the ancestor namespace (matching C#).
 */
describe('Default namespace reset (xmlns="")', () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	it('should emit xmlns="" on a namespace-free nested type under a default-namespace root', () => {
		@XmlElement({ name: "Detail" })
		class Detail {
			@XmlElement({ name: "code" })
			code: string = "";
		}

		@XmlRoot({ name: "Root", namespace: { uri: "http://example.com/root" } })
		class Root {
			@XmlElement({ name: "Detail" })
			detail: Detail = new Detail();
		}

		const root = new Root();
		root.detail.code = "42";

		const xml = serializer.toXml(root);

		expect(xml).toContain('xmlns="http://example.com/root"');
		// The namespace-free nested element resets the default namespace
		expect(xml).toMatch(/<Detail xmlns="">/);
		expect(xml).toContain("<code>42</code>");
	});

	it("should NOT reset a nested type that shares the ancestor default namespace", () => {
		const ns = { uri: "http://example.com/root" };

		@XmlElement({ name: "Detail", namespace: ns })
		class Detail {
			@XmlElement({ name: "code" })
			code: string = "";
		}

		@XmlRoot({ name: "Root", namespace: ns })
		class Root {
			@XmlElement({ name: "Detail" })
			detail: Detail = new Detail();
		}

		const root = new Root();
		root.detail.code = "7";

		const xml = serializer.toXml(root);

		// Same default namespace inherited — no reset, declared once
		expect(xml).not.toContain('xmlns=""');
		expect(xml.match(/xmlns="http:\/\/example\.com\/root"/g)?.length).toBe(1);
	});

	it("should not reset primitive children (they inherit the default namespace)", () => {
		@XmlRoot({ name: "Root", namespace: { uri: "http://example.com/root" } })
		class Root {
			@XmlElement({ name: "title" })
			title: string = "";
		}

		const root = new Root();
		root.title = "hello";

		const xml = serializer.toXml(root);
		expect(xml).not.toContain('xmlns=""');
		expect(xml).toContain("<title>hello</title>");
	});
});
