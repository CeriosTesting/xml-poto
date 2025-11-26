# XBRL Support

## Overview

The library provides full support for XBRL (eXtensible Business Reporting Language) documents, a complex XML-based standard for financial reporting. All bi-directional features work seamlessly with XBRL structures including contexts, units, facts, tuples, and footnotes.

## XBRL Key Features Supported

✅ **Multiple Namespaces** - Handle xbrli, us-gaap, dei, iso4217, link, xlink, etc.
✅ **Contexts** - Instant and duration periods, segments, scenarios
✅ **Units** - Simple measures and divide units (ratios)
✅ **Facts** - Monetary, numeric, string, and boolean facts
✅ **Tuples** - Nested fact structures
✅ **Footnotes** - Footnote links and relationships
✅ **Bi-directional** - Parse, modify, and serialize XBRL documents

## Basic XBRL Document

### Parsing an XBRL Instance

```typescript
import { XmlRoot, XmlDynamic, DynamicElement, XmlQuery, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'xbrl' })
class XbrlDocument {
  @XmlDynamic()
  dynamic!: DynamicElement;
}

const serializer = new XmlSerializer();

const xbrlXml = `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:xbrli="http://www.xbrl.org/2003/instance"
      xmlns:us-gaap="http://fasb.org/us-gaap/2023"
      xmlns:iso4217="http://www.xbrl.org/2003/iso4217">
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

// Access facts
const query = new XmlQuery([xbrl.dynamic]);
const assets = query.find('Assets').first();
console.log(assets?.numericValue); // 1000000
console.log(assets?.attributes.contextRef); // "Current_AsOf"
```

## Working with XBRL Contexts

### Instant Periods

```typescript
// Parse context with instant period
const context = query.find('context').first();
const instant = context?.children.find(c => c.name === 'period')
  ?.children.find(c => c.name === 'instant');

console.log(instant?.text); // "2023-12-31"
```

### Duration Periods

```typescript
const xbrlWithDuration = `
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

const xbrl = serializer.fromXml(xbrlWithDuration, XbrlDocument);
const query = new XmlQuery([xbrl.dynamic]);

const startDate = query.find('startDate').first();
const endDate = query.find('endDate').first();

console.log(startDate?.text); // "2023-01-01"
console.log(endDate?.text); // "2023-12-31"
```

### Creating Contexts Programmatically

```typescript
const xbrl = new DynamicElement({
  name: 'xbrl',
  qualifiedName: 'xbrl'
});

xbrl.setNamespaceDeclaration('xbrli', 'http://www.xbrl.org/2003/instance');

// Create context
const context = xbrl.createChild({
  name: 'context',
  attributes: { id: 'CurrentYear' }
});

const entity = context.createChild({ name: 'entity' });
entity.createChild({
  name: 'identifier',
  text: '0001234567',
  attributes: { scheme: 'http://www.sec.gov/CIK' }
});

const period = context.createChild({ name: 'period' });
period.createChild({ name: 'instant', text: '2023-12-31' });

const xml = xbrl.toXml({ indent: '  ', includeDeclaration: true });
```

## Working with XBRL Units

### Simple Units

```typescript
// Parse USD unit
const unit = query.find('unit').whereAttribute('id', 'USD').first();
const measure = unit?.children.find(c => c.name === 'measure');
console.log(measure?.text); // "iso4217:USD"

// Create new unit
const eurUnit = xbrl.dynamic.createChild({
  name: 'unit',
  attributes: { id: 'EUR' }
});
eurUnit.createChild({
  name: 'measure',
  text: 'iso4217:EUR'
});
```

### Divide Units (Ratios)

```typescript
const xbrlWithRatio = `
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

const xbrl = serializer.fromXml(xbrlWithRatio, XbrlDocument);
const query = new XmlQuery([xbrl.dynamic]);

const divideUnit = query.find('divide').first();
const numerator = query.find('unitNumerator').first();
const denominator = query.find('unitDenominator').first();

console.log(numerator?.children[0]?.text); // "iso4217:USD"
console.log(denominator?.children[0]?.text); // "xbrli:shares"
```

## Working with XBRL Facts

### Monetary Facts

```typescript
// Query monetary facts
const query = new XmlQuery([xbrl.dynamic]);

const assets = query.find('Assets').first();
console.log({
  value: assets?.numericValue,
  contextRef: assets?.attributes.contextRef,
  unitRef: assets?.attributes.unitRef,
  decimals: assets?.attributes.decimals
});
// { value: 1000000, contextRef: "Current_AsOf", unitRef: "USD", decimals: "-3" }
```

### Updating Facts

```typescript
// Update existing fact
const assets = query.find('Assets').first();
assets?.setText('1200000');
assets?.setAttribute('decimals', '-3');

console.log(assets?.numericValue); // 1200000
```

### Adding New Facts

```typescript
// Add new fact with namespace
xbrl.dynamic.createChild({
  name: 'StockholdersEquity',
  namespace: 'us-gaap',
  namespaceUri: 'http://fasb.org/us-gaap/2023',
  attributes: {
    contextRef: 'Current_AsOf',
    unitRef: 'USD',
    decimals: '-3'
  },
  text: '500000'
});

const xml = xbrl.dynamic.toXml({ indent: '  ' });
// Output includes: <us-gaap:StockholdersEquity contextRef="Current_AsOf" unitRef="USD" decimals="-3">500000</us-gaap:StockholdersEquity>
```

### String/Text Facts

```typescript
const xbrlWithText = `
<xbrl xmlns:dei="http://xbrl.sec.gov/dei/2023">
  <context id="C1">...</context>
  <dei:EntityRegistrantName contextRef="C1">ACME Corporation</dei:EntityRegistrantName>
  <dei:EntityCentralIndexKey contextRef="C1">0001234567</dei:EntityCentralIndexKey>
</xbrl>`;

const xbrl = serializer.fromXml(xbrlWithText, XbrlDocument);
const query = new XmlQuery([xbrl.dynamic]);

const name = query.findQualified('dei:EntityRegistrantName').first();
const cik = query.findQualified('dei:EntityCentralIndexKey').first();

console.log(name?.text); // "ACME Corporation"
console.log(cik?.text); // "0001234567"

// Update entity name
name?.setText('ACME Corporation Inc.');
```

## Working with XBRL Tuples

Tuples are nested fact structures in XBRL:

```typescript
const xbrlWithTuple = `
<xbrl xmlns:us-gaap="http://fasb.org/us-gaap/2023">
  <context id="C1">...</context>
  <unit id="USD">...</unit>

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

const xbrl = serializer.fromXml(xbrlWithTuple, XbrlDocument);
const query = new XmlQuery([xbrl.dynamic]);

// Query tuple items
const lineItems = query.find('SegmentReportingInformationLineItems').toArray();

lineItems.forEach((item, index) => {
  const name = item.children.find(c => c.name === 'SegmentName')?.text;
  const revenue = item.children.find(c => c.name === 'SegmentRevenue')?.numericValue;
  console.log(`Segment ${index + 1}: ${name} - $${revenue}`);
});
// Output:
// Segment 1: North America - $1000000
// Segment 2: Europe - $500000
```

## Batch Operations on XBRL Documents

### Update All Facts for a Context

```typescript
const query = new XmlQuery([xbrl.dynamic]);

// Update all facts referencing a specific context
query.descendants()
  .hasAttribute('contextRef')
  .whereAttribute('contextRef', 'Prior_AsOf')
  .setAttr('contextRef', 'Current_AsOf');
```

### Apply Rounding to All Monetary Facts

```typescript
// Find all monetary facts
const monetaryFacts = query.descendants()
  .hasAttribute('unitRef')
  .toArray();

monetaryFacts.forEach(fact => {
  if (fact.numericValue) {
    // Round to thousands
    const rounded = Math.round(fact.numericValue / 1000) * 1000;
    fact.setText(String(rounded));
    fact.setAttribute('decimals', '-3');
  }
});
```

### Calculate Derived Facts

```typescript
// Calculate total revenue from segments
const revenues = query.find('SegmentRevenue').toArray();
const total = revenues.reduce((sum, fact) => sum + (fact.numericValue || 0), 0);

// Add total revenue fact
xbrl.dynamic.createChild({
  name: 'Revenue',
  namespace: 'us-gaap',
  attributes: {
    contextRef: 'FY2023',
    unitRef: 'USD',
    decimals: '0'
  },
  text: String(total)
});
```

## Complete XBRL Workflow Example

```typescript
// 1. Parse existing XBRL document
const xbrl = serializer.fromXml(xbrlXml, XbrlDocument);
const query = new XmlQuery([xbrl.dynamic]);

// 2. Query and analyze data
const currentAssets = query.find('Assets')
  .whereAttribute('contextRef', 'Current_AsOf')
  .first();

const priorAssets = query.find('Assets')
  .whereAttribute('contextRef', 'Prior_AsOf')
  .first();

// 3. Calculate year-over-year growth
if (currentAssets?.numericValue && priorAssets?.numericValue) {
  const growth = ((currentAssets.numericValue - priorAssets.numericValue) /
                  priorAssets.numericValue) * 100;

  console.log(`Asset Growth: ${growth.toFixed(2)}%`);
}

// 4. Add new context for next year
const nextYearContext = xbrl.dynamic.createChild({
  name: 'context',
  attributes: { id: 'Next_AsOf' }
});

const entity = nextYearContext.createChild({ name: 'entity' });
entity.createChild({
  name: 'identifier',
  text: '0001234567',
  attributes: { scheme: 'http://www.sec.gov/CIK' }
});

const period = nextYearContext.createChild({ name: 'period' });
period.createChild({ name: 'instant', text: '2024-12-31' });

// 5. Add projected facts
xbrl.dynamic.createChild({
  name: 'Assets',
  namespace: 'us-gaap',
  attributes: {
    contextRef: 'Next_AsOf',
    unitRef: 'USD',
    decimals: '-3'
  },
  text: String(Math.round(currentAssets.numericValue * 1.1))
});

// 6. Serialize updated document
const updatedXml = xbrl.dynamic.toXml({
  indent: '  ',
  includeDeclaration: true
});

console.log(updatedXml);
```

## Creating XBRL Documents from Scratch

```typescript
// Create XBRL root
const xbrl = new DynamicElement({
  name: 'xbrl',
  qualifiedName: 'xbrl'
});

// Set up namespaces
xbrl.setNamespaceDeclaration('', 'http://www.xbrl.org/2003/instance');
xbrl.setNamespaceDeclaration('xbrli', 'http://www.xbrl.org/2003/instance');
xbrl.setNamespaceDeclaration('us-gaap', 'http://fasb.org/us-gaap/2023');
xbrl.setNamespaceDeclaration('dei', 'http://xbrl.sec.gov/dei/2023');
xbrl.setNamespaceDeclaration('iso4217', 'http://www.xbrl.org/2003/iso4217');

// Create context
const context = xbrl.createChild({
  name: 'context',
  attributes: { id: 'FY2023' }
});

const entity = context.createChild({ name: 'entity' });
entity.createChild({
  name: 'identifier',
  text: '0001234567',
  attributes: { scheme: 'http://www.sec.gov/CIK' }
});

const period = context.createChild({ name: 'period' });
period.createChild({ name: 'startDate', text: '2023-01-01' });
period.createChild({ name: 'endDate', text: '2023-12-31' });

// Create unit
const unit = xbrl.createChild({
  name: 'unit',
  attributes: { id: 'USD' }
});
unit.createChild({ name: 'measure', text: 'iso4217:USD' });

// Add entity information
xbrl.createChild({
  name: 'EntityRegistrantName',
  namespace: 'dei',
  attributes: { contextRef: 'FY2023' },
  text: 'Example Corporation'
});

// Add financial facts
const facts = [
  { name: 'Assets', value: '5000000' },
  { name: 'Liabilities', value: '3000000' },
  { name: 'StockholdersEquity', value: '2000000' },
  { name: 'Revenue', value: '10000000' },
  { name: 'NetIncome', value: '1000000' }
];

facts.forEach(fact => {
  xbrl.createChild({
    name: fact.name,
    namespace: 'us-gaap',
    attributes: {
      contextRef: 'FY2023',
      unitRef: 'USD',
      decimals: '-3'
    },
    text: fact.value
  });
});

// Generate XBRL document
const xbrlXml = xbrl.toXml({
  indent: '  ',
  includeDeclaration: true
});

console.log(xbrlXml);
```

## Advanced XBRL Features

### Namespace-Aware Queries

```typescript
// Find all US-GAAP facts
const gaapFacts = query.namespace('us-gaap').toArray();

// Find all DEI (Document and Entity Information) facts
const deiFacts = query.namespace('dei').toArray();

// Find by qualified name
const entityName = query.findQualified('dei:EntityRegistrantName').first();

// Find by namespace URI
const factsInNamespace = query.namespaceUri('http://fasb.org/us-gaap/2023').toArray();
```

### Context Reference Validation

```typescript
// Find all contexts
const contexts = query.find('context').toArray();
const contextIds = new Set(contexts.map(c => c.attributes.id));

// Find facts with invalid context references
const factsWithContext = query.descendants().hasAttribute('contextRef').toArray();
const invalidFacts = factsWithContext.filter(fact =>
  !contextIds.has(fact.attributes.contextRef)
);

if (invalidFacts.length > 0) {
  console.log(`Found ${invalidFacts.length} facts with invalid context references`);
}
```

### Unit Reference Validation

```typescript
// Find all units
const units = query.find('unit').toArray();
const unitIds = new Set(units.map(u => u.attributes.id));

// Find facts with invalid unit references
const factsWithUnit = query.descendants().hasAttribute('unitRef').toArray();
const invalidFacts = factsWithUnit.filter(fact =>
  !unitIds.has(fact.attributes.unitRef)
);

if (invalidFacts.length > 0) {
  console.log(`Found ${invalidFacts.length} facts with invalid unit references`);
}
```

## XBRL Best Practices

1. **Preserve Namespace Declarations**: When modifying XBRL documents, ensure namespace declarations are preserved in the root element.

2. **Maintain Context/Unit References**: Always ensure facts reference valid contexts and units.

3. **Use Correct Namespaces**: Use the appropriate namespace prefix for each fact type (us-gaap, dei, etc.).

4. **Handle Decimals Correctly**: Set the `decimals` attribute appropriately for monetary facts.

5. **Validate Structure**: After modifications, validate that the XBRL structure is still valid.

6. **Batch Operations**: Use `XmlQuery` for efficient batch operations on multiple facts.

## Common XBRL Patterns

### Compare Two Periods

```typescript
const periods = ['Current_AsOf', 'Prior_AsOf'];
const comparison: Record<string, any> = {};

periods.forEach(period => {
  const facts = query.descendants()
    .hasAttribute('contextRef')
    .whereAttribute('contextRef', period)
    .toArray();

  facts.forEach(fact => {
    if (!comparison[fact.name]) {
      comparison[fact.name] = {};
    }
    comparison[fact.name][period] = fact.numericValue;
  });
});

console.log(comparison);
```

### Extract Balance Sheet

```typescript
const balanceSheetItems = [
  'Assets',
  'Liabilities',
  'StockholdersEquity'
];

const balanceSheet: Record<string, number> = {};

balanceSheetItems.forEach(item => {
  const fact = query.find(item)
    .whereAttribute('contextRef', 'Current_AsOf')
    .first();

  if (fact?.numericValue) {
    balanceSheet[item] = fact.numericValue;
  }
});

console.log(balanceSheet);
// { Assets: 5000000, Liabilities: 3000000, StockholdersEquity: 2000000 }
```

## See Also

- [Bi-directional XML](./bi-directional-xml.md) - Core mutation and serialization features
- [Namespaces](./namespaces.md) - Working with XML namespaces
- [Querying](./querying.md) - Advanced query techniques

