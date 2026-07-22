import { describe, expect, it } from "vitest";

import {
	EMPTY_NAMESPACE_SCOPE,
	extendNamespaceScope,
	findElementKey,
	resolveNamespaceUri,
	splitQName,
} from "../../src/utils/xml-element-lookup";

const NS = "http://www.competent.nl/gbav/v1";
const OTHER_NS = "http://example.com/other";

describe("splitQName", () => {
	it("splits a prefixed name into prefix and local name", () => {
		expect(splitQName("tns:gbavVraag")).toEqual({ prefix: "tns", localName: "gbavVraag" });
	});

	it("treats an unprefixed name as having an empty prefix", () => {
		expect(splitQName("gbavVraag")).toEqual({ prefix: "", localName: "gbavVraag" });
	});

	it("does not treat a leading colon as a prefix separator", () => {
		expect(splitQName(":odd")).toEqual({ prefix: "", localName: ":odd" });
	});
});

describe("extendNamespaceScope", () => {
	it("records a default namespace declaration under the empty prefix", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns": NS });
		expect(scope.get("")).toBe(NS);
	});

	it("records a prefixed namespace declaration under its prefix", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns:ns2": NS });
		expect(scope.get("ns2")).toBe(NS);
	});

	it("lets a nested declaration rebind a prefix without touching the outer scope", () => {
		const outer = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns:p": NS });
		const inner = extendNamespaceScope(outer, { "@_xmlns:p": OTHER_NS });

		expect(inner.get("p")).toBe(OTHER_NS);
		expect(outer.get("p")).toBe(NS);
	});

	it("returns the same scope object when the element declares nothing", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { child: "x" });
		expect(scope).toBe(EMPTY_NAMESPACE_SCOPE);
	});

	it("ignores non-object elements", () => {
		expect(extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, "text")).toBe(EMPTY_NAMESPACE_SCOPE);
	});
});

describe("resolveNamespaceUri", () => {
	it("resolves a prefixed name through its binding", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns:ns2": NS });
		expect(resolveNamespaceUri("ns2:gbavVraag", scope)).toBe(NS);
	});

	it("resolves an unprefixed name through the default namespace", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns": NS });
		expect(resolveNamespaceUri("gbavVraag", scope)).toBe(NS);
	});

	it("returns undefined when the prefix has no binding", () => {
		expect(resolveNamespaceUri("nope:gbavVraag", EMPTY_NAMESPACE_SCOPE)).toBeUndefined();
	});
});

describe("findElementKey", () => {
	it("matches the exact name first", () => {
		const data = { "tns:gbavVraag": {} };
		expect(findElementKey(data, "tns:gbavVraag", NS, EMPTY_NAMESPACE_SCOPE)).toBe("tns:gbavVraag");
	});

	it("matches an element spelled with a different prefix bound to the same URI", () => {
		const data = { "ns2:gbavVraag": { "@_xmlns:ns2": NS } };
		expect(findElementKey(data, "tns:gbavVraag", NS, EMPTY_NAMESPACE_SCOPE)).toBe("ns2:gbavVraag");
	});

	it("matches an element in the default namespace against a prefixed expectation", () => {
		const data = { gbavVraag: { "@_xmlns": NS } };
		expect(findElementKey(data, "tns:gbavVraag", NS, EMPTY_NAMESPACE_SCOPE)).toBe("gbavVraag");
	});

	it("resolves a prefix bound by an ancestor rather than the element itself", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns:ns2": NS });
		const data = { "ns2:identificatie": {} };
		expect(findElementKey(data, "tns:identificatie", NS, scope)).toBe("ns2:identificatie");
	});

	it("rejects a same-named element bound to a different namespace", () => {
		const scope = extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, { "@_xmlns:other": OTHER_NS });
		const data = { "other:identificatie": {} };
		expect(findElementKey(data, "tns:identificatie", NS, scope)).toBeUndefined();
	});

	it("accepts any namespace when the member expects none", () => {
		const data = { "ns2:identificatie": { "@_xmlns:ns2": NS } };
		expect(findElementKey(data, "identificatie", undefined, EMPTY_NAMESPACE_SCOPE)).toBe("ns2:identificatie");
	});

	it("accepts an undeclared prefix rather than dropping the value", () => {
		// An undeclared prefix is malformed XML; reading it beats silently discarding it.
		const data = { "ghost:identificatie": {} };
		expect(findElementKey(data, "tns:identificatie", NS, EMPTY_NAMESPACE_SCOPE)).toBe("ghost:identificatie");
	});

	it("never matches attributes, text markers, comments or CDATA", () => {
		const data = { "@_indicatie": "x", "#text": "y", "?_indicatie": "z", __cdata: "w" };
		expect(findElementKey(data, "indicatie", undefined, EMPTY_NAMESPACE_SCOPE)).toBeUndefined();
	});

	it("returns undefined for a missing element", () => {
		expect(findElementKey({ other: {} }, "indicatie", undefined, EMPTY_NAMESPACE_SCOPE)).toBeUndefined();
	});

	it("returns undefined for non-object data", () => {
		expect(findElementKey("text", "indicatie", undefined, EMPTY_NAMESPACE_SCOPE)).toBeUndefined();
	});
});
