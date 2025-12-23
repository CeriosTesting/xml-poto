import { describe, expect, test } from "vitest";
import { XmlAttribute, XmlElement, XmlRoot, XmlText } from "../../src/decorators";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

/**
 * Test for context-aware element registration to handle duplicate element names
 * in different parent contexts without registry conflicts.
 *
 * This addresses the issue where multiple classes decorated with the same @XmlElement
 * name would conflict in the global registry, causing the wrong class to be instantiated.
 */

// First security model (for ContentDocument)
@XmlElement("owner")
class SecurityOwnerXml {
	@XmlAttribute({ name: "id" })
	id: string = "";

	@XmlAttribute({ name: "access" })
	access: string = "";

	@XmlText()
	value: string = "";
}

@XmlElement("custodian")
class SecurityCustodianXml {
	@XmlAttribute({ name: "id" })
	id: string = "";

	@XmlAttribute({ name: "access" })
	access: string = "";

	@XmlText()
	value: string = "";
}

@XmlElement("permission")
class PermissionXml {
	@XmlElement({ name: "owner", type: SecurityOwnerXml })
	owner: SecurityOwnerXml = new SecurityOwnerXml();

	@XmlElement({ name: "custodian", type: SecurityCustodianXml })
	custodian: SecurityCustodianXml = new SecurityCustodianXml();
}

@XmlElement("documentClassification")
class DocumentClassificationXml {
	@XmlElement({ name: "confidentiality" })
	confidentiality: string = "";
}

@XmlElement("security")
class SecurityXml {
	@XmlElement({ name: "permission", type: PermissionXml })
	permission: PermissionXml = new PermissionXml();

	@XmlElement({ name: "documentClassification", type: DocumentClassificationXml })
	documentClassification: DocumentClassificationXml = new DocumentClassificationXml();

	@XmlElement({ name: "countryCode" })
	countryCode: string = "";

	// This field only exists in SecurityXml, not in JudgementSecurityXml
	@XmlElement({ name: "archived" })
	archived: string = "";
}

@XmlRoot({ elementName: "contentDocument" })
class ContentDocumentXml {
	@XmlElement({ name: "security", type: SecurityXml })
	security: SecurityXml = new SecurityXml();
}

// Second security model (for Judgement) - SAME element name but different structure
@XmlElement("owner")
class JudgementOwnerXml {
	@XmlAttribute({ name: "id" })
	id: string = "";

	@XmlAttribute({ name: "access" })
	access: string = "";

	@XmlText()
	value: string = "";
}

@XmlElement("custodian")
class JudgementCustodianXml {
	@XmlAttribute({ name: "id" })
	id: string = "";

	@XmlAttribute({ name: "access" })
	access: string = "";

	@XmlText()
	value: string = "";
}

@XmlElement("permission")
class JudgementPermissionXml {
	@XmlElement({ name: "owner", type: JudgementOwnerXml })
	owner: JudgementOwnerXml = new JudgementOwnerXml();

	@XmlElement({ name: "custodian", type: JudgementCustodianXml })
	custodian: JudgementCustodianXml = new JudgementCustodianXml();
}

@XmlElement("documentClassification")
class JudgementDocumentClassificationXml {
	@XmlElement({ name: "confidentiality" })
	confidentiality: string = "";
}

@XmlElement("security")
class JudgementSecurityXml {
	@XmlElement({ name: "permission", type: JudgementPermissionXml })
	permission: JudgementPermissionXml = new JudgementPermissionXml();

	@XmlElement({ name: "documentClassification", type: JudgementDocumentClassificationXml })
	documentClassification: JudgementDocumentClassificationXml = new JudgementDocumentClassificationXml();

	@XmlElement({ name: "countryCode" })
	countryCode: string = "";

	// Note: NO archived field in JudgementSecurityXml
}

@XmlRoot({ elementName: "judgement" })
class JudgementXml {
	@XmlElement({ name: "security", type: JudgementSecurityXml })
	security: JudgementSecurityXml = new JudgementSecurityXml();
}

describe("Context-aware element registration (duplicate element names)", () => {
	const serializer = new XmlDecoratorSerializer();

	test("should correctly deserialize SecurityXml with archived field", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<contentDocument>
  <security>
    <permission>
      <owner id="owner1" access="full">Owner Name</owner>
      <custodian id="custodian1" access="read">Custodian Name</custodian>
    </permission>
    <documentClassification>
      <confidentiality>high</confidentiality>
    </documentClassification>
    <countryCode>US</countryCode>
    <archived>true</archived>
  </security>
</contentDocument>`;

		const result = serializer.fromXml(xml, ContentDocumentXml);

		expect(result).toBeInstanceOf(ContentDocumentXml);
		expect(result.security).toBeInstanceOf(SecurityXml);
		expect(result.security.countryCode).toBe("US");
		expect(result.security.archived).toBe("true");
		expect(result.security.permission.owner.id).toBe("owner1");
		expect(result.security.permission.owner.value).toBe("Owner Name");
		expect(result.security.documentClassification.confidentiality).toBe("high");
	});

	test("should correctly deserialize JudgementSecurityXml without archived field", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<judgement>
  <security>
    <permission>
      <owner id="owner2" access="write">Judgement Owner</owner>
      <custodian id="custodian2" access="admin">Judgement Custodian</custodian>
    </permission>
    <documentClassification>
      <confidentiality>medium</confidentiality>
    </documentClassification>
    <countryCode>UK</countryCode>
  </security>
</judgement>`;

		const result = serializer.fromXml(xml, JudgementXml);

		expect(result).toBeInstanceOf(JudgementXml);
		expect(result.security).toBeInstanceOf(JudgementSecurityXml);
		expect(result.security.countryCode).toBe("UK");
		// JudgementSecurityXml should NOT have an archived field
		expect("archived" in result.security).toBe(false);
		expect(result.security.permission.owner.id).toBe("owner2");
		expect(result.security.permission.owner.value).toBe("Judgement Owner");
		expect(result.security.documentClassification.confidentiality).toBe("medium");
	});

	test("should correctly serialize SecurityXml with archived field", () => {
		const contentDoc = new ContentDocumentXml();
		contentDoc.security.countryCode = "CA";
		contentDoc.security.archived = "false";
		contentDoc.security.permission.owner.id = "owner3";
		contentDoc.security.permission.owner.access = "full";
		contentDoc.security.permission.owner.value = "Test Owner";
		contentDoc.security.documentClassification.confidentiality = "low";

		const xml = serializer.toXml(contentDoc);

		expect(xml).toContain("<security>");
		expect(xml).toContain("<countryCode>CA</countryCode>");
		expect(xml).toContain("<archived>false</archived>");
		expect(xml).toContain('<owner id="owner3" access="full">Test Owner</owner>');
		expect(xml).toContain("<confidentiality>low</confidentiality>");
	});

	test("should correctly serialize JudgementSecurityXml without archived field", () => {
		const judgement = new JudgementXml();
		judgement.security.countryCode = "FR";
		judgement.security.permission.owner.id = "owner4";
		judgement.security.permission.owner.access = "read";
		judgement.security.permission.owner.value = "Judgement Test Owner";
		judgement.security.documentClassification.confidentiality = "high";

		const xml = serializer.toXml(judgement);

		expect(xml).toContain("<security>");
		expect(xml).toContain("<countryCode>FR</countryCode>");
		// Should NOT contain archived field
		expect(xml).not.toContain("<archived>");
		expect(xml).toContain('<owner id="owner4" access="read">Judgement Test Owner</owner>');
		expect(xml).toContain("<confidentiality>high</confidentiality>");
	});

	test("both models can coexist without registry conflicts", () => {
		// Deserialize ContentDocumentXml
		const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<contentDocument>
  <security>
    <permission>
      <owner id="cd1" access="full">CD Owner</owner>
      <custodian id="cd2" access="read">CD Custodian</custodian>
    </permission>
    <documentClassification>
      <confidentiality>high</confidentiality>
    </documentClassification>
    <countryCode>DE</countryCode>
    <archived>yes</archived>
  </security>
</contentDocument>`;

		const contentResult = serializer.fromXml(contentXml, ContentDocumentXml);

		// Deserialize JudgementXml
		const judgementXml = `<?xml version="1.0" encoding="UTF-8"?>
<judgement>
  <security>
    <permission>
      <owner id="jd1" access="write">JD Owner</owner>
      <custodian id="jd2" access="admin">JD Custodian</custodian>
    </permission>
    <documentClassification>
      <confidentiality>low</confidentiality>
    </documentClassification>
    <countryCode>IT</countryCode>
  </security>
</judgement>`;

		const judgementResult = serializer.fromXml(judgementXml, JudgementXml);

		// Verify ContentDocumentXml security has archived field
		expect(contentResult.security).toBeInstanceOf(SecurityXml);
		expect(contentResult.security.archived).toBe("yes");
		expect(contentResult.security.countryCode).toBe("DE");

		// Verify JudgementXml security does NOT have archived field
		expect(judgementResult.security).toBeInstanceOf(JudgementSecurityXml);
		expect("archived" in judgementResult.security).toBe(false);
		expect(judgementResult.security.countryCode).toBe("IT");
	});

	test("strict validation should reject mismatched elements even if another class with same name exists in registry", () => {
		// This test covers the issue where changing element name in model (e.g., "security" to "securitie")
		// would incorrectly accept the old element name by finding another class in the global registry

		@XmlElement("security")
		class MismatchTestSecurityXml {
			@XmlElement({ name: "field1" })
			field1: string = "";
		}

		// This class is intentionally registered but not directly used - it tests that
		// strict validation doesn't fall back to auto-discovery for unmapped elements
		@XmlElement("security")
		// @ts-expect-error - TS6196: intentionally unused, registered via decorator for testing
		class _AnotherSecurityXml {
			@XmlElement({ name: "field2" })
			field2: string = "";
		}

		@XmlRoot({ elementName: "document" })
		class DocumentWithMismatchedName {
			// Model expects "securitie" but XML has "security"
			// Even though AnotherSecurityXml is registered with "security", it should be rejected
			@XmlElement({ name: "securitie", type: MismatchTestSecurityXml })
			securitie: MismatchTestSecurityXml = new MismatchTestSecurityXml();
		}

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<document>
  <security>
    <field1>value1</field1>
  </security>
</document>`;

		const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

		// Should throw because XML has <security> but model expects <securitie>
		// The test verifies strict validation catches the mismatch
		let errorThrown = false;
		let errorMessage = "";

		try {
			strictSerializer.fromXml(xml, DocumentWithMismatchedName);
		} catch (error: any) {
			errorThrown = true;
			errorMessage = error.message;
		}

		expect(errorThrown).toBe(true);
		expect(errorMessage).toContain("Unexpected XML element");
		// Verify the error is about a validation failure (either missing expected element or wrong element)
		expect(errorMessage.length).toBeGreaterThan(0);
	});

	test("strict validation should report missing expected element when name is changed", () => {
		@XmlElement("data")
		class DataXml {
			@XmlElement({ name: "value" })
			value: string = "";
		}

		@XmlRoot({ elementName: "envelope" })
		class EnvelopeWithRenamedField {
			// Model expects "renamedData" but XML has "data"
			@XmlElement({ name: "renamedData", type: DataXml })
			renamedData: DataXml = new DataXml();
		}

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<envelope>
  <data>
    <value>test</value>
  </data>
</envelope>`;

		const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

		// Should throw error listing:
		// 1. <data> as unexpected element
		// 2. The error should show <renamedData> as the expected element
		let errorThrown = false;
		let errorMessage = "";

		try {
			strictSerializer.fromXml(xml, EnvelopeWithRenamedField);
		} catch (error: any) {
			errorThrown = true;
			errorMessage = error.message;
		}

		expect(errorThrown).toBe(true);
		expect(errorMessage).toContain("Unexpected XML element");
		expect(errorMessage).toContain("<data>");
		expect(errorMessage).toContain("<renamedData>");
	});

	test("strict mode should NOT use auto-discovery for unmapped elements even if they exist in global registry", () => {
		// This test ensures that in strict mode, auto-discovery doesn't bypass validation
		// for unmapped elements, even when a class with that element name exists globally

		@XmlElement("item")
		class ItemXml {
			@XmlElement({ name: "field1" })
			field1: string = "";
		}

		// This class is intentionally registered but not directly used - it tests that
		// strict validation doesn't fall back to auto-discovery for unmapped elements
		@XmlElement("item")
		// @ts-expect-error - TS6196: intentionally unused, registered via decorator for testing
		class _AnotherItemXml {
			@XmlElement({ name: "field2" })
			field2: string = "";
		}

		@XmlRoot({ elementName: "container" })
		class ContainerWithTypo {
			// Model expects "itme" (typo) but XML has "item"
			@XmlElement({ name: "itme", type: ItemXml })
			itme: ItemXml = new ItemXml();
		}

		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <item>
    <field1>value1</field1>
  </item>
</container>`;

		const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

		// In strict mode, should throw error for unexpected <item> even though:
		// 1. AnotherItemXml is registered globally with @XmlElement("item")
		// 2. Auto-discovery could find it
		// The key: strict mode should NOT use auto-discovery for unmapped elements
		let errorThrown = false;
		let errorMessage = "";

		try {
			strictSerializer.fromXml(xml, ContainerWithTypo);
		} catch (error: any) {
			errorThrown = true;
			errorMessage = error.message;
		}

		expect(errorThrown).toBe(true);
		expect(errorMessage).toContain("Unexpected XML element");
		expect(errorMessage).toContain("<item>");
		expect(errorMessage).toContain("<itme>");
	});
});
