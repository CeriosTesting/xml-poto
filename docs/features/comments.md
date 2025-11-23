# XML Comments

Learn how to add XML comments to your serialized documents using the `@XmlComment` decorator.

## Table of Contents

- [Overview](#overview)
- [@XmlComment Decorator](#xmlcomment-decorator)
- [Basic Comments](#basic-comments)
- [Required Comments](#required-comments)
- [Special Characters](#special-characters)
- [Multi-line Comments](#multi-line-comments)
- [Comments with Other Decorators](#comments-with-other-decorators)
- [Use Cases](#use-cases)
- [Best Practices](#best-practices)

## Overview

The `@XmlComment` decorator allows you to include XML comments in your serialized documents. Comments are useful for documentation, debugging, and providing context within XML files.

**XML Comment Example:**
```xml
<Document>
    <!--This is a comment-->
    <Title>My Document</Title>
</Document>
```

[↑ Back to top](#table-of-contents)

## @XmlComment Decorator

The `@XmlComment` decorator marks a property to be serialized as an XML comment.

### Options

```typescript
interface XmlCommentOptions {
    required?: boolean;  // Whether the comment must be present (default: false)
}
```

### Basic Syntax

```typescript
import { XmlRoot, XmlComment, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';
}
```

[↑ Back to top](#table-of-contents)

## Basic Comments

### Simple Comment

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';
}

const doc = new Document();
doc.comment = 'This is a document comment';
doc.title = 'My Document';

const serializer = new XmlSerializer();
const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <!--This is a document comment-->
    <Title>My Document</Title>
</Document>
```

### Empty Comments

Empty comments are omitted from the output:

```typescript
const doc = new Document();
doc.comment = '';  // Empty string
doc.title = 'My Document';

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <Title>My Document</Title>
</Document>
```

### Undefined Comments

Undefined comments are also omitted:

```typescript
const doc = new Document();
// doc.comment is undefined
doc.title = 'My Document';

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <Title>My Document</Title>
</Document>
```

[↑ Back to top](#table-of-contents)

## Required Comments

Use the `required` option to enforce that a comment must be present:

### Required Comment Example

```typescript
@XmlRoot({ elementName: 'Report' })
class Report {
    @XmlComment({ required: true })
    comment: string = '';

    @XmlElement({ name: 'Data' })
    data: string = '';
}

// ✅ Valid - comment is provided
const report1 = new Report();
report1.comment = 'Monthly report';
report1.data = 'Some data';

const xml1 = serializer.toXml(report1);

// ❌ Invalid - will throw error
const report2 = new Report();
report2.data = 'Some data';
// Throws: "Required comment is missing"
// const xml2 = serializer.toXml(report2);
```

**Output (valid):**
```xml
<Report>
    <!--Monthly report-->
    <Data>Some data</Data>
</Report>
```

[↑ Back to top](#table-of-contents)

## Special Characters

XML comments can contain special characters without escaping:

### Special Characters Example

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Content' })
    content: string = '';
}

const doc = new Document();
doc.comment = 'TODO: Fix the <bug> in version 2.0 & update docs';
doc.content = 'Test';

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <!--TODO: Fix the <bug> in version 2.0 & update docs-->
    <Content>Test</Content>
</Document>
```

### Characters Allowed in Comments

XML comments can contain:
- Angle brackets: `< >`
- Ampersands: `&`
- Quotes: `" '`
- Most special characters

**Note:** Comments cannot contain `--` (double hyphen) as it marks the end of a comment.

[↑ Back to top](#table-of-contents)

## Multi-line Comments

Comments can span multiple lines:

### Multi-line Example

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Content' })
    content: string = '';
}

const doc = new Document();
doc.comment = `Line 1
Line 2
Line 3`;
doc.content = 'Test';

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <!--Line 1
Line 2
Line 3-->
    <Content>Test</Content>
</Document>
```

### Formatted Multi-line Comments

```typescript
const doc = new Document();
doc.comment = `
====================================
Configuration File
Version: 2.0
Last Modified: 2024-01-15
====================================
`;
doc.content = 'Configuration data';
```

**Output:**
```xml
<Document>
    <!--
====================================
Configuration File
Version: 2.0
Last Modified: 2024-01-15
====================================
-->
    <Content>Configuration data</Content>
</Document>
```

[↑ Back to top](#table-of-contents)

## Comments with Other Decorators

Comments work alongside all other decorators:

### Comment with Multiple Elements

```typescript
@XmlRoot({ elementName: 'Config' })
class Config {
    @XmlComment()
    comment: string = '';

    @XmlElement({ name: 'Setting' })
    setting: string = '';

    @XmlElement({ name: 'Value' })
    value: number = 0;

    @XmlElement({ name: 'Enabled' })
    enabled: boolean = false;
}

const config = new Config();
config.comment = 'Configuration for production environment';
config.setting = 'timeout';
config.value = 30;
config.enabled = true;

const xml = serializer.toXml(config);
```

**Output:**
```xml
<Config>
    <!--Configuration for production environment-->
    <Setting>timeout</Setting>
    <Value>30</Value>
    <Enabled>true</Enabled>
</Config>
```

### Comment with Attributes

```typescript
@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlComment()
    comment: string = '';

    @XmlAttribute({ name: 'id' })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';
}

const product = new Product();
product.comment = 'Product added on 2024-01-15';
product.id = 'P123';
product.name = 'Laptop';
```

**Output:**
```xml
<Product id="P123">
    <!--Product added on 2024-01-15-->
    <Name>Laptop</Name>
</Product>
```

### Comment with Arrays

```typescript
@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlComment()
    comment: string = '';

    @XmlArrayItem({ itemName: 'Item' })
    items: string[] = [];
}

const catalog = new Catalog();
catalog.comment = 'Catalog updated weekly';
catalog.items = ['Item 1', 'Item 2', 'Item 3'];
```

**Output:**
```xml
<Catalog>
    <!--Catalog updated weekly-->
    <Item>Item 1</Item>
    <Item>Item 2</Item>
    <Item>Item 3</Item>
</Catalog>
```

[↑ Back to top](#table-of-contents)

## Use Cases

### Documentation Comments

```typescript
@XmlRoot({ elementName: 'API' })
class APIConfig {
    @XmlComment()
    documentation: string = '';

    @XmlElement({ name: 'Endpoint' })
    endpoint: string = '';

    @XmlElement({ name: 'Version' })
    version: string = '';
}

const config = new APIConfig();
config.documentation = 'API Configuration - Do not modify manually';
config.endpoint = 'https://api.example.com';
config.version = '1.0';
```

**Output:**
```xml
<API>
    <!--API Configuration - Do not modify manually-->
    <Endpoint>https://api.example.com</Endpoint>
    <Version>1.0</Version>
</API>
```

### Code Snippets

```typescript
@XmlRoot({ elementName: 'Code' })
class CodeSnippet {
    @XmlComment()
    description: string = '';

    @XmlElement({ name: 'Language' })
    language: string = '';

    @XmlElement({ name: 'Script' })
    script: string = '';
}

const snippet = new CodeSnippet();
snippet.description = 'Function to calculate factorial';
snippet.language = 'JavaScript';
snippet.script = 'function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }';
```

**Output:**
```xml
<Code>
    <!--Function to calculate factorial-->
    <Language>JavaScript</Language>
    <Script>function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }</Script>
</Code>
```

### Version Information

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlComment()
    version: string = '';

    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Content' })
    content: string = '';
}

const doc = new Document();
doc.version = 'Version 2.5 - Last modified: 2024-01-15 by John Doe';
doc.title = 'User Manual';
doc.content = 'Documentation content...';
```

**Output:**
```xml
<Document>
    <!--Version 2.5 - Last modified: 2024-01-15 by John Doe-->
    <Title>User Manual</Title>
    <Content>Documentation content...</Content>
</Document>
```

### TODO Notes

```typescript
@XmlRoot({ elementName: 'Project' })
class Project {
    @XmlComment()
    notes: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Status' })
    status: string = '';
}

const project = new Project();
project.notes = 'TODO: Add deadline field and priority levels';
project.name = 'Website Redesign';
project.status = 'In Progress';
```

**Output:**
```xml
<Project>
    <!--TODO: Add deadline field and priority levels-->
    <Name>Website Redesign</Name>
    <Status>In Progress</Status>
</Project>
```

### Change Log

```typescript
@XmlRoot({ elementName: 'Configuration' })
class Configuration {
    @XmlComment()
    changeLog: string = '';

    @XmlElement({ name: 'Settings' })
    settings: string = '';
}

const config = new Configuration();
config.changeLog = `
Change Log:
- 2024-01-15: Updated timeout value
- 2024-01-10: Added new feature flag
- 2024-01-05: Initial configuration
`;
config.settings = 'production';
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use Descriptive Comment Text

```typescript
// ✅ Good - clear and informative
@XmlComment()
comment: string = 'Configuration for production environment - Last updated: 2024-01-15';

// ❌ Bad - vague
@XmlComment()
comment: string = 'Config';
```

### 2. Initialize Comment Properties

```typescript
// ✅ Good - initialized
@XmlComment()
comment: string = '';

// ❌ Bad - uninitialized
@XmlComment()
comment: string;
```

### 3. Use Required Only When Necessary

```typescript
// ✅ Good - required for critical information
@XmlComment({ required: true })
licenseHeader: string = '';

// ❌ Bad - most comments should be optional
@XmlComment({ required: true })
optionalNote: string = '';
```

### 4. Avoid Double Hyphens

```typescript
// ✅ Good - uses single hyphen or alternative
comment = 'Section - Part A';

// ❌ Bad - contains -- which breaks XML comments
comment = 'Section -- Part A';
```

### 5. Keep Comments Concise

```typescript
// ✅ Good - brief and to the point
comment = 'Updated for version 2.0';

// ❌ Bad - overly verbose
comment = 'This configuration file has been updated to support the new features introduced in version 2.0 of the application, which includes...';
```

### 6. Use Comments for Metadata

```typescript
// ✅ Good - metadata that doesn't belong in elements
@XmlComment()
metadata: string = 'Generated: 2024-01-15, Author: System';

// ❌ Bad - data that should be elements
@XmlComment()
productName: string = 'Laptop';  // Should be @XmlElement
```

### 7. Test Comment Serialization

```typescript
describe('Comment Serialization', () => {
    it('should include comment in XML output', () => {
        const doc = new Document();
        doc.comment = 'Test comment';
        doc.title = 'Test';

        const xml = serializer.toXml(doc);

        expect(xml).toContain('<!--Test comment-->');
    });

    it('should omit empty comments', () => {
        const doc = new Document();
        doc.comment = '';
        doc.title = 'Test';

        const xml = serializer.toXml(doc);

        expect(xml).not.toContain('<!--');
    });
});
```

### 8. Use for Human-Readable Documentation

```typescript
// ✅ Good - helpful for humans reading the XML
@XmlComment()
description: string = 'This section contains user preferences. Modify with caution.';

// ❌ Bad - machine-readable data
@XmlComment()
checksum: string = 'a3f8b9c2d1e4f5a6';  // Should be an element
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Text Content & CDATA](text-content.md) - Text handling in elements
- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Converters](converters.md) | [Home](../../README.md)
