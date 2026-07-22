---
"@cerios/xml-poto-codegen": minor
---

Resolve `ref="…"` declarations, keep colliding type names apart, and stop generating code that
does not compile.

A pre-release audit found five constructs that generated silently wrong output. Each fix changes
generated code, so regenerate and review the diff.

**`xs:element ref="…"` resolves to the element it names.** Only the _name_ was taken from a
reference; the type was then looked for on the reference itself, found nothing, and fell back to
`string`. Every element declared by reference — pervasive in WSDL-adjacent schemas — generated as
a bare `string`, losing its complex type, its facets and its nillability. References now draw
type, facets, `nillable` and `default` from the global declaration, keeping only the occurrence
constraints from the reference itself. A reference to a global element carrying an _inline_
complexType reuses the class already generated for it rather than minting a duplicate.

**Referenced elements are namespace-qualified.** A global element declaration is always
qualified; `elementFormDefault` governs local declarations only. References previously inherited
the local-element form, so in an unqualified schema they were written without their namespace.

**`xs:attribute ref="…"` resolves too.** It hardcoded `string`, dropped all facets, and dropped
the reference's prefix — so the near-universal `ref="xml:lang"` produced a bare local `lang` in
the wrong namespace. Prefixes now resolve through the schema's bindings, including the `xml`
prefix that the XML spec binds implicitly and no schema declares. (Top-level `xs:attribute`
declarations were not parsed at all before; they are now.)

**Two distinct types no longer collapse onto one class.** Class names were assigned from the
local name alone, and the second claimant was dropped. Two namespaces merged from one WSDL that
each define `Header`, or two elements in different parents that each carry an inline complexType
of the same name, produced a single class — and every reference to the second silently got the
first one's content model. This is not hypothetical: in the UPA 2026 schema, the element
`CollectieveAangifte` (inline, one member) was typed with `CollectieveAangifteType` (two
members), advertising a member the schema forbids there. Colliding names are now suffixed
(`CollectieveAangifteType2`) and reported in the coverage notes. An `xs:redefine` pair is exempt,
since its shared name is deliberate.

**Abstract types are never instantiated.** A member typed by an `abstract="true"` complexType was
initialized with `new AbstractType()`, which `tsc` rejects — generated code that did not compile.
Such members now use a definite-assignment assertion, the same mechanism already used for
enum-typed members.

**`xs:pattern` is translated rather than passed through.** XSD's name-character escapes (`\i`,
`\I`, `\c`, `\C`) are expanded to their JavaScript equivalents. Patterns using syntax JavaScript
cannot express — character-class subtraction (`[a-z-[aeiou]]`) and Unicode block escapes
(`\p{IsBasicLatin}`) — are dropped with a coverage note instead of being emitted verbatim:
generated code passes the source to `new RegExp` while the decorator is being applied, so an
untranslatable pattern threw on _import_ of the module, taking down code that never touched the
type. Patterns are matched against the whole value by the runtime, per `xs:pattern` semantics —
this requires `@cerios/xml-poto` with that fix.

**Mutually referencing schemas no longer overflow the stack.** `xs:include`/`xs:import` recursion
had no visited set, so two schemas that reference each other — legal, and common — recursed until
the stack ran out, and a diamond merged the shared schema twice.

Also: string literals in generated code (enumeration tokens, default values) are escaped through
`JSON.stringify`, so a value containing a newline or a quote can no longer break the literal.
