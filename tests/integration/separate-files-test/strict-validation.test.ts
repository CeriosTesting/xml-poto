import { describe, expect, it } from "vitest";
import { XmlDecoratorSerializer } from "../../../src";
import { Contact } from "./contact";
import { Metadata } from "./metadata";

describe("Separate files strict validation", () => {
	it("should NOT throw validation error for namespaced elements in separate files", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<msg:contact xmlns:msg="http://example.com/message" version="1">
 <msg:sender>SENDER-001</msg:sender>
 <msg:recipient>RECIPIENT-001</msg:recipient>
</msg:contact>`;

		// This should NOT throw a strict validation error
		// Previously, it would fail with:
		// [Strict Validation Error] Unexpected XML element(s) found in 'Contact'
		// The following XML elements are not defined in the class model:
		// - <msg:sender>
		// - <msg:recipient>
		expect(() => {
			new XmlDecoratorSerializer({ strictValidation: true }).fromXml(xml, Contact);
		}).not.toThrow();

		const result = new XmlDecoratorSerializer({ strictValidation: true }).fromXml(xml, Contact);
		expect(result.sender).toBe("SENDER-001");
		expect(result.recipient).toBe("RECIPIENT-001");
		expect(result.version).toBe("1");
	});

	it("should work with nested classes from separate files", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<msg:metadata xmlns:msg="http://example.com/message" version="1">
  <msg:id>550e8400-e29b-41d4-a716-446655440000</msg:id>
  <msg:creation-time>2024-01-15T10:30:00Z</msg:creation-time>
  <msg:message-type>TestMessage</msg:message-type>
  <msg:subtype>example_type</msg:subtype>
  <msg:contact version="1">
   <msg:sender>SENDER-001</msg:sender>
   <msg:recipient>RECIPIENT-001</msg:recipient>
  </msg:contact>
</msg:metadata>`;

		expect(() => {
			new XmlDecoratorSerializer({ strictValidation: true }).fromXml(xml, Metadata);
		}).not.toThrow();

		const result = new XmlDecoratorSerializer({ strictValidation: true }).fromXml(xml, Metadata);
		expect(result.contact).toBeDefined();
		expect(result.contact.sender).toBe("SENDER-001");
		expect(result.contact.recipient).toBe("RECIPIENT-001");
	});
});
