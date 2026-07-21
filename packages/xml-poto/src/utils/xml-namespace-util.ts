/* eslint-disable typescript/no-explicit-any -- Namespace utilities work with any element/attribute types */
import { getMetadata, XmlElementMetadata, XSI_NAMESPACE } from "../decorators";
import type { Constructor } from "../decorators/storage/metadata-storage";

/**
 * Cache for namespace collections to avoid repeated lookups
 * Maps constructor to its collected namespaces
 */
const namespaceCache = new WeakMap<Constructor, Map<string, string>>();

/**
 * Cache for element name building to avoid repeated string concatenation
 * Key format: "name|prefix"
 */
const elementNameCache = new Map<string, string>();

/**
 * Cache for attribute name building to avoid repeated string concatenation
 * Key format: "name|prefix"
 */
const attributeNameCache = new Map<string, string>();

/**
 * Utility class for handling XML namespace collection and declaration.
 */
export class XmlNamespaceUtil {
	/**
	 * Helper to add namespaces array to the collection map
	 */
	private addNamespacesToMap(namespaces: any[] | undefined, map: Map<string, string>): void {
		if (!namespaces) return;

		for (const ns of namespaces) {
			if (!ns?.uri) continue;

			// If no prefix is specified, treat as default namespace
			if (!ns.prefix && ns.uri) {
				map.set("default", ns.uri);
			} else if (ns.prefix) {
				map.set(ns.prefix, ns.uri);
			}
		}
	}

	/**
	 * Collect all namespaces used in an object and its decorators.
	 * Only collect namespaces for the root element itself,
	 * not from nested objects (they declare their own namespaces).
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

		// Don't recursively collect from nested objects - they declare their own namespaces
		// Only collect from root-level field elements and attributes
		const metadata = getMetadata(ctor);
		for (const key in metadata.fieldElements) {
			const fieldMetadata = metadata.fieldElements[key];
			this.addNamespacesToMap(fieldMetadata.namespaces, namespaces);
		}

		return namespaces;
	}

	/**
	 * Collect static namespaces from class metadata (cacheable)
	 */
	private collectStaticNamespaces(ctor: any): Map<string, string> {
		const namespaces = new Map<string, string>();

		// Use single metadata lookup for better performance
		const metadata = getMetadata(ctor);

		// Collect namespaces from root/element/type metadata (same precedence as
		// getOrCreateDefaultElementMetadata, so an @XmlType-only root still declares
		// the namespace its element name is prefixed with)
		const rootMetadata = metadata.root;
		const elementMetadata = metadata.element;
		const effectiveMetadata = rootMetadata ?? elementMetadata ?? metadata.xmlType;

		this.addNamespacesToMap(effectiveMetadata?.namespaces, namespaces);

		// Attribute namespaces are intentionally NOT collected here: attributes are
		// never in the default namespace, and they are declared inline on their own
		// element during serialization (see XmlMappingUtil.serializeAttributes), then
		// deduplicated against ancestors.

		// Collect namespaces from array items
		for (const key in metadata.arrays) {
			const metadataArray = metadata.arrays[key];
			if (Array.isArray(metadataArray)) {
				for (const arrayMetadata of metadataArray) {
					this.addNamespacesToMap(arrayMetadata.namespaces, namespaces);
				}
			}
		}

		// Collect namespaces from field-level element metadata
		for (const key in metadata.fieldElements) {
			const fieldMetadata = metadata.fieldElements[key];
			this.addNamespacesToMap(fieldMetadata.namespaces, namespaces);
		}

		return namespaces;
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
		for (const key in obj) {
			if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
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

			for (const [prefix, uri] of namespaces) {
				if (prefix === "default") {
					// Default namespace: xmlns="uri"
					rootElement["@_xmlns"] = uri;
				} else {
					// Prefixed namespace: xmlns:prefix="uri"
					rootElement[`@_xmlns:${prefix}`] = uri;
				}
			}
		}
	}

	/**
	 * Remove redundant xmlns declarations that an ancestor element already binds
	 * to the identical URI. Walks the intermediate tree depth-first, carrying the
	 * set of in-scope prefix→URI bindings down to descendants.
	 *
	 * A prefix that is rebound to a *different* URI is left untouched (that is a
	 * legal namespace rebinding and changing it would alter semantics). Only an
	 * exact prefix→URI repeat of an ancestor declaration is dropped.
	 */
	dedupeNamespaceDeclarations(
		mappedObj: any,
		rootElementName: string,
		namespaceFreeContent: WeakSet<object> = new WeakSet(),
	): void {
		const rootElement = mappedObj[rootElementName];
		if (rootElement && typeof rootElement === "object") {
			this.dedupeElementNamespaces(rootElement, new Map(), new WeakSet(), namespaceFreeContent);
		}
	}

	/**
	 * Dedupe one element's xmlns declarations against the inherited scope, then
	 * recurse into its child elements with the (possibly extended) scope. The
	 * `visited` set guards against cyclic intermediate structures (e.g. inline
	 * DynamicElement content that references an ancestor).
	 *
	 * An element flagged in `namespaceFreeContent` that is nested under a default
	 * namespace gets an `xmlns=""` reset so it is not pulled into the ancestor's
	 * default namespace (matching C# XmlSerializer).
	 */
	private dedupeElementNamespaces(
		element: any,
		inheritedScope: Map<string, string>,
		visited: WeakSet<object>,
		namespaceFreeContent: WeakSet<object>,
	): void {
		if (visited.has(element)) return;
		visited.add(element);

		let childScope = inheritedScope;
		let cloned = false;
		const ensureChildScope = (): Map<string, string> => {
			if (!cloned) {
				childScope = new Map(inheritedScope);
				cloned = true;
			}
			return childScope;
		};

		// First pass: reconcile this element's own xmlns declarations.
		for (const key of Object.keys(element)) {
			const prefix = this.xmlnsPrefixFromKey(key);
			if (prefix === undefined) continue;

			const uri = element[key];
			if (inheritedScope.get(prefix) === uri) {
				// Ancestor already binds this prefix to the same URI → redundant.
				delete element[key];
			} else {
				ensureChildScope().set(prefix, uri);
			}
		}

		// Reset the default namespace on a namespace-free element nested under a
		// default-namespace ancestor, unless it already declares its own default.
		if (inheritedScope.get("default") && element["@_xmlns"] === undefined && namespaceFreeContent.has(element)) {
			element["@_xmlns"] = "";
			ensureChildScope().set("default", "");
		}

		// Second pass: recurse into child elements (skip attributes and text markers).
		for (const key of Object.keys(element)) {
			if (key.startsWith("@_") || key.startsWith("#") || key === "__cdata") continue;
			this.dedupeValue(element[key], childScope, visited, namespaceFreeContent);
		}
	}

	/**
	 * Recurse a child value: unwrap arrays, descend into element objects.
	 */
	private dedupeValue(
		value: any,
		scope: Map<string, string>,
		visited: WeakSet<object>,
		namespaceFreeContent: WeakSet<object>,
	): void {
		if (Array.isArray(value)) {
			for (const item of value) {
				this.dedupeValue(item, scope, visited, namespaceFreeContent);
			}
		} else if (value !== null && typeof value === "object") {
			this.dedupeElementNamespaces(value, scope, visited, namespaceFreeContent);
		}
	}

	/**
	 * Map an intermediate-tree attribute key to the namespace prefix it declares,
	 * or undefined when the key is not an xmlns declaration. The default namespace
	 * (`@_xmlns`) is keyed as "default" to match {@link addNamespacesToMap}.
	 */
	private xmlnsPrefixFromKey(key: string): string | undefined {
		if (key === "@_xmlns") return "default";
		if (key.startsWith("@_xmlns:")) return key.slice("@_xmlns:".length);
		return undefined;
	}

	/**
	 * Build element name with namespace prefix.
	 * Results are cached for performance.
	 * Uses the first namespace from the namespaces array as the primary namespace.
	 * When form is 'unqualified', the prefix is suppressed even if a namespace is configured.
	 */
	buildElementName(metadata: XmlElementMetadata): string {
		// Get primary namespace (first in array)
		const primaryNs = metadata.namespaces?.[0];

		// Fast path: no namespace
		if (!primaryNs?.uri) {
			return metadata.name;
		}

		// Create cache key (includes form to avoid cross-contamination)
		const prefix = primaryNs.prefix ?? "";
		const cacheKey = `${metadata.name}|${prefix}|${metadata.form ?? ""}`;

		// Check cache
		const cached = elementNameCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		// Build and cache result
		// 'unqualified' suppresses the prefix; undefined or 'qualified' applies it
		let result: string;
		if (prefix && metadata.form !== "unqualified") {
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
	 * Uses the first namespace from the namespaces array as the primary namespace.
	 * When form is 'unqualified', the prefix is suppressed even if a namespace is configured.
	 */
	buildAttributeName(metadata: {
		name: string;
		namespaces?: { prefix?: string; uri: string }[];
		form?: "qualified" | "unqualified";
	}): string {
		// A namespace-qualified attribute is always prefixed — attributes can never
		// use the default namespace in XML. If no prefix is given, one is synthesized.
		const qualification = this.getAttributeNamespaceQualification(metadata);
		if (!qualification) {
			return metadata.name;
		}

		const cacheKey = `${metadata.name}|${qualification.prefix}`;
		const cached = attributeNameCache.get(cacheKey);
		if (cached !== undefined) {
			return cached;
		}

		const result = `${qualification.prefix}:${metadata.name}`;
		attributeNameCache.set(cacheKey, result);
		return result;
	}

	/**
	 * Resolve the namespace qualification for an attribute, or `undefined` when it
	 * carries no namespace or is explicitly unqualified.
	 *
	 * Attributes are never in the default namespace, so a namespaced attribute
	 * without a prefix gets a stable synthesized prefix (mirroring C# XmlSerializer,
	 * which emits `q1`/`d1p1`-style prefixes). The declaration itself is emitted on
	 * the attribute's own element during serialization and deduplicated afterward.
	 */
	getAttributeNamespaceQualification(metadata: {
		namespaces?: { prefix?: string; uri: string }[];
		form?: "qualified" | "unqualified";
	}): { prefix: string; uri: string } | undefined {
		const primaryNs = metadata.namespaces?.[0];
		if (!primaryNs?.uri || metadata.form === "unqualified") {
			return undefined;
		}
		return { prefix: primaryNs.prefix ?? synthesizeAttributePrefix(primaryNs.uri), uri: primaryNs.uri };
	}
}

/**
 * Produce a stable, deterministic XML prefix for a namespace URI that has no
 * declared prefix. Deterministic so that name-building and declaration always
 * agree without shared state. Always a valid NCName (starts with a letter).
 */
function synthesizeAttributePrefix(uri: string): string {
	let hash = 0;
	for (let i = 0; i < uri.length; i++) {
		hash = (Math.imul(hash, 31) + uri.charCodeAt(i)) | 0;
	}
	return `d${(hash >>> 0).toString(36)}`;
}
