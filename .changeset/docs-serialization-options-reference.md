---
"@cerios/xml-poto": patch
---

Document every serialization option, and fix the samples that could not compile.

**New [Serialization Options](https://github.com/CeriosTesting/xml-poto/blob/main/packages/xml-poto/docs/serialization-options.md) reference.** Every field of `SerializationOptions` with its default, in one place. Three were documented nowhere: `omitDefaultValues`, `schemaLocation` and `noNamespaceSchemaLocation` — the first of which is a default-ON behavior change, so a reader had no way to learn that a member equal to its `defaultValue` is now dropped from output. Five older options (`ignoreAttributes`, `attributeNamePrefix`, `textNodeName`, `xmlVersion`, `standalone`) had never been documented either. The page opens with the `omitNullValues` and `omitDefaultValues` default changes and how to restore the previous behavior.

**Samples that did not compile.** `serializer.toXml(obj, { … })` appeared in five guides, but `toXml` takes a single argument — options belong on the constructor, as `core-concepts.md` itself says. Three option names in samples did not exist at all: `indentSize` and `declaration` (in the Getting Started "Serialization Options" block, so the page teaching options taught two that are not real) and `newLine`.

**`@XmlType` and `@XmlInclude` reach the Decorator Overview** in Core Concepts, which had listed every other decorator. `defaultValue` in the element and attribute option blocks now mentions omit-on-write.

**Navigation.** Three anchors pointed at headings that do not exist (or differed in case, which a browser does not forgive); "Type Identity with @XmlType" and "Two shapes, two options" were missing from their page tables of contents; and the Getting Started pointer for SOAP now reaches the SOAP guide instead of a section of the namespaces page that was never written.

A `tests/docs/docs-samples.test.ts` guard now checks the documentation against the source of truth on every run — option names against the option interfaces, `toXml`/`fromXml` arity, and every relative link and anchor — so this class of drift fails the build rather than shipping.
