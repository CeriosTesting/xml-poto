/* eslint-disable typescript/no-explicit-any -- Fault parsing walks the untyped intermediate tree */
import type { Constructor } from "../decorators/storage/metadata-storage";
import { findElementKey, type NamespaceScope, splitQName } from "../utils/xml-element-lookup";

import type { SoapDialect, SoapVersion } from "./soap-constants";

/**
 * A parsed SOAP fault.
 *
 * The shape is normalised across SOAP 1.1 and 1.2 — `faultCode` holds the 1.1
 * `faultcode` QName or the 1.2 `Code/Value`, and `faultString` the 1.1
 * `faultstring` or the 1.2 `Reason/Text`.
 */
export interface SoapFault {
	/** The SOAP version the fault was written in. */
	version: SoapVersion;
	/** Fault code as a QName string, e.g. `soapenv:Server` or `env:Receiver`. */
	faultCode?: string;
	/** Human-readable explanation. */
	faultString?: string;
	/** `faultactor` (1.1) / `Role` (1.2): who caused the fault. */
	faultActor?: string;
	/**
	 * Application-specific detail. A decoded instance when a matching class was
	 * registered via `faultDetailTypes`, otherwise the raw parsed object.
	 */
	detail?: unknown;
	/** The detail element exactly as parsed, regardless of any decoding. */
	rawDetail?: unknown;
	/** Local name of the detail's first child element, e.g. `gbavFout`. */
	detailName?: string;
}

/**
 * Thrown by `SoapSerializer` when a response body carries a `<Fault>` instead of
 * the expected payload.
 *
 * A fault is a valid SOAP response, but it is never the type the caller asked
 * for — raising it keeps a fault from being silently mistaken for a success.
 *
 * @example
 * ```ts
 * try {
 *   const antwoord = soap.fromXml(response, GbavAntwoord);
 * } catch (error) {
 *   if (error instanceof SoapFaultError) {
 *     error.faultCode;   // 'soapenv:Server'
 *     error.faultString; // 'Onbekende afnemer'
 *     error.detail;      // GbavFout instance when registered
 *   }
 * }
 * ```
 */
export class SoapFaultError extends Error {
	readonly version: SoapVersion;
	readonly faultCode?: string;
	readonly faultString?: string;
	readonly faultActor?: string;
	readonly detail?: unknown;
	readonly rawDetail?: unknown;
	readonly detailName?: string;

	constructor(fault: SoapFault) {
		super(buildMessage(fault));
		this.name = "SoapFaultError";
		this.version = fault.version;
		this.faultCode = fault.faultCode;
		this.faultString = fault.faultString;
		this.faultActor = fault.faultActor;
		this.detail = fault.detail;
		this.rawDetail = fault.rawDetail;
		this.detailName = fault.detailName;

		// Restore the prototype chain so `instanceof` works when the library is
		// consumed as compiled ES5/CommonJS.
		Object.setPrototypeOf(this, SoapFaultError.prototype);
	}

	/** The fault as a plain object. */
	toFault(): SoapFault {
		return {
			version: this.version,
			faultCode: this.faultCode,
			faultString: this.faultString,
			faultActor: this.faultActor,
			detail: this.detail,
			rawDetail: this.rawDetail,
			detailName: this.detailName,
		};
	}
}

function buildMessage(fault: SoapFault): string {
	const parts = [fault.faultCode, fault.faultString].filter(Boolean);
	return parts.length > 0 ? `SOAP fault: ${parts.join(" — ")}` : "SOAP fault received";
}

/** Decodes a fault detail element into a registered class, when one matches. */
export type FaultDetailDecoder = (detailName: string, detailValue: any, scope: NamespaceScope) => unknown;

/**
 * Parse a `<Fault>` element into a normalised {@link SoapFault}.
 *
 * `dialect` decides both the child element names and whether they are namespace-
 * qualified — 1.1 leaves them unqualified, 1.2 puts them in the envelope
 * namespace. Children are located with the same URI-aware lookup used everywhere
 * else, so a peer's choice of prefix is irrelevant.
 */
export function parseSoapFault(
	faultElement: any,
	dialect: SoapDialect,
	scope: NamespaceScope,
	decodeDetail?: FaultDetailDecoder,
): SoapFault {
	const fault: SoapFault = { version: dialect.version };
	if (faultElement === null || typeof faultElement !== "object") {
		return fault;
	}

	// SOAP 1.1 fault children are in no namespace; 1.2 qualifies them.
	const childUri = dialect.faultChildrenQualified ? dialect.namespace : undefined;
	const child = (name: string): any => {
		const key = findElementKey(faultElement, name, childUri, scope);
		return key === undefined ? undefined : faultElement[key];
	};

	fault.faultCode = readFaultCode(child(dialect.faultCode), dialect, scope);
	fault.faultString = readFaultReason(child(dialect.faultReason), dialect, scope);

	const actor = child(dialect.faultActor);
	if (actor !== undefined) fault.faultActor = readText(actor);

	const detail = child(dialect.faultDetail);
	if (detail !== undefined && detail !== null) {
		fault.rawDetail = detail;
		applyDetail(fault, detail, scope, decodeDetail);
	}

	return fault;
}

/**
 * SOAP 1.1 states the code directly as a QName; 1.2 nests it in a `Value` child
 * (which may itself nest a `Subcode`, ignored here — the top-level value is what
 * callers branch on).
 */
function readFaultCode(codeElement: any, dialect: SoapDialect, scope: NamespaceScope): string | undefined {
	if (codeElement === undefined || codeElement === null) return undefined;
	if (!dialect.faultChildrenQualified) return readText(codeElement);

	const valueKey = findElementKey(codeElement, "Value", dialect.namespace, scope);
	return valueKey === undefined ? readText(codeElement) : readText(codeElement[valueKey]);
}

/** SOAP 1.2 wraps the reason in one or more localised `Text` children. */
function readFaultReason(reasonElement: any, dialect: SoapDialect, scope: NamespaceScope): string | undefined {
	if (reasonElement === undefined || reasonElement === null) return undefined;
	if (!dialect.faultChildrenQualified) return readText(reasonElement);

	const textKey = findElementKey(reasonElement, "Text", dialect.namespace, scope);
	if (textKey === undefined) return readText(reasonElement);

	const text = reasonElement[textKey];
	// Multiple xml:lang variants may be present; the first is as good as any.
	return readText(Array.isArray(text) ? text[0] : text);
}

/**
 * Record the detail's first child element, decoded into a registered class when
 * `decodeDetail` recognises it. Falls back to the raw parsed object so no
 * information is lost when no type is registered.
 */
function applyDetail(fault: SoapFault, detail: any, scope: NamespaceScope, decodeDetail?: FaultDetailDecoder): void {
	if (typeof detail !== "object") {
		fault.detail = detail;
		return;
	}

	const childKey = Object.keys(detail).find((key) => !isNonElementKey(key));
	if (childKey === undefined) {
		fault.detail = detail;
		return;
	}

	const { localName } = splitQName(childKey);
	fault.detailName = localName;

	const value = detail[childKey];
	fault.detail = decodeDetail ? (decodeDetail(localName, value, scope) ?? value) : value;
}

function isNonElementKey(key: string): boolean {
	return key.startsWith("@_") || key.startsWith("#") || key.startsWith("?_") || key === "__cdata";
}

/** Read an element's text, tolerating both the bare-value and `{ '#text': … }` shapes. */
function readText(value: any): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "object") {
		const text = value["#text"] ?? value.__cdata;
		return text === undefined ? undefined : String(text);
	}
	return String(value);
}

/** Map of detail element local name → class to deserialize that detail into. */
export type FaultDetailTypes = Record<string, Constructor>;
