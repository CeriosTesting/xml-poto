# Getting Started

Welcome to **@cerios/xml-poto**! This guide will help you get up and running with type-safe XML serialization in TypeScript.

## Table of Contents

- [Installation](#installation)
- [Your First Serialization](#your-first-serialization)
- [Understanding the Basics](#understanding-the-basics)
- [Common Patterns](#common-patterns)
- [Next Steps](#next-steps)

## Installation

### NPM

```bash
npm install @cerios/xml-poto
```

### As a Dev Dependency

If you only need xml-poto during development (e.g., for build tools or testing):

```bash
npm install --save-dev @cerios/xml-poto
```

**Note:** No special TypeScript configuration is required. The package works with standard TypeScript decorators.

[↑ Back to top](#table-of-contents)

## Your First Serialization

Let's create a simple class and serialize it to XML.

### Step 1: Define Your Class

```typescript
import { XmlRoot, XmlElement, XmlAttribute, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Email' })
    email: string = '';

    @XmlElement({ name: 'Age' })
    age: number = 0;
}
```

**Key points:**
- `@XmlRoot` marks the class as the root XML element
- `@XmlElement` maps properties to XML elements
- `@XmlAttribute` maps properties to XML attributes
- **Always initialize properties** with default values

### Step 2: Serialize to XML

```typescript
const serializer = new XmlSerializer();

const person = new Person();
person.id = '123';
person.name = 'John Doe';
person.email = 'john@example.com';
person.age = 30;

const xml = serializer.toXml(person);
console.log(xml);
```

**Output:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Person id="123">
  <Name>John Doe</Name>
  <Email>john@example.com</Email>
  <Age>30</Age>
</Person>
```

### Step 3: Deserialize from XML

```typescript
const xmlString = `
<Person id="456">
    <Name>Jane Smith</Name>
    <Email>jane@example.com</Email>
    <Age>25</Age>
</Person>
`;

const person = serializer.fromXml(xmlString, Person);

console.log(person.name);  // 'Jane Smith'
console.log(person.age);   // 25
console.log(person instanceof Person);  // true
```

**That's it!** You've successfully serialized and deserialized your first object.

[↑ Back to top](#table-of-contents)

## Understanding the Basics

### Decorators Overview

xml-poto uses TypeScript decorators to define the XML structure:

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@XmlRoot` | Define root element | `@XmlRoot({ elementName: 'Book' })` |
| `@XmlElement` | Map property to element | `@XmlElement({ name: 'Title' })` |
| `@XmlAttribute` | Map property to attribute | `@XmlAttribute({ name: 'id' })` |
| `@XmlText` | Map property to text content | `@XmlText()` |

### The XmlSerializer

The `XmlSerializer` class handles all serialization and deserialization:

```typescript
const serializer = new XmlSerializer();

// Serialize object to XML string
const xml = serializer.toXml(myObject);

// Deserialize XML string to typed object
const obj = serializer.fromXml(xmlString, MyClass);
```

### Serialization Options

Customize the XML output with options:

```typescript
const xml = serializer.toXml(person, {
    format: true,              // Pretty print with indentation
    indentSize: 2,             // Number of spaces for indentation
    declaration: true,         // Include XML declaration
    omitNullValues: true,      // Exclude null/undefined values
    encoding: 'UTF-8'          // Character encoding
});
```

[↑ Back to top](#table-of-contents)

## Common Patterns

### Pattern 1: Attributes and Elements

```typescript
@XmlRoot({ elementName: 'Product' })
class Product {
    // Attributes - typically IDs, metadata
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlAttribute({ name: 'sku' })
    sku: string = '';

    // Elements - typically data content
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Price' })
    price: number = 0;

    @XmlElement({ name: 'Description' })
    description: string = '';
}
```

**Output:**
```xml
<Product id="001" sku="PROD-123">
    <Name>Laptop</Name>
    <Price>999.99</Price>
    <Description>High-performance laptop</Description>
</Product>
```

**Rule of thumb:**
- Use **attributes** for IDs, flags, and metadata
- Use **elements** for data content and nested structures

### Pattern 2: Text Content

When an element only contains text (no child elements), use `@XmlText`:

```typescript
@XmlRoot({ elementName: 'Message' })
class Message {
    @XmlAttribute({ name: 'type' })
    type: string = '';

    @XmlText()
    content: string = '';
}

const msg = new Message();
msg.type = 'info';
msg.content = 'Hello World';

// <Message type="info">Hello World</Message>
```

### Pattern 3: Optional Properties

Use TypeScript's optional properties for XML elements that may not always be present:

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Age' })
    age?: number;  // Optional

    @XmlElement({ name: 'Email' })
    email?: string;  // Optional
}
```

### Pattern 4: Nested Objects

```typescript
@XmlElement({ elementName: 'Address' })
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';

    @XmlElement({ name: 'Country' })
    country: string = '';
}

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Address', type: Address })
    address: Address = new Address();
}
```

**Output:**
```xml
<Person>
    <Name>John Doe</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>New York</City>
        <Country>USA</Country>
    </Address>
</Person>
```

### Pattern 5: Simple Arrays

```typescript
@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlArrayItem({ itemName: 'Book' })
    books: string[] = [];
}

const library = new Library();
library.name = 'City Library';
library.books = ['Book 1', 'Book 2', 'Book 3'];
```

**Output:**
```xml
<Library>
    <Name>City Library</Name>
    <Book>Book 1</Book>
    <Book>Book 2</Book>
    <Book>Book 3</Book>
</Library>
```

[↑ Back to top](#table-of-contents)

## Next Steps

Now that you understand the basics, explore more advanced features:

### Core Features
- **[Elements & Attributes](features/elements-and-attributes.md)** - Deep dive into element and attribute mapping
- **[Arrays & Collections](features/arrays.md)** - Working with arrays (wrapped and unwrapped)
- **[Nested Objects](features/nested-objects.md)** - Complex object hierarchies
- **[Text Content](features/text-content.md)** - Text nodes and CDATA sections

### Advanced Features
- **[Namespaces](features/namespaces.md)** - XML namespace support
- **[Querying](features/querying.md)** - XPath-like queries for data extraction
- **[Validation](features/validation.md)** - Pattern matching and required fields
- **[Custom Converters](features/converters.md)** - Transform values during serialization
- **[Mixed Content](features/mixed-content.md)** - HTML-like content with inline elements

### Reference
- **[API Reference](api-reference.md)** - Complete API documentation
- **[Examples](examples/)** - Real-world usage examples

### Quick Links

**Need help with:**
- [Working with dates?](features/converters.md#date-converter-example)
- [Handling HTML content?](features/mixed-content.md)
- [Extracting specific data?](features/querying.md)
- [Validating input?](features/validation.md)
- [SOAP/Web services?](features/namespaces.md#soap-example)

---

[← Back to README](../README.md) | [Core Concepts →](core-concepts.md)
