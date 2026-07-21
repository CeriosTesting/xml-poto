---
"@cerios/xml-poto-codegen": minor
---

Follow `wsdl:import`, and stop dropping `xs:anyAttribute` outside a bare `complexType`.

Both change generated output where the schema uses the construct, so regenerate and review the diff.

**A WSDL split across files no longer loses its imported half.** Only the `<definitions>` element
handed to the parser was read: `<wsdl:import location="…"/>` was never looked at. The routine split —
`service.wsdl` holding `<service>` and `<binding>` while importing an `interface.wsdl` that holds
`<types>`, `<message>` and `<portType>` — therefore generated either no operations or no types,
depending on which half the CLI was pointed at. Every reachable file now contributes:

- Bindings are collected across all files before any portType is walked, so an imported operation
  still gets the `soapAction` from the `<binding>` in the file that imported it.
- Each file resolves its own `xs:import`/`xs:include` locations against its own directory, so an
  imported WSDL elsewhere on disk finds its schemas.
- Mutual imports terminate and a file reached twice contributes once.
- A `wsdl:import` may name a bare `.xsd`, which WSDL 1.1 allows; it merges like an `xs:import` and
  keeps its own target namespace and element form.
- Remote `http(s)` locations are reported and skipped, matching `xs:import`.

A single-file WSDL generates exactly as before.

**`xs:anyAttribute` is honoured everywhere it is legal.** The wildcard was only read directly off
`<xs:complexType>`. Declared on a `complexContent` extension or restriction, on a `simpleContent`
extension or restriction, or on an `attributeGroup` definition, it was parsed into nothing and the
class came out with no member for it. All of those now produce the `@XmlDynamic() anyAttributes`
member, including a wildcard reached through any depth of `attributeGroup` references. A type that
names the wildcard more than once — directly _and_ through a group — still gets exactly one member.

Found while fixing the above, and fixed with it: an `xs:attributeGroup ref` inside a `simpleContent`
extension or restriction was not parsed at all, so every attribute it contributed was silently
missing from the class. A WSDL `<documentation>` written as plain text (rather than carrying an
`xml:lang` attribute) was likewise dropped, leaving the JSDoc off the generated operation.
