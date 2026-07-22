---
"@cerios/xml-poto-codegen": minor
---

Generate polymorphism decorators, flatten complexContent restrictions, and preserve per-type namespaces.

- **Polymorphism from XSD inheritance.** An `xs:complexType abstract="true"` now generates an `abstract class`, and (in single-file / `per-xsd` mode) a base type emits `@XmlInclude(() => Derived)` for each subtype so `xsi:type` resolves to the concrete class at runtime. In `per-type` mode subtypes instead self-register their `@XmlType` identity when the barrel is loaded (emitting `@XmlInclude` there would create an import cycle whose eager `extends` hits the base's temporal dead zone).
- **complexContent restriction narrowing.** A `<xs:restriction>` of a complex type is now generated as a flattened standalone class containing exactly the restricted members, instead of `extends Base` plus re-declared members. This fixes derived types wrongly re-inheriting members the restriction dropped. **Output change:** restriction-derived classes no longer carry an `extends` clause.
- **Multi-target-namespace fidelity.** Types imported via `xs:import` of a _different_ target namespace now keep their own namespace (and element/attribute form) on the generated `@XmlType`/`@XmlElement`, instead of adopting the importing schema's namespace.
- Enum tokens that are not valid identifiers (e.g. `US-EN`, `1`) already round-trip losslessly in all enum styles — the generated member value is the exact token — so no `@XmlEnum` remapping is emitted; a round-trip regression test locks this in.

Requires `@cerios/xml-poto` with the `XmlInclude` decorator.
