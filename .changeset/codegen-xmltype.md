---
"@cerios/xml-poto-codegen": minor
---

Generate `@XmlType` for XSD complex types instead of a class-level `@XmlElement`.

A named `xs:complexType` is a type definition, not a global element declaration, so it now receives `@XmlType` (type identity: name + namespace + form). Global/root elements continue to receive `@XmlRoot`. Combined with the serializer's namespace dedup and property/class reconciliation, this removes the redundant per-object namespace re-declarations and unqualified-wrapper shapes seen in generated output (issue #96).

The `useXmlRoot: false` flat mode is unchanged: it still emits class-level `@XmlElement` everywhere.

This release requires `@cerios/xml-poto` `^2.5.0` (generated code imports the new `XmlType` decorator).
