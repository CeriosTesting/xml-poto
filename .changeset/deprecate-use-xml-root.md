---
"@cerios/xml-poto-codegen": minor
---

Deprecate `useXmlRoot`; it is removed in the next major.

The option exists so a schema subset can be embedded in a document it does not own,
rather than standing alone as a root. Nothing needs it any more: `SoapSerializer` wraps
and unwraps `Envelope`/`Body` around an `@XmlRoot` payload, and an `@XmlRoot` class embeds
fine as a member type — the referencing `@XmlElement({ name })` decides the tag.

Behaviour is unchanged: `useXmlRoot: false` still flattens the model to class-level
`@XmlElement` everywhere. Setting the option at all, to either value, now prints a
deprecation warning during generation.
