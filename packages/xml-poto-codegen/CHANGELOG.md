# @cerios/xml-poto-codegen

## 0.1.1

### Patch Changes

- 577551f: Fixed two issues affecting Windows users using a TypeScript config file.

  **Paths with backslashes no longer appear in generated config files**

  When running `xml-poto-codegen init` on Windows, entering paths with backslashes (e.g. `.\schemas\file.xsd`) would write those backslashes directly into the generated config file. The config would look broken in your editor and could cause problems on other operating systems. You no longer need to type forward slashes manually — any path you enter is automatically normalized before being written.

  **`generate` no longer fails with `Unknown file extension ".ts"`**

  After running `init` with a TypeScript config, running `xml-poto-codegen generate` would immediately fail with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`, making the TypeScript config format unusable. This is now fixed — `generate` correctly loads `xml-poto-codegen.config.ts` files.

## 0.1.0

### Minor Changes

- 6cce581: Initial commit of `@cerios/xml-poto-codegen`.

  This first version introduces the XML schema to TypeScript generator for `@cerios/xml-poto`, including:
  - CLI commands (`init`, `generate`) for project setup and generation workflows.
  - JSON and TypeScript config support with per-source overrides.
  - Multi-XSD processing with import resolution across schema files.
  - Decorator-aware output for elements, attributes, arrays, text, and dynamic content.
  - Flexible output styles (`per-type` and `per-xsd`) and enum generation modes (`union`, `enum`, `const-object`).
  - Programmatic APIs for integration in build scripts and tooling.
