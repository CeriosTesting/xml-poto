# @cerios/xml-poto

A powerful TypeScript XML serialization library with decorator-based metadata. Provides type-safe, bidirectional XML-object mapping with support for namespaces, custom converters, validation, and flexible array handling.

[![npm version](https://img.shields.io/npm/v/@cerios/xml-poto.svg)](https://www.npmjs.com/package/@cerios/xml-poto)
[![npm downloads](https://img.shields.io/npm/dm/@cerios/xml-poto.svg)](https://www.npmjs.com/package/@cerios/xml-poto)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## ✨ Key Features

- 🎯 **Type-Safe** - Full TypeScript support with compile-time validation
- 🔄 **Bidirectional** - Seamless XML ↔ Object conversion
- 🏷️ **Decorator-Based** - Clean, declarative syntax
- 🔍 **Powerful Query API** - XPath-like querying with fluent interface
- ✏️ **Dynamic XML Manipulation** - Add, update, delete elements at runtime
- 🔁 **Full Serialization** - Parse, modify, and serialize back to XML
- 🌐 **Namespace Support** - Complete XML namespace handling
- ✅ **Validation** - Pattern matching, enums, and required fields
- 🔧 **Extensible** - Custom converters and transformations
- 📦 **Zero Config** - Sensible defaults, extensive customization

## 📦 Installation

```bash
npm install @cerios/xml-poto
```

### As a Dev Dependency

```bash
npm install --save-dev @cerios/xml-poto
```

> **Note:** This package uses standard TypeScript decorators and does **not** require `experimentalDecorators` or `emitDecoratorMetadata` in your `tsconfig.json`. It works with modern TypeScript configurations out of the box.

## 🎯 Quick Start

```typescript
import { XmlRoot, XmlElement, XmlAttribute, XmlSerializer } from '@cerios/xml-poto';

// 1. Define your class with decorators
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Email' })
    email: string = '';

    @XmlElement({ name: 'Age' })
    age?: number;
}

// 2. Create serializer
const serializer = new XmlSerializer();

// 3. Serialize to XML
const person = new Person();
person.id = '123';
person.name = 'John Doe';
person.email = 'john@example.com';
person.age = 30;

const xml = serializer.toXml(person);
console.log(xml);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <Person id="123">
//   <Name>John Doe</Name>
//   <Email>john@example.com</Email>
//   <Age>30</Age>
// </Person>

// 4. Deserialize from XML
const xmlString = `
    <Person id="456">
        <Name>Jane Smith</Name>
        <Email>jane@example.com</Email>
        <Age>25</Age>
    </Person>
`;

const deserializedPerson = serializer.fromXml(xmlString, Person);
console.log(deserializedPerson);
// Output: Person { id: '456', name: 'Jane Smith', email: 'jane@example.com', age: 25 }
```

## 🔁 Bi-directional XML (XmlDynamic)

Parse XML, modify it dynamically, and serialize back - perfect for XML transformation workflows:

```typescript
import { XmlRoot, XmlDynamic, DynamicElement, XmlQuery, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlDynamic()
    dynamic!: DynamicElement;  // Use DynamicElement (QueryableElement is deprecated)
}

const xml = `
  <Catalog>
    <Product id="1"><Name>Laptop</Name><Price>999</Price></Product>
    <Product id="2"><Name>Mouse</Name><Price>29</Price></Product>
  </Catalog>
`;

const catalog = serializer.fromXml(xml, Catalog);

// Query and modify
const query = new XmlQuery([catalog.dynamic]);
query.find('Product')
  .whereValueGreaterThan(100)
  .setAttr('premium', 'true');

// Add new elements
catalog.dynamic.createChild({
  name: 'Product',
  attributes: { id: '3' }
}).createChild({ name: 'Name', text: 'Keyboard' });

// Serialize back to XML
const updatedXml = catalog.dynamic.toXml({ indent: '  ' });
```

See [Bi-directional XML Guide](docs/features/bi-directional-xml.md) for complete documentation.

> **Note:** Use `DynamicElement` and `@XmlDynamic` for new code. `DynamicElement` and `@XmlDynamic` are deprecated but still supported.

## 📖 Documentation

### Getting Started
- [Installation & Setup](docs/getting-started.md#installation)
- [Your First Serialization](docs/getting-started.md#your-first-serialization)
- [Basic Concepts](docs/core-concepts.md)

### Core Features
- [Elements & Attributes](docs/features/elements-and-attributes.md) - Basic XML mapping
- [Text Content](docs/features/text-content.md) - Text nodes and CDATA
- [Arrays & Collections](docs/features/arrays.md) - Wrapped and unwrapped arrays
- [**Bi-directional XML (XmlDynamic)**](docs/features/bi-directional-xml.md) - ⭐ Parse, modify, and serialize XML
- [**XBRL Support**](docs/features/xbrl-support.md) - 🏦 Financial reporting with XBRL
- [Nested Objects](docs/features/nested-objects.md) - Complex hierarchies
- [Namespaces](docs/features/namespaces.md) - XML namespace support
- [Querying XML](docs/features/querying.md) - XPath-like queries and data extraction

### Advanced Features
- [Advanced Type Handling](docs/features/advanced-types.md) - `xsi:nil`, `xsi:type`, union types
- [Mixed Content](docs/features/mixed-content.md) - HTML-like content
- [Custom Converters](docs/features/converters.md) - Value transformations
- [Validation](docs/features/validation.md) - Patterns, enums, required fields
- [CDATA Sections](docs/features/cdata.md) - Preserve special characters
- [XML Comments](docs/features/comments.md) - Documentation in XML

### Reference
- [API Reference](docs/api-reference.md) - Complete API documentation
- [Decorator Reference](docs/api-reference.md#decorators)
- [Serialization Options](docs/api-reference.md#serialization-options)

### Examples
- [Real-World Scenarios](docs/examples/real-world.md)
- [Configuration Files](docs/examples/configuration.md)
- [API Responses](docs/examples/api-responses.md)
- [Blog Platform](docs/examples/blog-platform.md)

## 🎯 Common Use Cases

| Use Case | Feature | Documentation |
|----------|---------|---------------|
| REST API XML responses | Basic serialization | [Getting Started](docs/getting-started.md) |
| Configuration files | Nested objects, validation | [Nested Objects](docs/features/nested-objects.md) |
| RSS/Atom feeds | Unwrapped arrays | [Arrays](docs/features/arrays.md) |
| SOAP services | Namespaces | [Namespaces](docs/features/namespaces.md) |
| Blog content | Mixed content, CDATA | [Mixed Content](docs/features/mixed-content.md) |
| Data extraction | Query API, XPath | [Querying](docs/features/querying.md) |
| Code documentation | CDATA, comments | [CDATA](docs/features/cdata.md) |

## 🔧 Decorator Overview

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@XmlRoot` | Define root element | `@XmlRoot({ elementName: 'Person' })` |
| `@XmlElement` | Map to element | `@XmlElement({ name: 'Name' })` |
| `@XmlAttribute` | Map to attribute | `@XmlAttribute({ name: 'id' })` |
| `@XmlText` | Map to text content | `@XmlText()` |
| `@XmlComment` | Add XML comments | `@XmlComment()` |
| `@XmlArray` | Configure arrays | `@XmlArray({ itemName: 'Item' })` |
| `@XmlDynamic` | Enable query API | `@XmlDynamic()` |

[**Full API Reference →**](docs/api-reference.md)

## 💡 Why xml-poto?

### Traditional Approach ❌
```typescript
// Manual XML construction - error-prone
const xml = `<Person id="${id}"><Name>${name}</Name></Person>`;

// Manual parsing - tedious
const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');
const name = doc.querySelector('Name')?.textContent;
```

### With xml-poto ✅
```typescript
// Type-safe, automatic, validated
const xml = serializer.toXml(person);
const person = serializer.fromXml(xml, Person);
```

**Benefits:**
- ✅ Type safety at compile-time
- ✅ Automatic validation
- ✅ No string concatenation
- ✅ Bidirectional mapping
- ✅ IDE autocomplete

## 📝 Feature Highlights

### Query API - Extract Data with Ease
```typescript
@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlDynamic()  // Lazy-loaded and cached by default
    query!: DynamicElement;
}

const catalog = serializer.fromXml(xmlString, Catalog);

// Use XPath-like queries (QueryableElement built on first access)
const titles = catalog.query.find('Product').find('Title').texts();
const expensiveItems = catalog.query
    .find('Product')
    .whereValueGreaterThan(100);

// Navigate the tree
const parent = catalog.query.children[0].parent;
const siblings = catalog.query.children[0].siblings;
```
[Learn more about Querying →](docs/features/querying.md)

### Arrays - Flexible Collection Handling
```typescript
// Wrapped array
@XmlArray({ containerName: 'Books', itemName: 'Book', type: Book })
books: Book[] = [];
// <Books><Book>...</Book><Book>...</Book></Books>

// Unwrapped array
@XmlArray({ itemName: 'Item', type: Item })
items: Item[] = [];
// <Item>...</Item><Item>...</Item>
```
[Learn more about Arrays →](docs/features/arrays.md)

### Namespaces - Full XML Namespace Support
```typescript
const ns = { uri: 'http://example.com/schema', prefix: 'ex' };

@XmlRoot({ elementName: 'Document', namespace: ns })
class Document {
    @XmlElement({ name: 'Title', namespace: ns })
    title: string = '';
}
// <ex:Document xmlns:ex="http://example.com/schema">
//   <ex:Title>...</ex:Title>
// </ex:Document>
```
[Learn more about Namespaces →](docs/features/namespaces.md)

### Mixed Content - HTML-like Structures
```typescript
@XmlRoot({ elementName: 'Article' })
class Article {
    @XmlElement({ name: 'Content', mixedContent: true })
    content: any;
}
// Handles: <Content>Text <em>emphasis</em> more text</Content>
```
[Learn more about Mixed Content →](docs/features/mixed-content.md)

### Validation - Enforce Data Integrity
```typescript
@XmlAttribute({
    name: 'email',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
})
email: string = '';

@XmlElement({
    name: 'status',
    enum: ['active', 'inactive', 'pending']
})
status: string = '';
```
[Learn more about Validation →](docs/features/validation.md)

### Custom Converters - Transform Values
```typescript
const dateConverter = {
    serialize: (date: Date) => date.toISOString(),
    deserialize: (str: string) => new Date(str)
};

@XmlElement({ name: 'CreatedAt', converter: dateConverter })
createdAt: Date = new Date();
```
[Learn more about Converters →](docs/features/converters.md)

## 🎓 Best Practices

1. **Initialize properties**: Always provide default values
   ```typescript
   name: string = '';  // ✅ Good
   name: string;       // ❌ May cause issues
   ```

2. **Specify types for arrays**: Use the `type` parameter for complex objects
   ```typescript
   @XmlArray({ itemName: 'Item', type: Item })
   items: Item[] = [];
   ```

3. **Use validation for external data**: Apply `required`, `pattern`, `enum` for untrusted XML
   ```typescript
   @XmlAttribute({ name: 'id', required: true, pattern: /^\d+$/ })
   id: string = '';
   ```

4. **Test round-trip serialization**: Verify data integrity
   ```typescript
   const xml = serializer.toXml(original);
   const restored = serializer.fromXml(xml, MyClass);
   ```

## 🆚 Comparison

| Feature | xml-poto | Manual Parsing | Other Libraries |
|---------|----------|----------------|-----------------|
| Type Safety | ✅ Full | ❌ None | ⚠️ Partial |
| Bidirectional | ✅ Yes | ❌ No | ✅ Yes |
| Decorators | ✅ Yes | ❌ No | ⚠️ Some |
| Query API | ✅ XPath-like | ❌ No | ❌ No |
| Namespaces | ✅ Full | ⚠️ Manual | ⚠️ Limited |
| Validation | ✅ Built-in | ❌ Manual | ⚠️ External |
| Mixed Content | ✅ Yes | ⚠️ Complex | ❌ No |

## 🛠️ Advanced Topics

- [Processing Instructions](docs/features/processing-instructions.md)
- [DOCTYPE Declarations](docs/features/doctype.md)
- [Empty Element Syntax](docs/features/empty-elements.md)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

## 📄 License

MIT © Ronald Veth - Cerios

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/xml-poto)
- [NPM Package](https://www.npmjs.com/package/@cerios/xml-poto)
- [Issue Tracker](https://github.com/CeriosTesting/xml-poto/issues)
- [Changelog](CHANGELOG.md)

---

**Next Steps:**
- 📘 [Getting Started Guide](docs/getting-started.md)
- 📚 [Core Concepts](docs/core-concepts.md)
- 🎯 [Feature Guides](docs/features/)
- 📖 [API Reference](docs/api-reference.md)



