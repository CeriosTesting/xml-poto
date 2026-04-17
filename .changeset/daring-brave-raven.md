---
"@cerios/xml-poto-codegen": patch
---

Fix `XsdParser` throwing a cryptic tag-mismatch error when the input is not a valid XSD schema (e.g. an HTML page downloaded from a repository browser instead of the raw file).

**Changes:**

- `XsdParser.parseString()` now validates up front that the content has a schema root element (`<xs:schema>`, `<xsd:schema>`, `<schema>`, or any namespace-prefixed variant). Invalid input throws a clear, actionable error message instead of a cryptic internal parser error.
- XML declarations (`<?xml ... ?>`) and XML comments before the root element are stripped before parsing, so schemas with leading comments are now handled correctly.
- Include/import resolution was extracted into a private `resolveExternalSchemas()` method to keep `parseString` within complexity limits.
