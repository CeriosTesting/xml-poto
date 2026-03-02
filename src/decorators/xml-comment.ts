import { registerCommentMetadata } from "./storage";
import { XmlCommentMetadata, XmlCommentOptions } from "./types";

/**
 * Decorator to map a class property to an XML comment for a specific target element.
 *
 * Use this decorator to include XML comments that describe specific elements in your serialized output.
 * Comments appear immediately before their target element. Supports bi-directional serialization
 * and deserialization when enabled.
 *
 * The property can be either `string` or `string[]`:
 * - `string`: Single-line or multi-line comments (use \n for line breaks)
 * - `string[]`: Each array element becomes a line in the comment
 *
 * During deserialization:
 * - If property is `string`, multi-line comments are preserved with \n
 * - If property is `string[]`, multi-line comments are split into array elements
 *
 * @param options Configuration options for the XML comment
 * @param options.targetProperty - The property name that this comment describes (required) - type-safe with keyof
 * @param options.required - Whether this comment is required (validation)
 * @returns A field decorator function that stores metadata for serialization
 *
 * @example
 * ```
 * // Single-line comment with string
 * @XmlRoot({ name: 'Document' })
 * class Document {
 *   @XmlComment({ targetProperty: 'title' })
 *   titleComment: string = 'This describes the title';
 *
 *   @XmlElement({ name: 'Title' })
 *   title!: string;
 * }
 * // Serializes to:
 * // <Document>
 * //   <!--This describes the title-->
 * //   <Title>My Title</Title>
 * // </Document>
 * ```
 *
 * @example
 * ```
 * // Multi-line comment with string
 * @XmlRoot({ name: 'Config' })
 * class Config {
 *   @XmlComment({ targetProperty: 'setting' })
 *   settingComment: string = 'Configuration setting\nLine 2\nLine 3';
 *
 *   @XmlElement({ name: 'Setting' })
 *   setting!: string;
 * }
 * // Serializes to:
 * // <Config>
 * //   <!--Configuration setting
 * //   Line 2
 * //   Line 3-->
 * //   <Setting>production</Setting>
 * // </Config>
 * ```
 *
 * @example
 * ```
 * // Multi-line comment with string[]
 * @XmlRoot({ name: 'Task' })
 * class Task {
 *   @XmlComment({ targetProperty: 'description' })
 *   descriptionComment: string[] = [
 *     'TODO items:',
 *     '- Fix bug',
 *     '- Update docs'
 *   ];
 *
 *   @XmlElement({ name: 'Description' })
 *   description!: string;
 * }
 * // Serializes to:
 * // <Task>
 * //   <!--TODO items:
 * //   - Fix bug
 * //   - Update docs-->
 * //   <Description>Task description</Description>
 * // </Task>
 * //
 * // Deserializes to:
 * // descriptionComment = ['TODO items:', '- Fix bug', '- Update docs']
 * ```
 *
 * @example
 * ```
 * // Multiple comments for different elements
 * @XmlRoot({ name: 'Config' })
 * class Config {
 *   @XmlComment({ targetProperty: 'version' })
 *   versionComment: string = 'Application version';
 *
 *   @XmlElement({ name: 'Version' })
 *   version!: string;
 *
 *   @XmlComment({ targetProperty: 'setting' })
 *   settingComment: string = 'Configuration setting';
 *
 *   @XmlElement({ name: 'Setting' })
 *   setting!: string;
 * }
 * ```
 */
export function XmlComment<T>(options: XmlCommentOptions<T>) {
	return <V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const commentMetadata: XmlCommentMetadata = {
			propertyKey,
			targetProperty: options.targetProperty,
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
