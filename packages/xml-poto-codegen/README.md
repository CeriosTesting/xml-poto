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
>
> **Requires `@cerios/xml-poto` 2.5.0 or newer.** Generated code imports `XmlType`, `XmlInclude` and `@XmlArray({ items })`, which earlier versions do not export. The declared peer range is wider than this, so upgrade both together — an older runtime fails at compile time on the generated module rather than at install.

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

| Option                  | Type                                       | Description                                                                     |
| ----------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `sources`               | `XsdSource[]`                              | Array of XSD sources to process                                                 |
| `defaultOutputStyle`    | `'per-type' \| 'per-xsd'`                  | Default output style for all sources (default: `'per-type'`)                    |
| `enumStyle`             | `'union' \| 'enum' \| 'const-object'`      | Default enum generation style (default: `'union'`)                              |
| `useXmlRoot`            | `boolean`                                  | Emit `@XmlRoot` for root elements; `@XmlElement` when `false` (default: `true`) |
| `elementForm`           | `'schema' \| 'qualified' \| 'unqualified'` | How local elements are namespace-qualified (default: `'schema'`)                |
| `bigIntegerAs`          | `'number' \| 'string'`                     | How over-wide integer types are generated (default: `'number'`)                 |
| `requiredPropertyStyle` | `'schema' \| 'definite' \| 'initialized'`  | How required properties are declared (default: `'schema'`)                      |

### Source options

Every option below overrides its global counterpart for that source.

| Option                  | Type                                       | Description                                                    |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `xsdPath`               | `string`                                   | Path to the XSD file (required)                                |
| `outputPath`            | `string`                                   | Output path. `per-type`: directory. `per-xsd`: `.ts` file path |
| `outputStyle`           | `'per-type' \| 'per-xsd'`                  | `'per-type'`: one file per class. `'per-xsd'`: all in one file |
| `enumStyle`             | `'union' \| 'enum' \| 'const-object'`      | Enum generation style for this source                          |
| `useXmlRoot`            | `boolean`                                  | Emit `@XmlRoot` for root elements, or `@XmlElement`            |
| `elementForm`           | `'schema' \| 'qualified' \| 'unqualified'` | How local elements are namespace-qualified                     |
| `bigIntegerAs`          | `'number' \| 'string'`                     | How over-wide integer types are generated                      |
| `requiredPropertyStyle` | `'schema' \| 'definite' \| 'initialized'`  | How required properties are declared                           |

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

## 🌐 Namespace Qualification (`elementForm`)

XSD's `elementFormDefault` decides whether **local** elements are namespace-qualified. It
defaults to `unqualified` when a schema does not declare it, meaning only globally declared
elements carry the namespace:

```xml
<tns:gbavVraag xmlns:tns="http://example.com/v1">
  <identificatie>                     <!-- local: unqualified -->
    <indicatie>AFN</indicatie>
  </identificatie>
</tns:gbavVraag>
```

`elementForm` controls whether the generator honours that:

| Value           | Behaviour                                              |
| --------------- | ------------------------------------------------------ |
| `'schema'`      | **Default.** Honour the schema's `elementFormDefault`. |
| `'qualified'`   | Force qualified locals, whatever the schema says.      |
| `'unqualified'` | Force unqualified locals, whatever the schema says.    |

Forcing is an escape hatch for a service whose WSDL disagrees with what it actually puts on the
wire — not uncommon with older SOAP stacks. Reading is unaffected either way: deserialization
matches elements on their namespace URI, so a response using any prefix is understood.

## 🔢 Wide Integers (`bigIntegerAs`)

`xs:integer` is arbitrary-precision in XSD, and `xs:long` reaches 9223372036854775807 — both
beyond JavaScript's `Number.MAX_SAFE_INTEGER`, where `9007199254740993` silently becomes
`…992`.

| Value      | Behaviour                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------- |
| `'number'` | **Default.** Ergonomic, and accepts precision loss above 2^53.                               |
| `'string'` | Generate `string` for integer types whose `totalDigits` is absent or exceeds 15 safe digits. |

Integer types bounded by a `totalDigits` within range stay `number` under either setting, so
most schemas are unaffected. Reach for `'string'` when a schema carries long account,
transaction or document identifiers.

> A numeric type constrained by an XSD `pattern` is always generated as `string`, regardless of
> this option — a pattern constrains the _lexical_ form, which is how a schema expresses
> "nine digits, leading zero permitted". Coercing such a value to a number would change it.

## ✳️ Required Properties (`requiredPropertyStyle`)

A required member is generated either with a default initializer or with a definite-assignment
assertion, which makes `tsc` demand an assignment under `strictPropertyInitialization`:

```typescript
nummer: string = ""; // initializer
str!: string; // definite assignment
```

By default the choice is made per property, and it follows the schema. That means two schemas
describing the same service can generate differently — a schema declaring its elements against
raw built-ins keeps the initializer, while one restricting them does not:

```xml
<!-- '' is legal → nummer: string = '' -->
<xsd:element name="nummer" type="xsd:string" minOccurs="1"/>

<!-- '' violates minLength → str!: string -->
<xsd:simpleType name="NmIP">
  <xsd:restriction base="xsd:string"><xsd:minLength value="1"/></xsd:restriction>
</xsd:simpleType>
```

The reasoning is that `= ''` under `minLength="1"` cannot serialize: it only turns a missing
assignment into a runtime facet error, whereas `!` makes the compiler catch it. Set the option to
force one uniform shape instead.

| Value           | Behaviour                                                                     |
| --------------- | ----------------------------------------------------------------------------- |
| `'schema'`      | **Default.** Keep the initializer unless the property's own facets reject it. |
| `'definite'`    | Always `!`, whatever the schema says.                                         |
| `'initialized'` | Always an initializer where one is possible.                                  |

Under `'schema'`, a `''` is considered rejected by a `pattern`, a `minLength`/`length` above 0, or
an enumeration not listing it; a `0` by a `minInclusive` above 0, a `minExclusive` of 0 or more, a
negative `maxInclusive`/`maxExclusive`, or an enumeration not listing it. A property carrying
`default` or `fixed` is exempt — the schema chose that value.

> Enum-typed and abstract-typed members always take `!`, including under `'initialized'`. Neither
> has an assignable initializer: the base type's `''`/`0` does not satisfy an enum union, and an
> `abstract class` has no `new Type()` to call.

## 🔧 XSD to Decorator Mapping

| XSD Concept                           | Generated Code                                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Root element + complexType            | `@XmlRoot({ name: '...' })`                                                                                               |
| Named complexType                     | `@XmlType({ name: '...' })` class (`@XmlElement` when `useXmlRoot: false`)                                                |
| Element in sequence                   | `@XmlElement({ name: '...' })`                                                                                            |
| `xs:element ref` / `xs:attribute ref` | Resolved to the referenced global declaration's type and facets; always namespace-qualified                               |
| Repeating `xs:choice`/`xs:sequence`   | One `@XmlArray({ items })` collection, keeping the document order of the differently named siblings                       |
| `mixed="true"` complex type           | `@XmlText({ mixed: true })` beside the typed members, collecting the interleaved text runs                                |
| Element with `maxOccurs > 1`          | `@XmlArray({ itemName: '...' })` (+ `minOccurs`/`maxOccurs` for finite bounds)                                            |
| Attribute                             | `@XmlAttribute({ name: '...' })`                                                                                          |
| simpleContent                         | `@XmlText()`                                                                                                              |
| Enumeration restriction               | `enumValues` option                                                                                                       |
| Pattern restriction                   | `pattern` option (multiple `xs:pattern` facets are ORed)                                                                  |
| Facet restrictions                    | `length`, `minLength`, `maxLength`, `min/maxInclusive`, `min/maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace` |
| `fixed="..."`                         | `fixedValue` option (default when absent, constraint when present)                                                        |
| `xs:list`                             | `list` option — space-separated text round-trips as a typed array                                                         |
| `xs:choice`                           | `choiceGroup` / `choiceRequired` options (exclusive-member validation)                                                    |
| `nillable="true"`                     | `isNullable: true` (round-trips `xsi:nil`)                                                                                |
| `xs:annotation/documentation`         | JSDoc comments                                                                                                            |
| `xs:any` (in a sequence or a choice)  | `@XmlDynamic()`                                                                                                           |
| Inline `xs:union`/`xs:list` members   | Resolved like the attribute form, instead of collapsing to `string`                                                       |
| `xs:IDREFS` / `NMTOKENS` / `ENTITIES` | `string[]` with the `list` option                                                                                         |
| `complexContent` extension            | TypeScript `extends`                                                                                                      |
| `complexContent` restriction          | Flattened to a standalone class with the restricted members (no `extends`)                                                |
| `abstract="true"` complex type        | `abstract class`                                                                                                          |
| Type hierarchies (`xsi:type`)         | `@XmlInclude(() => Sub)` on the base in single-file mode; per-type relies on `@XmlType` self-registration                 |
| `xs:import` (different ns)            | Each imported type keeps its own namespace / element form                                                                 |
| `xs:import` / `xs:include`            | Cross-file type resolution                                                                                                |
| WSDL `<definitions>` documents        | Embedded `<types>` schemas merged; `message`/`portType`/`binding` become an `operations.ts`                               |
| `wsdl:import`                         | Followed for both WSDL and XSD targets, so a WSDL split over several files generates as one                               |
| `substitutionGroup`                   | Head becomes `@XmlArray({ items })` over the head and its substitutes, each with its own type                             |
| Groups / attributeGroups              | Inlined into the containing class                                                                                         |
| `xs:anyAttribute`                     | `@XmlDynamic()` — one `anyAttributes` member, wherever the wildcard is declared (see below)                               |

### Coverage Notes

Codegen focuses on what can be inferred from XSD structure and constraints. The generated code covers core decorators and common options, but not every runtime-only `xml-poto` capability.

- Generated from XSD: `@XmlRoot`, `@XmlElement`, `@XmlAttribute`, `@XmlText`, `@XmlArray`, `@XmlDynamic`, `@XmlType`, and (single-file mode) `@XmlInclude`
- Not generated (manual only): `@XmlComment`, `@XmlIgnore`
- Polymorphism: abstract complex types generate `abstract class`; in single-file (`per-xsd`) mode a base type emits `@XmlInclude(() => Sub)` so `xsi:type` resolves to the subtype. In `per-type` mode `@XmlInclude` is omitted (it would create an import cycle); subtypes register their `@XmlType` identity when the barrel is loaded, so load the barrel (or import each subtype) for `xsi:type` resolution.
- `complexContent` restriction is flattened: the derived type is a standalone class with only the restricted members, not `extends Base` (which would re-inherit dropped members).
- `xs:anyAttribute` is honoured in every position XSD allows it — on the complex type, on either half of `simpleContent`/`complexContent`, and on an `attributeGroup` definition reached through any depth of references. However many of those name the wildcard, the class gets a single `anyAttributes` member.
- Partial option coverage by design: runtime tuning options such as custom converters/transforms, CDATA toggles, mixed-content behavior flags, and advanced `@XmlDynamic` parse/cache/lazy settings are not inferred from XSD and must be added manually when needed.
- Parsed but reported as warnings only (no class-level representation): identity constraints (`xs:key`/`xs:keyref`/`xs:unique`), `xs:notation`, `xs:redefine` overrides, `use="prohibited"` attributes (omitted), and remote (`http(s)`) `schemaLocation` references (not fetched).
- `xs:pattern` is translated to a JavaScript `RegExp`. XSD's name-character escapes (`\i`, `\I`, `\c`, `\C`) are expanded; constructs JavaScript cannot express — character-class subtraction (`[a-z-[aeiou]]`) and Unicode block escapes (`\p{IsBasicLatin}`) — are dropped with a coverage note, because generated code passes the pattern to `new RegExp` at decoration time and an untranslatable one would throw on import.
- Two distinct complex types that map to the same class name (same local name in two merged namespaces, or two inline types sharing an element name) are kept apart: the second is suffixed (`AddressType2`) and reported. An `xs:redefine` pair is exempt — its shared name is intentional.

### WSDL Input

Files whose root element is `<definitions>` (SOAP/WSDL) are detected automatically — the extension does not matter (`.xsd` or `.wsdl`). All `<schema>` elements inside the WSDL `<types>` section are extracted, inherit the namespace declarations from `<definitions>`, and are merged into a single schema before generation.

`wsdl:import` is followed, so a WSDL split across files generates as one document: point the CLI at the file naming the service and the imported `<types>`, `<message>` and `<portType>` come with it. An imported operation is still paired with the `<binding>` that annotates it even when the two live in different files. Each file resolves its own relative locations against its own directory, mutual and repeated imports are visited once, and a `wsdl:import` may name a bare `.xsd` (which merges like an `xs:import`, keeping its own namespace) as WSDL 1.1 allows. Remote `http(s)` locations are reported and skipped, exactly as for `xs:import`.

A WSDL additionally produces an **`operations.ts`**, pairing each operation's `soapAction` with the classes it exchanges:

```typescript
export const CompetentPortOperations = {
	stelGbavVraag: {
		soapAction: "stelGbavVraag",
		input: GbavVraag,
		output: GbavAntwoord,
		faults: { gbavException: GbavFout },
	},
} as const;
```

It is data, not a client — it composes with `@cerios/xml-poto`'s `SoapSerializer` without dictating a transport, and `faults` is keyed to drop straight into that serializer's `faultDetailTypes` option. `operations.ts` is left out of the generated barrel `index.ts` (which it imports from), so import it directly.

`<service>` and its ports are ignored: the endpoint URL is deployment configuration, not schema. RPC-style and SOAP-encoded operations, and multi-part messages, are reported in the coverage notes and skipped rather than half-generated — only single-part document/literal maps cleanly to one class.

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

Contributions are welcome! Please open an issue or pull request on
[GitHub](https://github.com/CeriosTesting/xml-poto).

## 📄 License

MIT © Ronald Veth - Cerios

## 🔗 Links

- [GitHub Repository](https://github.com/CeriosTesting/xml-poto)
- [NPM Package](https://www.npmjs.com/package/@cerios/xml-poto-codegen)
- [xml-poto (runtime library)](https://www.npmjs.com/package/@cerios/xml-poto)
- [Issue Tracker](https://github.com/CeriosTesting/xml-poto/issues)
- [Changelog](CHANGELOG.md)
