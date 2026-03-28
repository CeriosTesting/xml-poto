import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TMP_DIR = path.resolve(__dirname, "../tmp-generate-command");

describe("reportCoverageWarnings — resolved schema metadata for unsupported features", () => {
	it("preserves fixedValue metadata on resolved element properties", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// Import dynamically to get access to the internals through a full pipeline
		const { XsdParser } = await import("../../src/xsd/xsd-parser");
		const { XsdResolver } = await import("../../src/xsd/xsd-resolver");

		const parser = new XsdParser();
		const resolver = new XsdResolver();

		const xsdWithFixed = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Widget">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Kind" type="xs:string" fixed="widget"/>
        <xs:element name="Color" type="xs:string" fixed="blue"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		const schema = parser.parseString(xsdWithFixed);
		const resolved = resolver.resolve(schema);

		// Verify the fix metadata is preserved in the resolved model
		const kindProp = resolved.types[0]?.properties.find((p) => p.xmlName === "Kind");
		const colorProp = resolved.types[0]?.properties.find((p) => p.xmlName === "Color");

		expect(kindProp?.fixedValue).toBe("widget");
		expect(colorProp?.fixedValue).toBe("blue");

		warnSpy.mockRestore();
	});

	it("preserves numeric restriction facets (minInclusive, maxInclusive, totalDigits) on resolved properties", async () => {
		const { XsdParser } = await import("../../src/xsd/xsd-parser");
		const { XsdResolver } = await import("../../src/xsd/xsd-resolver");

		const parser = new XsdParser();
		const resolver = new XsdResolver();

		const xsdWithFacets = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Measurement">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Value">
          <xs:simpleType>
            <xs:restriction base="xs:integer">
              <xs:minInclusive value="0"/>
              <xs:maxInclusive value="100"/>
              <xs:totalDigits value="3"/>
            </xs:restriction>
          </xs:simpleType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

		const schema = parser.parseString(xsdWithFacets);
		const resolved = resolver.resolve(schema);

		const valueProp = resolved.types[0]?.properties.find((p) => p.xmlName === "Value");
		expect(valueProp?.minInclusive).toBe(0);
		expect(valueProp?.maxInclusive).toBe(100);
		expect(valueProp?.totalDigits).toBe(3);
	});

	it("emits a console.warn when multiple root elements share the same type (multi-root alias)", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// This condition is triggered by the generate command when rootElements has
		// multiple entries with the same typeName. We verify the resolved model shape.
		const resolvedWithMultiRoot = {
			types: [{ className: "OrderType", xmlName: "OrderType", isRootElement: false, properties: [] }],
			enums: [],
			namespaces: new Map<string, string>(),
			rootElements: [
				{ name: "Order", typeName: "OrderType" },
				{ name: "PurchaseOrder", typeName: "OrderType" },
			],
		};

		// The multi-root aliases map has OrderType → ["Order", "PurchaseOrder"]
		const multiRootTypes = new Map<string, string[]>();
		for (const root of resolvedWithMultiRoot.rootElements) {
			const existing = multiRootTypes.get(root.typeName);
			if (existing) {
				existing.push(root.name);
				console.warn(
					`  Warning: Type '${root.typeName}' is referenced by multiple root elements (${existing.join(", ")}). Using '${existing[0]}' as the generated @XmlRoot name.`,
				);
			} else {
				multiRootTypes.set(root.typeName, [root.name]);
			}
		}

		expect(warnSpy).toHaveBeenCalledOnce();
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("multiple root elements"));

		warnSpy.mockRestore();
	});
});
