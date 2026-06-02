---
"@cerios/xml-poto": minor
---

Add `requireAllByDefault` serialization option.

When set to `true`, all `@XmlElement`, `@XmlAttribute`, `@XmlArray`, and `@XmlText` decorated fields are treated as required during deserialization unless the decorator explicitly sets `required: false`. This complements the existing per-field `required` option by providing a class-wide default, removing the need to mark every field individually.

Key behaviours:

- Fields with `required: false` are always optional regardless of this option.
- Fields with a `defaultValue` in the decorator are exempt from the required check (the default is used instead).
- TypeScript field initializers (e.g. `= ""`) have no effect on the required check; only `defaultValue` in the decorator suppresses the error.
- Can be combined with `strictValidation`.
