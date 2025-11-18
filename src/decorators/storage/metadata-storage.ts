import { XmlArrayItemMetadata, XmlAttributeMetadata, XmlElementMetadata, XmlRootMetadata } from "../types";

/** Storage for XML element metadata */
const elementMetadataStorage = new WeakMap<any, XmlElementMetadata>();
/** Storage for XML attribute metadata */
const attributeMetadataStorage = new WeakMap<any, Record<string, XmlAttributeMetadata>>();
/** Storage for property name that holds text content */
const textMetadataStorage = new WeakMap<any, string>();
/** Storage for property name that holds XML comment */
const commentMetadataStorage = new WeakMap<any, string>();
/** Storage for root element metadata */
const rootMetadataStorage = new WeakMap<any, XmlRootMetadata>();
/** Storage for array item metadata */
const arrayItemMetadataStorage = new WeakMap<any, Record<string, XmlArrayItemMetadata[]>>();
/** Storage for property name to XML name mappings */
const propertyMappingStorage = new WeakMap<any, Record<string, string>>();
/** Storage for field-level XML element metadata (including namespace info) */
const fieldElementMetadataStorage = new WeakMap<any, Record<string, XmlElementMetadata>>();

export {
	elementMetadataStorage,
	attributeMetadataStorage,
	textMetadataStorage,
	commentMetadataStorage,
	rootMetadataStorage,
	arrayItemMetadataStorage,
	propertyMappingStorage,
	fieldElementMetadataStorage,
};
