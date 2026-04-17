---
"@cerios/xml-poto": minor
"@cerios/xml-poto-codegen": patch
---

Implement `form` namespace qualification for `@XmlElement`, `@XmlAttribute`, and `@XmlArray`.

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
