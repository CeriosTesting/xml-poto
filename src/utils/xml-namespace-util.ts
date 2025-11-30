import { getMetadata, XmlElementMetadata, XSI_NAMESPACE } from "../decorators";
import type { Constructor } from "../decorators/storage/metadata-storage";

/**
 * Cache for namespace collections to avoid repeated lookups
 * Maps constructor to its collected namespaces
 */
const namespaceCache = new WeakMap<Constructor, Map<string, string>>();

/**
 * Cache for element name building to avoid repeated string concatenation
 * Key format: "name|prefix|isDefault"
 */
const elementNameCache = new Map<string, string>();

/**
 * Cache for attribute name building to avoid repeated string concatenation
 * Key format: "name|prefix|isDefault"
 */
const attributeNameCache = new Map<string, string>();

/**
 * Utility class for handling XML namespace collection and declaration.
 */
export class XmlNamespaceUtil {
	/**
	 * Collect all namespaces used in an object and its decorators.
	 * Results are cached per constructor for performance.
	 */
	collectAllNamespaces(obj: any): Map<string, string> {
		const namespaces = new Map<string, string>();
		const ctor = obj.constructor;

		// Check cache first for static metadata (doesn't include instance values)
		const cached = namespaceCache.get(ctor);
		if (cached) {
			// Clone cached namespaces as base
			for (const [key, value] of cached) {
				namespaces.set(key, value);
			}
		} else {
			// Collect static namespaces and cache them
			const staticNamespaces = this.collectStaticNamespaces(ctor);
			namespaceCache.set(ctor, staticNamespaces);
			for (const [key, value] of staticNamespaces) {
				namespaces.set(key, value);
			}
		}

		// Recursively collect namespaces from nested objects (instance-specific)
		this.collectNamespacesFromNestedObjects(obj, namespaces, new WeakSet());

		return namespaces;
	}

	/**
	 * Collect static namespaces from class metadata (cacheable)
	 */
	private collectStaticNamespaces(ctor: any): Map<string, string> {
		const namespaces = new Map<string, string>();

		// Use single metadata lookup for better performance
		const metadata = getMetadata(ctor);

		// Collect namespace from root/element metadata
		const rootMetadata = metadata.root;
		const elementMetadata = metadata.element;

		const effectiveMetadata = rootMetadata
			? {
					namespace: rootMetadata.namespace,
				}
			: elementMetadata;

		if (effectiveMetadata?.namespace) {
			const ns = effectiveMetadata.namespace;
			// If no prefix is specified or isDefault is true, treat as default namespace
			if (ns.isDefault || (!ns.prefix && ns.uri)) {
				namespaces.set("default", ns.uri);
			} else if (ns.prefix) {
				namespaces.set(ns.prefix, ns.uri);
			}
		}

		// Collect namespaces from attributes
		Object.values(metadata.attributes).forEach((attrMetadata: any) => {
			if (attrMetadata.namespace?.prefix) {
				namespaces.set(attrMetadata.namespace.prefix, attrMetadata.namespace.uri);
			}
		});

		// Collect namespaces from array items
		Object.values(metadata.arrays).forEach((metadataArray: any) => {
			if (Array.isArray(metadataArray)) {
				metadataArray.forEach((arrayMetadata: any) => {
					if (arrayMetadata.namespace?.prefix) {
						namespaces.set(arrayMetadata.namespace.prefix, arrayMetadata.namespace.uri);
					}
				});
			}
		});

		// Collect namespaces from field-level element metadata
		Object.values(metadata.fieldElements).forEach((fieldMetadata: XmlElementMetadata) => {
			if (fieldMetadata.namespace) {
				const ns = fieldMetadata.namespace;
				// If no prefix is specified or isDefault is true, treat as default namespace
				if (ns.isDefault || (!ns.prefix && ns.uri)) {
					namespaces.set("default", ns.uri);
				} else if (ns.prefix) {
					namespaces.set(ns.prefix, ns.uri);
				}
			}
		});

		return namespaces;
	} /**
	 * Recursively collect namespaces from nested objects.
	 */
	private collectNamespacesFromNestedObjects(
		obj: any,
		namespaces: Map<string, string>,
		visited: WeakSet<object>
	): void {
		if (typeof obj !== "object" || obj === null || visited.has(obj)) {
			return;
		}

		visited.add(obj);
		const ctor = obj.constructor;

		// Use single metadata lookup for better performance
		const metadata = getMetadata(ctor);

		// Collect from this object's attributes
		Object.values(metadata.attributes).forEach((attrMetadata: any) => {
			if (attrMetadata.namespace?.prefix) {
				namespaces.set(attrMetadata.namespace.prefix, attrMetadata.namespace.uri);
			}
		});

		// Collect from field elements
		Object.values(metadata.fieldElements).forEach((fieldMetadata: XmlElementMetadata) => {
			if (fieldMetadata.namespace) {
				const ns = fieldMetadata.namespace;
				// If no prefix is specified or isDefault is true, treat as default namespace
				if (ns.isDefault || (!ns.prefix && ns.uri)) {
					namespaces.set("default", ns.uri);
				} else if (ns.prefix) {
					namespaces.set(ns.prefix, ns.uri);
				}
			}
		});

		// Collect from arrays
		Object.values(metadata.arrays).forEach((metadataArray: any) => {
			if (Array.isArray(metadataArray)) {
				metadataArray.forEach((arrayMetadata: any) => {
					if (arrayMetadata.namespace?.prefix) {
						namespaces.set(arrayMetadata.namespace.prefix, arrayMetadata.namespace.uri);
					}
				});
			}
		});

		// Recursively process nested objects and arrays
		Object.values(obj).forEach((value: any) => {
			if (Array.isArray(value)) {
				value.forEach((item: any) => {
					this.collectNamespacesFromNestedObjects(item, namespaces, visited);
				});
			} else if (typeof value === "object" && value !== null) {
				this.collectNamespacesFromNestedObjects(value, namespaces, visited);
			}
		});
	}

	/**
	 * Check if XSI namespace is needed (scans for xsi:nil or xsi:type attributes).
	 */
	private needsXsiNamespace(obj: any, visited: Set<any> = new Set()): boolean {
		if (obj === null || obj === undefined || typeof obj !== "object") {
			return false;
		}

		if (visited.has(obj)) {
			return false;
		}
		visited.add(obj);

		// Check for xsi attributes in current object
		for (const key of Object.keys(obj)) {
			if (key.startsWith("@_xsi:")) {
				return true;
			}
			// Recursively check nested objects
			const value = obj[key];
			if (typeof value === "object" && value !== null) {
				if (this.needsXsiNamespace(value, visited)) {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Add namespace declarations to the root element.
	 */
	addNamespaceDeclarations(mappedObj: any, rootElementName: string, namespaces: Map<string, string>): void {
		const rootElement = mappedObj[rootElementName];
		if (rootElement && typeof rootElement === "object") {
			// Auto-add XSI namespace if xsi:nil or xsi:type attributes are present
			if (this.needsXsiNamespace(mappedObj) && !namespaces.has(XSI_NAMESPACE.prefix)) {
				namespaces.set(XSI_NAMESPACE.prefix, XSI_NAMESPACE.uri);
			}

			namespaces.forEach((uri, prefix) => {
				if (prefix === "default") {
					// Default namespace: xmlns="uri"
					rootElement["@_xmlns"] = uri;
				} else {
					// Prefixed namespace: xmlns:prefix="uri"
					rootElement[`@_xmlns:${prefix}`] = uri;
				}
			});
		}
	}

	/**
	 * Build element name with namespace prefix.
	 * Results are cached for performance.
	 */
	buildElementName(metadata: XmlElementMetadata): string {
		// Fast path: no namespace
		if (!metadata.namespace?.uri) {
			return metadata.name;
		}

		// Create cache key
		const prefix = metadata.namespace.prefix || "";
		const isDefault = metadata.namespace.isDefault ? "1" : "0";
		const cacheKey = `${metadata.name}|${prefix}|${isDefault}`;

		// Check cache
		const cached = elementNameCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		// Build and cache result
		let result: string;
		if (prefix && !metadata.namespace.isDefault) {
			result = `${prefix}:${metadata.name}`;
		} else {
			result = metadata.name;
		}

		elementNameCache.set(cacheKey, result);
		return result;
	}

	/**
	 * Build attribute name with namespace prefix.
	 * Results are cached for performance.
	 */
	buildAttributeName(metadata: { name: string; namespace?: { prefix?: string; isDefault?: boolean } }): string {
		// Fast path: no namespace
		if (!metadata.namespace) {
			return metadata.name;
		}

		// Create cache key
		const prefix = metadata.namespace.prefix || "";
		const isDefault = metadata.namespace.isDefault ? "1" : "0";
		const cacheKey = `${metadata.name}|${prefix}|${isDefault}`;

		// Check cache
		const cached = attributeNameCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		// Build and cache result
		let result: string;
		if (prefix && !metadata.namespace.isDefault) {
			result = `${prefix}:${metadata.name}`;
		} else {
			result = metadata.name;
		}

		attributeNameCache.set(cacheKey, result);
		return result;
	}
}
