"@cerios/xml-poto": minor
---

**Added support for multiple namespace declarations on XML elements.**
- You can now declare multiple namespaces on a single element using the new `namespaces` array property, while maintaining backward compatibility with the existing `namespace` property.
- Enables XBRL-style documents and other complex XML structures where the root element declares all namespaces upfront, reducing redundant namespace declarations throughout the document tree.
- All decorator interfaces (`XmlRoot`, `XmlElement`, `XmlAttribute`, `XmlArray`) and metadata structures now support the `namespaces` array pattern.
- Comprehensive documentation and examples for multi-namespace scenarios, nested element patterns, and XBRL use cases have been added.

**Improved XML namespace handling for nested elements.**
- Nested elements now declare their own namespaces, matching C# XmlSerializer behavior.
- Namespace context is propagated to child properties that don’t have explicit namespace declarations, ensuring proper inheritance.
- Namespace collection is optimized to avoid redundant declarations from deeply nested objects.
- Added support for namespace declarations on nested element content, allowing correct scoping of namespace prefixes throughout the XML document.

