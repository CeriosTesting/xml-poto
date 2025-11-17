import { arrayItemMetadataStorage } from "./storage";
import { XmlArrayItemMetadata, XmlArrayItemOptions } from "./types";

/**
 * XmlArrayItem decorator for polymorphic array support
 *
 * Allows customization of both the array container element name and individual array item element names.
 * When no containerName is provided, arrays are automatically unwrapped (items added directly to parent).
 *
 * @example
 * ```typescript
 * @XmlElement({ name: 'Document' })
 * class Document {
 *   // Wrapped arrays (with container)
 *   @XmlArrayItem({ containerName: 'BookCollection', itemName: 'Book' })
 *   books: string[] = ['Book 1', 'Book 2'];
 *
 *   // Unwrapped arrays (no container - items directly in parent)
 *   @XmlArrayItem({ itemName: 'Author' })
 *   authors: string[] = ['Author 1', 'Author 2'];
 *
 *   // Explicit unwrap control
 *   @XmlArrayItem({ containerName: 'Genres', itemName: 'Genre', unwrapped: true })
 *   genres: string[] = ['Fiction', 'Drama'];
 * }
 *
 * // Generates:
 * // <Document>
 * //   <BookCollection>
 * //     <Book>Book 1</Book>
 * //     <Book>Book 2</Book>
 * //   </BookCollection>
 * //   <Author>Author 1</Author>  <!-- unwrapped -->
 * //   <Author>Author 2</Author>  <!-- unwrapped -->
 * //   <Genre>Fiction</Genre>     <!-- unwrapped -->
 * //   <Genre>Drama</Genre>       <!-- unwrapped -->
 * // </Document>
 * ```
 *
 * @param options Configuration options for array items
 * @returns A field decorator function
 */
export function XmlArrayItem(options: XmlArrayItemOptions = {}) {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);

		// Support both new and legacy naming
		const containerName = options.containerName || options.name;
		const itemName = options.itemName || options.elementName;

		// Automatic unwrapping: if no containerName is provided, unwrap automatically
		const shouldUnwrap = options.unwrapped !== undefined ? options.unwrapped : !containerName;

		const arrayItemMetadata: XmlArrayItemMetadata = {
			containerName,
			itemName,
			type: options.type,
			namespace: options.namespace,
			nestingLevel: options.nestingLevel || 0,
			isNullable: options.isNullable,
			dataType: options.dataType,
			unwrapped: shouldUnwrap,
			// Legacy support
			name: containerName,
			elementName: itemName,
		};

		// Return a field initializer that registers metadata once per decorator
		return function (this: any, initialValue: V): V {
			const ctor = this.constructor;

			// Store array item metadata (can have multiple for polymorphic arrays)
			if (!ctor.__xmlArrayItems) {
				ctor.__xmlArrayItems = {};
			}
			if (!ctor.__xmlArrayItems[propertyKey]) {
				ctor.__xmlArrayItems[propertyKey] = [];
			}

			// Check if this exact metadata is already stored to avoid duplicates
			const existing = ctor.__xmlArrayItems[propertyKey];
			const isDuplicate = existing.some(
				(item: XmlArrayItemMetadata) =>
					item.elementName === arrayItemMetadata.elementName &&
					item.type === arrayItemMetadata.type &&
					item.name === arrayItemMetadata.name
			);

			if (!isDuplicate) {
				ctor.__xmlArrayItems[propertyKey].push(arrayItemMetadata);
			}

			// Also store in WeakMap
			if (!arrayItemMetadataStorage.has(ctor)) {
				arrayItemMetadataStorage.set(ctor, {});
			}
			const arrayItems = arrayItemMetadataStorage.get(ctor) ?? {};
			if (!arrayItems[propertyKey]) {
				arrayItems[propertyKey] = [];
			}

			// Check for duplicates in WeakMap too
			const existingWeakMap = arrayItems[propertyKey];
			const isDuplicateWeakMap = existingWeakMap.some(
				(item: XmlArrayItemMetadata) =>
					item.elementName === arrayItemMetadata.elementName &&
					item.type === arrayItemMetadata.type &&
					item.name === arrayItemMetadata.name
			);

			if (!isDuplicateWeakMap) {
				arrayItems[propertyKey].push(arrayItemMetadata);
			}

			return initialValue;
		};
	};
}
