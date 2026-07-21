---
"@cerios/xml-poto": minor
"@cerios/xml-poto-codegen": minor
---

Deserialized values now match their declared TypeScript types for numeric, boolean and enum members.

A round-trip sweep of every XSD and WSDL fixture found that the XML on the wire was always correct, but the objects coming back out of `fromXml` did not inhabit the types the generated classes declare.

**Numeric and boolean attributes came back as strings.** The worst case is silent and inverted:

```ts
@XmlAttribute({ name: 'draft' }) draft?: boolean;   // generated

doc.draft        // "false"  ← a string
if (doc.draft)   // TRUE — the document says false
```

Coercion is driven by a member's `dataType`, and codegen only ever assigned one for `xs:dateTime`/`xs:date`/`xs:time` — every numeric and boolean type got none. All numeric types and `xs:boolean` now carry an explicit `dataType`, so a member deserializes to the type it declares. Elements needed this too, not just attributes: the parser leaves a non-canonical number such as `<amount>007</amount>` as the string `"007"`.

**`xs:boolean` lexical `1`/`0` never became a boolean.** `coerceByDataType` bailed on any non-string input, and the parser had already turned `<flag>1</flag>` into the number `1`, so the boolean branch never ran. All four legal lexical forms (`true`/`false`/`1`/`0`) now deserialize to a boolean on elements, attributes and text content alike.

**Numeric-looking enum tokens failed on elements.** An enumeration of `"1"`/`"2"` validated fine as an attribute but threw `is not one of the allowed values` as an element, because the parser numericised the token before the facet check compared it against the declared strings. Enumeration facets now match on the lexical form, and a token the parser numericised is restored to its string form so it still inhabits the generated `'1' | '2'` union. Codegen also suppresses `dataType` on enum members, so an `xs:int`-based enumeration keeps its tokens verbatim rather than coercing them to numbers.

**Required members whose facets reject the default now use definite assignment.** `country: string = ''` under `pattern="[A-Z]{2}"` could never serialize — it merely deferred the problem to a runtime facet error. Such members are now emitted as `country!: string`, so `tsc` catches a missing assignment. Only members that are both required _and_ carry facets no default satisfies are affected; `total: number = 0` under `minInclusive="0"` keeps its initializer, as does any member with a schema `default`/`fixed` value.

Values change shape on deserialization, so drop any compensation you added for the old behaviour:

| member                                   | before               | after            |
| ---------------------------------------- | -------------------- | ---------------- |
| boolean attribute                        | `"true"` / `"false"` | `true` / `false` |
| numeric attribute                        | `"42"`               | `42`             |
| `xs:boolean` element written as `1`/`0`  | `1` / `0`            | `true` / `false` |
| non-canonical numeric element (`007`)    | `"007"`              | `7`              |
| numeric-looking enum token on an element | threw, or `2`        | `"2"`            |

A comparison such as `doc.draft === "true"` must become `doc.draft === true`. Regenerating from your schemas is recommended so members pick up their `dataType`; the runtime fixes apply to hand-written classes that already declare one.
