---
"@cerios/xml-poto-codegen": patch
---

Initial commit of `@cerios/xml-poto-codegen`.

This first version introduces the XML schema to TypeScript generator for `@cerios/xml-poto`, including:

- CLI commands (`init`, `generate`) for project setup and generation workflows.
- JSON and TypeScript config support with per-source overrides.
- Multi-XSD processing with import resolution across schema files.
- Decorator-aware output for elements, attributes, arrays, text, and dynamic content.
- Flexible output styles (`per-type` and `per-xsd`) and enum generation modes (`union`, `enum`, `const-object`).
- Programmatic APIs for integration in build scripts and tooling.
