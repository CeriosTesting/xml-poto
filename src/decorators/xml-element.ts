import { elementMetadataStorage, fieldElementMetadataStorage, propertyMappingStorage } from "./storage";
import { XmlElementMetadata, XmlElementOptions } from "./types";

/**
 * Simple registration function that uses immediate class access
 * @param nameOrOptions Element name or configuration options
 * @returns A decorator function that can be used on classes or fields
 */
export function XmlElement(nameOrOptions?: string | XmlElementOptions): any {
	return (target: any, context: any) => {
		if (context.kind === "class") {
			// Class decorator usage
			const options = (typeof nameOrOptions === "object" ? nameOrOptions : {}) || {};
			const elementMetadata: XmlElementMetadata = {
				name: options.name || String(context.name),
				namespace: options.namespace,
				required: options.required ?? false,
				order: options.order,
				dataType: options.dataType,
				isNullable: options.isNullable,
				form: options.form,
				type: options.type,
				useCDATA: options.useCDATA,
				unionTypes: options.unionTypes,
				mixedContent: options.mixedContent,
			};

			// Store comprehensive metadata on the class itself
			elementMetadataStorage.set(target, elementMetadata);

			return target;
		} else if (context.kind === "field") {
			// Field decorator usage
			const options = (typeof nameOrOptions === "object" ? nameOrOptions : {}) || {};
			const xmlName = typeof nameOrOptions === "string" ? nameOrOptions : options.name || String(context.name);

			return function (this: any, initialValue: any): any {
				const ctor = this.constructor;
				const propertyKey = String(context.name);

				// Store field-level element metadata (including namespace)
				const fieldElementMetadata: XmlElementMetadata = {
					name: xmlName,
					namespace: options.namespace,
					required: options.required ?? false,
					order: options.order,
					dataType: options.dataType,
					isNullable: options.isNullable,
					form: options.form,
					type: options.type,
					useCDATA: options.useCDATA,
					unionTypes: options.unionTypes,
					mixedContent: options.mixedContent,
				};

				// Store field metadata in WeakMap
				if (!fieldElementMetadataStorage.has(ctor)) {
					fieldElementMetadataStorage.set(ctor, {});
				}
				const fieldMetadata = fieldElementMetadataStorage.get(ctor) ?? {};
				fieldMetadata[propertyKey] = fieldElementMetadata;

				// Store in constructor property for backwards compatibility
				if (!ctor.__xmlPropertyMappings) {
					ctor.__xmlPropertyMappings = {};
				}
				ctor.__xmlPropertyMappings[propertyKey] = xmlName;

				// Store in WeakMap for backwards compatibility
				if (!propertyMappingStorage.has(ctor)) {
					propertyMappingStorage.set(ctor, {});
				}
				const mappings = propertyMappingStorage.get(ctor) ?? {};
				mappings[propertyKey] = xmlName;
				return initialValue;
			};
		}

		throw new Error(`XmlElement decorator can only be used on classes or fields, not ${context.kind}`);
	};
}
