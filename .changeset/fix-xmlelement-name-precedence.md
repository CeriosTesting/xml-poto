---
"@cerios/xml-poto": patch
---

Fix `@XmlElement` name precedence so a property-level explicit name correctly
overrides the class-level `@XmlElement` / `@XmlRoot` name of the referenced
type.

Previously, when a property's type carried a class-level `@XmlElement({ name })`
or `@XmlRoot({ name })`, that name would win even if the property itself was
decorated with `@XmlElement({ name: "..." })`. This was inconsistent with the
C# `System.Xml.Serialization.XmlSerializer` behaviour, where a property-level
`[XmlElement(ElementName = "...")]` always overrides the referenced type's
`[XmlType]` / `[XmlRoot]` name.

The serializer now resolves an element's tag name using a 3-tier priority:

1. Explicit name provided on the property's `@XmlElement` decorator.
2. Class-level `@XmlElement` / `@XmlRoot` name of the referenced type.
3. The property key (default).

Internally, `@XmlElement` now tracks whether the name was explicitly supplied
via a new `nameExplicitlySet` metadata flag, so tier 1 can be distinguished
from tier 3. The detection lives in a dedicated `isElementNameExplicitlySet`
helper and uses `!== undefined` (rather than `!= null`) to remain robust
against formatter rewrites that turn loose null checks into strict ones.
