/* eslint-disable typescript/no-explicit-any -- Metadata utils work with dynamic class constructors */
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
			name: existingRoot.name ?? ctor.name ?? "Element",
			namespaces: existingRoot.namespaces,
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

	// @XmlType provides class-level name/namespace identity as a fallback when the
	// class carries no @XmlRoot/@XmlElement (used to qualify nested/array references
	// and to derive root defaults, mirroring C# [XmlType]).
	const existingType = metadata.xmlType;
	if (existingType) {
		return existingType;
	}

	// Create default metadata using class name
	const defaultMetadata: XmlElementMetadata = {
		name: ctor.name ?? "Element",
		required: false,
	};

	// Cache it for future use
	metadata.element = defaultMetadata;

	return defaultMetadata;
}
