# @cerios/xml-poto

A powerful TypeScript XML serialization library with decorator-based metadata. Provides type-safe, bidirectional XML-object mapping with support for namespaces, custom converters, validation, and flexible array handling.

## 🚀 Features

- **Decorator-Based Metadata**: Simple, declarative syntax using TypeScript decorators
- **Bidirectional Mapping**: Seamlessly serialize objects to XML and deserialize XML back to typed objects
- **Namespace Support**: Full XML namespace handling with prefixes and default namespaces
- **Type Safety**: Leverage TypeScript's type system for compile-time validation
- **Custom Converters**: Transform values during serialization/deserialization
- **Validation**: Pattern matching, enum validation, and required field enforcement
- **Flexible Arrays**: Support for both wrapped and unwrapped array structures
- **Nested Objects**: Handle deeply nested object hierarchies with ease
- **Attribute & Element Support**: Map properties to XML attributes or elements
- **Text Content Mapping**: Map properties to XML text content
- **CDATA Support**: Preserve special characters (HTML, code) with CDATA sections
- **XML Comments**: Add documentation and metadata comments to XML output
- **Advanced Type Handling**:
  - `xsi:nil` for nullable fields
  - `xsi:type` for polymorphic serialization
  - Union types (e.g., `number | string`) with automatic type detection
- **Mixed Content Support**: Handle elements with interspersed text and child elements (HTML-like structures)
- **Zero Configuration**: Sensible defaults with extensive customization options

## 📦 Installation

```bash
npm install @cerios/xml-poto
```

### Dependencies

```bash
npm install fast-xml-parser
```

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

## 📖 Decorator Reference

| Decorator | Purpose | Use Case |
|-----------|---------|----------|
| `@XmlRoot` | Define the root element | Class-level decorator for top-level XML element |
| `@XmlElement` | Map to XML element | Class or field-level for element mapping |
| `@XmlAttribute` | Map to XML attribute | Field-level for attribute mapping |
| `@XmlText` | Map to XML text content | Field-level for text node content |
| `@XmlComment` | Add XML comments | Field-level for adding comments to XML output |
| `@XmlArrayItem` | Configure array serialization | Field-level for array element configuration |

## 🔧 Basic Usage

### 1. Simple Object Mapping

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Book' })
class Book {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';

    @XmlElement({ name: 'ISBN' })
    isbn: string = '';

    @XmlElement({ name: 'PublishedYear' })
    year?: number;
}

const serializer = new XmlSerializer();

// Serialize
const book = new Book();
book.title = 'TypeScript Handbook';
book.author = 'Microsoft';
book.isbn = '978-1234567890';
book.year = 2024;

const xml = serializer.toXml(book);
```

### 2. Using Attributes

```typescript
import { XmlRoot, XmlElement, XmlAttribute } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlAttribute({ name: 'sku' })
    sku: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Price' })
    price: number = 0;
}

const product = new Product();
product.id = 'PROD-001';
product.sku = 'SKU-12345';
product.name = 'Laptop';
product.price = 999.99;

const xml = serializer.toXml(product);
// Output:
// <Product id="PROD-001" sku="SKU-12345">
//   <Name>Laptop</Name>
//   <Price>999.99</Price>
// </Product>
```

### 3. Text Content

```typescript
import { XmlRoot, XmlAttribute, XmlText } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Message' })
class Message {
    @XmlAttribute({ name: 'type' })
    type: string = '';

    @XmlText()
    content: string = '';
}

const message = new Message();
message.type = 'info';
message.content = 'This is a message';

const xml = serializer.toXml(message);
// Output:
// <Message type="info">This is a message</Message>
```

### 4. CDATA Sections

Wrap content in CDATA sections to preserve special characters (HTML, XML, code):

```typescript
import { XmlRoot, XmlElement, XmlText, XmlAttribute } from '@cerios/xml-poto';

// Using @XmlText with CDATA
@XmlRoot({ elementName: 'Script' })
class ScriptTag {
    @XmlAttribute({ name: 'type' })
    type: string = 'text/javascript';

    @XmlText({ useCDATA: true })
    code: string = 'if (x < 10 && y > 5) { alert("<Hello>"); }';
}

const script = new ScriptTag();
const xml = serializer.toXml(script);
// Output:
// <Script type="text/javascript"><![CDATA[if (x < 10 && y > 5) { alert("<Hello>"); }]]></Script>

// Using @XmlElement with CDATA
@XmlRoot({ elementName: 'BlogPost' })
class BlogPost {
    @XmlElement({ name: 'Title' })
    title: string = 'XML Guide';

    @XmlElement({ name: 'Content', useCDATA: true })
    content: string = '<p>This is <strong>HTML</strong> content with <a href="#">links</a></p>';
}

const post = new BlogPost();
const postXml = serializer.toXml(post);
// Output:
// <BlogPost>
//   <Title>XML Guide</Title>
//   <Content><![CDATA[<p>This is <strong>HTML</strong> content with <a href="#">links</a></p>]]></Content>
// </BlogPost>

// Deserialization automatically handles CDATA
const deserialized = serializer.fromXml(postXml, BlogPost);
console.log(deserialized.content); // Original HTML preserved
```

**Common CDATA Use Cases:**
- HTML/XML content within XML documents
- JavaScript/CSS code snippets
- SQL queries with comparison operators
- JSON data embedded in XML
- Any content with `<`, `>`, `&`, quotes that shouldn't be escaped

### 5. XML Comments

Add comments to your XML documents for documentation, metadata, or debugging:

```typescript
import { XmlRoot, XmlElement, XmlComment, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Content' })
    content: string = '';
}

const doc = new Document();
doc.comment = 'This document was auto-generated on 2024-01-15';
doc.title = 'Report';
doc.content = 'Annual summary';

const serializer = new XmlSerializer();
const xml = serializer.toXml(doc);
console.log(xml);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <Document>
//   <!--This document was auto-generated on 2024-01-15-->
//   <Title>Report</Title>
//   <Content>Annual summary</Content>
// </Document>
```

**Required Comments:**

```typescript
@XmlRoot({ elementName: 'Report' })
class Report {
    @XmlComment({ required: true })
    metadata: string = '';

    @XmlElement({ name: 'Data' })
    data: string = '';
}

// Will throw error if metadata is missing
const report = new Report();
report.data = 'Some data';
serializer.toXml(report); // Error: Required comment is missing
```

**Common Comment Use Cases:**
- Document generation metadata (timestamps, versions)
- Human-readable documentation for XML consumers
- Debugging information during development
- Legal disclaimers or copyright notices
- Processing instructions or notes
- TODO markers for incomplete sections

**Note:** Comments are one-way only (serialization to XML). They are not preserved during deserialization as they are typically metadata rather than data.

### 6. Nested Objects

```typescript
import { XmlRoot, XmlElement } from '@cerios/xml-poto';

@XmlElement('Address')
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';

    @XmlElement({ name: 'Country' })
    country: string = '';
}

@XmlRoot({ elementName: 'Customer' })
class Customer {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Email' })
    email: string = '';

    @XmlElement({ name: 'Address' })
    address: Address = new Address();
}

const customer = new Customer();
customer.name = 'Alice Johnson';
customer.email = 'alice@example.com';
customer.address.street = '123 Main St';
customer.address.city = 'New York';
customer.address.country = 'USA';

const xml = serializer.toXml(customer);
// Output:
// <Customer>
//   <Name>Alice Johnson</Name>
//   <Email>alice@example.com</Email>
//   <Address>
//     <Street>123 Main St</Street>
//     <City>New York</City>
//     <Country>USA</Country>
//   </Address>
// </Customer>
```

### 7. Advanced Type Handling

#### xsi:nil for Nullable Fields

Handle nullable XML elements with `xsi:nil="true"` attribute:

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'MiddleName', isNullable: true })
    middleName: string | null = null;

    @XmlElement({ name: 'Age', isNullable: true })
    age: number | null = null;
}

const person = new Person();
person.name = 'John Doe';
person.middleName = null;  // Will generate xsi:nil="true"
person.age = 30;

const serializer = new XmlSerializer();
const xml = serializer.toXml(person);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <Person xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
//   <Name>John Doe</Name>
//   <MiddleName xsi:nil="true"></MiddleName>
//   <Age>30</Age>
// </Person>
```

#### xsi:type for Polymorphism

Enable runtime type detection with `xsi:type` attributes:

```typescript
@XmlElement('Animal')
class Animal {
    @XmlElement({ name: 'Name' })
    name: string = '';
}

@XmlElement('Dog')
class Dog extends Animal {
    @XmlElement({ name: 'Breed' })
    breed: string = '';
}

@XmlRoot({ elementName: 'Zoo' })
class Zoo {
    @XmlElement({ name: 'MainAnimal', type: Animal })
    mainAnimal: Animal = new Animal();
}

const serializerWithXsiType = new XmlSerializer({ useXsiType: true });
const zoo = new Zoo();
zoo.mainAnimal = new Dog();  // Runtime type differs from declared type

const xml = serializerWithXsiType.toXml(zoo);
// Output includes: xsi:type="Dog"
```

#### Union Types

Support properties that can be multiple types (string | number | boolean):

```typescript
@XmlRoot({ elementName: 'Config' })
class Config {
    @XmlElement({ name: 'Port', unionTypes: [Number, String] })
    port: number | string = 8080;

    @XmlElement({ name: 'Enabled', unionTypes: [Boolean, String] })
    enabled: boolean | string = true;

    @XmlElement({ name: 'Timeout', unionTypes: [Number, String] })
    timeout: number | string = '30s';
}

const xml = `<?xml version="1.0"?>
<Config>
  <Port>3000</Port>
  <Enabled>true</Enabled>
  <Timeout>default</Timeout>
</Config>`;

const serializer = new XmlSerializer();
const config = serializer.fromXml(xml, Config);
// config.port = 3000 (number)
// config.enabled = true (boolean)
// config.timeout = "default" (string - not a valid number)
```

**Union Type Conversion Priority:**
1. **Number**: Tries numeric conversion first (most specific)
2. **Boolean**: Converts 'true'/'false'/'1'/'0' to boolean
3. **String**: Fallback for non-convertible values

### 8. Mixed Content

Handle elements containing both text and child elements interspersed together (HTML-like content). This is perfect for rich text content, blog posts, documentation, and any scenario where text and inline elements need to coexist.

**What is Mixed Content?**

Mixed content refers to XML elements that contain both text nodes and child elements at the same level, like HTML paragraphs with inline formatting:

```xml
<p>This is <strong>bold</strong> text with <a href="#">a link</a>.</p>
```

**Basic Usage:**

```typescript
@XmlRoot({ elementName: 'BlogPost' })
class BlogPost {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Content', mixedContent: true })
    content: Array<{
        text?: string;
        element?: string;
        content?: string | any[];
        attributes?: Record<string, string>;
    }> = [];
}

const post = new BlogPost();
post.title = 'Getting Started';
post.content = [
    { text: 'Welcome to ' },
    { element: 'strong', content: 'XML serialization' },
    { text: '. Visit ' },
    {
        element: 'a',
        content: 'our docs',
        attributes: { href: 'https://docs.example.com', target: '_blank' }
    },
    { text: ' for more info.' }
];

const serializer = new XmlSerializer();
const xml = serializer.toXml(post);
```

**Output:**
```xml
<BlogPost>
  <Title>Getting Started</Title>
  <Content>Welcome to <strong>XML serialization</strong>. Visit <a href="https://docs.example.com" target="_blank">our docs</a> for more info.</Content>
</BlogPost>
```

**Mixed Content Array Format:**

Each item in the array can be one of:

1. **Text node:**
   ```typescript
   { text: 'Plain text content' }
   ```

2. **Element with text content:**
   ```typescript
   { element: 'strong', content: 'bold text' }
   ```

3. **Element with attributes:**
   ```typescript
   {
       element: 'a',
       content: 'link text',
       attributes: { href: 'https://example.com', class: 'link' }
   }
   ```

4. **Element with nested mixed content:**
   ```typescript
   {
       element: 'div',
       content: [
           { text: 'Text with ' },
           { element: 'span', content: 'nested element' }
       ]
   }
   ```

**Real-World Example - Blog Post:**

```typescript
@XmlRoot({ elementName: 'Article' })
class Article {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';

    @XmlElement({ name: 'Body', mixedContent: true })
    body: any[] = [];
}

const article = new Article();
article.id = 'art-001';
article.title = 'TypeScript Best Practices';
article.author = 'Jane Developer';
article.body = [
    { text: 'When writing ' },
    { element: 'code', content: 'TypeScript' },
    { text: ' code, always use ' },
    { element: 'strong', content: 'type annotations' },
    { text: '. For more information, check out the ' },
    {
        element: 'a',
        content: 'official documentation',
        attributes: {
            href: 'https://www.typescriptlang.org/docs',
            target: '_blank',
            rel: 'noopener'
        }
    },
    { text: ' or read our ' },
    { element: 'em', content: 'advanced guide' },
    { text: '.' }
];

const xml = serializer.toXml(article);
```

**Deserialization:**

The library includes a **custom XML parser** specifically designed to handle mixed content during deserialization. When you mark a field with `mixedContent: true`, the parser automatically routes to this custom parser:

```typescript
const xml = `
<Article id="art-002">
    <Title>Advanced Techniques</Title>
    <Author>Expert Developer</Author>
    <Body>Learn about <strong>advanced patterns</strong> in XML. These techniques allow you to handle <em>complex scenarios</em> with ease. Visit <a href="https://github.com/example" class="link">our GitHub</a> for examples.</Body>
</Article>
`;

const article = serializer.fromXml(xml, Article);

// article.body will be:
// [
//     { text: 'Learn about ' },
//     { element: 'strong', content: 'advanced patterns' },
//     { text: ' in XML. These techniques allow you to handle ' },
//     { element: 'em', content: 'complex scenarios' },
//     { text: ' with ease. Visit ' },
//     { element: 'a', content: 'our GitHub', attributes: { href: '...', class: 'link' } },
//     { text: ' for examples.' }
// ]
```

**Nested Elements:**

The custom parser handles nested inline elements correctly:

```typescript
const xml = `
<Paragraph>
    <Content>This is <strong>bold with <em>italic</em> inside</strong> text.</Content>
</Paragraph>
`;

const para = serializer.fromXml(xml, Paragraph);

// para.content will be:
// [
//     { text: 'This is ' },
//     {
//         element: 'strong',
//         content: [
//             { text: 'bold with ' },
//             { element: 'em', content: 'italic' },
//             { text: ' inside' }
//         ]
//     },
//     { text: ' text.' }
// ]
```

**Round-Trip Support:**

Mixed content fully supports round-trip serialization:

```typescript
// Serialize
const original = new BlogPost();
original.content = [
    { text: 'Text with ' },
    { element: 'strong', content: 'formatting' }
];

const xml = serializer.toXml(original);

// Deserialize
const restored = serializer.fromXml(xml, BlogPost);

// restored.content matches original.content structure
```

**Custom Parser Details:**

The library uses a **hybrid parsing strategy**:
- **Standard XML**: Uses fast-xml-parser (fast and reliable)
- **Mixed Content**: Automatically switches to custom parser when `mixedContent: true` is detected

This ensures optimal performance while providing accurate mixed content handling.

**Common Use Cases:**

- **Documentation systems** with inline code snippets and formatting
- **Blog platforms** with rich text content
- **HTML-like content** in XML format
- **Technical writing** with inline citations and references
- **Email templates** with styled text and links
- **CMS content** with embedded formatting tags

**Type Safety:**

For better type safety, define your mixed content type:

```typescript
type MixedContentNode =
    | { text: string }
    | { element: string; content: string | MixedContentNode[]; attributes?: Record<string, string> };

@XmlElement({ name: 'Content', mixedContent: true })
content: MixedContentNode[] = [];
```

**Performance Notes:**

- Serialization of mixed content is fast and efficient
- Deserialization uses a custom tokenizer and parser for accuracy
- The hybrid approach ensures non-mixed-content fields remain performant
- Whitespace in text nodes is preserved exactly as specified
- Full bidirectional support with round-trip integrity

**Choosing the Right Approach:**

All three approaches are fully supported. Choose based on your use case:

```typescript
// ✅ Mixed Content - Text and elements interspersed (parsed structure)
// Best for: Rich text editors, documentation with inline formatting, blog content
content: [
    { text: 'Hello ' },
    { element: 'b', content: 'world' }
]
// → <content>Hello <b>world</b></content>
// Deserializes back to structured array with full element/attribute information

// ✅ CDATA - Raw HTML/XML markup (preserved as-is)
// Best for: HTML snippets, pre-formatted code, when you need the exact string
content: '<p>Hello <b>world</b></p>'
// → <content><![CDATA[<p>Hello <b>world</b></p>]]></content>
// Deserializes back to the exact string

// ✅ Nested Objects - Structured hierarchical data
// Best for: Strongly-typed nested structures, complex data models
content: { paragraph: { bold: 'world' } }
// → <content><paragraph><bold>world</bold></paragraph></content>
// Deserializes back to typed object instances
```

**Why Use Mixed Content?**

Mixed content is the only approach that:
- Preserves the semantic structure of inline elements (tag names, attributes)
- Allows programmatic manipulation of individual text and element nodes
- Maintains proper XML structure (not escaped as text like CDATA)
- Provides type-safe access to element properties and attributes
- Handles deeply nested inline elements correctly

## 🎯 Advanced Examples

### Arrays with Wrapped Elements

Use `@XmlArrayItem` with `containerName` and `itemName` to create wrapped arrays:

```typescript
import { XmlRoot, XmlElement, XmlArrayItem } from '@cerios/xml-poto';

@XmlElement('Item')
class Item {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Quantity' })
    quantity: number = 0;
}

@XmlRoot({ elementName: 'Order' })
class Order {
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlArrayItem({
        containerName: 'Items',
        itemName: 'Item',
        type: Item
    })
    items: Item[] = [];
}

const order = new Order();
order.id = 'ORD-001';

const item1 = new Item();
item1.name = 'Widget';
item1.quantity = 5;

const item2 = new Item();
item2.name = 'Gadget';
item2.quantity = 3;

order.items = [item1, item2];

const xml = serializer.toXml(order);
// Output:
// <Order id="ORD-001">
//   <Items>
//     <Item>
//       <Name>Widget</Name>
//       <Quantity>5</Quantity>
//     </Item>
//     <Item>
//       <Name>Gadget</Name>
//       <Quantity>3</Quantity>
//     </Item>
//   </Items>
// </Order>
```

### Unwrapped Arrays

Omit `containerName` for unwrapped arrays where items appear directly in the parent element:

```typescript
@XmlRoot({ elementName: 'RssChannel' })
class RssChannel {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlArrayItem({ itemName: 'Item', type: RssItem })
    items: RssItem[] = [];
}

// XML Output:
// <RssChannel>
//   <Title>News Feed</Title>
//   <Item>...</Item>
//   <Item>...</Item>
// </RssChannel>
```

### Custom Converters

Transform values during serialization and deserialization:

```typescript
import { XmlRoot, XmlElement } from '@cerios/xml-poto';

const dateConverter = {
    serialize: (value: Date) => value.toISOString(),
    deserialize: (value: string) => new Date(value)
};

@XmlRoot({ elementName: 'Event' })
class Event {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({
        name: 'Date',
        converter: dateConverter
    })
    date: Date = new Date();
}

const event = new Event();
event.name = 'Conference 2024';
event.date = new Date('2024-06-15');

const xml = serializer.toXml(event);
// Output:
// <Event>
//   <Name>Conference 2024</Name>
//   <Date>2024-06-15T00:00:00.000Z</Date>
// </Event>

// Deserialize back to Date object
const deserialized = serializer.fromXml(xml, Event);
console.log(deserialized.date instanceof Date); // true
```

### Validation with Patterns and Enums

Enforce data constraints during deserialization:

```typescript
import { XmlRoot, XmlAttribute, XmlElement } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'User' })
class User {
    @XmlAttribute({
        name: 'id',
        pattern: /^USR-\d{6}$/,
        required: true
    })
    id: string = '';

    @XmlElement({
        name: 'Email',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        required: true
    })
    email: string = '';

    @XmlElement({
        name: 'Role',
        enum: ['admin', 'user', 'guest']
    })
    role: string = 'user';
}

// Valid XML
const validXml = `
    <User id="USR-123456">
        <Email>user@example.com</Email>
        <Role>admin</Role>
    </User>
`;

const user = serializer.fromXml(validXml, User); // ✅ Success

// Invalid XML - will throw error
const invalidXml = `
    <User id="INVALID">
        <Email>invalid-email</Email>
        <Role>superuser</Role>
    </User>
`;

try {
    serializer.fromXml(invalidXml, User);
} catch (error) {
    console.error(error.message); // Validation error
}
```

### XML Namespaces

Handle XML namespaces with prefixes and default namespaces:

```typescript
import { XmlRoot, XmlElement, XmlAttribute } from '@cerios/xml-poto';

@XmlRoot({
    elementName: 'Book',
    namespace: { uri: 'http://example.com/books', prefix: 'bk' }
})
class Book {
    @XmlAttribute({
        name: 'lang',
        namespace: { uri: 'http://www.w3.org/XML/1998/namespace', prefix: 'xml' }
    })
    language: string = 'en';

    @XmlElement({
        name: 'Title',
        namespace: { uri: 'http://example.com/books', prefix: 'bk' }
    })
    title: string = '';

    @XmlElement({
        name: 'Author',
        namespace: { uri: 'http://example.com/books', prefix: 'bk' }
    })
    author: string = '';
}

const book = new Book();
book.language = 'en';
book.title = 'XML Guide';
book.author = 'John Smith';

const xml = serializer.toXml(book);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <bk:Book xmlns:bk="http://example.com/books" xmlns:xml="http://www.w3.org/XML/1998/namespace" xml:lang="en">
//   <bk:Title>XML Guide</bk:Title>
//   <bk:Author>John Smith</bk:Author>
// </bk:Book>
```

### Default Namespace

```typescript
@XmlRoot({
    elementName: 'Document',
    namespace: { uri: 'http://example.com/default', isDefault: true }
})
class Document {
    @XmlElement({ name: 'Content' })
    content: string = '';
}

// Output:
// <Document xmlns="http://example.com/default">
//   <Content>Test content</Content>
// </Document>
```

### Deeply Nested Structures

Handle complex nested hierarchies:

```typescript
@XmlElement('Country')
class Country {
    @XmlElement({ name: 'Name' })
    name: string = '';
}

@XmlElement('State')
class State {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Country' })
    country: Country = new Country();
}

@XmlElement('City')
class City {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'State' })
    state: State = new State();
}

@XmlRoot({ elementName: 'Location' })
class Location {
    @XmlElement({ name: 'City' })
    city: City = new City();
}

const location = new Location();
location.city.name = 'Portland';
location.city.state.name = 'Oregon';
location.city.state.country.name = 'USA';

const xml = serializer.toXml(location);

// Deserialize preserves full structure
const deserialized = serializer.fromXml(xml, Location);
console.log(deserialized.city.state.country.name); // 'USA'
```

## 🧪 Serialization Options

Customize serialization behavior:

```typescript
import { XmlSerializer, SerializationOptions } from '@cerios/xml-poto';

const options: SerializationOptions = {
    includeXmlDeclaration: true,      // Include <?xml version="1.0"?>
    xmlVersion: '1.0',                 // XML version
    encoding: 'UTF-8',                 // Character encoding
    standalone: undefined,             // Standalone declaration
    omitNullValues: false,             // Omit null/undefined values
    format: true,                      // Pretty-print output
    indentation: '  ',                 // Indentation string
};

const serializer = new XmlSerializer(options);
```

### Omitting Null Values

```typescript
const options: SerializationOptions = {
    omitNullValues: true
};

const serializer = new XmlSerializer(options);

@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({ name: 'Name' })
    name: string = 'John';

    @XmlElement({ name: 'Age' })
    age?: number; // undefined

    @XmlElement({ name: 'Email' })
    email: string | null = null;
}

const user = new User();
const xml = serializer.toXml(user);
// Output:
// <User>
//   <Name>John</Name>
// </User>
// Age and Email are omitted
```

## 📚 API Reference

### Decorators

#### `@XmlRoot(options)`

Defines the root XML element for a class.

**Options:**
- `elementName: string` - Name of the root element
- `namespace?: XmlNamespace` - Namespace configuration
- `dataType?: string` - XML Schema data type
- `isNullable?: boolean` - Whether the element can be null

```typescript
@XmlRoot({
    elementName: 'Person',
    namespace: { uri: 'http://example.com', prefix: 'ex' }
})
class Person { }
```

#### `@XmlElement(options)`

Maps a property to an XML element. Can be used at class level or field level.

**Options:**
- `name: string` - Name of the XML element
- `namespace?: XmlNamespace` - Namespace configuration
- `required?: boolean` - Whether the element is required
- `order?: number` - Element order in serialization
- `dataType?: string` - XML Schema data type
- `isNullable?: boolean` - Generate `xsi:nil="true"` when value is null (default: false)
- `form?: 'qualified' | 'unqualified'` - Namespace form
- `type?: any` - Type constructor for deserialization and polymorphism
- `converter?: Converter` - Custom value converter
- `useCDATA?: boolean` - Wrap element content in CDATA section (field decorator only)
- `unionTypes?: any[]` - Array of allowed types for union type support (e.g., [Number, String])
- `mixedContent?: boolean` - Enable mixed content (text and elements interspersed, field decorator only)

```typescript
@XmlElement({
    name: 'EmailAddress',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
})
email: string = '';
```

#### `@XmlAttribute(options)`

Maps a property to an XML attribute.

**Options:**
- `name: string` - Name of the attribute
- `namespace?: XmlNamespace` - Namespace configuration
- `required?: boolean` - Whether the attribute is required
- `pattern?: RegExp` - Validation pattern
- `enum?: readonly any[]` - Allowed values
- `dataType?: string` - XML Schema data type
- `form?: 'qualified' | 'unqualified'` - Namespace form
- `type?: any` - Type information
- `converter?: Converter` - Custom value converter

```typescript
@XmlAttribute({
    name: 'id',
    pattern: /^\d{6}$/,
    required: true
})
id: string = '';
```

#### `@XmlText(options)`

Maps a property to the text content of an element.

**Options:**
- `xmlName?: string` - Property mapping name
- `required?: boolean` - Whether text content is required
- `dataType?: string` - XML Schema data type
- `converter?: Converter` - Custom value converter

```typescript
#### `@XmlText(options)`

Maps a property to XML text content.

**Options:**
- `required?: boolean` - Whether text is required
- `xmlName?: string` - Custom element name for property mapping
- `dataType?: string` - XML Schema data type
- `converter?: Converter` - Custom value converter
- `useCDATA?: boolean` - Wrap content in CDATA section (preserves special characters)

```typescript
@XmlText()
content: string = '';

@XmlText({ useCDATA: true })
htmlContent: string = '<div>HTML</div>';
```

#### `@XmlComment(options)`

Maps a property to an XML comment for documentation and metadata.

**Options:**
- `required?: boolean` - Whether comment is required (throws error if missing when true)

```typescript
@XmlComment()
comment: string = '';

@XmlComment({ required: true })
metadata: string = 'Generated by system';
```

**Note:** Comments are serialization-only (XML output). They are not preserved during deserialization as they represent metadata rather than data.

#### `@XmlArrayItem(options)`

Configures array serialization behavior.

**Options:**
- `containerName?: string` - Name of the wrapper element (omit for unwrapped arrays)
- `itemName?: string` - Name of individual array items
- `type?: any` - Type constructor for array items
- `namespace?: XmlNamespace` - Namespace configuration
- `nestingLevel?: number` - Nesting level for complex structures
- `isNullable?: boolean` - Whether array can be null
- `dataType?: string` - XML Schema data type
- `unwrapped?: boolean` - Explicitly control wrapping (auto-detected if omitted)

```typescript
// Wrapped array
@XmlArrayItem({
    containerName: 'Books',
    itemName: 'Book',
    type: Book
})
books: Book[] = [];

// Unwrapped array
@XmlArrayItem({
    itemName: 'Item',
    type: Item
})
items: Item[] = [];
```

### XmlSerializer

Main class for serialization and deserialization.

#### Constructor

```typescript
constructor(options?: SerializationOptions)
```

#### Methods

##### `toXml<T>(obj: T): string`

Serializes an object to XML string.

```typescript
const xml = serializer.toXml(myObject);
```

##### `fromXml<T>(xml: string, targetClass: new () => T): T`

Deserializes XML string to a typed object.

```typescript
const obj = serializer.fromXml(xmlString, MyClass);
```

### Types

#### `SerializationOptions`

```typescript
interface SerializationOptions {
    // XML Declaration options
    omitXmlDeclaration?: boolean;      // Skip XML declaration (default: false)
    xmlVersion?: string;                // XML version (default: "1.0")
    encoding?: string;                  // Character encoding (default: "UTF-8")
    standalone?: boolean;               // Include standalone declaration

    // Parsing options
    ignoreAttributes?: boolean;         // Skip attributes (default: false)
    attributeNamePrefix?: string;       // Prefix for attributes (default: "@_")
    textNodeName?: string;              // Property for text content (default: "#text")

    // Null handling
    omitNullValues?: boolean;           // Skip null/undefined values (default: false)

    // Advanced type handling
    useXsiType?: boolean;               // Generate xsi:type for polymorphism (default: false)
}
```

**Advanced Type Options:**
- `useXsiType`: When enabled, adds `xsi:type` attributes to elements when the runtime type differs from the declared type. Useful for polymorphic serialization.
- `omitNullValues`: When `true`, skips null/undefined properties entirely. When `false`, nullable properties with `isNullable: true` generate `xsi:nil="true"` attributes.

#### `XmlNamespace`

```typescript
interface XmlNamespace {
    uri: string;
    prefix?: string;
    isDefault?: boolean;
}
```

#### `Converter`

```typescript
interface Converter {
    serialize?: (value: any) => any;
    deserialize?: (value: any) => any;
}
```

## 🆚 Comparison

### Traditional XML Handling

```typescript
// ❌ Manual XML construction - error-prone
const xml = `
    <Person id="${person.id}">
        <Name>${person.name}</Name>
        <Email>${person.email}</Email>
    </Person>
`;

// ❌ Manual parsing - tedious and fragile
const parser = new DOMParser();
const doc = parser.parseFromString(xml, 'text/xml');
const person = {
    id: doc.querySelector('Person')?.getAttribute('id'),
    name: doc.querySelector('Name')?.textContent,
    email: doc.querySelector('Email')?.textContent
};
```

### With @cerios/xml-poto

```typescript
// ✅ Type-safe serialization
const xml = serializer.toXml(person);

// ✅ Type-safe deserialization
const person = serializer.fromXml(xml, Person);

// ✅ Compile-time validation
// ✅ Runtime validation
// ✅ Automatic type conversion
// ✅ Namespace handling
```

## 💡 Best Practices

1. **Use `@XmlRoot` for root elements**: Always decorate your top-level classes with `@XmlRoot` to define the root element name.

2. **Initialize class properties**: Always initialize properties with default values to enable proper metadata detection:
   ```typescript
   @XmlElement({ name: 'Name' })
   name: string = ''; // ✅ Good

   @XmlElement({ name: 'Name' })
   name: string; // ❌ May cause issues
   ```

3. **Use type parameter in @XmlArrayItem**: Always specify the `type` parameter for arrays of complex objects:
   ```typescript
   @XmlArrayItem({ itemName: 'Item', type: Item })
   items: Item[] = [];
   ```

4. **Choose between wrapped and unwrapped arrays**: Use `containerName` for wrapped arrays, omit it for unwrapped:
   ```typescript
   // Wrapped: <Items><Item>...</Item></Items>
   @XmlArrayItem({ containerName: 'Items', itemName: 'Item', type: Item })

   // Unwrapped: <Item>...</Item><Item>...</Item>
   @XmlArrayItem({ itemName: 'Item', type: Item })
   ```

5. **Use converters for complex types**: Implement converters for Date, custom types, or format transformations:
   ```typescript
   const dateConverter = {
       serialize: (date: Date) => date.toISOString(),
       deserialize: (str: string) => new Date(str)
   };
   ```

6. **Apply validation for external data**: Use `required`, `pattern`, and `enum` options when deserializing untrusted XML:
   ```typescript
   @XmlAttribute({
       name: 'status',
       enum: ['active', 'inactive'],
       required: true
   })
   status: string = '';
   ```

7. **Handle namespaces consistently**: When using namespaces, apply them consistently across related elements:
   ```typescript
   const bookNs = { uri: 'http://example.com/books', prefix: 'bk' };

   @XmlRoot({ elementName: 'Book', namespace: bookNs })
   class Book {
       @XmlElement({ name: 'Title', namespace: bookNs })
       title: string = '';
   }
   ```

8. **Use `omitNullValues` for cleaner XML**: Enable this option to exclude null/undefined values from serialized output.

9. **Test round-trip serialization**: Always verify that objects can be serialized to XML and deserialized back without data loss:
   ```typescript
   const original = createTestObject();
   const xml = serializer.toXml(original);
   const restored = serializer.fromXml(xml, TestClass);
   expect(restored).toEqual(original);
   ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Ronald Veth - Cerios

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/xml-poto)
- [Issue Tracker](https://github.com/CeriosTesting/xml-poto/issues)
- [NPM Package](https://www.npmjs.com/package/@cerios/xml-poto)
