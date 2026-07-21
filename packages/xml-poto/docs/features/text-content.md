# Text Content & CDATA

Learn how to handle text content and CDATA sections in XML elements using the `@XmlText` decorator.

## Table of Contents

- [Overview](#overview)
- [@XmlText Decorator](#xmltext-decorator)
- [Basic Text Content](#basic-text-content)
- [CDATA Sections](#cdata-sections)
- [Text with Attributes](#text-with-attributes)
- [Preserving Whitespace](#preserving-whitespace)
- [Special Characters](#special-characters)
- [Best Practices](#best-practices)

## Overview

The `@XmlText` decorator maps a class property to the text content of an XML element. This is useful when an element contains both attributes and text, or when you need to preserve special characters and formatting using CDATA sections.

**Simple Text Content:**

```xml
<Description>This is a description</Description>
```

**Text with CDATA:**

```xml
<Script><![CDATA[
function hello() {
    alert("Hello World!");
}
]]></Script>
```

[↑ Back to top](#table-of-contents)

## @XmlText Decorator

The `@XmlText` decorator configures how text content is serialized and deserialized.

### Options

```typescript
interface XmlTextOptions {
	useCDATA?: boolean; // Wrap content in CDATA section (default: false)
	required?: boolean; // Validation: text content must be present
	converter?: Converter; // Custom value transformation ({ serialize, deserialize })
	dataType?: string; // XML Schema data type, e.g. 'xs:decimal'
	list?: XmlListOptions; // Read/write the text as a space-separated list (xs:list)
	// …plus the XSD facets — see the Validation guide
}
```

### Basic Usage

```typescript
import { XmlRoot, XmlText, XmlSerializer } from "@cerios/xml-poto";

@XmlRoot({ name: "Note" })
class Note {
	@XmlText()
	content: string = "";
}

const note = new Note();
note.content = "Remember to buy milk!";

const serializer = new XmlSerializer();
const xml = serializer.toXml(note);
```

**Output:**

```xml
<Note>Remember to buy milk!</Note>
```

[↑ Back to top](#table-of-contents)

## Basic Text Content

### Simple Text Element

```typescript
@XmlRoot({ name: "Message" })
class Message {
	@XmlText()
	text: string = "";
}

const message = new Message();
message.text = "Hello, World!";

const xml = serializer.toXml(message);
```

**Output:**

```xml
<Message>Hello, World!</Message>
```

### Deserialization

```typescript
const xml = "<Message>Welcome to xml-poto!</Message>";
const message = serializer.fromXml(xml, Message);

console.log(message.text); // "Welcome to xml-poto!"
```

### Text with Multiple Lines

```typescript
@XmlRoot({ name: "Paragraph" })
class Paragraph {
	@XmlText()
	content: string = "";
}

const para = new Paragraph();
para.content = `Line 1
Line 2
Line 3`;

const xml = serializer.toXml(para);
```

**Output:**

```xml
<Paragraph>Line 1
Line 2
Line 3</Paragraph>
```

[↑ Back to top](#table-of-contents)

## CDATA Sections

CDATA (Character Data) sections allow you to include text that contains XML special characters without escaping them. This is particularly useful for:

- JavaScript/CSS code
- HTML content
- JSON data
- Any content with `<`, `>`, `&`, `"`, `'` characters

### Enabling CDATA

```typescript
@XmlRoot({ name: "Script" })
class Script {
	@XmlText({ useCDATA: true })
	code: string = "";
}

const script = new Script();
script.code = '<script>alert("XSS")</script>';

const xml = serializer.toXml(script);
```

**Output:**

```xml
<Script><![CDATA[<script>alert("XSS")</script>]]></Script>
```

### JavaScript Code Example

```typescript
@XmlRoot({ name: "JavaScriptFunction" })
class JavaScriptFunction {
	@XmlText({ useCDATA: true })
	body: string = "";
}

const func = new JavaScriptFunction();
func.body = `function greet(name) {
    if (name) {
        alert("Hello, " + name + "!");
    }
}`;

const xml = serializer.toXml(func);
```

**Output:**

```xml
<JavaScriptFunction><![CDATA[function greet(name) {
    if (name) {
        alert("Hello, " + name + "!");
    }
}]]></JavaScriptFunction>
```

### HTML Content Example

```typescript
@XmlRoot({ name: "HtmlContent" })
class HtmlContent {
	@XmlText({ useCDATA: true })
	html: string = "";
}

const content = new HtmlContent();
content.html = '<div class="container"><p>Hello <strong>World</strong>!</p></div>';

const xml = serializer.toXml(content);
```

**Output:**

```xml
<HtmlContent><![CDATA[<div class="container"><p>Hello <strong>World</strong>!</p></div>]]></HtmlContent>
```

### Deserialization with CDATA

```typescript
const xml = `<Script><![CDATA[<script>alert("XSS")</script>]]></Script>`;

const script = serializer.fromXml(xml, Script);
console.log(script.code); // "<script>alert("XSS")</script>"
```

### Special XML Characters in CDATA

CDATA sections preserve all special XML characters without escaping:

```typescript
@XmlRoot({ name: "SpecialContent" })
class SpecialContent {
	@XmlText({ useCDATA: true })
	data: string = "";
}

const content = new SpecialContent();
content.data = "< > & \" ' are all valid here!";

const xml = serializer.toXml(content);
```

**Output:**

```xml
<SpecialContent><![CDATA[< > & " ' are all valid here!]]></SpecialContent>
```

[↑ Back to top](#table-of-contents)

## Text with Attributes

You can combine `@XmlText` with `@XmlAttribute` to create elements that have both attributes and text content:

### Basic Example

```typescript
import { XmlRoot, XmlAttribute, XmlText } from "@cerios/xml-poto";

@XmlRoot({ name: "Link" })
class Link {
	@XmlAttribute({ name: "href" })
	url: string = "";

	@XmlAttribute({ name: "target" })
	target: string = "_blank";

	@XmlText()
	text: string = "";
}

const link = new Link();
link.url = "https://example.com";
link.target = "_self";
link.text = "Click here";

const xml = serializer.toXml(link);
```

**Output:**

```xml
<Link href="https://example.com" target="_self">Click here</Link>
```

### CDATA with Attributes

```typescript
@XmlRoot({ name: "Content" })
class Content {
	@XmlAttribute({ name: "type" })
	type: string = "";

	@XmlAttribute({ name: "encoding" })
	encoding: string = "utf-8";

	@XmlText({ useCDATA: true })
	data: string = "";
}

const content = new Content();
content.type = "html";
content.encoding = "utf-8";
content.data = "<p>Hello</p>";

const xml = serializer.toXml(content);
```

**Output:**

```xml
<Content type="html" encoding="utf-8"><![CDATA[<p>Hello</p>]]></Content>
```

### Deserialization

```typescript
const xml = '<Content type="html" encoding="utf-8"><![CDATA[<p>Hello</p>]]></Content>';
const content = serializer.fromXml(xml, Content);

console.log(content.type); // "html"
console.log(content.encoding); // "utf-8"
console.log(content.data); // "<p>Hello</p>"
```

[↑ Back to top](#table-of-contents)

## Preserving Whitespace

Whitespace handling is declared on the containing element with `xmlSpace`, which emits the
standard `xml:space` attribute — the same mechanism .NET and Java use.

### Default

```typescript
@XmlRoot({ name: "Code" })
class Code {
	@XmlText()
	content: string = "";
}

const code = new Code();
code.content = "    indented\n    code";

// Consumers are free to normalize the whitespace
```

### With Preservation

```typescript
@XmlRoot({ name: "Code", xmlSpace: "preserve" })
class Code {
	@XmlText()
	content: string = "";
}

const code = new Code();
code.content = `    function example() {
        console.log("indented");
    }`;

// Serializes as <Code xml:space="preserve">…</Code>, telling consumers to keep it verbatim
```

`xmlSpace` is available on `@XmlRoot` and `@XmlElement`.

### Combining CDATA and Whitespace

```typescript
@XmlRoot({ name: "FormattedCode", xmlSpace: "preserve" })
class FormattedCode {
	@XmlText({ useCDATA: true })
	code: string = "";
}

const formatted = new FormattedCode();
formatted.code = `    <div>
        <p>Indented HTML</p>
    </div>`;

const xml = serializer.toXml(formatted);
```

**Output:**

```xml
<FormattedCode><![CDATA[    <div>
        <p>Indented HTML</p>
    </div>]]></FormattedCode>
```

[↑ Back to top](#table-of-contents)

## Special Characters

### Without CDATA (Auto-Escaped)

```typescript
@XmlRoot({ name: "Text" })
class Text {
	@XmlText()
	content: string = "";
}

const text = new Text();
text.content = "Less than < and greater than > and ampersand &";

const xml = serializer.toXml(text);
```

**Output:**

```xml
<Text>Less than &lt; and greater than &gt; and ampersand &amp;</Text>
```

### With CDATA (No Escaping Needed)

```typescript
@XmlRoot({ name: "Text" })
class Text {
	@XmlText({ useCDATA: true })
	content: string = "";
}

const text = new Text();
text.content = "Less than < and greater than > and ampersand &";

const xml = serializer.toXml(text);
```

**Output:**

```xml
<Text><![CDATA[Less than < and greater than > and ampersand &]]></Text>
```

### Quote Characters

```typescript
@XmlRoot({ name: "Quote" })
class Quote {
	@XmlText({ useCDATA: false })
	text: string = "";
}

const quote = new Quote();
quote.text = "She said \"Hello\" and he replied 'Hi'";

const xml = serializer.toXml(quote);
```

**Output:**

```xml
<Quote>She said &quot;Hello&quot; and he replied &apos;Hi&apos;</Quote>
```

### Which Entities Are Recognised on Read

The parser resolves the five entities XML predefines — `&lt;` `&gt;` `&amp;` `&quot;` `&apos;` —
plus decimal and hexadecimal character references (`&#10;`, `&#x1F600;`, including characters
above U+FFFF).

Entities **declared in a DTD** are not resolved: no DTD is read, so an unrecognised `&nbsp;`
comes back as the literal text `&nbsp;` rather than being guessed at or silently dropped. A
useful consequence is that entity-expansion attacks ("billion laughs") have nothing to expand.

Values that would break the document are made safe on write: text containing `]]>` inside a
CDATA section is split across two sections, `--` inside a comment is padded, and tabs and line
breaks inside **attribute** values become `&#9;`/`&#10;`/`&#13;` so they survive the
attribute-value normalization every conforming reader applies.

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use CDATA for Code and Markup

```typescript
// ✅ Good - uses CDATA for HTML/JS/CSS
@XmlText({ useCDATA: true })
scriptContent: string = '';

// ❌ Bad - special characters will be escaped
@XmlText()
scriptContent: string = '';
```

### 2. Initialize Text Properties

```typescript
// ✅ Good - initialized
@XmlText()
content: string = '';

// ❌ Bad - may cause undefined issues
@XmlText()
content: string;
```

### 3. Use CDATA Only When Needed

```typescript
// ✅ Good - simple text doesn't need CDATA
@XmlText()
name: string = '';

// ❌ Bad - unnecessary CDATA overhead
@XmlText({ useCDATA: true })
name: string = '';
```

### 4. Combine with Attributes Wisely

```typescript
// ✅ Good - clear structure
@XmlRoot({ name: "Link" })
class Link {
	@XmlAttribute({ name: "href" })
	url: string = "";

	@XmlText()
	text: string = "";
}

// ❌ Bad - confusing with child elements
@XmlRoot({ name: "Link" })
class Link {
	@XmlElement({ name: "Url" })
	url: string = "";

	@XmlText() // Text + child elements = mixed content
	text: string = "";
}
```

### 5. Handle Empty Text

```typescript
const serializer = new XmlSerializer({ omitNullValues: true });

const note = new Note();
note.content = "";

const xml = serializer.toXml(note);
// Empty text content may be omitted
```

### 6. Test Roundtrip with Special Characters

```typescript
describe("Text Serialization", () => {
	it("should handle special characters", () => {
		const original = new Script();
		original.code = '<script>alert("test")</script>';

		const xml = serializer.toXml(original);
		const restored = serializer.fromXml(xml, Script);

		expect(restored.code).toBe(original.code);
	});
});
```

### 7. Use Appropriate CDATA for Content Type

```typescript
// ✅ Good - matches content type
@XmlRoot({ name: "Config" })
class Config {
	@XmlText({ useCDATA: true }) // JSON/XML content
	jsonData: string = "";

	@XmlElement({ name: "Name" }) // Simple text
	name: string = "";
}
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Mixed Content](mixed-content.md) - Handling mixed text and elements
- [Comments](comments.md) - XML comment support
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Comments](comments.md) | [Home](../../README.md) | [Mixed Content →](mixed-content.md)
