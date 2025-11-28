import { DynamicElement, XmlAttribute, XmlDynamic, XmlElement, XmlQuery, XmlRoot, XmlSerializer } from "../../src";

describe("XBRL Structure Support", () => {
	const serializer = new XmlSerializer();

	describe("XBRL Instance Documents", () => {
		it("should parse and serialize XBRL instance with multiple namespaces", () => {
			const xbrlXml = `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:link="http://www.xbrl.org/2003/linkbase"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:us-gaap="http://fasb.org/us-gaap/2023"
      xmlns:dei="http://xbrl.sec.gov/dei/2023">
  <context id="Current_AsOf">
    <entity>
      <identifier scheme="http://www.sec.gov/CIK">0001234567</identifier>
    </entity>
    <period>
      <instant>2023-12-31</instant>
    </period>
  </context>
  <unit id="USD">
    <measure>iso4217:USD</measure>
  </unit>
  <us-gaap:Assets contextRef="Current_AsOf" unitRef="USD" decimals="-3">1000000</us-gaap:Assets>
  <us-gaap:Liabilities contextRef="Current_AsOf" unitRef="USD" decimals="-3">500000</us-gaap:Liabilities>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);

			// Verify parsing
			expect(xbrl.dynamic).toBeDefined();
			expect(xbrl.dynamic.name).toBe("xbrl");
			expect(xbrl.dynamic.xmlnsDeclarations).toBeDefined();

			// Find context
			const query = new XmlQuery([xbrl.dynamic]);
			const contexts = query.find("context").toArray();
			expect(contexts.length).toBeGreaterThan(0);
			expect(contexts[0].attributes.id).toBe("Current_AsOf");

			// Find facts
			const assets = query.find("Assets").first();
			expect(assets).toBeDefined();
			expect(assets?.attributes.contextRef).toBe("Current_AsOf");
			expect(assets?.attributes.unitRef).toBe("USD");
			expect(assets?.text).toBe("1000000");
			expect(assets?.numericValue).toBe(1000000);

			// Serialize back
			const serialized = xbrl.dynamic.toXml({ indent: "  " });
			expect(serialized).toContain('contextRef="Current_AsOf"');
			expect(serialized).toContain('unitRef="USD"');
			expect(serialized).toContain("1000000");
		});

		it("should handle XBRL facts with different namespaces", () => {
			const xbrlXml = `
<xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:us-gaap="http://fasb.org/us-gaap/2023"
      xmlns:dei="http://xbrl.sec.gov/dei/2023">
  <context id="C1">
    <entity><identifier scheme="CIK">123</identifier></entity>
    <period><instant>2023-12-31</instant></period>
  </context>
  <dei:EntityRegistrantName contextRef="C1">Example Corp</dei:EntityRegistrantName>
  <us-gaap:Cash contextRef="C1" unitRef="USD">50000</us-gaap:Cash>
  <us-gaap:Revenue contextRef="C1" unitRef="USD">1000000</us-gaap:Revenue>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// Find facts by namespace
			const deiFacts = query.namespace("dei").toArray();
			expect(deiFacts.length).toBeGreaterThan(0);

			const gaapFacts = query.namespace("us-gaap").toArray();
			expect(gaapFacts.length).toBeGreaterThan(0);

			// Verify qualified names
			const entityName = query.find("dei:EntityRegistrantName").first();
			expect(entityName).toBeDefined();
			expect(entityName?.text).toBe("Example Corp");

			const cash = query.find("us-gaap:Cash").first();
			expect(cash).toBeDefined();
			expect(cash?.numericValue).toBe(50000);
		});

		it("should modify XBRL facts while preserving structure", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="Q1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:Assets contextRef="Q1" unitRef="USD" decimals="-3">1000000</us-gaap:Assets>
  <us-gaap:Liabilities contextRef="Q1" unitRef="USD" decimals="-3">500000</us-gaap:Liabilities>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// Update asset value
			const assets = query.find("Assets").first();
			assets?.setText("1200000");
			assets?.setAttribute("decimals", "-3");

			// Verify update
			expect(assets?.text).toBe("1200000");
			expect(assets?.numericValue).toBe(1200000);

			// Add new fact
			xbrl.dynamic.createChild({
				name: "Equity",
				namespace: "us-gaap",
				namespaceUri: "http://fasb.org/us-gaap/2023",
				attributes: {
					contextRef: "Q1",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "500000",
			});

			// Serialize and verify
			const updated = xbrl.dynamic.toXml({ indent: "  " });
			expect(updated).toContain("1200000");
			expect(updated).toContain("us-gaap:Equity");
			expect(updated).toContain('contextRef="Q1"');
		});
	});

	describe("XBRL Contexts and Periods", () => {
		it("should handle instant periods", () => {
			const xbrlXml = `
<xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
  <context id="AsOf_2023">
    <entity>
      <identifier scheme="http://www.sec.gov/CIK">0001234567</identifier>
    </entity>
    <period>
      <instant>2023-12-31</instant>
    </period>
  </context>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const context = query.find("context").first();
			expect(context).toBeDefined();
			expect(context?.attributes.id).toBe("AsOf_2023");

			const instant = query.find("instant").first();
			expect(instant?.text).toBe("2023-12-31");
		});

		it("should handle duration periods", () => {
			const xbrlXml = `
<xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
  <context id="FY2023">
    <entity>
      <identifier scheme="http://www.sec.gov/CIK">0001234567</identifier>
    </entity>
    <period>
      <startDate>2023-01-01</startDate>
      <endDate>2023-12-31</endDate>
    </period>
  </context>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const startDate = query.find("startDate").first();
			const endDate = query.find("endDate").first();

			expect(startDate?.text).toBe("2023-01-01");
			expect(endDate?.text).toBe("2023-12-31");
		});

		it("should handle contexts with segments", () => {
			const xbrlXml = `
<xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="Segment_North">
    <entity>
      <identifier scheme="http://www.sec.gov/CIK">0001234567</identifier>
      <segment>
        <xbrldi:explicitMember dimension="us-gaap:StatementGeographicalAxis">
          us-gaap:NorthAmericaMember
        </xbrldi:explicitMember>
      </segment>
    </entity>
    <period>
      <instant>2023-12-31</instant>
    </period>
  </context>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const context = query.find("context").first();
			expect(context).toBeDefined();

			const segment = query.find("segment").first();
			expect(segment).toBeDefined();
		});

		it("should create new contexts programmatically", () => {
			const xbrl = new DynamicElement({
				name: "xbrl",
			});

			xbrl.setNamespaceDeclaration("xbrli", "http://www.xbrl.org/2003/instance");

			// Create context
			const context = xbrl.createChild({
				name: "context",
				attributes: { id: "CurrentYear" },
			});

			const entity = context.createChild({ name: "entity" });
			entity.createChild({
				name: "identifier",
				text: "0001234567",
				attributes: { scheme: "http://www.sec.gov/CIK" },
			});

			const period = context.createChild({ name: "period" });
			period.createChild({ name: "instant", text: "2023-12-31" });

			// Verify structure
			const query = new XmlQuery([xbrl]);
			const contexts = query.find("context").toArray();
			expect(contexts).toHaveLength(1);
			expect(contexts[0].attributes.id).toBe("CurrentYear");

			const identifier = query.find("identifier").first();
			expect(identifier?.text).toBe("0001234567");
		});
	});

	describe("XBRL Units", () => {
		it("should handle simple units", () => {
			const xbrlXml = `
<xbrl xmlns:iso4217="http://www.xbrl.org/2003/iso4217">
  <unit id="USD">
    <measure>iso4217:USD</measure>
  </unit>
  <unit id="EUR">
    <measure>iso4217:EUR</measure>
  </unit>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const units = query.find("unit").toArray();
			expect(units).toHaveLength(2);

			const usdUnit = units.find(u => u.attributes.id === "USD");
			expect(usdUnit).toBeDefined();

			const measure = usdUnit?.children.find(c => c.name === "measure");
			expect(measure?.text).toBe("iso4217:USD");
		});

		it("should handle divide units (ratios)", () => {
			const xbrlXml = `
<xbrl xmlns:iso4217="http://www.xbrl.org/2003/iso4217"
      xmlns:xbrli="http://www.xbrl.org/2003/instance">
  <unit id="USDPerShare">
    <divide>
      <unitNumerator>
        <measure>iso4217:USD</measure>
      </unitNumerator>
      <unitDenominator>
        <measure>xbrli:shares</measure>
      </unitDenominator>
    </divide>
  </unit>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const divideUnit = query.find("divide").first();
			expect(divideUnit).toBeDefined();

			const numerator = query.find("unitNumerator").first();
			const denominator = query.find("unitDenominator").first();

			expect(numerator).toBeDefined();
			expect(denominator).toBeDefined();
		});

		it("should create units programmatically", () => {
			const xbrl = new DynamicElement({
				name: "xbrl",
			});

			xbrl.setNamespaceDeclaration("iso4217", "http://www.xbrl.org/2003/iso4217");

			// Create USD unit
			const usdUnit = xbrl.createChild({
				name: "unit",
				attributes: { id: "USD" },
			});
			usdUnit.createChild({
				name: "measure",
				text: "iso4217:USD",
			});

			// Create shares unit
			const sharesUnit = xbrl.createChild({
				name: "unit",
				attributes: { id: "shares" },
			});
			sharesUnit.createChild({
				name: "measure",
				namespace: "xbrli",
				text: "xbrli:shares",
			});

			const xml = xbrl.toXml({ indent: "  " });
			expect(xml).toContain('id="USD"');
			expect(xml).toContain('id="shares"');
			expect(xml).toContain("iso4217:USD");
		});
	});

	describe("XBRL Facts and Tuples", () => {
		it("should handle monetary facts with all attributes", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="C1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:CashAndCashEquivalents
    contextRef="C1"
    unitRef="USD"
    decimals="-3"
    id="fact1">
    100000
  </us-gaap:CashAndCashEquivalents>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const fact = query.find("CashAndCashEquivalents").first();
			expect(fact).toBeDefined();
			expect(fact?.attributes.contextRef).toBe("C1");
			expect(fact?.attributes.unitRef).toBe("USD");
			expect(fact?.attributes.decimals).toBe("-3");
			expect(fact?.attributes.id).toBe("fact1");
			expect(fact?.numericValue).toBe(100000);
		});

		it("should handle string/text facts", () => {
			const xbrlXml = `
<xbrl xmlns:dei="http://xbrl.sec.gov/dei/2023">
  <context id="C1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <dei:EntityRegistrantName contextRef="C1">ACME Corporation</dei:EntityRegistrantName>
  <dei:EntityCentralIndexKey contextRef="C1">0001234567</dei:EntityCentralIndexKey>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const name = query.find("dei:EntityRegistrantName").first();
			const cik = query.find("dei:EntityCentralIndexKey").first();

			expect(name?.text).toBe("ACME Corporation");
			expect(cik?.text).toBe("0001234567");
		});

		it("should handle tuples (nested facts)", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="C1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:ScheduleOfSegmentReportingInformationBySegmentTable>
    <us-gaap:SegmentReportingInformationLineItems>
      <us-gaap:SegmentName>North America</us-gaap:SegmentName>
      <us-gaap:SegmentRevenue contextRef="C1" unitRef="USD">1000000</us-gaap:SegmentRevenue>
    </us-gaap:SegmentReportingInformationLineItems>
    <us-gaap:SegmentReportingInformationLineItems>
      <us-gaap:SegmentName>Europe</us-gaap:SegmentName>
      <us-gaap:SegmentRevenue contextRef="C1" unitRef="USD">500000</us-gaap:SegmentRevenue>
    </us-gaap:SegmentReportingInformationLineItems>
  </us-gaap:ScheduleOfSegmentReportingInformationBySegmentTable>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const lineItems = query.find("SegmentReportingInformationLineItems").toArray();
			expect(lineItems).toHaveLength(2);

			// Check first segment
			const firstSegment = lineItems[0];
			const firstName = firstSegment.children.find(c => c.localName === "SegmentName");
			const firstRevenue = firstSegment.children.find(c => c.localName === "SegmentRevenue");

			expect(firstName?.text).toBe("North America");
			expect(firstRevenue?.numericValue).toBe(1000000);

			// Check second segment
			const secondSegment = lineItems[1];
			const secondName = secondSegment.children.find(c => c.localName === "SegmentName");
			expect(secondName?.text).toBe("Europe");
		});

		it("should add new facts to existing XBRL document", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="Current"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:Assets contextRef="Current" unitRef="USD">1000000</us-gaap:Assets>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);

			// Add new facts
			const liabilities = xbrl.dynamic.createChild({
				name: "Liabilities",
				namespace: "us-gaap",
				namespaceUri: "http://fasb.org/us-gaap/2023",
				attributes: {
					contextRef: "Current",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "500000",
			});

			const equity = xbrl.dynamic.createChild({
				name: "StockholdersEquity",
				namespace: "us-gaap",
				namespaceUri: "http://fasb.org/us-gaap/2023",
				attributes: {
					contextRef: "Current",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "500000",
			});

			expect(liabilities.prefix).toBe("us-gaap");
			expect(equity.prefix).toBe("us-gaap");

			const xml = xbrl.dynamic.toXml({ indent: "  " });
			expect(xml).toContain("us-gaap:Liabilities");
			expect(xml).toContain("us-gaap:StockholdersEquity");
			expect(xml).toContain('contextRef="Current"');
		});
	});

	describe("XBRL Footnotes and Relationships", () => {
		it("should handle footnote links", () => {
			const xbrlXml = `
<xbrl xmlns:link="http://www.xbrl.org/2003/linkbase"
      xmlns:xlink="http://www.w3.org/1999/xlink">
  <link:footnoteLink xlink:type="extended">
    <link:loc xlink:type="locator" xlink:href="#fact1" xlink:label="fact1_loc"/>
    <link:footnote xlink:type="resource" xlink:label="footnote1" xml:lang="en">
      This is a footnote explaining the fact.
    </link:footnote>
    <link:footnoteArc xlink:type="arc"
                      xlink:arcrole="http://www.xbrl.org/2003/arcrole/fact-footnote"
                      xlink:from="fact1_loc"
                      xlink:to="footnote1"/>
  </link:footnoteLink>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			const footnoteLink = query.find("footnoteLink").first();
			expect(footnoteLink).toBeDefined();

			const footnote = query.find("footnote").first();
			expect(footnote?.text).toContain("This is a footnote");
		});
	});

	describe("Complex XBRL Scenarios", () => {
		it("should handle complete financial statement with batch modifications", () => {
			const xbrlXml = `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:us-gaap="http://fasb.org/us-gaap/2023"
      xmlns:dei="http://xbrl.sec.gov/dei/2023"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217">
  <context id="Current_AsOf">
    <entity><identifier scheme="http://www.sec.gov/CIK">0001234567</identifier></entity>
    <period><instant>2023-12-31</instant></period>
  </context>
  <context id="Prior_AsOf">
    <entity><identifier scheme="http://www.sec.gov/CIK">0001234567</identifier></entity>
    <period><instant>2022-12-31</instant></period>
  </context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>

  <dei:EntityRegistrantName contextRef="Current_AsOf">Example Corp</dei:EntityRegistrantName>

  <us-gaap:Assets contextRef="Current_AsOf" unitRef="USD" decimals="-3">5000000</us-gaap:Assets>
  <us-gaap:Assets contextRef="Prior_AsOf" unitRef="USD" decimals="-3">4500000</us-gaap:Assets>

  <us-gaap:Liabilities contextRef="Current_AsOf" unitRef="USD" decimals="-3">3000000</us-gaap:Liabilities>
  <us-gaap:Liabilities contextRef="Prior_AsOf" unitRef="USD" decimals="-3">2800000</us-gaap:Liabilities>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// 1. Update entity name
			query.find("dei:EntityRegistrantName").setText("Example Corporation Inc.");

			// 2. Adjust current year assets (10% increase)
			const currentAssets = query.find("Assets").whereAttribute("contextRef", "Current_AsOf").first();

			if (currentAssets?.numericValue) {
				const newValue = Math.round(currentAssets.numericValue * 1.1);
				currentAssets.setText(String(newValue));
			}

			// 3. Add equity facts
			xbrl.dynamic.createChild({
				name: "StockholdersEquity",
				namespace: "us-gaap",
				attributes: {
					contextRef: "Current_AsOf",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "2000000",
			});

			// 4. Add prior equity
			xbrl.dynamic.createChild({
				name: "StockholdersEquity",
				namespace: "us-gaap",
				attributes: {
					contextRef: "Prior_AsOf",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "1700000",
			});

			// Verify modifications
			const updatedName = query.find("dei:EntityRegistrantName").first();
			expect(updatedName?.text).toBe("Example Corporation Inc.");

			const updatedAssets = query.find("Assets").whereAttribute("contextRef", "Current_AsOf").first();
			expect(updatedAssets?.numericValue).toBeGreaterThan(5000000);

			const equityFacts = query.find("StockholdersEquity").toArray();
			expect(equityFacts).toHaveLength(2);

			// Serialize
			const serialized = xbrl.dynamic.toXml({ indent: "  ", includeDeclaration: true });
			expect(serialized).toContain("Example Corporation Inc.");
			expect(serialized).toContain("StockholdersEquity");
			expect(serialized).toContain("2000000");
		});

		it("should create XBRL document from scratch", () => {
			// Create root
			const xbrl = new DynamicElement({
				name: "xbrl",
			});

			// Set namespaces
			xbrl.setNamespaceDeclaration("", "http://www.xbrl.org/2003/instance");
			xbrl.setNamespaceDeclaration("xbrli", "http://www.xbrl.org/2003/instance");
			xbrl.setNamespaceDeclaration("us-gaap", "http://fasb.org/us-gaap/2023");
			xbrl.setNamespaceDeclaration("iso4217", "http://www.xbrl.org/2003/iso4217");

			// Create context
			const context = xbrl.createChild({
				name: "context",
				attributes: { id: "CurrentYear" },
			});
			const entity = context.createChild({ name: "entity" });
			entity.createChild({
				name: "identifier",
				text: "0001234567",
				attributes: { scheme: "http://www.sec.gov/CIK" },
			});
			const period = context.createChild({ name: "period" });
			period.createChild({ name: "instant", text: "2023-12-31" });

			// Create unit
			const unit = xbrl.createChild({
				name: "unit",
				attributes: { id: "USD" },
			});
			unit.createChild({ name: "measure", text: "iso4217:USD" });

			// Add facts
			xbrl.createChild({
				name: "Assets",
				namespace: "us-gaap",
				attributes: {
					contextRef: "CurrentYear",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "1000000",
			});

			xbrl.createChild({
				name: "Liabilities",
				namespace: "us-gaap",
				attributes: {
					contextRef: "CurrentYear",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "600000",
			});

			xbrl.createChild({
				name: "StockholdersEquity",
				namespace: "us-gaap",
				attributes: {
					contextRef: "CurrentYear",
					unitRef: "USD",
					decimals: "-3",
				},
				text: "400000",
			});

			// Generate XML
			const xml = xbrl.toXml({ indent: "  ", includeDeclaration: true });

			// Verify structure
			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('xmlns="http://www.xbrl.org/2003/instance"');
			expect(xml).toContain('xmlns:us-gaap="http://fasb.org/us-gaap/2023"');
			expect(xml).toContain('<context id="CurrentYear">');
			expect(xml).toContain('<unit id="USD">');
			expect(xml).toContain("us-gaap:Assets");
			expect(xml).toContain("us-gaap:Liabilities");
			expect(xml).toContain("us-gaap:StockholdersEquity");
			expect(xml).toContain('contextRef="CurrentYear"');
			expect(xml).toContain('unitRef="USD"');
		});

		it("should transform XBRL for different reporting periods", () => {
			// Start with Q1 data
			const q1Xml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="Q1_2023">
    <entity><identifier scheme="CIK">123</identifier></entity>
    <period>
      <startDate>2023-01-01</startDate>
      <endDate>2023-03-31</endDate>
    </period>
  </context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:Revenue contextRef="Q1_2023" unitRef="USD">250000</us-gaap:Revenue>
  <us-gaap:NetIncome contextRef="Q1_2023" unitRef="USD">50000</us-gaap:NetIncome>
</xbrl>`;

			const xbrl = serializer.fromXml(q1Xml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// Clone and modify for Q2
			const context = query.find("context").first();
			if (context) {
				// Update context ID
				context.setAttribute("id", "Q2_2023");

				// Update period
				const startDate = context.children.find(c => c.name === "period")?.children.find(c => c.name === "startDate");
				const endDate = context.children.find(c => c.name === "period")?.children.find(c => c.name === "endDate");

				startDate?.setText("2023-04-01");
				endDate?.setText("2023-06-30");
			}

			// Update facts with Q2 data
			query.find("Revenue").setAttr("contextRef", "Q2_2023").setText("275000");
			query.find("NetIncome").setAttr("contextRef", "Q2_2023").setText("55000");

			// Verify transformation
			const updatedContext = query.find("context").first();
			expect(updatedContext?.attributes.id).toBe("Q2_2023");

			const revenue = query.find("Revenue").first();
			expect(revenue?.attributes.contextRef).toBe("Q2_2023");
			expect(revenue?.numericValue).toBe(275000);

			const xml = xbrl.dynamic.toXml({ indent: "  " });
			expect(xml).toContain('id="Q2_2023"');
			expect(xml).toContain("2023-04-01");
			expect(xml).toContain("2023-06-30");
			expect(xml).toContain("275000");
		});
	});

	describe("XBRL Query Operations", () => {
		it("should find all monetary facts", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023" xmlns:dei="http://xbrl.sec.gov/dei/2023">
  <context id="C1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <dei:EntityRegistrantName contextRef="C1">Company</dei:EntityRegistrantName>
  <us-gaap:Assets contextRef="C1" unitRef="USD">1000000</us-gaap:Assets>
  <us-gaap:Revenue contextRef="C1" unitRef="USD">500000</us-gaap:Revenue>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// Find all facts with unitRef (monetary facts)
			const monetaryFacts = query.descendants().hasAttribute("unitRef").toArray();

			expect(monetaryFacts.length).toBeGreaterThan(0);
			monetaryFacts.forEach(fact => {
				expect(fact.attributes.unitRef).toBeDefined();
				expect(fact.attributes.contextRef).toBeDefined();
			});
		});

		it("should calculate totals from XBRL facts", () => {
			const xbrlXml = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="Q1"><entity><identifier scheme="CIK">123</identifier></entity></context>
  <unit id="USD"><measure>iso4217:USD</measure></unit>
  <us-gaap:RevenueFromContractWithCustomerProductA contextRef="Q1" unitRef="USD">100000</us-gaap:RevenueFromContractWithCustomerProductA>
  <us-gaap:RevenueFromContractWithCustomerProductB contextRef="Q1" unitRef="USD">150000</us-gaap:RevenueFromContractWithCustomerProductB>
  <us-gaap:RevenueFromContractWithCustomerProductC contextRef="Q1" unitRef="USD">75000</us-gaap:RevenueFromContractWithCustomerProductC>
</xbrl>`;

			const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
			const query = new XmlQuery([xbrl.dynamic]);

			// Find all revenue facts (by name pattern)
			const revenues = query.findPattern(/Revenue/).toArray();

			// Calculate total
			const total = revenues.reduce((sum, fact) => {
				return sum + (fact.numericValue || 0);
			}, 0);

			expect(total).toBe(325000);

			// Add total as a new fact
			xbrl.dynamic.createChild({
				name: "Revenue",
				namespace: "us-gaap",
				attributes: {
					contextRef: "Q1",
					unitRef: "USD",
					decimals: "0",
				},
				text: String(total),
			});

			const totalFact = query.find("Revenue").whereAttribute("decimals", "0").first();
			expect(totalFact?.numericValue).toBe(325000);
		});
	});
});

// Test helper class
@XmlRoot({ name: "xbrl" })
@XmlRoot({ name: "xbrl" })
class XbrlDocument {
	@XmlDynamic()
	dynamic!: DynamicElement;

	@XmlElement({ name: "context" })
	contexts?: XbrlContext[];
}

class XbrlContext {
	@XmlAttribute({ name: "id" })
	id?: string;

	@XmlElement({ name: "entity" })
	entity?: any;

	@XmlElement({ name: "period" })
	period?: any;
}
