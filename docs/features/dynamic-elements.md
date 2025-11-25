# Dynamic Elements

Add XML elements with runtime-determined names using the `@XmlDynamic()` decorator. Perfect for XBRL datapoints, extensible configurations, or any XML structure where element names are not known at compile time.

## Quick Start

```typescript
import { XmlDynamic, DynamicElement, XmlElement } from '@cerios/xml-poto';

@XmlElement('xbrli:xbrl')
class XBRLRoot {
  @XmlDynamic()
  datapoints: Map<string, DynamicElement> = new Map();
}

// Add elements with runtime names
const xbrl = new XBRLRoot();
xbrl.datapoints.set('nl-cd:TransferPrice', {
  value: 150000,  // string | number | boolean
  attributes: { contextRef: 'ctx1', unitRef: 'EUR', decimals: '0' }
});

// Serialize to XML
const xml = serializer.toXml(xbrl);
// <xbrli:xbrl>
//   <nl-cd:TransferPrice contextRef="ctx1" unitRef="EUR" decimals="0">150000</nl-cd:TransferPrice>
// </xbrli:xbrl>
```

## DynamicElement Interface

```typescript
interface DynamicElement {
  value: string | number | boolean;  // Converted to string in XML
  attributes?: Record<string, string>;
}
```

## Basic Usage

### With Map (Preserves Order)

```typescript
@XmlRoot({ elementName: 'config' })
class Config {
  @XmlElement()
  version: string = '1.0';

  @XmlDynamic()
  settings: Map<string, DynamicElement> = new Map();
}

const config = new Config();
config.settings.set('timeout', { value: 30 });
config.settings.set('debug', { value: true, attributes: { type: 'boolean' } });
```

### With Record

```typescript
@XmlRoot({ elementName: 'data' })
class Data {
  @XmlDynamic()
  fields: Record<string, DynamicElement> = {};
}

const data = new Data();
data.fields['field1'] = { value: 'value1' };
data.fields['field2'] = { value: 42, attributes: { type: 'number' } };
```

## Custom Element Types

Extend `DynamicElement` for domain-specific, type-safe elements:

```typescript
// Define your custom type
interface XBRLDatapoint extends DynamicElement {
  contextRef: string;      // Now required!
  unitRef?: string;
  decimals?: number;
  _metadata?: {            // Custom app data (not serialized to XML)
    source: string;
    validated: boolean;
  };
}

@XmlElement('xbrli:xbrl')
class XBRLRoot {
  @XmlDynamic()
  datapoints: Map<string, XBRLDatapoint> = new Map();
}

// Usage - TypeScript enforces the structure
const xbrl = new XBRLRoot();
xbrl.datapoints.set('nl-cd:TransferPrice', {
  value: 150000,
  contextRef: 'ctx1',     // ✅ Required
  unitRef: 'EUR',
  decimals: 0,
  attributes: { decimals: '0' },
  _metadata: { source: 'import', validated: true }
});

// ❌ TypeScript error - missing required contextRef
xbrl.datapoints.set('invalid', {
  value: 500000
  // Error: Property 'contextRef' is required
});
```

## Helper Methods

Add domain-specific helper methods for cleaner code:

```typescript
@XmlElement('xbrli:xbrl')
class XBRLRoot {
  @XmlDynamic()
  datapoints: Map<string, XBRLDatapoint> = new Map();

  addMonetaryDatapoint(
    name: string,
    amount: number,
    contextRef: string,
    currency: string,
    decimals: number = 0
  ): void {
    this.datapoints.set(name, {
      value: amount,
      contextRef,
      unitRef: currency,
      decimals,
      attributes: {
        contextRef,
        unitRef: currency,
        decimals: String(decimals)
      }
    });
  }

  addTextDatapoint(name: string, text: string, contextRef: string): void {
    this.datapoints.set(name, {
      value: text,
      contextRef,
      attributes: { contextRef }
    });
  }
}

// Clean, type-safe usage
xbrl.addMonetaryDatapoint('nl-cd:TransferPrice', 150000, 'ctx1', 'EUR', 0);
xbrl.addTextDatapoint('nl-cd:Address', '123 Main St', 'ctx1');
```

## Complete XBRL Example

```typescript
import {
  XmlRoot, XmlElement, XmlArrayItem, XmlAttribute,
  XmlDynamic, XmlQueryable, DynamicElement
} from '@cerios/xml-poto';

// Define custom datapoint type
interface XBRLDatapoint extends DynamicElement {
  contextRef: string;
  unitRef?: string;
  decimals?: number;
}

@XmlElement('xbrli:context')
class Context {
  @XmlAttribute() id: string = '';
}

@XmlElement('xbrli:unit')
class Unit {
  @XmlAttribute() id: string = '';
  @XmlElement({ name: 'xbrli:measure' }) measure: string = '';
}

@XmlElement('xbrli:xbrl')
class XBRL {
  @XmlArrayItem({ itemName: 'xbrli:context', type: Context })
  contexts: Context[] = [];

  @XmlArrayItem({ itemName: 'xbrli:unit', type: Unit })
  units: Unit[] = [];

  @XmlQueryable()  // For reading
  query!: QueryableElement;

  @XmlDynamic()    // For writing
  datapoints: Map<string, XBRLDatapoint> = new Map();
}

@XmlRoot({ elementName: 'envelope' })
class Envelope {
  @XmlElement({ name: 'xbrli:xbrl', type: XBRL })
  xbrl: XBRL = new XBRL();
}

// Create and populate
const envelope = new Envelope();

// Add context
const ctx = new Context();
ctx.id = 'ctx1';
envelope.xbrl.contexts.push(ctx);

// Add unit
const unit = new Unit();
unit.id = 'EUR';
unit.measure = 'iso4217:EUR';
envelope.xbrl.units.push(unit);

// Add dynamic datapoints
envelope.xbrl.datapoints.set('nl-cd:TransferPrice', {
  value: 150000,
  contextRef: 'ctx1',
  unitRef: 'EUR',
  decimals: 0,
  attributes: { contextRef: 'ctx1', unitRef: 'EUR', decimals: '0' }
});

envelope.xbrl.datapoints.set('nl-cd:PropertyValue', {
  value: 500000,
  contextRef: 'ctx1',
  unitRef: 'EUR',
  decimals: 0,
  attributes: { contextRef: 'ctx1', unitRef: 'EUR', decimals: '0' }
});

// Serialize
const serializer = new XmlDecoratorSerializer({ indent: '  ', newLine: '\n' });
const xml = serializer.toXml(envelope);
```

**Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<envelope>
  <xbrli:xbrl>
    <xbrli:context id="ctx1"/>
    <xbrli:unit id="EUR">
      <xbrli:measure>iso4217:EUR</xbrli:measure>
    </xbrli:unit>
    <nl-cd:TransferPrice contextRef="ctx1" unitRef="EUR" decimals="0">150000</nl-cd:TransferPrice>
    <nl-cd:PropertyValue contextRef="ctx1" unitRef="EUR" decimals="0">500000</nl-cd:PropertyValue>
  </xbrli:xbrl>
</envelope>
```

## Combining with @XmlQueryable

Use `@XmlQueryable()` for **reading** and `@XmlDynamic()` for **writing**:

```typescript
@XmlElement('data')
class DataContainer {
  @XmlQueryable()  // Read dynamic elements
  query!: QueryableElement;

  @XmlDynamic()    // Write dynamic elements
  elements: Map<string, DynamicElement> = new Map();

  // Extract dynamic elements after deserialization
  loadFromQuery(): void {
    for (const child of this.query.children) {
      if (child.qualifiedName.includes(':')) {
        this.elements.set(child.qualifiedName, {
          value: child.text || '',
          attributes: child.attributes
        });
      }
    }
  }
}

// Workflow: Deserialize -> Load -> Modify -> Serialize
const data = serializer.fromXml(xmlString, DataContainer);
data.loadFromQuery();
data.elements.set('new:Element', { value: 'new', attributes: { type: 'text' } });
const xml = serializer.toXml(data);
```

## Advanced: Multi-Type Elements

```typescript
// Base type
interface DataElement extends DynamicElement {
  dataType: 'monetary' | 'text' | 'date';
}

// Specific types
interface MonetaryElement extends DataElement {
  dataType: 'monetary';
  currency: string;
  decimals: number;
}

interface TextElement extends DataElement {
  dataType: 'text';
  language?: string;
}

type ReportElement = MonetaryElement | TextElement;

@XmlElement('report')
class Report {
  @XmlDynamic()
  data: Map<string, ReportElement> = new Map();

  addMonetary(name: string, value: number, currency: string, contextRef: string): void {
    this.data.set(name, {
      value,
      dataType: 'monetary',
      currency,
      decimals: 2,
      attributes: { contextRef, unitRef: currency, decimals: '2' }
    });
  }

  addText(name: string, value: string, contextRef: string, lang?: string): void {
    this.data.set(name, {
      value,
      dataType: 'text',
      language: lang,
      attributes: { contextRef, ...(lang && { 'xml:lang': lang }) }
    });
  }
}
```

## Features

- ✅ **Runtime element names** - Add elements with names determined at runtime
- ✅ **Type-safe** - Full TypeScript support with custom types
- ✅ **Flexible values** - string | number | boolean (converted to string in XML)
- ✅ **Namespace support** - Element names can include prefixes (e.g., `ns:Element`)
- ✅ **Multiple attributes** - Each element can have any number of attributes
- ✅ **Map or Record** - Use either container type
- ✅ **Extensible** - Extend `DynamicElement` for custom types
- ✅ **Integration** - Works with all other decorators

## Best Practices

1. **Use Map for ordered elements** - Map preserves insertion order
2. **Extend DynamicElement** - Create domain-specific types for better type safety
3. **Add helper methods** - Encapsulate common operations
4. **Prefix internal data** - Use `_` for properties not serialized to XML (e.g., `_metadata`)
5. **Validate before serializing** - Add validation methods to catch errors early
6. **Document types** - Add JSDoc comments to custom interfaces

## Limitations

- Dynamic elements are **write-only** during serialization (use `@XmlQueryable()` for reading)
- Element names must be valid XML names
- Attributes are always serialized as strings
- Only text content + attributes supported (no nested complex types in dynamic elements)

## Type Safety Comparison

### Without Custom Types
```typescript
// Generic - less safe
xbrl.datapoints.set('test', {
  value: 100,
  attributes: { contextRef: 'ctx1' }
});
// Easy to forget required fields!
```

### With Custom Types
```typescript
// Type-safe - catches errors
xbrl.datapoints.set('test', {
  value: 100,
  contextRef: 'ctx1',  // ✅ Required!
  unitRef: 'EUR',      // ✅ Auto-complete!
  decimals: 0          // ✅ Type-checked!
});
// TypeScript ensures correctness!
```

## See Also

- [Querying](./querying.md) - Reading dynamic elements with `@XmlQueryable()`
- [Elements and Attributes](./elements-and-attributes.md) - Standard element decorators
- [Namespaces](./namespaces.md) - Namespace handling
- [Arrays](./arrays.md) - Array handling with `@XmlArrayItem()`
