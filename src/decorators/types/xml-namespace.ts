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
