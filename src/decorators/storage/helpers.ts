import {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlElementMetadata,
	XmlQueryableMetadata,
	XmlTextMetadata,
} from "../types";
import { getMetadata } from "./metadata-storage";

/**
 * Helper function to register attribute metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML attribute metadata
 */
export function registerAttributeMetadata(ctor: any, propertyKey: string, metadata: XmlAttributeMetadata) {
	const classMetadata = getMetadata(ctor);
	classMetadata.attributes[propertyKey] = metadata;
}

/**
 * Helper function to register array metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML array metadata
 */
export function registerArrayMetadata(ctor: any, propertyKey: string, metadata: XmlArrayMetadata) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);

	if (!classMetadata.arrays[propertyKey]) {
		classMetadata.arrays[propertyKey] = [];
	}

	// Check if this exact metadata is already stored to avoid duplicates
	const existing = classMetadata.arrays[propertyKey];
	const isDuplicate = existing.some(
		(item: XmlArrayMetadata) =>
			item.itemName === metadata.itemName &&
			item.type === metadata.type &&
			item.containerName === metadata.containerName
	);

	if (!isDuplicate) {
		classMetadata.arrays[propertyKey].push(metadata);
	}
}

/**
 * Helper function to register property name mapping
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param xmlName The XML element name
 */
export function registerPropertyMapping(ctor: any, propertyKey: string, xmlName: string) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.propertyMappings[propertyKey] = xmlName;
}

/**
 * Helper function to register text metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML text metadata
 */
export function registerTextMetadata(ctor: any, propertyKey: string, metadata: XmlTextMetadata) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.textProperty = propertyKey;
	classMetadata.textMetadata = metadata;
}

/**
 * Helper function to register comment metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML comment metadata
 */
export function registerCommentMetadata(ctor: any, propertyKey: string, metadata: XmlCommentMetadata) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.commentProperty = propertyKey;
	classMetadata.commentMetadata = metadata;
}

/**
 * Helper function to register field element metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML element metadata
 */
export function registerFieldElementMetadata(ctor: any, propertyKey: string, metadata: XmlElementMetadata) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.fieldElements[propertyKey] = metadata;
}

/**
 * Helper function to register ignored property
 * @param ctor The class constructor
 * @param propertyKey The property name
 */
export function registerIgnoredProperty(ctor: any, propertyKey: string) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.ignoredProperties.add(propertyKey);
}

/**
 * Helper function to register queryable metadata
 * @param ctor The class constructor
 * @param metadata The XML queryable metadata
 */
export function registerQueryableMetadata(ctor: any, metadata: XmlQueryableMetadata) {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);

	// Avoid duplicates
	const existing = classMetadata.queryables;
	const isDuplicate = existing.some(q => q.propertyKey === metadata.propertyKey);

	if (!isDuplicate) {
		classMetadata.queryables.push(metadata);
	}
}
