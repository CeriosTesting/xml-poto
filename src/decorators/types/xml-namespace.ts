/**
 * XML namespace configuration
 *
 * @example
 * ```typescript
 * // Default namespace (no prefix) - applies to all unprefixed elements
 * { uri: "http://example.com/default" }
 * // Generates: xmlns="http://example.com/default"
 *
 * // Prefixed namespace - requires prefix on elements
 * { uri: "http://example.com/custom", prefix: "custom" }
 * // Generates: xmlns:custom="http://example.com/custom"
 * // Usage: <custom:Element>
 * ```
 */
export interface XmlNamespace {
	/**
	 * XML namespace prefix (e.g., 'ns', 'soap').
	 *
	 * - If omitted or empty string: treated as **default namespace** (xmlns="...")
	 * - If provided: creates a **prefixed namespace** (xmlns:prefix="...")
	 *
	 * @example
	 * ```typescript
	 * // Default namespace (no prefix needed on elements)
	 * { uri: "http://example.com" }
	 *
	 * // Prefixed namespace (prefix required on elements)
	 * { uri: "http://example.com", prefix: "ex" }
	 * ```
	 */
	prefix?: string;

	/** Namespace URI (e.g., 'http://example.com/namespace') - must be unique */
	uri: string;

	/**
	 * Explicitly mark as default namespace (optional).
	 *
	 * **Note:** This is redundant - omitting `prefix` automatically makes it a default namespace.
	 * Use this only for explicit documentation purposes.
	 *
	 * @deprecated Prefer omitting `prefix` instead of setting `isDefault: true`
	 */
	isDefault?: boolean;
}

/**
 * XML Schema Instance namespace
 */
export const XSI_NAMESPACE = {
	prefix: "xsi",
	uri: "http://www.w3.org/2001/XMLSchema-instance",
} as const;
