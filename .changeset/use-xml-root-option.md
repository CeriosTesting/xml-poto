---
"@cerios/xml-poto-codegen": minor
---

Add `useXmlRoot` config option to control whether root elements get `@XmlRoot` or `@XmlElement`.

When an XSD represents a subset of a larger schema, root elements should be embeddable rather than standalone. Setting `useXmlRoot: false` causes all root elements to be generated with `@XmlElement` instead of `@XmlRoot`, including all XSD-derivable options (`form`, `isNullable`, `namespace`).

- **`useXmlRoot: true`** (default) — root elements get `@XmlRoot`, preserving existing behaviour.
- **`useXmlRoot: false`** — root elements get `@XmlElement` with full option support. The schema's `elementFormDefault` is propagated as the `form` option on the class-level decorator.

The option is available both globally (`XmlPotoCodegenConfig.useXmlRoot`) and per source (`XsdSource.useXmlRoot`), with per-source taking precedence.

**Changes:**

- `XsdSource` / `XmlPotoCodegenConfig` — new `useXmlRoot?: boolean` option.
- `ConfigLoader.validateConfig()` — validates `useXmlRoot` as boolean on both levels.
- `ClassGenerator` — accepts `useXmlRoot` and `elementFormDefault`; when `useXmlRoot` is false, root promotion is skipped and `form` is propagated from the schema.
- `ResolvedType` — new `form?` field for namespace form qualification.
- `mapClassDecorator()` — emits `form` and `isNullable` on the `@XmlElement` class-level path.
