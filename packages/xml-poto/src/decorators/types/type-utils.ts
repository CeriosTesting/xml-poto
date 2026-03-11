/**
 * Type utilities for better IntelliSense performance
 * These types help TypeScript narrow types faster and provide better autocomplete
 */

/**
 * Deep readonly type helper
 * Makes all properties and nested properties readonly
 */
export type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Extract decorator names from metadata
 */
export type DecoratorKeys = "element" | "attribute" | "text" | "root" | "array" | "comment" | "queryable";
