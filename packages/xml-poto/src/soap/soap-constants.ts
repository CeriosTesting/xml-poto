/**
 * SOAP envelope namespaces and the element names that live in them.
 *
 * The two SOAP versions differ in more than the namespace URI: 1.2 renamed the
 * fault children and moved them *into* the envelope namespace, where 1.1 leaves
 * them unqualified. Everything version-dependent is described here so the
 * serializer and fault parser stay declarative.
 */

/** SOAP protocol version. */
export type SoapVersion = "1.1" | "1.2";

/** SOAP 1.1 envelope namespace (`http://schemas.xmlsoap.org/soap/envelope/`). */
export const SOAP_1_1_NAMESPACE = "http://schemas.xmlsoap.org/soap/envelope/";

/** SOAP 1.2 envelope namespace (`http://www.w3.org/2003/05/soap-envelope`). */
export const SOAP_1_2_NAMESPACE = "http://www.w3.org/2003/05/soap-envelope";

/** The default prefix bound to the envelope namespace when writing. */
export const DEFAULT_SOAP_PREFIX = "soapenv";

/**
 * The version-specific vocabulary of a SOAP envelope.
 *
 * `faultChildrenQualified` captures the trap that catches most hand-rolled
 * implementations: in SOAP 1.1 `faultcode`/`faultstring`/`detail` are in **no
 * namespace**, while their 1.2 counterparts are qualified with the envelope
 * namespace.
 */
export interface SoapDialect {
	readonly version: SoapVersion;
	readonly namespace: string;
	readonly envelope: "Envelope";
	readonly header: "Header";
	readonly body: "Body";
	readonly fault: "Fault";
	/** Whether the Fault's own children carry the envelope namespace. */
	readonly faultChildrenQualified: boolean;
	/** Element holding the fault code — a QName string in 1.1, a `Value` wrapper in 1.2. */
	readonly faultCode: string;
	/** Element holding the human-readable reason. */
	readonly faultReason: string;
	/** Element holding application-specific detail. */
	readonly faultDetail: string;
	/** Who caused the fault: `faultactor` in 1.1, `Role` in 1.2. */
	readonly faultActor: string;
	/** Header attribute naming the intermediary a header targets: `actor` in 1.1, `role` in 1.2. */
	readonly headerActor: string;
}

const SOAP_1_1: SoapDialect = {
	version: "1.1",
	namespace: SOAP_1_1_NAMESPACE,
	envelope: "Envelope",
	header: "Header",
	body: "Body",
	fault: "Fault",
	faultChildrenQualified: false,
	faultCode: "faultcode",
	faultReason: "faultstring",
	faultDetail: "detail",
	faultActor: "faultactor",
	headerActor: "actor",
};

const SOAP_1_2: SoapDialect = {
	version: "1.2",
	namespace: SOAP_1_2_NAMESPACE,
	envelope: "Envelope",
	header: "Header",
	body: "Body",
	fault: "Fault",
	faultChildrenQualified: true,
	faultCode: "Code",
	faultReason: "Reason",
	faultDetail: "Detail",
	faultActor: "Role",
	headerActor: "role",
};

/** Look up the dialect for a SOAP version. */
export function dialectForVersion(version: SoapVersion): SoapDialect {
	return version === "1.2" ? SOAP_1_2 : SOAP_1_1;
}

/**
 * Identify the SOAP version a namespace URI denotes, or `undefined` when the URI
 * is not a SOAP envelope namespace. Used to auto-detect the version while
 * reading, so a 1.2 response parses on a 1.1-configured serializer.
 */
export function dialectForNamespace(uri: string | undefined): SoapDialect | undefined {
	if (uri === SOAP_1_1_NAMESPACE) return SOAP_1_1;
	if (uri === SOAP_1_2_NAMESPACE) return SOAP_1_2;
	return undefined;
}

/** Every dialect, for callers that must try each in turn (e.g. locating an Envelope). */
export const SOAP_DIALECTS: readonly SoapDialect[] = [SOAP_1_1, SOAP_1_2];
