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
- `isNullable?: boolean` - Whether the element can be null
- `form?: 'qualified' | 'unqualified'` - Namespace form
- `type?: any` - Type constructor for deserialization
- `converter?: Converter` - Custom value converter
- `useCDATA?: boolean` - Wrap element content in CDATA section (field decorator only)

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
    includeXmlDeclaration?: boolean;
    xmlVersion?: string;
    encoding?: string;
    standalone?: boolean;
    omitNullValues?: boolean;
    format?: boolean;
    indentation?: string;
}
```

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
