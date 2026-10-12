/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { SoapSerializer, XmlElement, XmlRoot, XmlSerializer } from "../../src";
import { getMetadata } from "../../src/decorators";
import { XmlNamespaceUtil } from "../../src/utils/xml-namespace-util";

const NS = "urn:example:statement:v1";
const XSI = "http://www.w3.org/2001/XMLSchema-instance";
const EXT = "urn:example:extension:v1";

/** Shaped like a codegen root: default target namespace, qualified child. */
@XmlRoot({ name: "Statement", namespace: { uri: NS } })
class Statement {
	@XmlElement({ name: "Value", namespace: { uri: NS } })
	value: string = "sample";
}

/** The workaround the option replaces: a subclass redeclaring the root. */
@XmlRoot({ name: "Statement", namespace: { uri: NS }, namespaces: [{ prefix: "xsi", uri: XSI }] })
class WrappedStatement extends Statement {}

@XmlRoot({ name: "Entry", namespace: { uri: NS, prefix: "st" } })
class PrefixedEntry {
	@XmlElement({ name: "Value", namespace: { uri: NS, prefix: "st" } })
	value: string = "sample";
}

@XmlRoot({ name: "Record", namespace: { uri: NS } })
class NillableRecord {
	@XmlElement({ name: "Note", namespace: { uri: NS }, isNullable: true })
	note: string | null = null;
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("additionalRootNamespaces", () => {
	describe("declaring on an unmodified root", () => {
		it("adds xmlns:xsi and changes nothing else", () => {
			const plain = new XmlSerializer().toXml(new Statement());
			const extended = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "xsi", uri: XSI }],
			}).toXml(new Statement());

			expect(plain).not.toContain("xmlns:xsi=");
			expect(extended).toContain(`<Statement xmlns="${NS}" xmlns:xsi="${XSI}">`);
			expect(extended.replace(` xmlns:xsi="${XSI}"`, "")).toBe(plain);
		});

		it("matches the decorated-subclass workaround", () => {
			const viaOption = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "xsi", uri: XSI }],
			}).toXml(new Statement());

			expect(viaOption).toBe(new XmlSerializer().toXml(new WrappedStatement()));
		});

		it("emits a declaration whose prefix nothing uses", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "ext", uri: EXT }],
			}).toXml(new Statement());

			expect(xml).toContain(`xmlns:ext="${EXT}"`);
		});

		it("keeps several declarations in the given order", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [
					{ prefix: "xsi", uri: XSI },
					{ prefix: "ext", uri: EXT },
				],
			}).toXml(new Statement());

			expect(xml).toContain(`<Statement xmlns="${NS}" xmlns:xsi="${XSI}" xmlns:ext="${EXT}">`);
		});

		it("still round-trips", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "ext", uri: EXT }],
			}).toXml(new Statement());

			expect(new XmlSerializer().fromXml(xml, Statement).value).toBe("sample");
		});
	});

	describe("deduplication", () => {
		it("declares xsi once when the model already does", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "xsi", uri: XSI }],
			}).toXml(new WrappedStatement());

			expect(count(xml, "xmlns:xsi=")).toBe(1);
		});

		it("declares xsi once when xsi:nil already pulls it in", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "xsi", uri: XSI }],
			}).toXml(new NillableRecord());

			expect(xml).toContain('xsi:nil="true"');
			expect(count(xml, "xmlns:xsi=")).toBe(1);
		});

		it("declares xsi once alongside schemaLocation", () => {
			const xml = new XmlSerializer({
				schemaLocation: { [NS]: "statement.xsd" },
				additionalRootNamespaces: [{ prefix: "xsi", uri: XSI }],
			}).toXml(new Statement());

			expect(xml).toContain(`xsi:schemaLocation="${NS} statement.xsd"`);
			expect(count(xml, "xmlns:xsi=")).toBe(1);
		});

		it("accepts a model prefix repeated with the same URI", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "st", uri: NS }],
			}).toXml(new PrefixedEntry());

			expect(count(xml, "xmlns:st=")).toBe(1);
		});

		it("collapses identical entries in the list", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [
					{ prefix: "ext", uri: EXT },
					{ prefix: "ext", uri: EXT },
				],
			}).toXml(new Statement());

			expect(count(xml, "xmlns:ext=")).toBe(1);
		});
	});

	describe("conflicts", () => {
		it("throws when a model prefix would be rebound", () => {
			const serializer = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "st", uri: EXT }],
			});

			expect(() => serializer.toXml(new PrefixedEntry())).toThrow(/prefix "st" is already bound/);
		});

		it.each([
			["xsi bound elsewhere", [{ prefix: "xsi", uri: EXT }], /reserved/],
			["xml bound elsewhere", [{ prefix: "xml", uri: EXT }], /reserved/],
			["the xmlns prefix", [{ prefix: "xmlns", uri: EXT }], /reserved/],
			[
				"the XML namespace under another prefix",
				[{ prefix: "x", uri: "http://www.w3.org/XML/1998/namespace" }],
				/reserved/,
			],
			["a missing prefix", [{ uri: EXT }], /needs a prefix/],
			["an empty uri", [{ prefix: "ext", uri: "" }], /non-empty uri/],
			["an invalid prefix", [{ prefix: "e:x", uri: EXT }], /not a valid namespace prefix/],
			[
				"conflicting entries",
				[
					{ prefix: "ext", uri: EXT },
					{ prefix: "ext", uri: NS },
				],
				/bound to both/,
			],
		])("rejects %s at construction", (_label, namespaces, message) => {
			expect(() => new XmlSerializer({ additionalRootNamespaces: namespaces as any })).toThrow(message);
		});

		it("treats the standard xml binding as a no-op", () => {
			const xml = new XmlSerializer({
				additionalRootNamespaces: [{ prefix: "xml", uri: "http://www.w3.org/XML/1998/namespace" }],
			}).toXml(new Statement());

			expect(xml).not.toContain("xmlns:xml=");
		});
	});

	describe("isolation", () => {
		it("does not leak into other serializers or model metadata", () => {
			const before = JSON.stringify(getMetadata(Statement).root);

			new XmlSerializer({ additionalRootNamespaces: [{ prefix: "ext", uri: EXT }] }).toXml(new Statement());

			expect(new XmlSerializer().toXml(new Statement())).not.toContain("xmlns:ext=");
			expect(JSON.stringify(getMetadata(Statement).root)).toBe(before);
			expect([...new XmlNamespaceUtil().collectAllNamespaces(new Statement()).keys()]).toEqual(["default"]);
		});

		it("ignores changes to the caller's array after construction", () => {
			const namespaces = [{ prefix: "ext", uri: EXT }];
			const serializer = new XmlSerializer({ additionalRootNamespaces: namespaces });
			namespaces[0].uri = "urn:example:changed";
			namespaces.push({ prefix: "other", uri: "urn:example:other" });

			const xml = serializer.toXml(new Statement());

			expect(xml).toContain(`xmlns:ext="${EXT}"`);
			expect(xml).not.toContain("xmlns:other=");
		});
	});

	describe("SoapSerializer", () => {
		it("declares on the payload root inside Body", () => {
			const xml = new SoapSerializer({
				additionalRootNamespaces: [{ prefix: "ext", uri: EXT }],
			}).toXml(new Statement());

			expect(xml).toContain(`<Statement xmlns="${NS}" xmlns:ext="${EXT}">`);
		});
	});
});
