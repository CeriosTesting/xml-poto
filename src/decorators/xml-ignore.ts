import { registerIgnoredProperty } from "./storage";

/**
 * Decorator to exclude a class property from XML serialization and deserialization.
 *
 * Use this decorator on properties that should not be included in XML output, such as
 * internal state, computed values, sensitive data, or temporary fields. Properties marked
 * with @XmlIgnore are completely skipped during both serialization and deserialization.
 *
 * @returns A field decorator function that marks the property as ignored
 *
 * @example
 * ```
 * // Exclude sensitive and internal data
 * @XmlRoot({ elementName: 'User' })
 * class User {
 *   @XmlElement() username!: string;
 *   @XmlElement() email!: string;
 *
 *   @XmlIgnore()
 *   password!: string;  // Never serialized to XML
 *
 *   @XmlIgnore()
 *   internalId!: number;  // Internal use only
 * }
 *
 * // Serializes to: <User><username>john</username><email>john@example.com</email></User>
 * // Password and internalId are not included
 * ```
 *
 * @example
 * ```
 * // Exclude computed properties
 * @XmlRoot({ elementName: 'Product' })
 * class Product {
 *   @XmlElement() price!: number;
 *   @XmlElement() taxRate!: number;
 *
 *   @XmlIgnore()
 *   get totalPrice(): number {
 *     return this.price * (1 + this.taxRate);
 *   }
 * }
 *
 * // Only price and taxRate are serialized; totalPrice is excluded
 * ```
 *
 * @example
 * ```
 * // Exclude temporary/transient fields
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlElement() title!: string;
 *   @XmlElement() content!: string;
 *
 *   @XmlIgnore()
 *   isDirty: boolean = false;  // UI state, not persisted
 *
 *   @XmlIgnore()
 *   lastModified: Date = new Date();  // Managed elsewhere
 * }
 * ```
 *
 * @example
 * ```
 * // Exclude circular references
 * @XmlRoot({ elementName: 'Node' })
 * class TreeNode {
 *   @XmlElement() value!: string;
 *   @XmlElement() children!: TreeNode[];
 *
 *   @XmlIgnore()
 *   parent?: TreeNode;  // Avoid circular reference in XML
 * }
 * ```
 */
export function XmlIgnore(): any {
	return (_target: any, context: ClassFieldDecoratorContext) => {
		const propertyKey = String(context.name);

		context.addInitializer(function (this: any) {
			const ctor = this.constructor;
			registerIgnoredProperty(ctor, propertyKey);
		});
	};
}
