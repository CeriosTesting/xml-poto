---
"@cerios/xml-poto": minor
---

Performance Improvements:
- 3x faster serialization/deserialization via optimized metadata lookups and caching
- Removed public metadata getter functions (use direct getMetadata() instead)
- Cached namespace collections and element/attribute name building
- Refactored to flatMap for cleaner array operations

Features:
- Transform functions and class conversion methods
- Automated release workflow with GitHub Actions + npm provenance

Cleanup:
- Removed manual initializeDynamicProperty functions (no longer needed)
- Simplified namespace handling in DynamicElement
- Migrated tests from Jest to Vitest
