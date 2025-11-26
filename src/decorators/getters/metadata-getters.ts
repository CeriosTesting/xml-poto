import type { ClassMetadata } from "../storage/metadata-storage";
import { getMetadata, hasMetadata } from "../storage/metadata-storage";
import {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlDynamicMetadata,
	XmlElementMetadata,
	XmlRootMetadata,
	XmlTextMetadata,
} from "../types";

/**
 * Safely try to instantiate a class once to trigger field initializers
 * @param target The class constructor
 */
function tryInstantiate(target: any): void {
	try {
		void new target();
	} catch {
		// Ignore instantiation errors - class might need constructor params
	}
}

/**
 * Get all metadata for a class at once (most efficient - single lookup)
 * @param target The class constructor
 * @returns Complete metadata object for the class
 */
export function getAllMetadata(target: any): ClassMetadata {
	return getMetadata(target);
}

/**
 * Get XML element metadata
 * @param target The class constructor
 * @returns The XML element metadata or undefined
 */
export function getXmlElementMetadata(target: any): XmlElementMetadata | undefined {
	return hasMetadata(target) ? getMetadata(target).element : undefined;
}

/**
 * Get XML attribute metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Record of attribute metadata keyed by property name
 */
export function getXmlAttributeMetadata(target: any): Record<string, XmlAttributeMetadata> {
	// Check unified storage if it has data
	if (hasMetadata(target)) {
		const attributes = getMetadata(target).attributes;
		if (Object.keys(attributes).length > 0) {
			return attributes;
		}
	}

	// Try instantiating once to trigger field initializers
	tryInstantiate(target);

	// Check unified storage again after instantiation
	if (hasMetadata(target)) {
		return getMetadata(target).attributes;
	}

	// Return empty object - class has no decorated fields
	return {};
}

/**
 * Get XML text metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Object with property key and metadata, or undefined
 */
export function getXmlTextMetadata(target: any): { propertyKey: string; metadata: XmlTextMetadata } | undefined {
	if (hasMetadata(target)) {
		const metadata = getMetadata(target);
		const propertyKey = metadata.textProperty;
		if (propertyKey) {
			return { propertyKey, metadata: metadata.textMetadata || { required: false } };
		}
	}

	return undefined;
}

/**
 * Get XML comment metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Object with property key and metadata, or undefined
 */
export function getXmlCommentMetadata(target: any): { propertyKey: string; metadata: XmlCommentMetadata } | undefined {
	if (hasMetadata(target)) {
		const metadata = getMetadata(target);
		const propertyKey = metadata.commentProperty;
		if (propertyKey) {
			return { propertyKey, metadata: metadata.commentMetadata || { required: false } };
		}
	}

	return undefined;
}

/**
 * Get property to XML name mappings (optimized - single lookup)
 * @param target The class constructor
 * @returns Record of property mappings keyed by property name
 */
export function getXmlPropertyMappings(target: any): Record<string, string> {
	// Check unified storage if it has data
	if (hasMetadata(target)) {
		const mappings = getMetadata(target).propertyMappings;
		if (Object.keys(mappings).length > 0) {
			return mappings;
		}
	}

	// Try instantiating once to trigger field initializers
	tryInstantiate(target);

	// Check unified storage again after instantiation
	if (hasMetadata(target)) {
		return getMetadata(target).propertyMappings;
	}

	// Return empty object - class has no decorated fields
	return {};
}

/**
 * Get field-level XML element metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Record of field element metadata keyed by property name
 */
export function getXmlFieldElementMetadata(target: any): Record<string, XmlElementMetadata> {
	// Fast path: check if fieldElements is populated
	if (hasMetadata(target)) {
		const fieldElements = getMetadata(target).fieldElements;
		if (Object.keys(fieldElements).length > 0) {
			return fieldElements;
		}
	}

	// Try instantiating once to trigger field initializers
	tryInstantiate(target);

	// Return whatever we have after instantiation (might still be empty)
	return hasMetadata(target) ? getMetadata(target).fieldElements : {};
}

/**
 * Get XML root metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns The XML root metadata or undefined
 */
export function getXmlRootMetadata(target: any): XmlRootMetadata | undefined {
	return hasMetadata(target) ? getMetadata(target).root : undefined;
}

/**
 * Get XML array metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Record of array metadata arrays keyed by property name
 */
export function getXmlArrayMetadata(target: any): Record<string, XmlArrayMetadata[]> {
	// Check unified storage if it has data
	if (hasMetadata(target)) {
		const arrays = getMetadata(target).arrays;
		if (Object.keys(arrays).length > 0) {
			return arrays;
		}
	}

	// Try instantiating once to trigger field initializers
	tryInstantiate(target);

	// Check unified storage again after instantiation
	if (hasMetadata(target)) {
		return getMetadata(target).arrays;
	}

	// Return empty object - class has no decorated fields
	return {};
}

/**
 * Get XML dynamic metadata (optimized - single lookup)
 * @param target The class constructor
 * @returns Array of dynamic metadata
 */
export function getXmlDynamicMetadata(target: any): XmlDynamicMetadata[] {
	return hasMetadata(target) ? getMetadata(target).queryables : [];
}
