/* eslint-disable typescript/no-explicit-any -- Array decorator requires any types for dynamic array handling */
import { registerArrayMetadata } from "./storage";
import { registerConstructorByName } from "./storage/metadata-storage";
import { withResolvedType } from "./storage/type-ref";
import { XmlArrayMetadata, XmlArrayOptions, XmlNamespace } from "./types";
import { extractValueFacets } from "./value-facets";

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
					`Unwrapped arrays have items directly in the parent element without a container.`,
			);
		}

		// `items` describes several alternatives; `itemName`/`type` describe one. Both
		// at once is ambiguous about which name an item should be written under.
		if (options.items && (options.itemName || options.type)) {
			throw new Error(
				`Invalid @XmlArray configuration on '${propertyKey}': 'items' cannot be combined with 'itemName' or 'type'. ` +
					`Use 'items' for a collection of differently named elements, or 'itemName'/'type' for a uniform one.`,
			);
		}

		if (options.items?.length === 0) {
			throw new Error(`Invalid @XmlArray configuration on '${propertyKey}': 'items' must list at least one element.`);
		}

		// Combine namespace and namespaces into single array
		const allNamespaces: XmlNamespace[] = [];
		if (options.namespace) {
			allNamespaces.push(options.namespace);
		}
		if (options.namespaces) {
			allNamespaces.push(...options.namespaces);
		}

		// Automatic unwrapping: if no containerName is provided, unwrap automatically
		const shouldUnwrap = options.unwrapped ?? !options.containerName;

		const arrayMetadata: XmlArrayMetadata = {
			...extractValueFacets(options),
			containerName: options.containerName,
			itemName: options.itemName,
			items: options.items,
			type: options.type,
			namespaces: allNamespaces.length > 0 ? allNamespaces : undefined,
			nestingLevel: options.nestingLevel ?? 0,
			unwrapped: shouldUnwrap,
			isNullable: options.isNullable,
			dataType: options.dataType,
			order: options.order,
			form: options.form,
			required: options.required ?? false,
			requiredExplicitlyFalse: options.required === false || undefined,
			defaultValue: options.defaultValue,
			minOccurs: options.minOccurs,
			maxOccurs: options.maxOccurs,
			choiceGroup: options.choiceGroup,
			choiceRequired: options.choiceRequired,
		};

		// Return a field initializer that registers metadata once per decorator
		return function (this: any, initialValue: V): V {
			const ctor = this.constructor;

			// Use helper function to register metadata
			registerArrayMetadata(ctor, propertyKey, arrayMetadata);

			// Register type parameter class if provided for auto-discovery
			if (options.type) {
				withResolvedType(options.type, (typeCtor) => registerConstructorByName(typeCtor.name, typeCtor));
			}

			// Every alternative's class needs the same registration.
			for (const item of options.items ?? []) {
				if (item.type) {
					withResolvedType(item.type, (typeCtor) => registerConstructorByName(typeCtor.name, typeCtor));
				}
			}

			return initialValue;
		};
	};
}
