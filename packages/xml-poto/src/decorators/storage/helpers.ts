import {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlDynamicMetadata,
	XmlElementMetadata,
	XmlTextMetadata,
} from "../types";

import { Constructor, getMetadata } from "./metadata-storage";

/**
 * Helper function to register attribute metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML attribute metadata
 */
export function registerAttributeMetadata(
	ctor: Constructor,
	propertyKey: string,
	metadata: XmlAttributeMetadata,
): void {
	const classMetadata = getMetadata(ctor);
	classMetadata.attributes[propertyKey] = metadata;
}

/**
 * Helper function to register array metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML array metadata
 */
export function registerArrayMetadata(ctor: Constructor, propertyKey: string, metadata: XmlArrayMetadata): void {
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
			item.containerName === metadata.containerName,
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
export function registerPropertyMapping(ctor: Constructor, propertyKey: string, xmlName: string): void {
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
export function registerTextMetadata(ctor: Constructor, propertyKey: string, metadata: XmlTextMetadata): void {
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
export function registerCommentMetadata(ctor: Constructor, propertyKey: string, metadata: XmlCommentMetadata): void {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);

	// Avoid duplicates
	const isDuplicate = classMetadata.comments.some(
		(c) => c.propertyKey === propertyKey && c.targetProperty === metadata.targetProperty,
	);

	if (!isDuplicate) {
		classMetadata.comments.push(metadata);
	}
}

/**
 * Helper function to register field element metadata
 * @param ctor The class constructor
 * @param propertyKey The property name
 * @param metadata The XML element metadata
 */
export function registerFieldElementMetadata(
	ctor: Constructor,
	propertyKey: string,
	metadata: XmlElementMetadata,
): void {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.fieldElements[propertyKey] = metadata;
}

/**
 * Helper function to register ignored property
 * @param ctor The class constructor
 * @param propertyKey The property name
 */
export function registerIgnoredProperty(ctor: Constructor, propertyKey: string): void {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);
	classMetadata.ignoredProperties.add(propertyKey);
}

/**
 * Helper function to register dynamic metadata
 * @param ctor The class constructor
 * @param metadata The XML dynamic metadata
 */
export function registerDynamicMetadata(ctor: Constructor, metadata: XmlDynamicMetadata): void {
	// Store in unified metadata (single WeakMap lookup)
	const classMetadata = getMetadata(ctor);

	// Avoid duplicates
	const existing = classMetadata.queryables;
	const isDuplicate = existing.some((q) => q.propertyKey === metadata.propertyKey);

	if (!isDuplicate) {
		classMetadata.queryables.push(metadata);
	}
}
