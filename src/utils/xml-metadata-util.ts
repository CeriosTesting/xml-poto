import { getMetadata, XmlElementMetadata } from "../decorators";

/**
 * Gets or creates default element metadata for a class.
 * Used when a class has no @XmlRoot or @XmlElement decorator.
 *
 * This is a shared utility to avoid code duplication between
 * XmlDecoratorSerializer and XmlMappingUtil.
 *
 * @param ctor - Class constructor
 * @returns Element metadata (from decorators or default)
 */
export function getOrCreateDefaultElementMetadata(ctor: any): XmlElementMetadata {
	// Use single metadata lookup
	const metadata = getMetadata(ctor);
	const existingRoot = metadata.root;
	if (existingRoot) {
		return {
			name: existingRoot.name || existingRoot.elementName || ctor.name || "Element",
			namespace: existingRoot.namespace,
			required: false,
			dataType: existingRoot.dataType,
			isNullable: existingRoot.isNullable,
			xmlSpace: existingRoot.xmlSpace,
		};
	}

	const existingElement = metadata.element;
	if (existingElement) {
		return existingElement;
	}

	// Create default metadata using class name
	const defaultMetadata: XmlElementMetadata = {
		name: ctor.name || "Element",
		required: false,
	};

	// Cache it for future use
	metadata.element = defaultMetadata;

	return defaultMetadata;
}
