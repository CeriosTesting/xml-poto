# Core Concepts

This guide explains the fundamental concepts behind **@cerios/xml-poto** and how decorators enable type-safe XML serialization.

## Table of Contents

- [The Decorator Pattern](#the-decorator-pattern)
- [How It Works](#how-it-works)
- [The XmlSerializer](#the-xmlserializer)
- [Decorator Overview](#decorator-overview)
- [Type Safety](#type-safety)
- [Property Initialization](#property-initialization)
- [Bidirectional Mapping](#bidirectional-mapping)
- [Best Practices](#best-practices)

## The Decorator Pattern

xml-poto uses TypeScript decorators to add metadata to your classes. This metadata tells the serializer how to convert between XML and JavaScript objects.

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';
}
```

**Without decorators**, you would need to manually parse XML:
```typescript
// ❌ Manual approach - error-prone
const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');
const person = {
    id: doc.documentElement.getAttribute('id'),
    name: doc.querySelector('Name')?.textContent
};
```

**With decorators**, it's automatic and type-safe:
```typescript
// ✅ With xml-poto - clean and type-safe
const person = serializer.fromXml(xml, Person);
console.log(person.name); // TypeScript knows this is a string
```

[↑ Back to top](#table-of-contents)

## How It Works

### Step 1: Define Structure with Decorators

```typescript
@XmlRoot({ elementName: 'Book' })
class Book {
    @XmlAttribute({ name: 'isbn' })
    isbn: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';
}
```

### Step 2: Decorators Store Metadata

When your class is defined, decorators store metadata about:
- Which properties map to XML elements
- Which properties map to XML attributes
- Element names and namespaces
- Type information
- Validation rules

### Step 3: Serializer Uses Metadata

When you serialize or deserialize, the `XmlSerializer`:
1. Reads the stored metadata
2. Maps properties to/from XML structure
3. Applies any converters or validators
4. Creates properly typed objects

```typescript
const serializer = new XmlSerializer();

// Serialization: Object → XML
const xml = serializer.toXml(book);

// Deserialization: XML → Object
const book = serializer.fromXml(xml, Book);
```

[↑ Back to top](#table-of-contents)

## The XmlSerializer

The `XmlSerializer` is the main class you'll interact with.

### Creating a Serializer

```typescript
import { XmlSerializer } from '@cerios/xml-poto';

const serializer = new XmlSerializer();
```

**With strict validation (recommended for development):**
```typescript
const serializer = new XmlSerializer({
    strictValidation: true  // Catch configuration errors early
});
```

See [Strict Validation Mode](features/validation.md#strict-validation-mode) for details.

### Serializing Objects to XML

```typescript
const book = new Book();
book.isbn = '978-1234567890';
book.title = 'TypeScript Handbook';
book.author = 'Microsoft';

const xml = serializer.toXml(book);
```

**With options:**
```typescript
const xml = serializer.toXml(book, {
    format: true,           // Pretty print
    indentSize: 2,          // 2 spaces per indent
    declaration: true,      // Include <?xml version="1.0"?>
    omitNullValues: true,   // Exclude null/undefined values
    encoding: 'UTF-8',      // Character encoding
    strictValidation: true  // Validate type configuration (deserialization only)
});
```

### Deserializing XML to Objects

```typescript
const xmlString = `
<Book isbn="978-1234567890">
    <Title>TypeScript Handbook</Title>
    <Author>Microsoft</Author>
</Book>
`;

const book = serializer.fromXml(xmlString, Book);
console.log(book instanceof Book);  // true
```

[↑ Back to top](#table-of-contents)

## Decorator Overview

xml-poto provides several decorators for different XML structures:

### @XmlRoot

Marks a class as the root XML element. **Required** on the top-level class.

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    // ...
}
```

**Options:**
```typescript
interface XmlRootOptions {
    elementName: string;           // XML element name
    namespace?: XmlNamespace;      // Namespace (prefix and URI)
    ignoreUnknownElements?: boolean; // Ignore extra elements during deserialization
}
```

### @XmlElement

Maps a property to an XML element.

```typescript
@XmlElement({ name: 'FirstName' })
firstName: string = '';
```

**Options:**
```typescript
interface XmlElementOptions {
    name: string;                  // XML element name
    type?: Function;               // Type constructor for complex objects
    namespace?: XmlNamespace;      // Element namespace
    required?: boolean;            // Validation: element must be present
    converter?: Converter;         // Custom value transformation
    useCDATA?: boolean;            // Wrap in CDATA section
    mixedContent?: boolean;        // Support HTML-like mixed content
    enum?: string[];               // Validation: allowed values
    pattern?: RegExp;              // Validation: value must match pattern
}
```

### @XmlAttribute

Maps a property to an XML attribute.

```typescript
@XmlAttribute({ name: 'id' })
id: string = '';
```

**Options:**
```typescript
interface XmlAttributeOptions {
    name: string;                  // XML attribute name
    namespace?: XmlNamespace;      // Attribute namespace
    required?: boolean;            // Validation: attribute must be present
    converter?: Converter;         // Custom value transformation
    enum?: string[];               // Validation: allowed values
    pattern?: RegExp;              // Validation: value must match pattern
}
```

### @XmlText

Maps a property to the element's text content.

```typescript
@XmlRoot({ elementName: 'Message' })
class Message {
    @XmlAttribute({ name: 'type' })
    type: string = '';

    @XmlText()
    content: string = '';
}

// <Message type="info">Hello World</Message>
```

### @XmlArray

Configures array serialization.

```typescript
// Unwrapped array
@XmlArray({ itemName: 'Item' })
items: string[] = [];

// Wrapped array
@XmlArray({ containerName: 'Items', itemName: 'Item' })
items: string[] = [];
```

**Options:**
```typescript
interface XmlArrayOptions {
    itemName: string;              // Name for each array item
    containerName?: string;        // Optional container element
    type?: Function;               // Type constructor for complex objects
    namespace?: XmlNamespace;      // Namespace for items
}
```

### @XmlComment

Adds XML comments to the output.

```typescript
@XmlComment()
description: string = 'This is a comment';
```

### @XmlQueryable

Enables query API for data extraction with lazy loading and caching.

```typescript
@XmlQueryable()
query!: QueryableElement;
```

**Key features:**
- Lazy loading: Built only when first accessed (improves deserialization performance)
- Caching: Results cached by default for instant repeated access
- Flexible: Can target specific properties or entire document

**See:** [Querying XML Guide](features/querying.md)

[↑ Back to top](#table-of-contents)

## Type Safety

One of xml-poto's biggest advantages is **full TypeScript support**.

### Compile-Time Type Checking

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Age' })
    age: number = 0;
}

const person = serializer.fromXml(xml, Person);

// ✅ TypeScript knows the types
const name: string = person.name;
const age: number = person.age;

// ❌ TypeScript catches errors
person.age = "thirty";  // Error: Type 'string' is not assignable to type 'number'
```

### IDE Autocomplete

TypeScript provides autocomplete for your decorated classes:

```typescript
const person = new Person();
person.  // IDE shows: name, age, and other properties
```

### Type Inference

The serializer preserves types during deserialization:

```typescript
@XmlRoot({ elementName: 'Config' })
class Config {
    @XmlElement({ name: 'Port' })
    port: number = 0;

    @XmlElement({ name: 'Enabled' })
    enabled: boolean = false;
}

const xml = `
<Config>
    <Port>8080</Port>
    <Enabled>true</Enabled>
</Config>
`;

const config = serializer.fromXml(xml, Config);
console.log(typeof config.port);     // 'number'
console.log(typeof config.enabled);  // 'boolean'
```

[↑ Back to top](#table-of-contents)

## Property Initialization

**Always initialize properties with default values.** This is critical for proper serialization.

### ✅ Good Practice

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';  // ✅ Initialized

    @XmlElement({ name: 'Age' })
    age: number = 0;  // ✅ Initialized

    @XmlElement({ name: 'Email' })
    email?: string;  // ✅ Optional properties can be undefined
}
```

### ❌ Bad Practice

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string;  // ❌ Not initialized - may cause issues

    @XmlElement({ name: 'Age' })
    age: number;  // ❌ Not initialized - may cause issues
}
```

### Why?

Decorators run when the class is **defined**, not when instances are created. Uninitialized properties can cause:
- Incorrect metadata registration
- Missing properties in serialized XML
- Deserialization errors

### For Complex Objects

```typescript
@XmlElement({ elementName: 'Address' })
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';
}

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    // ✅ Initialize complex objects
    @XmlElement({ name: 'Address', type: Address })
    address: Address = new Address();
}
```

[↑ Back to top](#table-of-contents)

## Bidirectional Mapping

xml-poto supports **bidirectional** mapping: Objects ↔ XML.

### Object to XML (Serialization)

```typescript
const person = new Person();
person.name = 'John Doe';
person.age = 30;

const xml = serializer.toXml(person);
```

**Result:**
```xml
<Person>
    <Name>John Doe</Name>
    <Age>30</Age>
</Person>
```

### XML to Object (Deserialization)

```typescript
const xml = `
<Person>
    <Name>Jane Smith</Name>
    <Age>25</Age>
</Person>
`;

const person = serializer.fromXml(xml, Person);
```

**Result:**
```typescript
Person {
    name: 'Jane Smith',
    age: 25
}
```

### Round-Trip Consistency

Data should survive a round trip:

```typescript
// Original object
const original = new Person();
original.name = 'John Doe';
original.age = 30;

// Serialize to XML
const xml = serializer.toXml(original);

// Deserialize back to object
const restored = serializer.fromXml(xml, Person);

// Should be equivalent
console.log(restored.name === original.name);  // true
console.log(restored.age === original.age);    // true
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use Descriptive Element Names

```typescript
// ✅ Good - clear XML structure
@XmlElement({ name: 'FirstName' })
firstName: string = '';

@XmlElement({ name: 'LastName' })
lastName: string = '';

// ❌ Bad - unclear XML
@XmlElement({ name: 'FN' })
firstName: string = '';
```

### 2. Follow XML Naming Conventions

```typescript
// ✅ PascalCase for elements (common convention)
@XmlElement({ name: 'FirstName' })

// ✅ camelCase for attributes (common convention)
@XmlAttribute({ name: 'userId' })

// Consistency is key!
```

### 3. Use Attributes for Metadata

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    // ✅ Attributes for IDs, types, flags
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlAttribute({ name: 'version' })
    version: string = '';

    // ✅ Elements for content
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Content' })
    content: string = '';
}
```

### 4. Initialize All Properties

```typescript
@XmlRoot({ elementName: 'Config' })
class Config {
    // ✅ Initialize with defaults
    @XmlElement({ name: 'Host' })
    host: string = 'localhost';

    @XmlElement({ name: 'Port' })
    port: number = 8080;

    @XmlElement({ name: 'Timeout' })
    timeout: number = 30000;
}
```

### 5. Use Optional Properties Wisely

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    // Required fields
    @XmlElement({ name: 'Name' })
    name: string = '';

    // Optional fields
    @XmlElement({ name: 'MiddleName' })
    middleName?: string;

    @XmlElement({ name: 'Suffix' })
    suffix?: string;
}
```

### 6. Leverage Type Parameter for Arrays

```typescript
@XmlElement({ elementName: 'Book' })
class Book {
    @XmlElement({ name: 'Title' })
    title: string = '';
}

@XmlRoot({ elementName: 'Library' })
class Library {
    // ✅ Specify type for complex objects
    @XmlArray({ itemName: 'Book', type: Book })
    books: Book[] = [];
}
```

### 7. Test Round-Trip Serialization

```typescript
describe('Person Serialization', () => {
    it('should survive round-trip', () => {
        const original = new Person();
        original.name = 'John Doe';
        original.age = 30;

        const xml = serializer.toXml(original);
        const restored = serializer.fromXml(xml, Person);

        expect(restored.name).toBe(original.name);
        expect(restored.age).toBe(original.age);
    });
});
```

### 8. Use Validation for External Data

```typescript
@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({
        name: 'Email',
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    })
    email: string = '';

    @XmlElement({
        name: 'Status',
        enum: ['active', 'inactive', 'pending']
    })
    status: string = 'pending';
}
```

### 9. Enable Strict Validation in Development

```typescript
// Development environment
const devSerializer = new XmlSerializer({
    strictValidation: true  // Catch missing type parameters
});

// Production environment
const prodSerializer = new XmlSerializer({
    strictValidation: false  // More lenient for legacy data
});
```

**Why?** Strict validation catches common configuration errors where nested objects lack proper type information, preventing runtime issues with features like `@XmlQueryable`.

[↑ Back to top](#table-of-contents)

---

## What's Next?

Now that you understand the core concepts, explore specific features:

### Core Features
- **[Elements & Attributes](features/elements-and-attributes.md)** - Detailed element and attribute mapping
- **[Arrays & Collections](features/arrays.md)** - Working with arrays
- **[Nested Objects](features/nested-objects.md)** - Complex hierarchies
- **[Text Content](features/text-content.md)** - Text nodes and CDATA

### Advanced Features
- **[Namespaces](features/namespaces.md)** - XML namespace support
- **[Querying](features/querying.md)** - XPath-like queries
- **[Validation](features/validation.md)** - Data validation
- **[Custom Converters](features/converters.md)** - Value transformations
- **[Mixed Content](features/mixed-content.md)** - HTML-like structures

---

[← Getting Started](getting-started.md) | [Home](../README.md) | [Elements & Attributes →](features/elements-and-attributes.md)
