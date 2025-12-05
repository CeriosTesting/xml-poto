---
"@cerios/xml-poto": minor
---

Add extra field validation in strict mode. When `strictValidation: true` is enabled, the library now validates that all XML elements are defined in the class model, throwing detailed errors for unmapped fields. This validation is automatically skipped for classes with `@XmlDynamic` decorators or `mixedContent` fields, allowing flexible schemas where needed. This helps catch typos, API changes, and schema mismatches early in development while maintaining backward compatibility.
