---
"@cerios/xml-poto": patch
---

Enhances the auto-discovery mechanism for XML deserialization by introducing a constructor name registry and lookup caching to improve performance and reliability.

Adds a new constructor registry that maps class names to their constructors, enabling auto-discovery of undecorated classes when property names match class names. This complements the existing element name registry.

Implements caching for element class lookups to avoid repeated registry searches. Cache is automatically cleared when new classes are registered to maintain consistency.

Consolidates the auto-discovery logic into a single method with multiple fallback strategies, including namespace-aware lookups, dotted name handling, naming convention variants, and constructor name matching.

Registers class constructors automatically during decorator application, ensuring all decorated classes are discoverable without manual registration.

Updates strict validation error messages to clarify that decorators are required for all properties that should be deserialized, as TypeScript type annotations alone are insufficient.
