# Namespaces

Learn how to work with XML namespaces for proper element and attribute qualification.

## Table of Contents

- [Overview](#overview)
- [Namespace Basics](#namespace-basics)
- [Defining Namespaces](#defining-namespaces)
- [Root Element Namespaces](#root-element-namespaces)
- [Element Namespaces](#element-namespaces)
- [Attribute Namespaces](#attribute-namespaces)
- [Array Item Namespaces](#array-item-namespaces)
- [Default Namespaces](#default-namespaces)
- [Multiple Namespaces](#multiple-namespaces)
- [Namespace Inheritance](#namespace-inheritance)
- [Best Practices](#best-practices)

## Overview

XML namespaces prevent element name conflicts and provide semantic meaning to elements. They use URIs (Uniform Resource Identifiers) to uniquely identify elements.

**Namespaced XML Example:**
```xml
<inv:Invoice xmlns:inv="http://example.com/invoice">
    <inv:Number>12345</inv:Number>
    <inv:Date>2024-01-01</inv:Date>
</inv:Invoice>
```

[↑ Back to top](#table-of-contents)

## Namespace Basics

### What is a Namespace?

A namespace consists of:
- **URI (Uniform Resource Identifier)**: A unique identifier (doesn't need to be a working URL)
- **Prefix**: A short alias used in the XML document

**Example:**
```typescript
const namespace = {
    uri: "http://example.com/invoice",
    prefix: "inv"
};
```

### Why Use Namespaces?

```xml
<!-- Without namespaces - ambiguous -->
<Order>
    <Date>2024-01-01</Date>  <!-- Order date or delivery date? -->
</Order>

<!-- With namespaces - clear -->
<order:Order xmlns:order="http://example.com/order" xmlns:delivery="http://example.com/delivery">
    <order:Date>2024-01-01</order:Date>
    <delivery:Date>2024-01-05</delivery:Date>
</order:Order>
```

[↑ Back to top](#table-of-contents)

## Defining Namespaces

### XmlNamespace Type

```typescript
interface XmlNamespace {
    uri: string;      // Unique identifier URI
    prefix: string;   // Prefix for the namespace (use "" for default namespace)
}
```

### Creating Namespace Objects

```typescript
// Standard namespace with prefix
const bookNs = {
    uri: "http://example.com/books",
    prefix: "book"
};

// Invoice namespace
const invoiceNs = {
    uri: "http://example.com/invoice",
    prefix: "inv"
};

// Default namespace (no prefix)
const defaultNs = {
    uri: "http://example.com/default",
    prefix: ""
};
```

[↑ Back to top](#table-of-contents)

## Root Element Namespaces

Apply namespaces to the root element:

### Basic Root Namespace

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

const invoiceNs = { uri: "http://example.com/invoice", prefix: "inv" };

@XmlRoot({
    elementName: 'Invoice',
    namespace: invoiceNs
})
class Invoice {
    @XmlElement({ name: 'Number' })
    number: string = '';

    @XmlElement({ name: 'Date' })
    date: string = '';
}

const invoice = new Invoice();
invoice.number = '12345';
invoice.date = '2024-01-01';

const serializer = new XmlSerializer();
const xml = serializer.toXml(invoice);
```

**Output:**
```xml
<inv:Invoice xmlns:inv="http://example.com/invoice">
    <Number>12345</Number>
    <Date>2024-01-01</Date>
</inv:Invoice>
```

Note: Child elements without explicit namespace declarations inherit the default behavior.

[↑ Back to top](#table-of-contents)

## Element Namespaces

Apply namespaces to individual elements:

### Elements with Namespaces

```typescript
const docNs = { uri: "http://example.com/doc", prefix: "doc" };
const metaNs = { uri: "http://example.com/meta", prefix: "meta" };

@XmlRoot({
    elementName: 'Document',
    namespace: docNs
})
class Document {
    @XmlElement({
        name: 'Id',
        namespace: { uri: "http://example.com/id", prefix: "id" }
    })
    id: string = '';

    @XmlElement({
        name: 'Title',
        namespace: docNs
    })
    title: string = '';

    @XmlElement({
        name: 'Metadata',
        namespace: metaNs
    })
    metadata: string = '';
}

const doc = new Document();
doc.id = '001';
doc.title = 'Sample Document';
doc.metadata = 'Created 2024';

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<doc:Document xmlns:doc="http://example.com/doc" xmlns:id="http://example.com/id" xmlns:meta="http://example.com/meta">
    <id:Id>001</id:Id>
    <doc:Title>Sample Document</doc:Title>
    <meta:Metadata>Created 2024</meta:Metadata>
</doc:Document>
```

### Nested Elements with Namespaces

```typescript
const rootNs = { uri: "http://root.com", prefix: "r" };
const nestedNs = { uri: "http://nested.com", prefix: "n" };

@XmlElement({
    elementName: 'Nested',
    namespace: nestedNs
})
class Nested {
    @XmlElement({
        name: 'Value',
        namespace: nestedNs
    })
    value: string = '';
}

@XmlRoot({
    elementName: 'Root',
    namespace: rootNs
})
class Root {
    @XmlElement({
        name: 'Nested',
        type: Nested,
        namespace: nestedNs
    })
    nested: Nested = new Nested();
}

const root = new Root();
root.nested.value = 'test';
```

**Output:**
```xml
<r:Root xmlns:r="http://root.com" xmlns:n="http://nested.com">
    <n:Nested>
        <n:Value>test</n:Value>
    </n:Nested>
</r:Root>
```

[↑ Back to top](#table-of-contents)

## Attribute Namespaces

Apply namespaces to attributes:

### Attributes with Namespaces

```typescript
const rootNs = { uri: "http://root.com", prefix: "r" };
const attrNs = { uri: "http://attr.com", prefix: "a" };

@XmlRoot({
    elementName: 'Element',
    namespace: rootNs
})
class Element {
    @XmlAttribute({
        name: 'id',
        namespace: attrNs
    })
    id: string = '';

    @XmlElement({ name: 'Value' })
    value: string = '';
}

const element = new Element();
element.id = '123';
element.value = 'test';
```

**Output:**
```xml
<r:Element xmlns:r="http://root.com" xmlns:a="http://attr.com" a:id="123">
    <Value>test</Value>
</r:Element>
```

### Multiple Attributes with Different Namespaces

```typescript
const xmlNs = { uri: "http://www.w3.org/XML/1998/namespace", prefix: "xml" };
const customNs = { uri: "http://example.com/custom", prefix: "custom" };

@XmlRoot({ elementName: 'Content' })
class Content {
    @XmlAttribute({
        name: 'lang',
        namespace: xmlNs
    })
    language: string = '';

    @XmlAttribute({
        name: 'version',
        namespace: customNs
    })
    version: string = '';

    @XmlText()
    text: string = '';
}

const content = new Content();
content.language = 'en';
content.version = '1.0';
content.text = 'Hello';
```

**Output:**
```xml
<Content xmlns:xml="http://www.w3.org/XML/1998/namespace" xmlns:custom="http://example.com/custom" xml:lang="en" custom:version="1.0">Hello</Content>
```

[↑ Back to top](#table-of-contents)

## Array Item Namespaces

Apply namespaces to array items:

### Array Items with Namespaces

```typescript
const itemNs = { uri: "http://item.com", prefix: "i" };

@XmlElement({ elementName: 'Item' })
class Item {
    @XmlElement({ name: 'Name' })
    name: string = '';
}

@XmlRoot({ elementName: 'Container' })
class Container {
    @XmlArray({
        itemName: 'Item',
        type: Item,
        namespace: itemNs
    })
    items: Item[] = [];
}

const container = new Container();

const item1 = new Item();
item1.name = 'First';

const item2 = new Item();
item2.name = 'Second';

container.items = [item1, item2];
```

**Output:**
```xml
<Container>
    <i:Item xmlns:i="http://item.com">
        <Name>First</Name>
    </i:Item>
    <i:Item xmlns:i="http://item.com">
        <Name>Second</Name>
    </i:Item>
</Container>
```

[↑ Back to top](#table-of-contents)

## Default Namespaces

Use default namespaces (no prefix) for cleaner XML:

### Default Namespace Example

```typescript
const defaultNs = { uri: "http://example.com", prefix: "" };

@XmlRoot({
    elementName: 'Root',
    namespace: defaultNs
})
class Root {
    @XmlElement({ name: 'Child', namespace: defaultNs })
    child: string = '';
}

const root = new Root();
root.child = 'value';
```

**Output:**
```xml
<Root xmlns="http://example.com">
    <Child>value</Child>
</Root>
```

### Mixed Default and Prefixed Namespaces

```typescript
const defaultNs = { uri: "http://example.com/default", prefix: "" };
const specialNs = { uri: "http://example.com/special", prefix: "sp" };

@XmlRoot({
    elementName: 'Document',
    namespace: defaultNs
})
class Document {
    @XmlElement({ name: 'Title', namespace: defaultNs })
    title: string = '';

    @XmlElement({ name: 'Special', namespace: specialNs })
    special: string = '';
}

const doc = new Document();
doc.title = 'Document Title';
doc.special = 'Special Value';
```

**Output:**
```xml
<Document xmlns="http://example.com/default" xmlns:sp="http://example.com/special">
    <Title>Document Title</Title>
    <sp:Special>Special Value</sp:Special>
</Document>
```

[↑ Back to top](#table-of-contents)

## Multiple Namespaces

Use multiple namespaces in a single document. You can now declare multiple namespaces on a single element using the `namespaces` array property.

### Declaring Multiple Namespaces on Root

**New in v1.x:** Use the `namespaces` array to declare multiple namespace prefixes that will be used by child elements:

```typescript
const reportNs = { uri: "http://example.com/report", prefix: "rpt" };
const dataNs = { uri: "http://example.com/data", prefix: "data" };
const metaNs = { uri: "http://example.com/meta", prefix: "meta" };

@XmlRoot({
    elementName: 'Report',
    namespace: reportNs,  // Primary namespace for the root element
    namespaces: [         // Additional namespaces for child elements
        dataNs,
        metaNs
    ]
})
class Report {
    @XmlElement({
        name: 'title',
        namespace: metaNs  // Uses namespace declared above
    })
    title: string = '';

    @XmlElement({
        name: 'value',
        namespace: dataNs  // Uses namespace declared above
    })
    value: string = '';
}

const report = new Report();
report.title = 'Q4 Report';
report.value = '12345';
```

**Output:**
```xml
<rpt:Report xmlns:rpt="http://example.com/report" xmlns:data="http://example.com/data" xmlns:meta="http://example.com/meta">
    <meta:title>Q4 Report</meta:title>
    <data:value>12345</data:value>
</rpt:Report>
```

### XBRL-Style Multi-Namespace Documents

Perfect for complex financial reporting standards like XBRL where the root declares all namespaces:

```typescript
const xbrliNs = { uri: "http://www.xbrl.org/2003/instance", prefix: "xbrli" };
const usGaapNs = { uri: "http://xbrl.us/us-gaap/2023", prefix: "us-gaap" };
const customNs = { uri: "http://example.com/custom/2023", prefix: "custom" };
const iso4217Ns = { uri: "http://www.xbrl.org/2003/iso4217", prefix: "iso4217" };

@XmlRoot({
    elementName: 'xbrl',
    namespace: xbrliNs,
    namespaces: [
        usGaapNs,
        customNs,
        iso4217Ns
    ]
})
class XbrlDocument {
    @XmlElement({
        name: 'Assets',
        namespace: usGaapNs
    })
    assets: string = '';

    @XmlElement({
        name: 'CustomMetric',
        namespace: customNs
    })
    customMetric: string = '';
}

const xbrl = new XbrlDocument();
xbrl.assets = '1000000';
xbrl.customMetric = '500';
```

**Output:**
```xml
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
            xmlns:us-gaap="http://xbrl.us/us-gaap/2023"
            xmlns:custom="http://example.com/custom/2023"
            xmlns:iso4217="http://www.xbrl.org/2003/iso4217">
    <us-gaap:Assets>1000000</us-gaap:Assets>
    <custom:CustomMetric>500</custom:CustomMetric>
</xbrli:xbrl>
```

### Nested Elements with Additional Namespaces

Each element can declare its own additional namespaces:

```typescript
const docNs = { uri: "http://example.com/doc", prefix: "doc" };
const metaNs = { uri: "http://example.com/meta", prefix: "meta" };
const authNs = { uri: "http://example.com/author", prefix: "auth" };
const dateNs = { uri: "http://example.com/date", prefix: "dt" };

@XmlRoot({
    elementName: 'Document',
    namespace: docNs
})
class Document {
    @XmlElement({
        name: 'metadata',
        namespace: metaNs,
        namespaces: [       // This element adds more namespace declarations
            authNs,
            dateNs
        ]
    })
    metadata: string = '';
}

const doc = new Document();
doc.metadata = 'test';
```

**Output:**
```xml
<doc:Document xmlns:doc="http://example.com/doc"
              xmlns:meta="http://example.com/meta"
              xmlns:auth="http://example.com/author"
              xmlns:dt="http://example.com/date">
    <meta:metadata>test</meta:metadata>
</doc:Document>
```

### Backward Compatibility

The existing `namespace` property continues to work exactly as before:

```typescript
// Old way - still fully supported
@XmlRoot({
    elementName: 'Document',
    namespace: { uri: "http://example.com/doc", prefix: "doc" }
})
class Document {
    @XmlElement()
    title: string = '';
}

// New way - combines both approaches
@XmlRoot({
    elementName: 'Document',
    namespace: { uri: "http://example.com/doc", prefix: "doc" },
    namespaces: [
        { uri: "http://example.com/meta", prefix: "meta" }
    ]
})
class Document {
    @XmlElement()
    title: string = '';
}
```

Both approaches work, and you can combine them as needed.

### Complex Multi-Namespace Example

```typescript
const soapNs = { uri: "http://schemas.xmlsoap.org/soap/envelope/", prefix: "soap" };
const bodyNs = { uri: "http://example.com/body", prefix: "b" };
const headerNs = { uri: "http://example.com/header", prefix: "h" };

@XmlElement({
    elementName: 'Header',
    namespace: soapNs
})
class Header {
    @XmlElement({
        name: 'Auth',
        namespace: headerNs
    })
    auth: string = '';
}

@XmlElement({
    elementName: 'Body',
    namespace: soapNs
})
class Body {
    @XmlElement({
        name: 'Request',
        namespace: bodyNs
    })
    request: string = '';
}

@XmlRoot({
    elementName: 'Envelope',
    namespace: soapNs
})
class Envelope {
    @XmlElement({
        name: 'Header',
        type: Header,
        namespace: soapNs
    })
    header: Header = new Header();

    @XmlElement({
        name: 'Body',
        type: Body,
        namespace: soapNs
    })
    body: Body = new Body();
}

const envelope = new Envelope();
envelope.header.auth = 'token123';
envelope.body.request = 'getData';
```

**Output:**
```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:h="http://example.com/header" xmlns:b="http://example.com/body">
    <soap:Header>
        <h:Auth>token123</h:Auth>
    </soap:Header>
    <soap:Body>
        <b:Request>getData</b:Request>
    </soap:Body>
</soap:Envelope>
```

[↑ Back to top](#table-of-contents)

## Namespace Inheritance

### Same Namespace Reuse

When multiple elements use the same namespace, the declaration appears once:

```typescript
const sameNs = { uri: "http://same.com", prefix: "s" };

@XmlRoot({ elementName: 'Root', namespace: sameNs })
class Root {
    @XmlElement({ name: 'Field1', namespace: sameNs })
    field1: string = '';

    @XmlElement({ name: 'Field2', namespace: sameNs })
    field2: string = '';

    @XmlElement({ name: 'Field3', namespace: sameNs })
    field3: string = '';
}
```

**Output:**
```xml
<s:Root xmlns:s="http://same.com">
    <s:Field1>value1</s:Field1>
    <s:Field2>value2</s:Field2>
    <s:Field3>value3</s:Field3>
</s:Root>
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use Consistent Prefixes

```typescript
// ✅ Good - consistent prefix across codebase
const bookNs = { uri: "http://example.com/books", prefix: "book" };

// ❌ Bad - inconsistent prefixes for same URI
const bookNs1 = { uri: "http://example.com/books", prefix: "b" };
const bookNs2 = { uri: "http://example.com/books", prefix: "bk" };
```

### 2. Define Namespaces as Constants

```typescript
// ✅ Good - reusable constants
export const NAMESPACES = {
    INVOICE: { uri: "http://example.com/invoice", prefix: "inv" },
    CUSTOMER: { uri: "http://example.com/customer", prefix: "cust" },
    PRODUCT: { uri: "http://example.com/product", prefix: "prod" }
};

@XmlRoot({
    elementName: 'Invoice',
    namespace: NAMESPACES.INVOICE
})
class Invoice { }
```

### 3. Use Meaningful Prefixes

```typescript
// ✅ Good - clear and descriptive
const invoiceNs = { uri: "http://example.com/invoice", prefix: "inv" };
const customerNs = { uri: "http://example.com/customer", prefix: "cust" };

// ❌ Bad - unclear abbreviations
const ns1 = { uri: "http://example.com/invoice", prefix: "x" };
const ns2 = { uri: "http://example.com/customer", prefix: "y" };
```

### 4. Use Standard Namespace URIs

```typescript
// ✅ Good - recognizable standard namespaces
const xmlNs = { uri: "http://www.w3.org/XML/1998/namespace", prefix: "xml" };
const xsiNs = { uri: "http://www.w3.org/2001/XMLSchema-instance", prefix: "xsi" };

// Your custom namespaces should follow similar patterns
const myAppNs = { uri: "http://example.com/myapp/v1", prefix: "app" };
```

### 5. Group Related Elements in Same Namespace

```typescript
// ✅ Good - related elements share namespace
const addressNs = { uri: "http://example.com/address", prefix: "addr" };

@XmlElement({ elementName: 'Address', namespace: addressNs })
class Address {
    @XmlElement({ name: 'Street', namespace: addressNs })
    street: string = '';

    @XmlElement({ name: 'City', namespace: addressNs })
    city: string = '';

    @XmlElement({ name: 'Country', namespace: addressNs })
    country: string = '';
}
```

### 6. Document Namespace Meanings

```typescript
/**
 * Namespace for invoice-related elements.
 * URI: http://example.com/invoice/v2
 * Prefix: inv
 */
export const INVOICE_NS = {
    uri: "http://example.com/invoice/v2",
    prefix: "inv"
};
```

### 7. Test Namespace Serialization

```typescript
describe('Namespace Serialization', () => {
    it('should apply namespace to root element', () => {
        const invoice = new Invoice();
        invoice.number = '12345';

        const xml = serializer.toXml(invoice);

        expect(xml).toContain('xmlns:inv="http://example.com/invoice"');
        expect(xml).toContain('<inv:Invoice');
    });

    it('should apply namespace to child elements', () => {
        const invoice = new Invoice();
        invoice.number = '12345';

        const xml = serializer.toXml(invoice);

        expect(xml).toContain('<inv:Number>12345</inv:Number>');
    });
});
```

### 8. Handle Namespace Conflicts

```typescript
// When different elements need the same prefix, use unique URIs
const oldVersionNs = { uri: "http://example.com/v1", prefix: "app" };
const newVersionNs = { uri: "http://example.com/v2", prefix: "app" };

// Better: Use different prefixes
const v1Ns = { uri: "http://example.com/v1", prefix: "v1" };
const v2Ns = { uri: "http://example.com/v2", prefix: "v2" };
```

### 9. Use Default Namespace for Primary Content

```typescript
// ✅ Good - main content uses default namespace
const defaultNs = { uri: "http://example.com/book", prefix: "" };
const metaNs = { uri: "http://example.com/metadata", prefix: "meta" };

@XmlRoot({ elementName: 'Book', namespace: defaultNs })
class Book {
    @XmlElement({ name: 'Title', namespace: defaultNs })
    title: string = '';

    @XmlElement({ name: 'Metadata', namespace: metaNs })
    metadata: string = '';
}
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Nested Objects](nested-objects.md) - Complex hierarchies
- [Querying](querying.md) - Namespace-aware queries
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Nested Objects](nested-objects.md) | [Home](../../README.md) | [Mixed Content →](mixed-content.md)
