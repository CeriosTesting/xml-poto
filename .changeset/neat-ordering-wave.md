---
"@cerios/xml-poto": minor
---

Add cross-decorator child serialization ordering support and document it.

### What changed

- Added `order?: number` to `@XmlArray` and `@XmlDynamic` options and metadata.
- Kept `@XmlElement` ordering and implemented serializer-side ordering so it is now actually applied at runtime.
- Child serialization order now resolves across `@XmlElement`, `@XmlArray`, and `@XmlDynamic` together.
- Sorting behavior:
  - Lower `order` values serialize first.
  - Unordered properties serialize after ordered properties.
  - Ties preserve stable existing property order.

### Documentation

- Updated array docs with `order` option and example.
- Updated bi-directional XML docs with `@XmlDynamic({ order })` usage.
- Updated elements/attributes docs with cross-decorator ordering notes.

### Why this matters

Previously `order` existed in element metadata but did not affect output ordering. This change makes ordering deterministic and consistent across the three child-producing decorators.
