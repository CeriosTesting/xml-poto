# @cerios/xml-poto-codegen

## 1.0.0

### Minor Changes

- c4f2ffd: Add `useXmlRoot` config option to control whether root elements get `@XmlRoot` or `@XmlElement`.

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

### Patch Changes

- c4f2ffd: Fix `XsdParser` throwing a cryptic tag-mismatch error when the input is not a valid XSD schema (e.g. an HTML page downloaded from a repository browser instead of the raw file).

  **Changes:**
  - `XsdParser.parseString()` now validates up front that the content has a schema root element (`<xs:schema>`, `<xsd:schema>`, `<schema>`, or any namespace-prefixed variant). Invalid input throws a clear, actionable error message instead of a cryptic internal parser error.
  - XML declarations (`<?xml ... ?>`) and XML comments before the root element are stripped before parsing, so schemas with leading comments are now handled correctly.
  - Include/import resolution was extracted into a private `resolveExternalSchemas()` method to keep `parseString` within complexity limits.

- c4f2ffd: Implement `form` namespace qualification for `@XmlElement`, `@XmlAttribute`, and `@XmlArray`.

  The `form` option (`"qualified"` | `"unqualified"`) now has runtime effect, matching the XSD `form` attribute semantics:
  - **`"qualified"`** — the element or attribute is serialized with its namespace prefix (e.g. `<ns:city>`).
  - **`"unqualified"`** — the prefix is suppressed even when a namespace is configured (e.g. `<city>`), matching local elements in schemas with `elementFormDefault="unqualified"`.
  - **default (undefined)** — existing behaviour is preserved: prefix applied when present for `@XmlElement`/`@XmlAttribute`; no prefix on `@XmlArray` containers.

  **Changes in `@cerios/xml-poto`:**
  - `XmlNamespaceUtil.buildElementName()` — respects `form` when building the prefixed element name. Cache key now includes `form` to avoid cross-contamination.
  - `XmlNamespaceUtil.buildAttributeName()` — same logic; parameter type extended to accept `form?`.
  - `XmlMappingUtil.serializeArrayValue()` — container element name is now prefixed when `form === "qualified"` and a namespace prefix is configured.
  - `XmlMappingUtil.buildXmlToPropertyMap()` — also registers the prefixed container name in the deserialization lookup map for `"qualified"` arrays, enabling round-trips.
  - `XmlArrayOptions` and `XmlArrayMetadata` — `form` option added (was already present on `XmlElementOptions`/`XmlAttributeOptions`).

  **Changes in `@cerios/xml-poto-codegen`:**
  - `buildArrayDecorator()` — now emits `form: '...'` in generated `@XmlArray` decorators, consistent with `@XmlElement` and `@XmlAttribute`.

- Updated dependencies [c4f2ffd]
  - @cerios/xml-poto@2.2.0

## 0.1.1

### Patch Changes

- 577551f: Fixed two issues affecting Windows users using a TypeScript config file.

  **Paths with backslashes no longer appear in generated config files**

  When running `xml-poto-codegen init` on Windows, entering paths with backslashes (e.g. `.\schemas\file.xsd`) would write those backslashes directly into the generated config file. The config would look broken in your editor and could cause problems on other operating systems. You no longer need to type forward slashes manually — any path you enter is automatically normalized before being written.

  **`generate` no longer fails with `Unknown file extension ".ts"`**

  After running `init` with a TypeScript config, running `xml-poto-codegen generate` would immediately fail with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`, making the TypeScript config format unusable. This is now fixed — `generate` correctly loads `xml-poto-codegen.config.ts` files.

## 0.1.0

### Minor Changes

- 6cce581: Initial commit of `@cerios/xml-poto-codegen`.

  This first version introduces the XML schema to TypeScript generator for `@cerios/xml-poto`, including:
  - CLI commands (`init`, `generate`) for project setup and generation workflows.
  - JSON and TypeScript config support with per-source overrides.
  - Multi-XSD processing with import resolution across schema files.
  - Decorator-aware output for elements, attributes, arrays, text, and dynamic content.
  - Flexible output styles (`per-type` and `per-xsd`) and enum generation modes (`union`, `enum`, `const-object`).
  - Programmatic APIs for integration in build scripts and tooling.
