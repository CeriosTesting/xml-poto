---
"@cerios/xml-poto-codegen": patch
---

Fixed two issues affecting Windows users using a TypeScript config file.

**Paths with backslashes no longer appear in generated config files**

When running `xml-poto-codegen init` on Windows, entering paths with backslashes (e.g. `.\schemas\file.xsd`) would write those backslashes directly into the generated config file. The config would look broken in your editor and could cause problems on other operating systems. You no longer need to type forward slashes manually — any path you enter is automatically normalized before being written.

**`generate` no longer fails with `Unknown file extension ".ts"`**

After running `init` with a TypeScript config, running `xml-poto-codegen generate` would immediately fail with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`, making the TypeScript config format unusable. This is now fixed — `generate` correctly loads `xml-poto-codegen.config.ts` files.
