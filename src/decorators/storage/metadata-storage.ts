import type {
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlCommentMetadata,
	XmlDynamicMetadata,
	XmlElementMetadata,
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
	queryables: XmlDynamicMetadata[];
	/** Set of property names marked with @XmlIgnore */
	ignoredProperties: Set<string>;
}

/**
 * Type-safe WeakMap wrapper for better IntelliSense
 * Provides a cleaner API and better type inference
 * @internal
 */
class TypedMetadataStorage<K extends Constructor, V> {
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
 * Registry mapping XML element names (with namespace prefix) to their class constructors
 * Used for auto-discovery during deserialization when field metadata is not available
 * Example: "msg:metadata" -> Metadata class constructor
 */
const elementClassRegistry = new Map<string, Constructor>();

/**
 * Register a class constructor with its XML element name for auto-discovery
 * @param elementName - Full element name including namespace prefix (e.g., "msg:metadata")
 * @param ctor - Class constructor to register
 */
export function registerElementClass(elementName: string, ctor: Constructor): void {
	elementClassRegistry.set(elementName, ctor);
}

/**
 * Find a registered class constructor by XML element name
 * @param elementName - Full element name including namespace prefix (e.g., "msg:metadata")
 * @returns Class constructor if found, undefined otherwise
 */
export function findElementClass(elementName: string): Constructor | undefined {
	return elementClassRegistry.get(elementName);
}

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
 * Check if metadata exists for a class
 * @param target - Class constructor
 * @returns True if metadata exists
 */
export function hasMetadata(target: Constructor): boolean {
	return metadataStorage.has(target);
}

/**
 * Delete metadata for a class (mainly for testing)
 * @param target - Class constructor
 * @returns True if metadata was deleted
 */
export function deleteMetadata(target: Constructor): boolean {
	return metadataStorage.delete(target);
}
