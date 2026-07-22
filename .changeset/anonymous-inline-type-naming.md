---
"@cerios/xml-poto-codegen": minor
---

Name an anonymous inline complexType after the type that declares it when its own
name is taken, and mark it anonymous.

`<element name="Foo">` with an inline complexType wants the class name `FooType`,
which collides with the named complexType `FooType` under the convention most
schemas follow. The loser used to become `FooType2`, a name that says nothing about
which of the two it is. It is now named after where it was declared —
`TijdvakCorrectieCollectieveAangifte` rather than `CollectieveAangifteType2` — and
the coverage note explains the anonymous case in its own terms. Only names that
actually collide change; an inline type with its preferred name free keeps it, as
does a collision between two _named_ types, which has no declaring type to borrow.

Inline complexTypes are now emitted as `@XmlType({ anonymous: true })`, so they no
longer claim a schema type identity the XSD never declared. This requires
`@cerios/xml-poto` 2.6.0 or later.
