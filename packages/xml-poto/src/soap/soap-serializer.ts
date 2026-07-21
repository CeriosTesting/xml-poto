/* eslint-disable typescript/no-explicit-any -- Serializer works with dynamic objects and the untyped intermediate tree */
import type { SerializationOptions } from "../serialization-options";
import {
	EMPTY_NAMESPACE_SCOPE,
	extendNamespaceScope,
	findElementKey,
	getOrCreateDefaultElementMetadata,
	type NamespaceScope,
} from "../utils";
import { XmlDecoratorSerializer } from "../xml-decorator-serializer";

import {
	DEFAULT_SOAP_PREFIX,
	dialectForVersion,
	type SoapDialect,
	SOAP_DIALECTS,
	type SoapVersion,
} from "./soap-constants";
import { type FaultDetailTypes, parseSoapFault, SoapFaultError } from "./soap-fault";

/**
 * A concrete (non-abstract) class reference. Distinct from `Constructor`, which
 * admits abstract classes and so cannot be instantiated during deserialization.
 */
type ConcreteConstructor = new (...args: any[]) => any;

/**
 * Is this a header spec rather than the decorated object itself?
 *
 * Distinguished by the `value` property: a decorated payload class could in
 * principle have one too, so the check also requires that it holds an object,
 * which a scalar member would not.
 */
function isHeaderSpec(entry: object | SoapHeaderSpec): entry is SoapHeaderSpec {
	const candidate = entry as SoapHeaderSpec;
	return (
		"value" in candidate &&
		typeof candidate.value === "object" &&
		candidate.value !== null &&
		("mustUnderstand" in candidate || "actor" in candidate || "relay" in candidate)
	);
}

/** Options for {@link SoapSerializer}, on top of the standard serialization options. */
export interface SoapSerializerOptions extends SerializationOptions {
	/** SOAP version used when writing. Reading auto-detects. Default: `'1.1'`. */
	soapVersion?: SoapVersion;
	/** Namespace prefix bound to the envelope namespace when writing. Default: `'soapenv'`. */
	soapPrefix?: string;
	/**
	 * Classes to deserialize fault details into, keyed by the detail element's
	 * local name. With `{ gbavFout: GbavFout }`, a fault carrying
	 * `<detail><gbavFout>…</gbavFout></detail>` surfaces `error.detail` as a
	 * `GbavFout` instance instead of a raw object.
	 */
	faultDetailTypes?: FaultDetailTypes;
}

/**
 * A header to write, with the SOAP control attributes a peer may require.
 *
 * The attribute names differ between versions — 1.1 says `actor`, 1.2 says `role`
 * — and are resolved from the active dialect, so the same spec works for both.
 */
export interface SoapHeaderSpec {
	/** The decorated object to serialize into the `Header`. */
	value: object;
	/** `mustUnderstand`: the receiver must process this header or fail. */
	mustUnderstand?: boolean;
	/** The intermediary this header is aimed at (`actor` in 1.1, `role` in 1.2). */
	actor?: string;
	/** SOAP 1.2 `relay`: whether an intermediary that ignores it should pass it on. */
	relay?: boolean;
}

/** Per-call options for {@link SoapSerializer.toXml}. */
export interface SoapWriteOptions {
	/**
	 * Decorated objects to write into the SOAP `Header`. Each is serialized with
	 * its own element name and namespace, exactly as it would be as a root.
	 * Omitted entirely when empty, so no empty `<Header/>` is produced.
	 *
	 * Pass a {@link SoapHeaderSpec} instead of a bare object to set `mustUnderstand`,
	 * `actor`/`role` or `relay` on it.
	 */
	headers?: readonly (object | SoapHeaderSpec)[];
}

/** What to read out of an envelope with {@link SoapSerializer.fromEnvelope}. */
export interface SoapReadSpec<TBody extends ConcreteConstructor, THeaders extends readonly ConcreteConstructor[]> {
	/** The class the `Body` payload deserializes into. */
	body: TBody;
	/** Classes to look for in the `Header`. Missing headers come back `undefined`. */
	headers?: THeaders;
}

/** Result of {@link SoapSerializer.fromEnvelope}. */
export interface SoapEnvelopeResult<TBody> {
	body: TBody;
	/** Positionally matches the requested header classes; `undefined` where absent. */
	headers: unknown[];
}

/**
 * A serializer that reads and writes SOAP envelopes, so payload classes stay free
 * of `Envelope`/`Body` wrapper types.
 *
 * `toXml` wraps the payload; `fromXml` unwraps it and raises a
 * {@link SoapFaultError} when the response carries a `<Fault>`. Everything else —
 * decorators, namespaces, validation, all {@link SerializationOptions} — behaves
 * exactly as with {@link XmlDecoratorSerializer}.
 *
 * Reading is deliberately lenient about how the peer spells things: the envelope
 * is matched on its namespace URI, so `soap:`, `soapenv:`, `S:`, `env:` and a
 * default `xmlns=` are all understood, and the SOAP version is detected from that
 * URI rather than assumed.
 *
 * @example
 * ```ts
 * const soap = new SoapSerializer({ faultDetailTypes: { gbavFout: GbavFout } });
 *
 * const request = soap.toXml(vraag);
 * // <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
 * //   <soapenv:Body><tns:gbavVraag …>…</tns:gbavVraag></soapenv:Body>
 * // </soapenv:Envelope>
 *
 * const antwoord = soap.fromXml(response, GbavAntwoord);
 * ```
 */
export class SoapSerializer extends XmlDecoratorSerializer {
	private readonly writeDialect: SoapDialect;
	private readonly soapPrefix: string;
	private readonly faultDetailTypes: FaultDetailTypes;

	/** Headers staged by the current toXml call, consumed by buildDocumentRoot. */
	private pendingHeaders: readonly (object | SoapHeaderSpec)[] = [];

	constructor(options: SoapSerializerOptions = {}) {
		super(options);
		this.writeDialect = dialectForVersion(options.soapVersion ?? "1.1");
		this.soapPrefix = options.soapPrefix ?? DEFAULT_SOAP_PREFIX;
		this.faultDetailTypes = options.faultDetailTypes ?? {};
	}

	/**
	 * Serialize an object into a SOAP envelope.
	 *
	 * @param obj The payload; becomes the sole child of `Body`
	 * @param options Optional per-call extras, notably typed `headers`
	 */
	override toXml<const T extends object>(obj: T, options: SoapWriteOptions = {}): string {
		this.pendingHeaders = options.headers ?? [];
		try {
			return super.toXml(obj);
		} finally {
			this.pendingHeaders = [];
		}
	}

	/**
	 * Deserialize the `Body` payload of a SOAP envelope.
	 *
	 * @throws {SoapFaultError} when the body carries a `<Fault>`
	 * @throws {Error} when the document is not a SOAP envelope
	 */
	override fromXml<const T extends new (...args: any[]) => any>(xmlString: string, targetClass: T): InstanceType<T> {
		return super.fromXml(xmlString, targetClass);
	}

	/**
	 * Deserialize the body *and* selected headers from a SOAP envelope.
	 *
	 * `fromXml` covers the common case of wanting only the body; use this when a
	 * response carries headers you need (WS-Security, correlation ids, …).
	 *
	 * @throws {SoapFaultError} when the body carries a `<Fault>`
	 */
	fromEnvelope<const TBody extends ConcreteConstructor, const THeaders extends readonly ConcreteConstructor[]>(
		xmlString: string,
		spec: SoapReadSpec<TBody, THeaders>,
	): SoapEnvelopeResult<InstanceType<TBody>> {
		const parsed = this.parser.parse(xmlString);
		const envelope = this.locateEnvelope(parsed);
		const headers = this.readHeaders(envelope, spec.headers ?? []);
		const body = this.fromXml(xmlString, spec.body);
		return { body, headers };
	}

	// ── Write side ────────────────────────────────────────────────────────────

	/**
	 * Nest the mapped payload in `Envelope > Body`, with a `Header` in front when
	 * headers were supplied. The envelope namespace is declared on the Envelope
	 * itself; the payload keeps its own declarations, which the inherited dedupe
	 * pass then reconciles against this new root.
	 */
	protected override buildDocumentRoot(
		mappedObj: any,
		rootName: string,
		source: object,
	): { root: any; rootName: string } {
		// The payload's own name and instance are not needed here — mappedObj is
		// already keyed by rootName, and it goes into the Body verbatim.
		void rootName;
		void source;
		const dialect = this.writeDialect;
		const envelopeName = this.qualify(dialect.envelope);
		const envelope: any = { [`@_xmlns:${this.soapPrefix}`]: dialect.namespace };

		const header = this.buildHeader();
		if (header !== undefined) {
			envelope[this.qualify(dialect.header)] = header;
		}
		envelope[this.qualify(dialect.body)] = mappedObj;

		return { root: { [envelopeName]: envelope }, rootName: envelopeName };
	}

	/**
	 * Map each staged header object the same way a root payload is mapped, merging
	 * them into a single `Header` element. Returns undefined when there are none,
	 * so no empty `<Header/>` is emitted.
	 */
	private buildHeader(): any {
		if (this.pendingHeaders.length === 0) return undefined;

		const header: any = {};
		for (const entry of this.pendingHeaders) {
			const spec = isHeaderSpec(entry) ? entry : { value: entry };
			const headerObj = spec.value;
			const metadata = getOrCreateDefaultElementMetadata((headerObj as any).constructor);
			const name = this.namespaceUtil.buildElementName(metadata);
			const mapped = this.mappingUtil.mapFromObject(headerObj, name, metadata);

			// Headers declare their own namespaces, exactly as a root payload does.
			this.namespaceUtil.addNamespaceDeclarations(mapped, name, this.namespaceUtil.collectAllNamespaces(headerObj));
			header[name] = mapped[name];
			this.addHeaderControlAttributes(header[name], spec);
		}
		return header;
	}

	/**
	 * Write `mustUnderstand` / `actor` / `role` / `relay` onto a header element.
	 *
	 * These live in the envelope namespace, so they carry the envelope prefix. SOAP
	 * 1.1 spells `mustUnderstand` as `"1"`/`"0"` and names the target `actor`; 1.2
	 * uses `"true"`/`"false"` and `role`. Both come from the dialect.
	 */
	private addHeaderControlAttributes(headerContent: any, spec: SoapHeaderSpec): void {
		if (typeof headerContent !== "object" || headerContent === null) return;

		const dialect = this.writeDialect;
		const attr = (localName: string): string => `@_${this.qualify(localName)}`;

		if (spec.mustUnderstand !== undefined) {
			headerContent[attr("mustUnderstand")] =
				dialect.version === "1.1" ? (spec.mustUnderstand ? "1" : "0") : String(spec.mustUnderstand);
		}
		if (spec.actor !== undefined) {
			headerContent[attr(dialect.headerActor)] = spec.actor;
		}
		if (spec.relay !== undefined && dialect.version === "1.2") {
			headerContent[attr("relay")] = String(spec.relay);
		}
	}

	private qualify(localName: string): string {
		return this.soapPrefix ? `${this.soapPrefix}:${localName}` : localName;
	}

	// ── Read side ─────────────────────────────────────────────────────────────

	/**
	 * Step from the parsed document through `Envelope > Body`, carrying down the
	 * xmlns declarations each makes. That accumulation is essential: responses
	 * routinely bind the *payload's* prefix on the Envelope, so without it the
	 * payload's prefix would not resolve.
	 *
	 * A `<Fault>` in the body is detected here and raised, before the caller's
	 * expected type is looked for and fails to match.
	 */
	protected override resolveDocumentBody(parsed: any): { node: any; scope: NamespaceScope } {
		const { dialect, envelope, scope: envelopeScope } = this.locateEnvelope(parsed);

		const bodyKey = findElementKey(envelope, dialect.body, dialect.namespace, envelopeScope);
		if (bodyKey === undefined) {
			throw new Error(`SOAP ${dialect.version} Body element not found in envelope`);
		}

		const body = envelope[bodyKey];
		const bodyScope = extendNamespaceScope(envelopeScope, body);

		this.throwIfFault(body, dialect, bodyScope);

		return { node: body ?? {}, scope: bodyScope };
	}

	/**
	 * Find the SOAP Envelope, trying each known version's namespace so the version
	 * is detected from the document rather than assumed from configuration.
	 */
	private locateEnvelope(parsed: any): { dialect: SoapDialect; envelope: any; scope: NamespaceScope } {
		// Prefer the configured version, then any other, so a document that somehow
		// matched both resolves predictably.
		const candidates = [this.writeDialect, ...SOAP_DIALECTS.filter((d) => d !== this.writeDialect)];

		for (const dialect of candidates) {
			const key = findElementKey(parsed, dialect.envelope, dialect.namespace, EMPTY_NAMESPACE_SCOPE);
			if (key === undefined) continue;

			const envelope = parsed[key] ?? {};
			return { dialect, envelope, scope: extendNamespaceScope(EMPTY_NAMESPACE_SCOPE, envelope) };
		}

		throw new Error(
			"No SOAP Envelope found in XML. Expected an element named 'Envelope' in " +
				`'${dialectForVersion("1.1").namespace}' or '${dialectForVersion("1.2").namespace}'.`,
		);
	}

	/** Raise a typed error when the body holds a Fault rather than a payload. */
	private throwIfFault(body: any, dialect: SoapDialect, scope: NamespaceScope): void {
		if (body === null || typeof body !== "object") return;

		const faultKey = findElementKey(body, dialect.fault, dialect.namespace, scope);
		if (faultKey === undefined) return;

		const fault = parseSoapFault(body[faultKey], dialect, scope, (name, value, detailScope) =>
			this.decodeFaultDetail(name, value, detailScope),
		);
		throw new SoapFaultError(fault);
	}

	/** Deserialize a fault detail into its registered class, when one is registered. */
	private decodeFaultDetail(detailName: string, detailValue: any, scope: NamespaceScope): unknown {
		const detailType = this.faultDetailTypes[detailName];
		if (!detailType || detailValue === null || typeof detailValue !== "object") {
			return undefined;
		}
		return this.mappingUtil.mapToObject(detailValue, detailType as new () => object, scope);
	}

	/** Read the requested header classes out of an envelope, positionally. */
	private readHeaders(
		located: { dialect: SoapDialect; envelope: any; scope: NamespaceScope },
		headerTypes: readonly ConcreteConstructor[],
	): unknown[] {
		if (headerTypes.length === 0) return [];

		const { dialect, envelope, scope } = located;
		const headerKey = findElementKey(envelope, dialect.header, dialect.namespace, scope);
		if (headerKey === undefined) return headerTypes.map(() => undefined);

		const header = envelope[headerKey];
		const headerScope = extendNamespaceScope(scope, header);
		if (header === null || typeof header !== "object") return headerTypes.map(() => undefined);

		return headerTypes.map((headerType) => {
			const metadata = getOrCreateDefaultElementMetadata(headerType);
			const name = this.namespaceUtil.buildElementName(metadata);
			const expectedUri = metadata.form === "unqualified" ? undefined : metadata.namespaces?.[0]?.uri;
			const key = findElementKey(header, name, expectedUri, headerScope);
			if (key === undefined) return undefined;

			const value = header[key];
			return this.mappingUtil.mapToObject(
				value === "" ? {} : value,
				headerType,
				extendNamespaceScope(headerScope, value),
			);
		});
	}
}
