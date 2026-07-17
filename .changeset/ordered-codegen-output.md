---
"@cerios/xml-poto-codegen": minor
---

Generate classes in dependency order so the output always compiles (fixes broken `per-xsd` output for XSDs that declare types before their dependencies, e.g. alphabetically ordered schemas):

- **Topological sorting**: classes are now emitted dependency-first (based on `extends` bases and decorator `type:` references), with a stable order — schemas already in a valid order produce unchanged output, and independent types keep their XSD document order. Previously classes were emitted in raw document order, producing `class X used before its declaration` compile errors and runtime TDZ crashes.
- **Circular and self references** (which no ordering can satisfy) are emitted as lazy `() => Foo` thunks in both output styles. This requires `@cerios/xml-poto` >= the release adding `TypeRef` support (published together with this change).
- **`per-type` mode**: classes linked by an `extends` edge inside a reference cycle are now merged into one file (named after the base class), because a cyclic `extends` split across ES modules always leaves an import order that fails. All other classes keep one file each; the barrel re-exports everything as before.
- **`xs:redefine`**: a type deriving from itself (the redefine pattern; redefines are merged like includes) no longer generates `class X extends X` — the extends clause is dropped with a coverage note.

Also fixes two further compile errors surfaced by the same schemas:

- Required properties typed by a named enum no longer get a mis-typed base-type initializer (`status: StatusType = ''`); they are emitted with a definite-assignment assertion (`status!: StatusType`).
- The same element appearing in multiple `xs:choice` branches no longer generates duplicate class properties; occurrences are merged into one property that is optional unless required in every branch.
