/**
 * XML namespace configuration
 */
export interface XmlNamespace {
	/** XML namespace prefix (e.g., 'ns', 'soap') - optional for default namespace */
	prefix?: string;
	/** Namespace URI (e.g., 'http://example.com/namespace') */
	uri: string;
	/** True if this is the default namespace (xmlns="...") */
	isDefault?: boolean;
}

/**
 * XML Schema Instance namespace
 */
export const XSI_NAMESPACE = {
	prefix: "xsi",
	uri: "http://www.w3.org/2001/XMLSchema-instance",
} as const;
