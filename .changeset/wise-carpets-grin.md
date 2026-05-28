---
"@cerios/xml-poto": patch
---

Fix `strictValidation` not checking required property values after deserialization.

When `strictValidation: true`, a new post-deserialization check now throws a `[Strict Validation Error]` if a required `@XmlElement` property resolves to `null` or `undefined` on the instance (e.g. when a `transform.deserialize` function returns a nullish value). Properties with a `defaultValue` are excluded from this check.
