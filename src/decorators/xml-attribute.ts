import { registerAttributeMetadata } from "./storage";
import { XmlAttributeMetadata, XmlAttributeOptions } from "./types";

/**
 * Modern TS5+ field decorator for XML attributes - simplified without reflect-metadata
 * @param options Configuration options for the XML attribute
 * @returns A field decorator function
 */
export function XmlAttribute(options: XmlAttributeOptions = {}) {
	return <T, V>(_target: undefined, context: ClassFieldDecoratorContext<T, V>): ((initialValue: V) => V) => {
		const propertyKey = String(context.name);
		const attributeMetadata: XmlAttributeMetadata = {
			name: options.name || propertyKey,
			namespace: options.namespace,
			required: options.required ?? false,
			converter: options.converter,
			pattern: options.pattern,
			enumValues: options.enumValues,
			dataType: options.dataType,
			form: options.form,
			type: options.type,
		};

		// Return a field initializer that does the registration
		return function (this: any, initialValue: V): V {
			const ctor = this.constructor;

			// Store using our existing registration system
			registerAttributeMetadata(ctor, propertyKey, attributeMetadata);

			return initialValue;
		};
	};
}
