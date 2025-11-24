import { registerCommentMetadata } from "./storage";
import { XmlCommentMetadata, XmlCommentOptions } from "./types";

/**
 * Decorator to map a class property to an XML comment.
 *
 * Use this decorator to include XML comments in your serialized output. Comments are
 * preserved during serialization but are typically ignored during deserialization.
 * Useful for documentation, metadata, or conditional processing instructions.
 *
 * @param options Configuration options for the XML comment
 * @param options.required - Whether this comment is required (validation)
 * @returns A field decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Basic comment
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlComment() description!: string;
 *   @XmlElement() title!: string;
 *   @XmlElement() content!: string;
 * }
 *
 * const doc = new Document();
 * doc.description = 'This is the main document';
 * doc.title = 'My Title';
 * doc.content = 'Content here';
 *
 * // Serializes to:
 * // <Document>
 * //   <!-- This is the main document -->
 * //   <title>My Title</title>
 * //   <content>Content here</content>
 * // </Document>
 * ```
 *
 * @example
 * ```
 * // Multiple comments
 * @XmlRoot({ elementName: 'Config' })
 * class Config {
 *   @XmlComment() headerComment!: string;
 *   @XmlElement() version!: string;
 *   @XmlComment() settingsComment!: string;
 *   @XmlElement() setting!: string;
 * }
 *
 * // Comments appear in the order they're defined
 * ```
 *
 * @example
 * ```
 * // Documentation comments
 * @XmlRoot({ elementName: 'API' })
 * class APIEndpoint {
 *   @XmlComment() documentation: string = 'GET /api/users - Returns list of users';
 *   @XmlElement() path!: string;
 *   @XmlElement() method!: string;
 * }
 * ```
 */
export function XmlComment(options: XmlCommentOptions = {}) {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const commentMetadata: XmlCommentMetadata = {
			required: options.required ?? false,
		};

		// Store metadata during first instance creation
		let metadataStored = false;

		// Return a field initializer that stores metadata on first use
		return function (this: any, initialValue: V): V {
			if (!metadataStored) {
				const ctor = this.constructor;

				// Use helper function to register comment metadata
				registerCommentMetadata(ctor, propertyKey, commentMetadata);

				metadataStored = true;
			}
			return initialValue;
		};
	};
}
