# @cerios/xml-poto-codegen

Generate TypeScript classes with [`@cerios/xml-poto`](https://www.npmjs.com/package/@cerios/xml-poto) decorators from XSD schemas. Turn your XML Schema definitions into fully decorated, type-safe TypeScript code — ready for bidirectional XML serialization.

[![npm version](https://img.shields.io/npm/v/@cerios/xml-poto-codegen.svg)](https://www.npmjs.com/package/@cerios/xml-poto-codegen)
[![npm downloads](https://img.shields.io/npm/dm/@cerios/xml-poto-codegen.svg)](https://www.npmjs.com/package/@cerios/xml-poto-codegen)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## ✨ Key Features

- 🎯 **Type-Safe Output** — Generated classes with full TypeScript types and decorator metadata
- 📄 **XSD Driven** — Supports complex types, enumerations, inheritance, namespaces, groups, and more
- 🧼 **WSDL Input** — Extracts and merges all XSD schemas embedded in a WSDL `<types>` section
- ✅ **Validation Built In** — XSD facets (pattern, length, numeric bounds, digits, whiteSpace), fixed values, `xs:list`, and `xs:choice` groups are emitted as runtime-validated decorator options
- 📝 **JSDoc from XSD** — `xs:documentation` annotations become JSDoc on classes, properties, and enums
- 🔧 **Configurable** — JSON or TypeScript config with per-source overrides
- 📁 **Flexible Output** — One file per class (`per-type`) or all-in-one (`per-xsd`)
- 🏷️ **Enum Styles** — Generate unions, TS enums, or const-object patterns
- 🔗 **Multi-XSD** — Process multiple schemas with cross-file `xs:import` resolution
- 🚀 **CLI & Programmatic** — Use from the command line or integrate into build scripts
- 📦 **Zero Config Start** — Interactive `init` command to scaffold your config

## 📦 Installation

```bash
npm install -D @cerios/xml-poto-codegen
```

> **Peer dependency:** [`@cerios/xml-poto`](https://www.npmjs.com/package/@cerios/xml-poto) must be installed in the project where generated code will be used.

## 🎯 Quick Start

### 1. Initialize config

```bash
npx xml-poto-codegen init
```

The init flow asks you to choose either a JSON or TypeScript config file and then scaffolds it in your project root.

Example `xml-poto-codegen.config.json`:

```json
{
	"sources": [
		{
			"xsdPath": "./schemas/my-schema.xsd",
			"outputPath": "./src/generated",
			"outputStyle": "per-type"
		}
	]
}
```

### 2. Generate classes

```bash
npx xml-poto-codegen generate
```

### 3. Use the generated code

Given this XSD:

```xml
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Person">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="FirstName" type="xs:string"/>
        <xs:element name="LastName" type="xs:string"/>
        <xs:element name="Age" type="xs:integer"/>
        <xs:element name="Email" type="xs:string" minOccurs="0"/>
      </xs:sequence>
      <xs:attribute name="id" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>
</xs:schema>
```

The codegen produces:

```typescript
// ──────────────────────────────────────────────
// AUTO-GENERATED — do not edit
// ──────────────────────────────────────────────

import { XmlAttribute, XmlElement, XmlRoot } from "@cerios/xml-poto";

@XmlRoot({ name: "Person" })
export class Person {
	@XmlAttribute({ name: "id", required: true })
	id: string = "";

	@XmlElement({ name: "FirstName" })
	firstName: string = "";

	@XmlElement({ name: "LastName" })
	lastName: string = "";

	@XmlElement({ name: "Age" })
	age: number = 0;

	@XmlElement({ name: "Email" })
	email?: string;
}
```

You can then serialize and deserialize immediately with `@cerios/xml-poto`:

```typescript
import { XmlSerializer } from "@cerios/xml-poto";
import { Person } from "./generated/person";

const serializer = new XmlSerializer();
const person = serializer.fromXml(xmlString, Person);
const xml = serializer.toXml(person);
```

## 🛠️ CLI Commands

### `init`

```bash
npx xml-poto-codegen init
```

Interactively create a config file. Prompts for config format (json/ts, default: ts), validates XSD paths, asks for output style, then asks for a folder path (`per-type`) or file path (`per-xsd`) accordingly.

### `generate`

```bash
npx xml-poto-codegen generate
```

## ⚙️ Configuration

Create `xml-poto-codegen.config.json` or `xml-poto-codegen.config.ts` in your project root.

### JSON config

```json
{
	"sources": [
		{
			"xsdPath": "./schemas/orders.xsd",
			"outputPath": "./src/generated/orders",
			"outputStyle": "per-type"
		},
		{
			"xsdPath": "./schemas/products.xsd",
			"outputPath": "./src/generated/products.ts",
			"outputStyle": "per-xsd"
		}
	],
	"defaultOutputStyle": "per-type"
}
```

### TypeScript config

```ts
import type { XmlPotoCodegenConfig } from "@cerios/xml-poto-codegen";

const config: XmlPotoCodegenConfig = {
	sources: [
		{
			xsdPath: "./schemas/orders.xsd",
			outputPath: "./src/generated/orders",
			outputStyle: "per-type",
		},
	],
	defaultOutputStyle: "per-type",
};

export default config;
```

### Global options

| Option               | Type                                  | Description                                                  |
| -------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `sources`            | `XsdSource[]`                         | Array of XSD sources to process                              |
| `defaultOutputStyle` | `'per-type' \| 'per-xsd'`             | Default output style for all sources (default: `'per-type'`) |
| `enumStyle`          | `'union' \| 'enum' \| 'const-object'` | Default enum generation style (default: `'union'`)           |

### Source options

| Option        | Type                                  | Description                                                    |
| ------------- | ------------------------------------- | -------------------------------------------------------------- |
| `xsdPath`     | `string`                              | Path to the XSD file (required)                                |
| `outputPath`  | `string`                              | Output path. `per-type`: directory. `per-xsd`: `.ts` file path |
| `outputStyle` | `'per-type' \| 'per-xsd'`             | `'per-type'`: one file per class. `'per-xsd'`: all in one file |
| `enumStyle`   | `'union' \| 'enum' \| 'const-object'` | Enum generation style for this source (overrides global)       |

## 🏷️ Enum Styles

Choose how XSD enumerations are generated with the `enumStyle` option.

### `"union"` (default)

```typescript
export type StatusType = "active" | "inactive" | "pending";
```

### `"enum"`

```typescript
export enum StatusType {
	Active = "active",
	Inactive = "inactive",
	Pending = "pending",
}
```

### `"const-object"`

```typescript
export const StatusType = {
	Active: "active",
	Inactive: "inactive",
	Pending: "pending",
} as const;
export type StatusType = (typeof StatusType)[keyof typeof StatusType];
```

## 🔧 XSD to Decorator Mapping

| XSD Concept                    | Generated Code                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Root element + complexType     | `@XmlRoot({ name: '...' })`                                                                                               |
| Named complexType              | `@XmlElement()` class                                                                                                     |
| Element in sequence            | `@XmlElement({ name: '...' })`                                                                                            |
| Element with `maxOccurs > 1`   | `@XmlArray({ itemName: '...' })` (+ `minOccurs`/`maxOccurs` for finite bounds)                                            |
| Attribute                      | `@XmlAttribute({ name: '...' })`                                                                                          |
| simpleContent                  | `@XmlText()`                                                                                                              |
| Enumeration restriction        | `enumValues` option                                                                                                       |
| Pattern restriction            | `pattern` option (multiple `xs:pattern` facets are ORed)                                                                  |
| Facet restrictions             | `length`, `minLength`, `maxLength`, `min/maxInclusive`, `min/maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace` |
| `fixed="..."`                  | `fixedValue` option (default when absent, constraint when present)                                                        |
| `xs:list`                      | `list` option — space-separated text round-trips as a typed array                                                         |
| `xs:choice`                    | `choiceGroup` / `choiceRequired` options (exclusive-member validation)                                                    |
| `nillable="true"`              | `isNullable: true` (round-trips `xsi:nil`)                                                                                |
| `xs:annotation/documentation`  | JSDoc comments                                                                                                            |
| `xs:any`                       | `@XmlDynamic()`                                                                                                           |
| Extension base                 | TypeScript `extends`                                                                                                      |
| `xs:import` / `xs:include`     | Cross-file type resolution                                                                                                |
| WSDL `<definitions>` documents | Embedded `<types>` schemas extracted and merged                                                                           |
| `substitutionGroup`            | Resolved to concrete types                                                                                                |
| Groups / attributeGroups       | Inlined into the containing class                                                                                         |

### Coverage Notes

Codegen focuses on what can be inferred from XSD structure and constraints. The generated code covers core decorators and common options, but not every runtime-only `xml-poto` capability.

- Generated from XSD: `@XmlRoot`, `@XmlElement`, `@XmlAttribute`, `@XmlText`, `@XmlArray`, `@XmlDynamic`
- Not generated (manual only): `@XmlComment`, `@XmlIgnore`
- Partial option coverage by design: runtime tuning options such as custom converters/transforms, CDATA toggles, mixed-content behavior flags, and advanced `@XmlDynamic` parse/cache/lazy settings are not inferred from XSD and must be added manually when needed.
- Parsed but reported as warnings only (no class-level representation): identity constraints (`xs:key`/`xs:keyref`/`xs:unique`), `xs:notation`, `xs:redefine` overrides, `use="prohibited"` attributes (omitted), and remote (`http(s)`) `schemaLocation` references (not fetched).

### WSDL Input

Files whose root element is `<definitions>` (SOAP/WSDL) are detected automatically — the extension does not matter (`.xsd` or `.wsdl`). All `<schema>` elements inside the WSDL `<types>` section are extracted, inherit the namespace declarations from `<definitions>`, and are merged into a single schema before generation. WSDL-only artifacts (messages, port types, bindings, services) are ignored.

## 📁 Output Styles

### `per-type` (default)

One file per class/enum plus a barrel `index.ts`:

```
src/generated/
  ├── person.ts
  ├── address-type.ts
  ├── status-type.ts
  └── index.ts
```

### `per-xsd`

All types in a single file:

```
src/generated/
  └── my-schema.ts
```

### Declaration Order & Circular Types

Generated classes are always declared dependency-first (base types and referenced types before their dependents), regardless of the declaration order in the XSD — the order is stable, so schemas already in a valid order generate unchanged output.

Circular and self-referencing types (e.g. a `Section` containing `Section` children), which no declaration order can satisfy, are emitted as lazy references (`type: () => Section`). In `per-type` mode, classes connected by an `extends` relationship inside a reference cycle are placed together in one file (named after the base class), because a cyclic `extends` split across ES modules cannot evaluate in any import order.

## 💡 Why Codegen?

### Without codegen ❌

```typescript
// Manually write decorated classes for every XSD type
@XmlRoot({ name: "Person" })
class Person {
	@XmlAttribute({ name: "id", required: true })
	id: string = "";

	@XmlElement({ name: "FirstName" })
	firstName: string = "";

	// ... dozens more properties, easy to get wrong
}
```

### With codegen ✅

```bash
# One command, always in sync with your schema
npx xml-poto-codegen generate
```

**Benefits:**

- ✅ Always matches the XSD — no manual drift
- ✅ Handles complex schemas with inheritance, groups, and namespaces
- ✅ Regenerate when schemas change
- ✅ Consistent decorator options and property types

## 🎓 Best Practices

1. **Commit your config, not the generated code** — Add `src/generated/` to `.gitignore` and run codegen as part of your build pipeline.

2. **Use `per-type` for large schemas** — Keeps files small and enables tree-shaking.

3. **Pin your enum style per-source** — Override `enumStyle` at the source level when different schemas need different patterns.

4. **Regenerate after schema changes** — Run `npx xml-poto-codegen generate` whenever your XSD files are updated.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md).

## 📄 License

MIT © Ronald Veth - Cerios

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/xml-poto)
- [NPM Package](https://www.npmjs.com/package/@cerios/xml-poto-codegen)
- [xml-poto (runtime library)](https://www.npmjs.com/package/@cerios/xml-poto)
- [Issue Tracker](https://github.com/CeriosTesting/xml-poto/issues)
- [Changelog](CHANGELOG.md)
