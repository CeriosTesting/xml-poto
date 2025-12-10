---
"@cerios/xml-poto": minor
---

### Auto-Discovery
Classes with @XmlElement decorator are automatically discovered and instantiated during deserialization without explicit type parameters or property initialization.

Features:
- Namespace-aware lookup (strips prefixes like ns:element)
- Dotted name handling (sender.identifier → identifier)
- Naming convention variants (camelCase, PascalCase, special char removal)
- Property name hints for edge cases