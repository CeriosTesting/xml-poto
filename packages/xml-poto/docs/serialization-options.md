# Serialization Options

Every option accepted by `XmlSerializer` (and `XmlParser`), with its default.

Options are given to the **serializer**, not to `toXml`/`fromXml`:

```typescript
import { XmlSerializer } from "@cerios/xml-poto";

const serializer = new XmlSerializer({ format: false, omitNullValues: true });
const xml = serializer.toXml(person);
```

## Table of Contents

- [Behavior Changes in 2.5.0](#behavior-changes-in-250)
- [Output Shape](#output-shape)
- [Value Omission](#value-omission)
- [Schema and Type Hints](#schema-and-type-hints)
- [Parsing](#parsing)
- [Validation](#validation)

## Behavior Changes in 2.5.0

Two defaults changed to match .NET `XmlSerializer`. Both affect documents that previously emitted
empty elements or redundant values.

| Option              | Was     | Now    | Restore the old behavior with  |
| ------------------- | ------- | ------ | ------------------------------ |
| `omitNullValues`    | `false` | `true` | `{ omitNullValues: false }`    |
| `omitDefaultValues` | —       | `true` | `{ omitDefaultValues: false }` |

- **`omitNullValues`** — null/undefined non-nullable members are now **omitted** rather than written
  as empty elements. `isNullable` members still emit `xsi:nil="true"`, even when omission is on.
- **`omitDefaultValues`** — new. A scalar member whose value equals its declared `defaultValue` is
  now omitted on write, matching C# `[DefaultValue]`, and re-applied on read.

[↑ Back to top](#table-of-contents)

## Output Shape

| Option                   | Type                           | Default           | Description                                                                                                                                                                       |
| ------------------------ | ------------------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`                 | `boolean`                      | `true`            | Indent and line-break the output. Set `false` for a compact, single-line document — what a SOAP request usually wants, and what anything hashing or signing the payload requires. |
| `indent`                 | `string`                       | `"  "` (2 spaces) | Indentation string per nesting level. Only applies when `format` is `true`.                                                                                                       |
| `emptyElementStyle`      | `"self-closing" \| "explicit"` | `"self-closing"`  | `<tag/>` versus `<tag></tag>`.                                                                                                                                                    |
| `omitXmlDeclaration`     | `boolean`                      | `false`           | Skip the `<?xml version="1.0"?>` declaration.                                                                                                                                     |
| `xmlVersion`             | `string`                       | `"1.0"`           | XML version written in the declaration.                                                                                                                                           |
| `encoding`               | `string`                       | `"UTF-8"`         | Character encoding written in the declaration.                                                                                                                                    |
| `standalone`             | `boolean`                      | _(not written)_   | Include a `standalone` declaration.                                                                                                                                               |
| `processingInstructions` | `ProcessingInstruction[]`      | _(none)_          | Processing instructions to write after the XML declaration. Each is `{ target, data }`.                                                                                           |
| `docType`                | `DocType`                      | _(none)_          | DOCTYPE declaration: `{ rootElement, publicId?, systemId?, internalSubset? }`.                                                                                                    |

```typescript
// Compact output, no declaration — for signing or hashing
const compact = new XmlSerializer({ format: false, omitXmlDeclaration: true });

// Tab-indented, explicit empty elements
const readable = new XmlSerializer({ indent: "\t", emptyElementStyle: "explicit" });
```

[↑ Back to top](#table-of-contents)

## Value Omission

| Option              | Type      | Default | Description                                                                                                                                                             |
| ------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `omitNullValues`    | `boolean` | `true`  | Omit null/undefined members instead of writing empty elements/attributes. `isNullable` members still emit `xsi:nil="true"`.                                             |
| `omitDefaultValues` | `boolean` | `true`  | Omit a member whose value equals its `defaultValue`. Applies to scalar element, attribute and text members only; `required` and `isNullable` members are never omitted. |

```typescript
@XmlRoot({ name: "Config" })
class Config {
	@XmlElement({ name: "port", defaultValue: 3000 })
	port: number = 3000;

	@XmlElement({ name: "host" })
	host?: string;
}

new XmlSerializer().toXml(new Config());
// <Config/>  — port equals its default, host is undefined

new XmlSerializer({ omitDefaultValues: false, omitNullValues: false }).toXml(new Config());
// <Config>
//   <port>3000</port>
//   <host/>
// </Config>
```

The omitted default is re-applied on deserialization, so the round-trip is lossless.

[↑ Back to top](#table-of-contents)

## Schema and Type Hints

| Option                      | Type                     | Default  | Description                                                                                                                                                                |
| --------------------------- | ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useXsiType`                | `boolean`                | `false`  | Write `xsi:type` on polymorphic values, qualified with the runtime type's namespace prefix. See [Polymorphism](features/polymorphism.md).                                  |
| `schemaLocation`            | `Record<string, string>` | _(none)_ | Emit `xsi:schemaLocation` on the document root, as namespace URI → location pairs. Written in the `"uri location"` form the spec requires, space-separated across entries. |
| `noNamespaceSchemaLocation` | `string`                 | _(none)_ | Emit `xsi:noNamespaceSchemaLocation` on the document root, for a schema with no target namespace.                                                                          |

Many public schemas (government, banking) require a schema location:

```typescript
const serializer = new XmlSerializer({
	schemaLocation: {
		"http://example.com/v1": "https://example.com/v1/schema.xsd",
	},
});
// <Root xsi:schemaLocation="http://example.com/v1 https://example.com/v1/schema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
```

The `xsi` namespace is declared automatically when one of these options writes an attribute.

[↑ Back to top](#table-of-contents)

## Parsing

| Option                | Type      | Default   | Description                                          |
| --------------------- | --------- | --------- | ---------------------------------------------------- |
| `ignoreAttributes`    | `boolean` | `false`   | Skip parsing and generating XML attributes entirely. |
| `attributeNamePrefix` | `string`  | `"@_"`    | Prefix for attribute names in parsed objects.        |
| `textNodeName`        | `string`  | `"#text"` | Property name for text content in mixed elements.    |

These control the intermediate representation the parser builds. Decorated classes rarely need
them; they matter when working with the raw parsed object or with `@XmlDynamic`.

[↑ Back to top](#table-of-contents)

## Validation

| Option                    | Type                                                    | Default    | Description                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validationMode`          | `"strict" \| "warn" \| "off"`                           | `"strict"` | How XSD facet violations (`pattern`, `enumValues`, length/min/max facets, `fixedValue`) and structural checks (choice groups, `min`/`maxOccurs`) are handled. |
| `validationModeOverrides` | `Partial<Record<XmlValidationRule, XmlValidationMode>>` | _(none)_   | Per-rule overrides. Unlisted rules follow `validationMode`.                                                                                                   |
| `strictValidation`        | `boolean`                                               | `false`    | Throw when nested objects are not properly instantiated via the `type` option.                                                                                |
| `requireAllByDefault`     | `boolean`                                               | `false`    | Treat every `@XmlElement`, `@XmlAttribute`, `@XmlArray` and `@XmlText` property as required unless `required: false` is set.                                  |

```typescript
const serializer = new XmlSerializer({
	validationMode: "strict",
	validationModeOverrides: { pattern: "warn", fixedValue: "off" },
});
```

See [Validation](features/validation.md) for the full rule list and examples.

[↑ Back to top](#table-of-contents)

---

## See Also

- [Core Concepts](core-concepts.md) - Decorators and how they map to XML
- [Validation](features/validation.md) - Facets, required fields and validation modes
- [Polymorphism](features/polymorphism.md) - `xsi:type` and type hierarchies
- [SOAP Envelopes](features/soap.md) - `SoapSerializer` inherits every option on this page

---

[← Core Concepts](core-concepts.md) | [Home](../README.md) | [Elements & Attributes →](features/elements-and-attributes.md)
