---
"@cerios/xml-poto-codegen": minor
---

WSDL support and complete XSD rule coverage in generated classes:

- **WSDL input**: files with a `<definitions>` root (SOAP/WSDL) are now detected automatically; all XSD schemas embedded in the WSDL `<types>` section are extracted and merged, inheriting `xmlns` declarations from the `<definitions>` root. This fixes "No XSD schema root element found" for `.xsd`/`.wsdl` files that are actually WSDL documents.
- **Facets are now emitted and enforced**: `length`, `minLength`, `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace`, `pattern` (now also on elements and simpleContent, with multiple `xs:pattern` facets ORed together), and `fixed` values — all mapped to the corresponding `@cerios/xml-poto` decorator options instead of a "not enforced" warning.
- **`xs:list`**: generated as `list` options (with typed items), including facets from the list's `itemType`.
- **`xs:choice`**: direct choice members now share a generated `choiceGroup` (with `choiceRequired` per the choice's `minOccurs`), enforced at runtime by xml-poto.
- **Bounded `maxOccurs`**: finite occurs bounds are emitted as `minOccurs`/`maxOccurs` on `@XmlArray`.
- **`xs:annotation`/`xs:documentation`** becomes JSDoc on generated classes, properties, and enums.
- **More XSD constructs**: `complexContent` restriction with `choice`/`all`/group refs, `xs:all` with `minOccurs`/nested choices, `use="prohibited"` attributes omitted, `xs:redefine` merged (with warning), `xs:notation` and identity constraints (`xs:key`/`xs:keyref`/`xs:unique`) parsed and reported as coverage notes, and explicit warnings for remote or missing `schemaLocation` references.

Requires `@cerios/xml-poto` ≥ the release containing the new validation options.
