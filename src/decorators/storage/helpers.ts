import { XmlAttributeMetadata } from "../types";
import { attributeMetadataStorage } from "./metadata-storage";

/**
 * Helper function to register attribute metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML attribute metadata
 */
export function registerAttributeMetadata(ctor: any, propertyKey: string, metadata: XmlAttributeMetadata) {
	// Store on constructor property
	if (!ctor.__xmlAttributes) {
		ctor.__xmlAttributes = {};
	}
	ctor.__xmlAttributes[propertyKey] = metadata;

	// Store in WeakMap
	if (!attributeMetadataStorage.has(ctor)) {
		attributeMetadataStorage.set(ctor, {});
	}
	const attributes = attributeMetadataStorage.get(ctor) || {};
	attributes[propertyKey] = metadata;
	attributeMetadataStorage.set(ctor, attributes);
}
