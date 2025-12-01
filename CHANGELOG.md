# @cerios/xml-poto

## 1.2.0

### Minor Changes

- e4a2c63: Performance Improvements:

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

## 1.1.1

### Patch Changes

- 555c6d7: Added XPath 1.0 features support. Fixed field initialization overwriting decorator properties

## 1.1.0

### Minor Changes

- 8988e48: Lazy Loading Control for XmlDynamic: Added lazy loading control for the XmlDynamic decorator, providing better performance and flexibility in XML handling. XmlRoot Property Rename: Renamed elementName property to name in XmlRoot for improved clarity and consistency. QueryableElement Refactor: Renamed QueryableElement to DynamicElement throughout the codebase for better semantic meaning

## 1.0.4

### Patch Changes

- 605e4e9: Renamed @XmlArrayItem decorator to @XmlArray for better clarity and consistency. The old @XmlArrayItem decorator is now deprecated but still functional for backward compatibility. Added support for undecorated classes within @XmlArray elements. Arrays can now contain plain classes without requiring decorators on every element.

## 1.0.3

### Patch Changes

- 101fbab: Added

  - Support for XML mapping of undecorated classes
  - Strict validation for nested object instantiation

  Fixed:

  - Circular reference detection logic refactored and improved
  - Issue with reusing instances resulting in empty elements after first use
  - Query initialization bugs
  - Nested queryables handling

  Changed:

  - Enhanced circular reference detection in XML mappingPlease enter a summary for your changes.
  - An empty message aborts the editor.

## 1.0.2

### Patch Changes

- d8a57cc: bugfix for XmlQueryable undefined when not using targetName

## 1.0.1

### Patch Changes

- c9f0883: **Performance & IntelliSense Optimization**

  This release significantly improves TypeScript IntelliSense performance and runtime efficiency through metadata storage consolidation:

  **Core Improvements:**

  - **Unified Metadata Storage**: Consolidated 9+ separate WeakMaps into a single `ClassMetadata` structure, reducing metadata lookups from multiple operations to just one per class
  - **Type-Safe Storage**: Introduced `TypedMetadataStorage<K, V>` wrapper for better type inference and IntelliSense autocomplete
  - **Symbol-Based Lazy Loading**: Enhanced `@XmlDynamic` to use `Symbol.for()` keys for cache and builder storage, preventing property collisions and improving memory efficiency
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
