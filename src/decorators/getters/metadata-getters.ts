import {
	arrayItemMetadataStorage,
	attributeMetadataStorage,
	commentMetadataStorage,
	elementMetadataStorage,
	fieldElementMetadataStorage,
	propertyMappingStorage,
	rootMetadataStorage,
	textMetadataStorage,
} from "../storage";
import {
	XmlArrayItemMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlElementMetadata,
	XmlRootMetadata,
	XmlTextMetadata,
} from "../types";

/**
 * Get XML element metadata
 * @param target The class constructor
 * @returns The XML element metadata or undefined
 */
export function getXmlElementMetadata(target: any): XmlElementMetadata | undefined {
	return elementMetadataStorage.get(target);
}

/**
 * Get XML attribute metadata with multiple fallback strategies
 * @param target The class constructor
 * @returns Record of attribute metadata keyed by property name
 */
export function getXmlAttributeMetadata(target: any): Record<string, XmlAttributeMetadata> {
	// Try WeakMap first
	let attributes = attributeMetadataStorage.get(target);

	if (!attributes || Object.keys(attributes).length === 0) {
		// Try constructor property fallback
		attributes = target.__xmlAttributes || {};
	}

	if (!attributes || Object.keys(attributes).length === 0) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();

			// Re-check all sources after instantiation
			attributes = attributeMetadataStorage.get(target) || target.__xmlAttributes || {};
		} catch {
			// If instantiation fails, return empty object
			attributes = {};
		}
	}

	return attributes || {};
}

/**
 * Get XML text metadata
 * @param target The class constructor
 * @returns Object with property key and metadata, or undefined
 */
export function getXmlTextMetadata(target: any): { propertyKey: string; metadata: XmlTextMetadata } | undefined {
	// Try WeakMap first
	let propertyKey = textMetadataStorage.get(target);

	if (!propertyKey) {
		// Try constructor property fallback
		propertyKey = target.__xmlTextProperty;
	}

	if (!propertyKey) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();
			propertyKey = textMetadataStorage.get(target) || target.__xmlTextProperty;
		} catch {
			// If instantiation fails, return undefined
			return undefined;
		}
	}

	if (propertyKey) {
		const metadata = target.__xmlTextMetadata || { required: false };
		return { propertyKey, metadata };
	}

	return undefined;
}

/**
 * Get XML comment metadata
 * @param target The class constructor
 * @returns Object with property key and metadata, or undefined
 */
export function getXmlCommentMetadata(target: any): { propertyKey: string; metadata: XmlCommentMetadata } | undefined {
	// Try WeakMap first
	let propertyKey = commentMetadataStorage.get(target);

	if (!propertyKey) {
		// Try constructor property fallback
		propertyKey = target.__xmlCommentProperty;
	}

	if (!propertyKey) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();
			propertyKey = commentMetadataStorage.get(target) || target.__xmlCommentProperty;
		} catch {
			// If instantiation fails, return undefined
			return undefined;
		}
	}

	if (propertyKey) {
		const metadata = target.__xmlCommentMetadata || { required: false };
		return { propertyKey, metadata };
	}

	return undefined;
}

/**
 * Get property to XML name mappings
 * @param target The class constructor
 * @returns Record of property mappings keyed by property name
 */
export function getXmlPropertyMappings(target: any): Record<string, string> {
	// Try WeakMap first
	let mappings = propertyMappingStorage.get(target);

	if (!mappings || Object.keys(mappings).length === 0) {
		// Try constructor property fallback
		mappings = target.__xmlPropertyMappings;
	}

	if (!mappings || Object.keys(mappings).length === 0) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();

			// Re-check all sources after instantiation
			mappings = propertyMappingStorage.get(target) || target.__xmlPropertyMappings || {};
		} catch {
			mappings = {};
		}
	}

	return mappings || {};
}

/**
 * Get field-level XML element metadata
 * @param target The class constructor
 * @returns Record of field element metadata keyed by property name
 */
export function getXmlFieldElementMetadata(target: any): Record<string, XmlElementMetadata> {
	// Try WeakMap first
	let fieldMetadata = fieldElementMetadataStorage.get(target);

	if (!fieldMetadata || Object.keys(fieldMetadata).length === 0) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();

			// Re-check after instantiation
			fieldMetadata = fieldElementMetadataStorage.get(target) || {};
		} catch {
			fieldMetadata = {};
		}
	}

	return fieldMetadata || {};
}

/**
 * Get XML root metadata
 * @param target The class constructor
 * @returns The XML root metadata or undefined
 */
export function getXmlRootMetadata(target: any): XmlRootMetadata | undefined {
	return rootMetadataStorage.get(target);
}

/**
 * Get XML array item metadata
 * @param target The class constructor
 * @returns Record of array item metadata arrays keyed by property name
 */
export function getXmlArrayItemMetadata(target: any): Record<string, XmlArrayItemMetadata[]> {
	// Try WeakMap first
	let arrayItems = arrayItemMetadataStorage.get(target);

	if (!arrayItems || Object.keys(arrayItems).length === 0) {
		// Try constructor property fallback
		arrayItems = target.__xmlArrayItems || {};
	}

	if (!arrayItems || Object.keys(arrayItems).length === 0) {
		// Force instantiation to trigger initializers if needed
		try {
			void new target();
			arrayItems = arrayItemMetadataStorage.get(target) || target.__xmlArrayItems || {};
		} catch {
			arrayItems = {};
		}
	}

	return arrayItems || {};
}
