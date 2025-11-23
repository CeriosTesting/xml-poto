import {
	getXmlArrayItemMetadata,
	getXmlAttributeMetadata,
	getXmlElementMetadata,
	getXmlFieldElementMetadata,
	getXmlRootMetadata,
	XmlElementMetadata,
	XSI_NAMESPACE,
} from "../decorators";

/**
 * Utility class for handling XML namespace collection and declaration.
 */
export class XmlNamespaceUtil {
	/**
	 * Collect all namespaces used in an object and its decorators.
	 */
	collectAllNamespaces(obj: any): Map<string, string> {
		const namespaces = new Map<string, string>();
		const ctor = obj.constructor;

		// Collect namespace from root/element metadata
		const rootMetadata = getXmlRootMetadata(ctor);
		const elementMetadata = getXmlElementMetadata(ctor);

		const effectiveMetadata = rootMetadata
			? {
					namespace: rootMetadata.namespace,
				}
			: elementMetadata;

		if (effectiveMetadata?.namespace) {
			const ns = effectiveMetadata.namespace;
			if (ns.isDefault) {
				namespaces.set("default", ns.uri);
			} else if (ns.prefix) {
				namespaces.set(ns.prefix, ns.uri);
			}
		}

		// Collect namespaces from attributes
		const attributeMetadata = getXmlAttributeMetadata(ctor);
		Object.values(attributeMetadata).forEach((metadata: any) => {
			if (metadata.namespace?.prefix) {
				namespaces.set(metadata.namespace.prefix, metadata.namespace.uri);
			}
		});

		// Collect namespaces from array items
		const arrayItemMetadata = getXmlArrayItemMetadata(ctor);
		Object.values(arrayItemMetadata).forEach((metadataArray: any) => {
			if (Array.isArray(metadataArray)) {
				metadataArray.forEach((metadata: any) => {
					if (metadata.namespace?.prefix) {
						namespaces.set(metadata.namespace.prefix, metadata.namespace.uri);
					}
				});
			}
		});

		// Collect namespaces from field-level element metadata
		const fieldElementMetadata = getXmlFieldElementMetadata(ctor);
		Object.values(fieldElementMetadata).forEach((metadata: XmlElementMetadata) => {
			if (metadata.namespace) {
				const ns = metadata.namespace;
				if (ns.isDefault) {
					namespaces.set("default", ns.uri);
				} else if (ns.prefix) {
					namespaces.set(ns.prefix, ns.uri);
				}
			}
		});

		// Recursively collect namespaces from nested objects
		this.collectNamespacesFromNestedObjects(obj, namespaces, new WeakSet());

		return namespaces;
	}

	/**
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

		// Collect from this object's metadata
		const attributeMetadata = getXmlAttributeMetadata(ctor);
		Object.values(attributeMetadata).forEach((metadata: any) => {
			if (metadata.namespace?.prefix) {
				namespaces.set(metadata.namespace.prefix, metadata.namespace.uri);
			}
		});

		const fieldElementMetadata = getXmlFieldElementMetadata(ctor);
		Object.values(fieldElementMetadata).forEach((metadata: XmlElementMetadata) => {
			if (metadata.namespace) {
				const ns = metadata.namespace;
				if (ns.isDefault) {
					namespaces.set("default", ns.uri);
				} else if (ns.prefix) {
					namespaces.set(ns.prefix, ns.uri);
				}
			}
		});

		const arrayItemMetadata = getXmlArrayItemMetadata(ctor);
		Object.values(arrayItemMetadata).forEach((metadataArray: any) => {
			if (Array.isArray(metadataArray)) {
				metadataArray.forEach((metadata: any) => {
					if (metadata.namespace?.prefix) {
						namespaces.set(metadata.namespace.prefix, metadata.namespace.uri);
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
	 */
	buildElementName(metadata: XmlElementMetadata): string {
		if (metadata.namespace) {
			// Handle default namespace (no prefix)
			if (metadata.namespace.isDefault || !metadata.namespace.prefix) {
				return metadata.name;
			}
			// Handle prefixed namespace
			if (metadata.namespace.prefix) {
				return `${metadata.namespace.prefix}:${metadata.name}`;
			}
		}
		return metadata.name;
	}

	/**
	 * Build attribute name with namespace prefix.
	 */
	buildAttributeName(metadata: { name: string; namespace?: { prefix?: string; isDefault?: boolean } }): string {
		if (metadata.namespace) {
			// Attributes don't use default namespace, only prefixed
			if (metadata.namespace.prefix && !metadata.namespace.isDefault) {
				return `${metadata.namespace.prefix}:${metadata.name}`;
			}
		}
		return metadata.name;
	}
}
