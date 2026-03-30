---
"@cerios/xml-poto": patch
---

Fix handling of empty elements for typed complex optional fields

**`fromXml`**: An empty element (`<tag/>` or `<tag></tag>`) mapped to a field decorated with `@XmlElement({ type: SomeClass })` now correctly deserializes into a new instance of `SomeClass` with default values, instead of returning an empty string `""`.

**`toXml`**: A typed complex optional field (`field?: SomeClass`) whose value is `undefined` is now omitted from the output entirely, instead of emitting an empty self-closing element (`<tag/>`).
