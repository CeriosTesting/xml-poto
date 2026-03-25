---
"@cerios/xml-poto": patch
---

Fixed deserialization of classes with only `@XmlAttribute` and `@XmlText` decorators (no class-level `@XmlRoot`/`@XmlElement`) when used as nested types. Previously, `JSON.stringify` on deserialized instances produced internal parser keys (`@_`, `#text`) instead of the actual property names. Classes with these decorators are now registered for auto-discovery, and a metadata-based fallback resolves them when name-based discovery fails. Also fixed premature CDATA extraction that discarded attribute data when both `@XmlAttribute` and `@XmlText({ useCDATA: true })` were present on the same class.
