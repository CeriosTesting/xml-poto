---
"@cerios/xml-poto-codegen": minor
---

Fix choice branches, named-enum vocabularies, and numeric types whose lexical form carries meaning.

Auditing a real production schema (the Dutch UPA 2026 pension declaration — 63 simpleTypes, 17 complexTypes, unprefixed XSD declarations, `elementFormDefault="qualified"` with `attributeFormDefault="unqualified"`) surfaced three defects that no existing fixture reached. Two made schema-valid documents unreadable or silently corrupted.

**A `<choice>` of `<sequence>` branches no longer marks its members required.** A choice offers alternatives, so a document taking one branch contains none of the others. Members of a `<sequence>` branch were nevertheless generated `required: true`, and a perfectly valid document taking a different branch failed to deserialize with `Required element 'X' is missing`. Members of a choice's _direct_ elements were already handled; only branch members were missed. Exclusivity **between** branches remains unmodelled — expressing "these are required together iff this branch is taken" needs branch-level groups — so this relaxes `required` without adding a `choiceGroup`.

**Named enum simpleTypes now carry their vocabulary.** A named `<simpleType>` with `<enumeration>` members generated a string-union type but emitted no `enumValues`, so the runtime had nothing to validate against:

```xml
<CdAard>99</CdAard>   <!-- accepted: 99 is not one of the 14 allowed codes -->
<CdAard>11</CdAard>   <!-- returned the NUMBER 11, outside its own "1"|"4"|…|"11" union -->
```

Anonymous enumerations already emitted `enumValues`, so the two spellings of the same concept disagreed. Named ones now emit it too — the generated union type is unchanged; the decorator simply gains the tokens. This makes the enumeration enforced and lets the existing lexical-form restoration return `"11"` rather than `11`.

**A numeric type constrained by a `pattern` is generated as `string`.** A pattern constrains the _lexical_ space, which is how a schema expresses "nine digits, leading zero permitted". A Dutch BSN declared `xs:nonNegativeInteger` with a 9-digit pattern read `012345678` back as `12345678` and re-serialized it as `"12345678"` — a different, invalid identifier. The pattern could not catch it either, since pattern facets only apply to strings. Such members now generate `string` with no `dataType`, preserving the value and making the pattern enforceable. Numeric types without a pattern are unaffected.

**New `bigIntegerAs` option** (`'number' | 'string'`, default `'number'`). `xs:integer` is arbitrary-precision and `xs:long` reaches 9223372036854775807, both beyond `Number.MAX_SAFE_INTEGER` — `9007199254740993` silently becomes `…992`. Setting `'string'` generates integer types as `string` when their `totalDigits` is absent or exceeds 15; types bounded within the safe range stay `number` either way. Available globally and per source, alongside `elementForm`.

Generated output changes for three shapes, all TypeScript-visible at compile time:

| shape                                | before           | after               |
| ------------------------------------ | ---------------- | ------------------- |
| member of a choice's sequence branch | `x: T = new T()` | `x?: T`             |
| member typed by a named enum         | no `enumValues`  | `enumValues: [...]` |
| numeric member with a `pattern`      | `x?: number`     | `x?: string`        |

Regenerate from your schemas to pick these up. The third is the one to look at: a member that was `number` becomes `string`, which `tsc` will point at.
