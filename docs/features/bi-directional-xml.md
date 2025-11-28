# Bi-directional XML with XmlDynamic

## Overview

The `@XmlDynamic` decorator provides a bi-directional interface for working with XML. It allows you to parse XML into a queryable structure, modify it dynamically, and serialize it back to XML.

> **Note:** `@XmlQueryable` is deprecated. Use `@XmlDynamic` for new code.

## Key Features

- **Read & Query**: Parse and navigate XML structures
- **Modify**: Add, update, and delete elements and attributes
- **Serialize**: Convert modified structures back to XML
- **Fluent API**: Chain operations for cleaner code

## Basic Usage

### Setting Up

```typescript
import {
  XmlRoot,
  XmlDynamic,
  DynamicElement,
  XmlSerializer
} from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Document' })
class Document {
  @XmlDynamic()
  dynamic!: DynamicElement;
}

const serializer = new XmlSerializer();
```

### Parse XML

```typescript
const xml = `
  <Document>
    <Title>My Document</Title>
    <Content>Hello World</Content>
  </Document>
`;

const doc = serializer.fromXml(xml, Document);

// Access the queryable element
console.log(doc.dynamic.name); // "Document"
console.log(doc.dynamic.children.length); // 2
```

## Mutation Methods

### Adding Elements

#### Add a Child Element

```typescript
// Create and add a new child
const newChild = new DynamicElement({
  name: 'Author',  // Can be qualified name like 'ns:Author' or local name 'Author'
  text: 'John Doe',
  attributes: { id: '123' }
});

doc.dynamic.addChild(newChild);
```

#### Create a Child from Data

```typescript
// Shorthand for creating and adding
doc.dynamic.createChild({
  name: 'CreatedDate',  // Stores as-is (can be qualified or local name)
  text: '2025-11-26',
  attributes: { format: 'ISO8601' }
});
```

### Updating Elements

#### Update Element Properties

```typescript
const titleElement = doc.dynamic.children[0];

titleElement.update({
  name: 'Heading',
  text: 'Updated Title',
  attributes: { level: '1' }
});
```

#### Set Text Content

```typescript
const content = doc.dynamic.children[1];
content.setText('Updated content');
```

### Managing Attributes

```typescript
// Set an attribute
doc.dynamic.setAttribute('version', '2.0');
doc.dynamic.setAttribute('status', 'draft');

// Remove an attribute
doc.dynamic.removeAttribute('version');

// Check if attribute exists
const hasVersion = 'version' in doc.dynamic.attributes;
```

### Removing Elements

#### Remove a Child

```typescript
// Remove by reference
const childToRemove = doc.dynamic.children[0];
doc.dynamic.removeChild(childToRemove);

// Remove by index
doc.dynamic.removeChild(0);
```

#### Remove Element from Parent

```typescript
const element = doc.dynamic.children[0];
element.remove(); // Removes itself from parent
```

#### Clear All Children

```typescript
doc.dynamic.clearChildren();
```

### Replacing Elements

```typescript
const oldElement = doc.dynamic.children[0];
const newElement = new DynamicElement({
  name: 'NewElement',
  text: 'Replacement'
});

doc.dynamic.replaceChild(oldElement, newElement);
```

### Cloning Elements

```typescript
// Create a deep copy
const clone = doc.dynamic.clone();

// Modify the clone without affecting the original
clone.setText('Modified clone');
```

## Serialization

### Serialize to XML

```typescript
// Basic serialization
const xml = doc.dynamic.toXml();

// With formatting
const prettyXml = doc.dynamic.toXml({
  indent: '  ',           // Indentation string
  includeDeclaration: true, // <?xml version="1.0"?>
  selfClosing: true       // Use self-closing tags for empty elements
});

console.log(prettyXml);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <Document version="2.0">
//   <Heading level="1">Updated Title</Heading>
//   <Content>Updated content</Content>
//   <Author id="123">John Doe</Author>
// </Document>
```

### Serialization Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeDeclaration` | `boolean` | `false` | Include XML declaration |
| `indent` | `string` | `""` | Indentation string (e.g., "  " or "\t") |
| `selfClosing` | `boolean` | `true` | Use self-closing tags for empty elements |

## Configuration Options

### Lazy Loading

By default, `@XmlDynamic` uses immediate loading, building the dynamic element tree during deserialization. You can enable lazy loading to defer parsing until the property is first accessed, which can improve performance for large documents where you may not need to access the dynamic properties immediately.

```typescript
// Default behavior (immediate loading)
@XmlRoot({ elementName: 'Document' })
class Document {
  @XmlDynamic()
  dynamic!: DynamicElement;
}

// Explicit immediate loading
@XmlRoot({ elementName: 'Document' })
class ImmediateDocument {
  @XmlDynamic({ lazyLoad: false })
  dynamic!: DynamicElement;
}

// Lazy loading enabled
@XmlRoot({ elementName: 'Document' })
class LazyDocument {
  @XmlDynamic({ lazyLoad: true })
  dynamic!: DynamicElement;
}
```

**When to use `lazyLoad: false` (default):**
- When you need to create instances from scratch without parsing XML
- When you always access the dynamic property immediately after parsing
- When you want to ensure the element tree is built during deserialization
- Most common use cases where the dynamic property is regularly accessed

**When to use `lazyLoad: true`:**
- For large XML documents where you might not need the dynamic property
- To improve initial parsing performance when the property is rarely accessed
- When the dynamic property is accessed conditionally

**Example creating from scratch:**
```typescript
@XmlRoot({ elementName: 'Config' })
class Config {
  @XmlDynamic() // lazyLoad: false is the default
  dynamic!: DynamicElement;
}

// Create from scratch
const config = new Config();
config.dynamic = new DynamicElement({
  name: 'Config',
  attributes: { version: '1.0' }
});

config.dynamic.createChild({ name: 'Setting', text: 'value' });
```

### Other Options

```typescript
@XmlDynamic({
  // Target a specific property instead of root element
  targetProperty: 'specificElement',

  // Make the dynamic element required (validation error if missing)
  required: true,

  // Control child parsing
  parseChildren: true,

  // Auto-parse numeric values
  parseNumeric: true,

  // Auto-parse boolean values
  parseBoolean: true,

  // Trim whitespace from text
  trimValues: true,

  // Preserve raw text with whitespace
  preserveRawText: false,

  // Limit parsing depth for performance
  maxDepth: 10,

  // Cache the parsed result
  cache: true,

  // Use lazy loading (default: false for immediate loading)
  lazyLoad: false
})
dynamic!: DynamicElement;
```

## Batch Operations with XmlQuery

For modifying multiple elements at once, use the `XmlQuery` API:

```typescript
import { XmlQuery } from '@cerios/xml-poto';

const query = new XmlQuery([doc.dynamic]);

// Set attribute on all matched elements
query.find('Item')
  .setAttr('processed', 'true');

// Set attribute with function
query.find('Item')
  .setAttr('index', (el) => String(el.indexInParent));

// Update all matching elements
query.find('Product')
  .whereAttribute('status', 'pending')
  .updateElements({
    attributes: { status: 'processed' }
  });

// Set text content
query.find('Price')
  .setText('99.99');

// Remove elements
const removed = query.find('Item')
  .whereAttribute('status', 'inactive')
  .removeElements();

// Add children to multiple elements
query.find('Order')
  .appendChild((parent) => {
    return new DynamicElement({
      name: 'ProcessedAt',
      text: new Date().toISOString()
    });
  });

// Clear children
query.find('Container')
  .clearChildren();

// Serialize results
const xmlStrings = query.find('Item').toXmlStrings();
const firstXml = query.find('Item').toXml();
```

## Complete Example: E-commerce Catalog

```typescript
import { XmlRoot, XmlDynamic, DynamicElement, XmlQuery, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Catalog' })
class Catalog {
  @XmlDynamic()
  dynamic!: DynamicElement;
}

const serializer = new XmlSerializer();

// Parse existing catalog
const xml = `
  <Catalog>
    <Product id="1" status="active">
      <Name>Laptop</Name>
      <Price>999.99</Price>
      <Stock>10</Stock>
    </Product>
    <Product id="2" status="inactive">
      <Name>Mouse</Name>
      <Price>29.99</Price>
      <Stock>0</Stock>
    </Product>
    <Product id="3" status="active">
      <Name>Keyboard</Name>
      <Price>79.99</Price>
      <Stock>15</Stock>
    </Product>
  </Catalog>
`;

const catalog = serializer.fromXml(xml, Catalog);
const query = new XmlQuery([catalog.dynamic]);

// 1. Apply discount to active products
const activeProducts = query.find('Product')
  .whereAttribute('status', 'active')
  .toArray();

for (const product of activeProducts) {
  const priceElement = product.children.find(c => c.name === 'Price');
  if (priceElement && priceElement.numericValue) {
    const discountedPrice = (priceElement.numericValue * 0.9).toFixed(2);
    priceElement.setText(discountedPrice);
  }
  product.setAttribute('discount', '10%');
}

// 2. Remove out-of-stock products
query.find('Product')
  .whereAttribute('status', 'inactive')
  .removeElements();

// 3. Add new products
const newProduct = catalog.dynamic.createChild({
  name: 'Product',
  attributes: { id: '4', status: 'active' }
});
newProduct.createChild({ name: 'Name', text: 'Monitor' });
newProduct.createChild({ name: 'Price', text: '299.99' });
newProduct.createChild({ name: 'Stock', text: '8' });

// 4. Add metadata
catalog.dynamic.setAttribute('lastUpdated', new Date().toISOString());
catalog.dynamic.createChild({
  name: 'ProductCount',
  text: String(catalog.dynamic.children.length)
});

// 5. Serialize back to XML
const updatedXml = catalog.dynamic.toXml({
  indent: '  ',
  includeDeclaration: true
});

console.log(updatedXml);
```

Output:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Catalog lastUpdated="2025-11-26T10:30:00.000Z">
  <Product id="1" status="active" discount="10%">
    <Name>Laptop</Name>
    <Price>899.99</Price>
    <Stock>10</Stock>
  </Product>
  <Product id="3" status="active" discount="10%">
    <Name>Keyboard</Name>
    <Price>71.99</Price>
    <Stock>15</Stock>
  </Product>
  <Product id="4" status="active">
    <Name>Monitor</Name>
    <Price>299.99</Price>
    <Stock>8</Stock>
  </Product>
  <ProductCount>3</ProductCount>
</Catalog>
```

## Creating XML from Scratch

You can also create XML documents programmatically:

```typescript
// Create root element
const config = new DynamicElement({
  name: 'Configuration',
  attributes: { version: '1.0' }
});

// Add database settings
const database = config.createChild({ name: 'Database' });
database.createChild({ name: 'Host', text: 'localhost' });
database.createChild({ name: 'Port', text: '5432' });
database.createChild({ name: 'Database', text: 'myapp' });

// Add credentials
const credentials = database.createChild({ name: 'Credentials' });
credentials.createChild({ name: 'Username', text: 'admin' });
credentials.createChild({ name: 'Password', text: 'secret' });

// Add logging settings
const logging = config.createChild({ name: 'Logging' });
logging.createChild({ name: 'Level', text: 'INFO' });
logging.createChild({ name: 'File', text: '/var/log/app.log' });

// Generate XML
const xml = config.toXml({ indent: '  ', includeDeclaration: true });
```

## Namespace Support

```typescript
// Create element with namespace
const element = new DynamicElement({
  name: 'xs:Element',  // Qualified name with prefix
  namespaceUri: 'http://www.w3.org/2001/XMLSchema'
});

// The prefix and localName are automatically computed:
// element.prefix === 'xs'
// element.localName === 'Element'

// Set namespace declarations
element.setNamespaceDeclaration('xs', 'http://www.w3.org/2001/XMLSchema');
element.setNamespaceDeclaration('', 'http://example.com/default'); // Default namespace

const xml = element.toXml();
// <xs:Element xmlns="http://example.com/default" xmlns:xs="http://www.w3.org/2001/XMLSchema"/>
```

## Best Practices

1. **Use XmlQuery for Batch Operations**: When modifying multiple elements, use `XmlQuery` for cleaner, more efficient code.

2. **Validate Before Serialization**: Check that your modifications are valid before serializing back to XML.

3. **Clone When Needed**: Use `clone()` to create copies when you need to modify elements without affecting the original.

4. **Handle Paths**: Element paths are automatically updated when you modify the tree structure.

5. **Escape Special Characters**: The serializer automatically escapes XML special characters (`<`, `>`, `&`, `"`, `'`).

6. **Preserve Structure**: When removing elements, indices are automatically updated for remaining elements.

## API Reference

### DynamicElement Methods

| Method | Description |
|--------|-------------|
| `addChild(child)` | Add a child element |
| `createChild(data)` | Create and add a child from data |
| `removeChild(child)` | Remove a child element |
| `remove()` | Remove this element from its parent |
| `update(data)` | Update element properties |
| `setAttribute(name, value)` | Set an attribute |
| `removeAttribute(name)` | Remove an attribute |
| `setText(text)` | Set text content |
| `clearChildren()` | Remove all children |
| `replaceChild(old, new)` | Replace a child element |
| `clone()` | Create a deep copy |
| `setNamespaceDeclaration(prefix, uri)` | Set namespace declaration |
| `toXml(options)` | Serialize to XML string |

### XmlQuery Mutation Methods

| Method | Description |
|--------|-------------|
| `setAttr(name, value)` | Set attribute on all matched elements |
| `removeAttr(name)` | Remove attribute from all matched elements |
| `setText(text)` | Set text on all matched elements |
| `updateElements(updates)` | Update properties on all matched elements |
| `removeElements()` | Remove all matched elements from their parents |
| `appendChild(child)` | Add child to all matched elements |
| `clearChildren()` | Clear children from all matched elements |
| `toXmlStrings(options)` | Serialize all matched elements to XML strings |
| `toXml(options)` | Serialize first matched element to XML string |

## See Also

- [Querying XML](./querying.md) - Learn about the query API
- [XPath Support](./querying.md#xpath-support) - Using XPath expressions
- [Namespaces](./namespaces.md) - Working with XML namespaces

