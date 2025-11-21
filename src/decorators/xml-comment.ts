import { commentMetadataStorage } from "./storage";
import { XmlCommentMetadata, XmlCommentOptions } from "./types";

/**
 * Modern TS5+ field decorator for XML comments
 * @param options Configuration options for the XML comment
 * @returns A field decorator function
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

				// Store comment property metadata
				if (!ctor.__xmlCommentProperty) {
					ctor.__xmlCommentProperty = propertyKey;
					ctor.__xmlCommentMetadata = commentMetadata;
				}

				// Also store in WeakMap
				commentMetadataStorage.set(ctor, propertyKey);
				metadataStored = true;
			}
			return initialValue;
		};
	};
}
