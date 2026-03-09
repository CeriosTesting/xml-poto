// Re-export all types from a single entry point
// Core types are loaded first for better IntelliSense performance

// Metadata types
export type {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlDynamicMetadata,
	XmlElementMetadata,
	XmlIgnoreMetadata,
	XmlRootMetadata,
	XmlTextMetadata,
} from "./metadata";
// Options and namespace
export * from "./options";
// Type utilities for better IntelliSense
export type { DecoratorKeys, DeepReadonly } from "./type-utils";
export * from "./xml-namespace";
