import { registerArrayMetadata } from "./storage";
import { XmlArrayItemOptions, XmlArrayMetadata, XmlArrayOptions } from "./types";

/**
 * XmlArray decorator for polymorphic array support
 *
 * Allows customization of both the array container element name and individual array item element names.
 * When no containerName is provided, arrays are automatically unwrapped (items added directly to parent).
 *
 * @example
 * ```
 * @XmlElement({ name: 'Document' })
 * class Document {
 *   // Wrapped arrays (with container)
 *   @XmlArray({ containerName: 'BookCollection', itemName: 'Book' })
 *   books: string[] = ['Book 1', 'Book 2'];
 *
 *   // Unwrapped arrays (no container - items directly in parent)
 *   @XmlArray({ itemName: 'Author' })
 *   authors: string[] = ['Author 1', 'Author 2'];
 *
 *   // Explicit unwrap control
 *   @XmlArray({ containerName: 'Genres', itemName: 'Genre', unwrapped: true })
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
export function XmlArray(options: XmlArrayOptions = {}) {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);

		// Validate: can't have both unwrapped:true and containerName
		if (options.unwrapped === true && options.containerName) {
			throw new Error(
				`Invalid @XmlArray configuration on '${propertyKey}': cannot specify 'containerName' when 'unwrapped' is true. ` +
					`Unwrapped arrays have items directly in the parent element without a container.`
			);
		}

		// Automatic unwrapping: if no containerName is provided, unwrap automatically
		const shouldUnwrap = options.unwrapped !== undefined ? options.unwrapped : !options.containerName;

		const arrayMetadata: XmlArrayMetadata = {
			containerName: options.containerName,
			itemName: options.itemName,
			type: options.type,
			namespace: options.namespace,
			nestingLevel: options.nestingLevel || 0,
			isNullable: options.isNullable,
			dataType: options.dataType,
			unwrapped: shouldUnwrap,
		};

		// Return a field initializer that registers metadata once per decorator
		return function (this: any, initialValue: V): V {
			const ctor = this.constructor;

			// Use helper function to register metadata
			registerArrayMetadata(ctor, propertyKey, arrayMetadata);

			return initialValue;
		};
	};
}

// Legacy support - will be deprecated
/** @deprecated Use XmlArray instead */
export function XmlArrayItem(options: XmlArrayItemOptions = {}) {
	return XmlArray(options);
}
