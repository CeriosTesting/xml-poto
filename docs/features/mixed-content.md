# Mixed Content

Learn how to handle mixed content (interleaved text and elements) in XML using the `mixedContent` option.

## Table of Contents

- [Overview](#overview)
- [What is Mixed Content?](#what-is-mixed-content)
- [Basic Mixed Content](#basic-mixed-content)
- [Mixed Content with Attributes](#mixed-content-with-attributes)
- [HTML-like Content](#html-like-content)
- [Nested Mixed Content](#nested-mixed-content)
- [Limitations](#limitations)
- [Best Practices](#best-practices)

## Overview

Mixed content allows an XML element to contain both text and child elements interleaved together. This is commonly seen in HTML-like content where formatting tags are embedded within text.

**Mixed Content Example:**
```xml
<Paragraph>
    This is <strong>bold</strong> and <em>italic</em> text.
</Paragraph>
```

[↑ Back to top](#table-of-contents)

## What is Mixed Content?

### Normal Content (Not Mixed)

Elements contain either text OR child elements, but not both interleaved:

```xml
<!-- Pure text -->
<Name>John Doe</Name>

<!-- Pure elements -->
<Person>
    <FirstName>John</FirstName>
    <LastName>Doe</LastName>
</Person>
```

### Mixed Content

Elements contain text AND child elements interleaved:

```xml
<!-- Mixed: text + elements interleaved -->
<Paragraph>
    This is <strong>bold</strong> and this is <em>italic</em> text.
</Paragraph>
```

[↑ Back to top](#table-of-contents)

## Basic Mixed Content

### Enabling Mixed Content

Use the `mixedContent: true` option with `@XmlElement`:

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Paragraph' })
class Paragraph {
    @XmlElement({ name: 'content', mixedContent: true })
    content: any[] = [];
}
```

### Mixed Content Structure

Mixed content is represented as an array of objects with two possible types:

**Text Node:**
```typescript
{ text: "plain text content" }
```

**Element Node:**
```typescript
{
    element: "tagName",
    content: "element content",
    attributes?: { key: "value" }
}
```

### Simple Example

```typescript
@XmlRoot({ elementName: 'Paragraph' })
class Paragraph {
    @XmlElement({ name: 'content', mixedContent: true })
    content: any[] = [];
}

const para = new Paragraph();
para.content = [
    { text: "This is " },
    { element: "strong", content: "bold" },
    { text: " text." }
];

const serializer = new XmlSerializer();
const xml = serializer.toXml(para);
```

**Output:**
```xml
<Paragraph>
    <content>This is <strong>bold</strong> text.</content>
</Paragraph>
```

### Multiple Elements

```typescript
@XmlRoot({ elementName: 'Article' })
class Article {
    @XmlElement({ name: 'body', mixedContent: true })
    body: any[] = [];
}

const article = new Article();
article.body = [
    { text: "Text with " },
    { element: "em", content: "emphasis" },
    { text: " and " },
    { element: "strong", content: "bold" },
    { text: " words." }
];

const xml = serializer.toXml(article);
```

**Output:**
```xml
<Article>
    <body>Text with <em>emphasis</em> and <strong>bold</strong> words.</body>
</Article>
```

[↑ Back to top](#table-of-contents)

## Mixed Content with Attributes

Add attributes to elements within mixed content:

### Element with Attributes

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({ name: 'content', mixedContent: true })
    content: any[] = [];
}

const doc = new Document();
doc.content = [
    { text: "Click " },
    {
        element: "a",
        content: "here",
        attributes: {
            href: "https://example.com",
            target: "_blank"
        }
    },
    { text: " for more." }
];

const xml = serializer.toXml(doc);
```

**Output:**
```xml
<Document>
    <content>Click <a href="https://example.com" target="_blank">here</a> for more.</content>
</Document>
```

### Multiple Attributes

```typescript
@XmlRoot({ elementName: 'Content' })
class Content {
    @XmlElement({ name: 'text', mixedContent: true })
    text: any[] = [];
}

const content = new Content();
content.text = [
    { text: "Visit " },
    {
        element: "a",
        content: "our site",
        attributes: {
            href: "https://example.com",
            class: "external-link",
            rel: "noopener",
            title: "Visit our website"
        }
    },
    { text: " today!" }
];
```

**Output:**
```xml
<Content>
    <text>Visit <a href="https://example.com" class="external-link" rel="noopener" title="Visit our website">our site</a> today!</text>
</Content>
```

[↑ Back to top](#table-of-contents)

## HTML-like Content

Mixed content is perfect for HTML-like structures:

### Formatted Text

```typescript
@XmlRoot({ elementName: 'RichText' })
class RichText {
    @XmlElement({ name: 'content', mixedContent: true })
    content: any[] = [];
}

const richText = new RichText();
richText.content = [
    { text: "This paragraph contains " },
    { element: "strong", content: "bold text" },
    { text: ", " },
    { element: "em", content: "italic text" },
    { text: ", and " },
    { element: "u", content: "underlined text" },
    { text: "." }
];

const xml = serializer.toXml(richText);
```

**Output:**
```xml
<RichText>
    <content>This paragraph contains <strong>bold text</strong>, <em>italic text</em>, and <u>underlined text</u>.</content>
</RichText>
```

### Links and Images

```typescript
@XmlRoot({ elementName: 'BlogPost' })
class BlogPost {
    @XmlElement({ name: 'body', mixedContent: true })
    body: any[] = [];
}

const post = new BlogPost();
post.body = [
    { text: "Check out " },
    {
        element: "a",
        content: "this article",
        attributes: { href: "https://blog.example.com/post1" }
    },
    { text: " about TypeScript. " },
    {
        element: "img",
        content: "",
        attributes: {
            src: "https://example.com/image.png",
            alt: "TypeScript Logo"
        }
    }
];
```

**Output:**
```xml
<BlogPost>
    <body>Check out <a href="https://blog.example.com/post1">this article</a> about TypeScript. <img src="https://example.com/image.png" alt="TypeScript Logo"></img></body>
</BlogPost>
```

### Code Blocks

```typescript
@XmlRoot({ elementName: 'Documentation' })
class Documentation {
    @XmlElement({ name: 'description', mixedContent: true })
    description: any[] = [];
}

const doc = new Documentation();
doc.description = [
    { text: "Use the " },
    { element: "code", content: "toXml()" },
    { text: " method to serialize objects to XML. Example: " },
    { element: "code", content: "serializer.toXml(obj)" },
    { text: "." }
];
```

**Output:**
```xml
<Documentation>
    <description>Use the <code>toXml()</code> method to serialize objects to XML. Example: <code>serializer.toXml(obj)</code>.</description>
</Documentation>
```

[↑ Back to top](#table-of-contents)

## Nested Mixed Content

Elements within mixed content can also contain mixed content:

### Nested Example

```typescript
@XmlRoot({ elementName: 'Article' })
class Article {
    @XmlElement({ name: 'content', mixedContent: true })
    content: any[] = [];
}

const article = new Article();
article.content = [
    { text: "This is a " },
    {
        element: "div",
        content: [
            { text: "nested " },
            { element: "strong", content: "structure" }
        ],
        attributes: { class: "highlight" }
    },
    { text: " example." }
];

// Note: Nested mixed content may have limitations
```

[↑ Back to top](#table-of-contents)

## Limitations

### Deserialization Constraints

Mixed content deserialization has some limitations due to XML parser constraints:

```typescript
// Serialization works perfectly
const para = new Paragraph();
para.content = [
    { text: "This is " },
    { element: "strong", content: "bold" },
    { text: " text." }
];
const xml = serializer.toXml(para);  // ✅ Works great

// Deserialization may not perfectly preserve all details
const restored = serializer.fromXml(xml, Paragraph);  // ⚠️ May have limitations
```

### Whitespace Handling

Whitespace in mixed content may be normalized during parsing:

```typescript
// Input
para.content = [
    { text: "Text    with    spaces" }
];

// After roundtrip, multiple spaces may be normalized
```

### Complex Nesting

Deeply nested mixed content structures may have unpredictable behavior:

```typescript
// ✅ Simple nesting - OK
{ element: "div", content: [{ element: "span", content: "text" }] }

// ⚠️ Complex nesting - may have issues
{ element: "div", content: [
    { element: "span", content: [
        { element: "strong", content: [/* more nesting */] }
    ]}
]}
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use for HTML-like Content

```typescript
// ✅ Good - perfect use case for mixed content
@XmlElement({ name: 'description', mixedContent: true })
description: any[] = [];  // HTML-like formatted text

// ❌ Bad - use regular elements instead
@XmlElement({ name: 'person', mixedContent: true })
person: any[] = [];  // Structured data should use proper elements
```

### 2. Keep Structure Simple

```typescript
// ✅ Good - simple, flat structure
content = [
    { text: "Simple " },
    { element: "strong", content: "text" }
];

// ⚠️ Complex - may have issues
content = [
    { element: "div", content: [
        { element: "div", content: [
            { element: "span", content: "deeply nested" }
        ]}
    ]}
];
```

### 3. Initialize as Empty Array

```typescript
// ✅ Good
@XmlElement({ name: 'content', mixedContent: true })
content: any[] = [];

// ❌ Bad
@XmlElement({ name: 'content', mixedContent: true })
content: any[];
```

### 4. Type the Array Appropriately

```typescript
// ✅ Good - explicit types for content nodes
interface TextNode {
    text: string;
}

interface ElementNode {
    element: string;
    content: string | any[];
    attributes?: Record<string, string>;
}

type MixedContentNode = TextNode | ElementNode;

@XmlElement({ name: 'content', mixedContent: true })
content: MixedContentNode[] = [];
```

### 5. Test Serialization Separately from Deserialization

```typescript
describe('Mixed Content', () => {
    it('should serialize mixed content', () => {
        const para = new Paragraph();
        para.content = [
            { text: "Bold " },
            { element: "strong", content: "text" }
        ];

        const xml = serializer.toXml(para);
        expect(xml).toContain("<strong>text</strong>");
    });

    // Test deserialization separately
    it('should deserialize mixed content', () => {
        const xml = '<Paragraph><content>Bold <strong>text</strong></content></Paragraph>';
        const para = serializer.fromXml(xml, Paragraph);

        expect(Array.isArray(para.content)).toBe(true);
        // Check individual pieces
    });
});
```

### 6. Use CDATA for Complex HTML

If you need to preserve complex HTML exactly, consider using `@XmlText` with CDATA instead:

```typescript
// Alternative: Use CDATA for complex HTML
@XmlRoot({ elementName: 'Article' })
class Article {
    @XmlText({ useCDATA: true })
    htmlContent: string = '';
}

const article = new Article();
article.htmlContent = '<div><p>Complex <strong>HTML</strong></p></div>';
```

### 7. Document Mixed Content Structure

```typescript
/**
 * Article content with mixed text and formatting elements.
 * Structure:
 * - text: plain text nodes
 * - element: HTML-like elements (strong, em, a, etc.)
 * - attributes: element attributes (href, class, etc.)
 */
@XmlElement({ name: 'content', mixedContent: true })
content: any[] = [];
```

### 8. Validate Mixed Content Before Serialization

```typescript
function validateMixedContent(content: any[]): boolean {
    return content.every(node => {
        if ('text' in node) {
            return typeof node.text === 'string';
        }
        if ('element' in node) {
            return typeof node.element === 'string' &&
                   (typeof node.content === 'string' || Array.isArray(node.content));
        }
        return false;
    });
}

const para = new Paragraph();
para.content = [/* ... */];

if (validateMixedContent(para.content)) {
    const xml = serializer.toXml(para);
}
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Text Content & CDATA](text-content.md) - Simple text handling
- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Nested Objects](nested-objects.md) - Complex hierarchies
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Namespaces](namespaces.md) | [Home](../../README.md) | [Validation →](validation.md)
