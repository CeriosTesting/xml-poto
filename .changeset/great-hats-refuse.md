---
"@cerios/xml-poto": minor
---

Add XSD validation support to the decorators and serializer:

- **XSD facets on `@XmlElement`, `@XmlAttribute`, `@XmlText`, and `@XmlArray`**: `pattern`, `enumValues`, `length`, `minLength`, `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace`, and `fixedValue`. Facets are validated during both serialization and deserialization.
- **Unified `validationMode` serializer option** (`"strict"` | `"warn"` | `"off"`, default `"strict"`): governs all facet validation including the pre-existing `pattern`/`enumValues` checks on `@XmlAttribute` (whose default throw behavior is unchanged but can now be relaxed). Individual rules can be tuned per rule via **`validationModeOverrides`** (e.g. `{ pattern: "warn", fixedValue: "off", choiceGroup: "warn" }`); unlisted rules follow `validationMode`. When a value violates several rules, each violation is handled by its own rule's mode.
- **`xs:list` support**: the new `list` option on `@XmlElement`, `@XmlAttribute`, and `@XmlText` round-trips arrays as space-separated text (e.g. `<sizes>1 2 3</sizes>` ↔ `number[]`), with optional typed items via `list: { itemType: "number" }`.
- **Choice groups (`xs:choice`)**: `choiceGroup` and `choiceRequired` options on `@XmlElement`/`@XmlArray` enforce that at most one (and, when required, at least one) member of a group is set.
- **`minOccurs`/`maxOccurs` on `@XmlArray`**: item-count validation.
- **`xsi:nil` round-trip**: `isNullable` elements now deserialize `xsi:nil="true"` back to `null` (previously serialize-only). Applies only when `isNullable: true` is set.
- **`dataType` activated**: the previously inert `dataType` option now coerces values (numeric/boolean XSD types) during deserialization when the property type cannot be inferred from its runtime value (i.e. optional properties that were previously left as raw strings).
- **`fixedValue`**: acts as a default when the value is absent and as a constraint (value must equal it) when present.
- `@XmlText` now also deserializes text-only elements that parse to a plain primitive.
