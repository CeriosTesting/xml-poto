/**
 * TypeScript 5+ XML Serialization Framework
 *
 * A comprehensive, decorator-based XML serialization framework that supports:
 * - Pure TypeScript 5+ decorators (no reflect-metadata dependency)
 * - Multi-namespace XML generation with prefix support
 * - Complex nested objects and mixed primitive/complex arrays
 * - Field-level element namespaces and attribute namespacing
 * - Enterprise-grade XML serialization capabilities
 *
 * @example
 * ```typescript
 * import { XmlRoot, XmlElement, XmlAttribute, XmlSerializer } from 'xml-poto';
 *
 * @XmlRoot({ elementName: 'person' })
 * class Person {
 *   @XmlAttribute({ name: 'id' })
 *   id: string = 'p001';
 *
 *   @XmlElement('name')
 *   fullName: string = 'John Doe';
 * }
 *
 * const serializer = new XmlSerializer();
 * const xml = serializer.toXml(new Person());
 * // Generates: <person id="p001"><name>John Doe</name></person>
 * ```
 */

// ===== DECORATORS =====
// XmlElement, XmlAttribute, XmlText, XmlRoot, XmlArrayItem
export * from "./decorators";

// ===== CONFIGURATION =====
// Serialization options and defaults
export * from "./serialization-options";
export { XmlMappingUtil } from "./xml-mapping-util";

// ===== UTILITIES (Advanced Usage) =====
// Namespace handling, mapping, and validation utilities
export { XmlNamespaceUtil } from "./xml-namespace-util";

// ===== XML SERIALIZER =====
// XmlSerializer class with toXml() and fromXml() methods
export * from "./xml-serializer";
export { XmlValidationUtil } from "./xml-validation-util";
