import { textMetadataStorage } from "./storage";
import { XmlTextMetadata, XmlTextOptions } from "./types";

/**
 * Modern TS5+ field decorator for XML text content and property mapping
 * @param options Configuration options for the XML text content
 * @returns A field decorator function
 */
export function XmlText(options: XmlTextOptions = {}) {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const textMetadata: XmlTextMetadata = {
			converter: options.converter,
			required: options.required ?? false,
			dataType: options.dataType,
		};

		// Store metadata during first instance creation
		let metadataStored = false;

		// Return a field initializer that stores metadata on first use
		return function (this: any, initialValue: V): V {
			if (!metadataStored) {
				const ctor = this.constructor;

				// Store text property metadata
				if (!ctor.__xmlTextProperty) {
					ctor.__xmlTextProperty = propertyKey;
					ctor.__xmlTextMetadata = textMetadata;
				}

				// Store property mapping if xmlName is provided (replaces @XmlProperty functionality)
				if (options.xmlName) {
					if (!ctor.__xmlPropertyMappings) {
						ctor.__xmlPropertyMappings = {};
					}
					ctor.__xmlPropertyMappings[propertyKey] = options.xmlName;
				}

				// Also store in WeakMap
				textMetadataStorage.set(ctor, propertyKey);
				metadataStored = true;
			}
			return initialValue;
		};
	};
}
