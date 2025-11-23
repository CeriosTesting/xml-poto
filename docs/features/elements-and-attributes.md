# Elements and Attributes

Learn how to map properties to XML elements and attributes using `@XmlElement` and `@XmlAttribute` decorators.

## Table of Contents

- [Overview](#overview)
- [@XmlElement Decorator](#xmlelement-decorator)
- [@XmlAttribute Decorator](#xmlattribute-decorator)
- [When to Use Each](#when-to-use-each)
- [Element vs Attribute Examples](#element-vs-attribute-examples)
- [Optional Properties](#optional-properties)
- [Default Values](#default-values)
- [Renaming Properties](#renaming-properties)
- [Type Conversion](#type-conversion)
- [Nested Elements](#nested-elements)
- [Best Practices](#best-practices)

## Overview

XML has two main ways to store data:
1. **Elements** - `<Name>John</Name>`
2. **Attributes** - `<Person name="John">`

xml-poto provides decorators for both:
- `@XmlElement` - Maps property to XML element
- `@XmlAttribute` - Maps property to XML attribute

[↑ Back to top](#table-of-contents)

## @XmlElement Decorator

Maps a class property to an XML element.

### Basic Usage

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'FirstName' })
    firstName: string = '';

    @XmlElement({ name: 'LastName' })
    lastName: string = '';

    @XmlElement({ name: 'Age' })
    age: number = 0;
}

const person = new Person();
person.firstName = 'John';
person.lastName = 'Doe';
person.age = 30;

const serializer = new XmlSerializer();
const xml = serializer.toXml(person);
```

**Output:**
```xml
<Person>
    <FirstName>John</FirstName>
    <LastName>Doe</LastName>
    <Age>30</Age>
</Person>
```

### Options

```typescript
interface XmlElementOptions {
    name: string;                    // XML element name (required)
    type?: Function;                 // Type constructor for complex objects
    namespace?: XmlNamespace;        // Element namespace
    required?: boolean;              // Element must be present
    converter?: Converter;           // Custom value transformation
    useCDATA?: boolean;              // Wrap in CDATA section
    mixedContent?: boolean;          // Support mixed content
    enum?: string[];                 // Allowed values
    pattern?: RegExp;                // Validation pattern
}
```

### Example with Options

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({
        name: 'Title',
        required: true
    })
    title: string = '';

    @XmlElement({
        name: 'Content',
        useCDATA: true
    })
    content: string = '';

    @XmlElement({
        name: 'Status',
        enum: ['draft', 'published', 'archived']
    })
    status: string = 'draft';
}
```

[↑ Back to top](#table-of-contents)

## @XmlAttribute Decorator

Maps a class property to an XML attribute.

### Basic Usage

```typescript
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
```

**Output:**
```xml
<Product id="PROD-001" sku="SKU-12345">
    <Name>Laptop</Name>
    <Price>999.99</Price>
</Product>
```

### Options

```typescript
interface XmlAttributeOptions {
    name: string;                    // XML attribute name (required)
    namespace?: XmlNamespace;        // Attribute namespace
    required?: boolean;              // Attribute must be present
    converter?: Converter;           // Custom value transformation
    enum?: string[];                 // Allowed values
    pattern?: RegExp;                // Validation pattern
}
```

### Example with Options

```typescript
@XmlRoot({ elementName: 'User' })
class User {
    @XmlAttribute({
        name: 'id',
        required: true,
        pattern: /^\d+$/
    })
    id: string = '';

    @XmlAttribute({
        name: 'role',
        enum: ['admin', 'user', 'guest']
    })
    role: string = 'user';

    @XmlElement({ name: 'Username' })
    username: string = '';
}
```

[↑ Back to top](#table-of-contents)

## When to Use Each

### Use @XmlAttribute for:

✅ **Identifiers and Keys**
```typescript
@XmlAttribute({ name: 'id' })
id: string = '';

@XmlAttribute({ name: 'key' })
key: string = '';
```

✅ **Metadata and Flags**
```typescript
@XmlAttribute({ name: 'version' })
version: string = '1.0';

@XmlAttribute({ name: 'enabled' })
enabled: boolean = true;
```

✅ **Short, Simple Values**
```typescript
@XmlAttribute({ name: 'type' })
type: string = 'text';

@XmlAttribute({ name: 'lang' })
language: string = 'en';
```

### Use @XmlElement for:

✅ **Content Data**
```typescript
@XmlElement({ name: 'Description' })
description: string = '';

@XmlElement({ name: 'Content' })
content: string = '';
```

✅ **Complex or Long Values**
```typescript
@XmlElement({ name: 'Biography' })
biography: string = '';

@XmlElement({ name: 'Address' })
address: string = '';
```

✅ **Nested Objects**
```typescript
@XmlElement({ name: 'Author', type: Author })
author: Author = new Author();

@XmlElement({ name: 'Comments', type: Comment })
comments: Comment[] = [];
```

✅ **Data that May Contain Special Characters**
```typescript
@XmlElement({ name: 'Code', useCDATA: true })
code: string = '';
```

[↑ Back to top](#table-of-contents)

## Element vs Attribute Examples

### Example 1: Book

```typescript
@XmlRoot({ elementName: 'Book' })
class Book {
    // Attributes - IDs and metadata
    @XmlAttribute({ name: 'isbn' })
    isbn: string = '';

    @XmlAttribute({ name: 'edition' })
    edition: string = '1';

    @XmlAttribute({ name: 'language' })
    language: string = 'en';

    // Elements - content
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';

    @XmlElement({ name: 'Description' })
    description: string = '';

    @XmlElement({ name: 'Price' })
    price: number = 0;
}
```

**Output:**
```xml
<Book isbn="978-1234567890" edition="2" language="en">
    <Title>TypeScript Handbook</Title>
    <Author>Microsoft</Author>
    <Description>Comprehensive guide to TypeScript</Description>
    <Price>49.99</Price>
</Book>
```

### Example 2: Configuration

```typescript
@XmlRoot({ elementName: 'ServerConfig' })
class ServerConfig {
    // Attributes - settings flags
    @XmlAttribute({ name: 'enabled' })
    enabled: boolean = true;

    @XmlAttribute({ name: 'environment' })
    environment: string = 'production';

    // Elements - configuration values
    @XmlElement({ name: 'Host' })
    host: string = 'localhost';

    @XmlElement({ name: 'Port' })
    port: number = 8080;

    @XmlElement({ name: 'ConnectionString' })
    connectionString: string = '';
}
```

**Output:**
```xml
<ServerConfig enabled="true" environment="production">
    <Host>localhost</Host>
    <Port>8080</Port>
    <ConnectionString>Server=db.example.com;Database=myapp</ConnectionString>
</ServerConfig>
```

[↑ Back to top](#table-of-contents)

## Optional Properties

Use TypeScript's optional property syntax (`?`) for elements/attributes that may not always be present.

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    // Required
    @XmlElement({ name: 'FirstName' })
    firstName: string = '';

    @XmlElement({ name: 'LastName' })
    lastName: string = '';

    // Optional
    @XmlElement({ name: 'MiddleName' })
    middleName?: string;

    @XmlElement({ name: 'Suffix' })
    suffix?: string;

    @XmlAttribute({ name: 'nickname' })
    nickname?: string;
}

const person = new Person();
person.firstName = 'John';
person.lastName = 'Doe';
// middleName, suffix, and nickname are not set

const xml = serializer.toXml(person, { omitNullValues: true });
```

**Output:**
```xml
<Person>
    <FirstName>John</FirstName>
    <LastName>Doe</LastName>
</Person>
```

[↑ Back to top](#table-of-contents)

## Default Values

Always initialize properties with sensible defaults.

```typescript
@XmlRoot({ elementName: 'Settings' })
class Settings {
    @XmlElement({ name: 'Theme' })
    theme: string = 'light';  // Default theme

    @XmlElement({ name: 'FontSize' })
    fontSize: number = 14;  // Default font size

    @XmlElement({ name: 'AutoSave' })
    autoSave: boolean = true;  // Default auto-save

    @XmlElement({ name: 'Language' })
    language: string = 'en';  // Default language
}

// When deserializing, missing elements use defaults
const xml = '<Settings></Settings>';
const settings = serializer.fromXml(xml, Settings);

console.log(settings.theme);     // 'light'
console.log(settings.fontSize);  // 14
console.log(settings.autoSave);  // true
```

[↑ Back to top](#table-of-contents)

## Renaming Properties

The property name in your class doesn't have to match the XML element/attribute name.

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    // Property: firstName, XML: FirstName
    @XmlElement({ name: 'FirstName' })
    firstName: string = '';

    // Property: lastName, XML: LastName
    @XmlElement({ name: 'LastName' })
    lastName: string = '';

    // Property: emailAddress, XML: Email
    @XmlElement({ name: 'Email' })
    emailAddress: string = '';

    // Property: phoneNum, XML: PhoneNumber
    @XmlElement({ name: 'PhoneNumber' })
    phoneNum: string = '';
}
```

**Benefits:**
- Follow TypeScript naming conventions in code
- Match external XML schema requirements
- Maintain backward compatibility

[↑ Back to top](#table-of-contents)

## Type Conversion

xml-poto automatically converts between XML strings and TypeScript types.

### Supported Types

```typescript
@XmlRoot({ elementName: 'DataTypes' })
class DataTypes {
    @XmlElement({ name: 'StringValue' })
    stringValue: string = '';

    @XmlElement({ name: 'NumberValue' })
    numberValue: number = 0;

    @XmlElement({ name: 'BooleanValue' })
    booleanValue: boolean = false;

    @XmlElement({ name: 'IntegerValue' })
    integerValue: number = 0;

    @XmlElement({ name: 'FloatValue' })
    floatValue: number = 0.0;
}

const xml = `
<DataTypes>
    <StringValue>Hello</StringValue>
    <NumberValue>42</NumberValue>
    <BooleanValue>true</BooleanValue>
    <IntegerValue>100</IntegerValue>
    <FloatValue>3.14</FloatValue>
</DataTypes>
`;

const data = serializer.fromXml(xml, DataTypes);

console.log(typeof data.stringValue);   // 'string'
console.log(typeof data.numberValue);   // 'number'
console.log(typeof data.booleanValue);  // 'boolean'
console.log(data.numberValue);          // 42 (not '42')
console.log(data.booleanValue);         // true (not 'true')
```

### Boolean Values

Accepts multiple formats:
```typescript
// All these deserialize to true
<BooleanValue>true</BooleanValue>
<BooleanValue>True</BooleanValue>
<BooleanValue>1</BooleanValue>
<BooleanValue>yes</BooleanValue>

// All these deserialize to false
<BooleanValue>false</BooleanValue>
<BooleanValue>False</BooleanValue>
<BooleanValue>0</BooleanValue>
<BooleanValue>no</BooleanValue>
```

[↑ Back to top](#table-of-contents)

## Nested Elements

Use `@XmlElement` with the `type` parameter for complex nested objects.

```typescript
@XmlElement({ elementName: 'Address' })
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';

    @XmlElement({ name: 'State' })
    state: string = '';

    @XmlElement({ name: 'ZipCode' })
    zipCode: string = '';

    @XmlElement({ name: 'Country' })
    country: string = '';
}

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    // Specify type parameter for nested object
    @XmlElement({ name: 'Address', type: Address })
    address: Address = new Address();
}

const person = new Person();
person.name = 'John Doe';
person.address.street = '123 Main St';
person.address.city = 'New York';
person.address.state = 'NY';
person.address.zipCode = '10001';
person.address.country = 'USA';

const xml = serializer.toXml(person);
```

**Output:**
```xml
<Person>
    <Name>John Doe</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>New York</City>
        <State>NY</State>
        <ZipCode>10001</ZipCode>
        <Country>USA</Country>
    </Address>
</Person>
```

**See:** [Nested Objects Guide](nested-objects.md)

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Be Consistent with Naming

```typescript
// ✅ Good - consistent PascalCase
@XmlElement({ name: 'FirstName' })
@XmlElement({ name: 'LastName' })
@XmlElement({ name: 'EmailAddress' })

// ❌ Bad - inconsistent
@XmlElement({ name: 'FirstName' })
@XmlElement({ name: 'last_name' })
@XmlElement({ name: 'email' })
```

### 2. Initialize All Properties

```typescript
// ✅ Good
@XmlElement({ name: 'Name' })
name: string = '';

@XmlElement({ name: 'Count' })
count: number = 0;

// ❌ Bad
@XmlElement({ name: 'Name' })
name: string;  // Uninitialized
```

### 3. Use Meaningful Names

```typescript
// ✅ Good - descriptive
@XmlElement({ name: 'EmailAddress' })
emailAddress: string = '';

@XmlElement({ name: 'PhoneNumber' })
phoneNumber: string = '';

// ❌ Bad - unclear
@XmlElement({ name: 'Addr' })
addr: string = '';

@XmlElement({ name: 'Tel' })
tel: string = '';
```

### 4. Group Related Properties

```typescript
@XmlRoot({ elementName: 'Product' })
class Product {
    // Identifiers
    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlAttribute({ name: 'sku' })
    sku: string = '';

    // Basic info
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Description' })
    description: string = '';

    // Pricing
    @XmlElement({ name: 'Price' })
    price: number = 0;

    @XmlElement({ name: 'Currency' })
    currency: string = 'USD';

    // Inventory
    @XmlElement({ name: 'Stock' })
    stock: number = 0;

    @XmlElement({ name: 'Available' })
    available: boolean = true;
}
```

### 5. Use Type Parameter for Complex Objects

```typescript
// ✅ Good - type specified
@XmlElement({ name: 'Author', type: Author })
author: Author = new Author();

// ❌ Bad - type not specified (may not deserialize correctly)
@XmlElement({ name: 'Author' })
author: Author = new Author();
```

### 6. Consider XML Size

Attributes create smaller XML:
```xml
<!-- With attributes - 73 characters -->
<Person id="1" name="John" age="30" />

<!-- With elements - 115 characters -->
<Person>
    <Id>1</Id>
    <Name>John</Name>
    <Age>30</Age>
</Person>
```

Use attributes for:
- High-volume data
- Network transmission
- Storage optimization

Use elements for:
- Readability
- Complex data
- Extensibility

[↑ Back to top](#table-of-contents)

---

## See Also

- [Core Concepts](../core-concepts.md) - Fundamental concepts
- [Nested Objects](nested-objects.md) - Complex object hierarchies
- [Arrays](arrays.md) - Working with collections
- [Validation](validation.md) - Validating element and attribute values
- [Custom Converters](converters.md) - Transform values during serialization

[← Core Concepts](../core-concepts.md) | [Home](../../README.md) | [Arrays →](arrays.md)
