---
"@cerios/xml-poto": patch
---

Enforce @XmlArray for list properties — strict validation error when using @XmlElement for arrays

**Breaking (strict mode):** When `strictValidation` is enabled, using `@XmlElement` on a property that receives multiple XML elements (producing an array) now throws a `[Strict Validation Error]`. The error message includes the property name, the XML element name, and a concrete fix suggesting `@XmlArray({ itemName: '...', type: YourItemClass })`.

- `@XmlElement` no longer auto-deserializes repeated XML elements into typed array items. Arrays pass through as plain objects unless `@XmlArray` is used.
- The error is thrown for any `@XmlElement` property receiving an array, even when a `type` is specified.
- Mixed content arrays (`mixedContent: true`) are excluded from this validation and continue to work as before.
- Without `strictValidation`, `@XmlElement` arrays still work but items are not typed — no error is thrown.
