# @cerios/xml-poto

## 1.0.1

### Patch Changes

- c9f0883: **Performance & IntelliSense Optimization**

  This release significantly improves TypeScript IntelliSense performance and runtime efficiency through metadata storage consolidation:

  **Core Improvements:**

  - **Unified Metadata Storage**: Consolidated 9+ separate WeakMaps into a single `ClassMetadata` structure, reducing metadata lookups from multiple operations to just one per class
  - **Type-Safe Storage**: Introduced `TypedMetadataStorage<K, V>` wrapper for better type inference and IntelliSense autocomplete
  - **Symbol-Based Lazy Loading**: Enhanced `@XmlQueryable` to use `Symbol.for()` keys for cache and builder storage, preventing property collisions and improving memory efficiency
  - **Optimized Type Exports**: Reorganized type exports with explicit `type` imports/exports for faster TypeScript compilation
  - **Better Type Hints**: Added `Constructor<T>` type helper and `DeepReadonly<T>` utility for improved type safety and IntelliSense suggestions

  **Technical Details:**

  - Decorator metadata registration now uses centralized helper functions (`registerAttributeMetadata`, `registerFieldElementMetadata`, etc.)
  - Metadata getters optimized with single-lookup strategy using `getMetadata()` and `hasMetadata()` checks
  - Removed legacy constructor property fallback patterns (`__xmlAttributes`, `__xmlPropertyMappings`, etc.)
  - Enhanced `fromXml()` and `toXml()` method signatures with `const` generics for better type inference

  **Developer Experience:**

  - Faster IntelliSense autocomplete in editors
  - Reduced memory footprint for classes with many decorators
  - Improved type narrowing and inference in serializer methods
  - More predictable property access patterns in decorated classes

  This is a patch release focused on internal optimizations with no breaking changes to the public API.

## 1.0.0

### Major Changes

- f437574: This release represents a stable, feature-complete API suitable for production use in REST APIs, configuration files, SOAP services, RSS/Atom feeds, and any TypeScript project requiring robust XML handling.

## 0.1.0

### Minor Changes

- dc64eab: Initial implementation of XML serialization library

  Complete TypeScript 5+ decorator-based framework with bidirectional XML-object mapping, namespace support, validation, custom converters, and flexible array handling. Includes comprehensive documentation.
