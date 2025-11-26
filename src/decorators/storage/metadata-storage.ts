import type {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlElementMetadata,
	XmlQueryableMetadata,
	XmlRootMetadata,
	XmlTextMetadata,
} from "../types";

/**
 * Type helper for constructor functions
 * More specific than 'any' for better IntelliSense performance
 * Supports both concrete and abstract constructors
 */
export type Constructor<T = object> = (new (...args: any[]) => T) | (abstract new (...args: any[]) => T);

/**
 * Unified metadata structure for each class
 * This single object holds all decorator metadata, reducing WeakMap lookups from 9+ to 1
 */
export interface ClassMetadata {
	/** Root element metadata from @XmlRoot */
	root?: XmlRootMetadata;
	/** Class-level element metadata */
	element?: XmlElementMetadata;
	/** Attribute metadata from @XmlAttribute decorators */
	attributes: Record<string, XmlAttributeMetadata>;
	/** Field-level element metadata (with namespace info) */
	fieldElements: Record<string, XmlElementMetadata>;
	/** Array metadata from @XmlArray decorators */
	arrays: Record<string, XmlArrayMetadata[]>;
	/** Property name to XML element name mappings */
	propertyMappings: Record<string, string>;
	/** Property name that holds text content from @XmlText */
	textProperty?: string;
	/** Text metadata from @XmlText decorator */
	textMetadata?: XmlTextMetadata;
	/** Property name that holds XML comment from @XmlComment */
	commentProperty?: string;
	/** Comment metadata from @XmlComment decorator */
	commentMetadata?: XmlCommentMetadata;
	/** Queryable metadata from @XmlDynamic decorators */
	queryables: XmlQueryableMetadata[];
	/** Set of property names marked with @XmlIgnore */
	ignoredProperties: Set<string>;
}

/**
 * Type-safe WeakMap wrapper for better IntelliSense
 * Provides a cleaner API and better type inference
 */
export class TypedMetadataStorage<K extends Constructor, V> {
	private storage = new WeakMap<K, V>();

	set(key: K, value: V): void {
		this.storage.set(key, value);
	}

	get(key: K): V | undefined {
		return this.storage.get(key);
	}

	has(key: K): boolean {
		return this.storage.has(key);
	}

	delete(key: K): boolean {
		return this.storage.delete(key);
	}

	/**
	 * Get existing value or create new one using factory function
	 * Reduces boilerplate for get-or-create patterns
	 */
	getOrCreate(key: K, factory: () => V): V {
		const existing = this.storage.get(key);
		if (existing !== undefined) {
			return existing;
		}
		const newValue = factory();
		this.storage.set(key, newValue);
		return newValue;
	}
}

/**
 * Single unified WeakMap for all metadata - one lookup per class
 * This is significantly faster than 9 separate WeakMap lookups
 * Uses TypedMetadataStorage for better type inference
 */
const metadataStorage = new TypedMetadataStorage<Constructor, ClassMetadata>();

/**
 * Get or create metadata for a class constructor
 * Guarantees a valid metadata object exists
 * @param target - Class constructor
 * @returns Metadata object for the class
 */
export function getMetadata(target: Constructor): ClassMetadata {
	return metadataStorage.getOrCreate(target, () => ({
		attributes: {},
		fieldElements: {},
		arrays: {},
		propertyMappings: {},
		queryables: [],
		ignoredProperties: new Set(),
	}));
}

/**
 * Check if class has any metadata (fast check without creating metadata)
 * @param target - Class constructor
 * @returns True if metadata exists
 */
export function hasMetadata(target: Constructor): boolean {
	return metadataStorage.has(target);
}

/**
 * Clear all metadata for a class (useful for testing)
 * @param target - Class constructor
 */
export function clearMetadata(target: Constructor): void {
	metadataStorage.delete(target);
}
