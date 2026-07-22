/* eslint-disable typescript/no-explicit-any -- Lookup operates on the untyped intermediate tree */

/**
 * Namespace-aware element lookup for deserialization.
 *
 * XML identifies an element by `{namespace-uri, local-name}` — the prefix is only
 * a document-local alias. A service is free to answer with `tns:`, `ns2:`, or a
 * default `xmlns=` and mean exactly the same element. Matching on the literal
 * prefixed string therefore fails against real peers (JAX-WS commonly emits `ns2:`),
 * so these helpers resolve prefixes to URIs and compare on the pair instead.
 */

/**
 * Prefix → namespace URI bindings in scope at a point in the document.
 * The empty-string key holds the default (unprefixed) namespace.
 */
export type NamespaceScope = ReadonlyMap<string, string>;

export const EMPTY_NAMESPACE_SCOPE: NamespaceScope = new Map<string, string>();

/** Keys in the intermediate tree that are not child elements. */
function isNonElementKey(key: string): boolean {
	return key.startsWith("@_") || key.startsWith("#") || key.startsWith("?_") || key === "__cdata";
}

/** Split `prefix:local` into its parts; an unprefixed name yields an empty prefix. */
export function splitQName(name: string): { prefix: string; localName: string } {
	const colonIndex = name.indexOf(":");
	if (colonIndex <= 0) {
		return { prefix: "", localName: name };
	}
	return { prefix: name.slice(0, colonIndex), localName: name.slice(colonIndex + 1) };
}

/**
 * Extend `scope` with the xmlns declarations carried by one element of the
 * intermediate tree (`@_xmlns` / `@_xmlns:prefix`). Returns `scope` unchanged when
 * the element declares none, so the common case allocates nothing. An omitted
 * scope starts empty, which is what the document root inherits.
 */
export function extendNamespaceScope(scope: NamespaceScope | undefined, element: any): NamespaceScope {
	scope ??= EMPTY_NAMESPACE_SCOPE;
	if (element === null || typeof element !== "object") return scope;

	let extended: Map<string, string> | undefined;
	for (const key of Object.keys(element)) {
		let prefix: string | undefined;
		if (key === "@_xmlns") prefix = "";
		else if (key.startsWith("@_xmlns:")) prefix = key.slice("@_xmlns:".length);
		else continue;

		const uri = element[key];
		if (typeof uri !== "string") continue;
		extended ??= new Map(scope);
		extended.set(prefix, uri);
	}

	return extended ?? scope;
}

/**
 * Resolve the namespace URI that `name` is qualified with under `scope`, or
 * `undefined` when its prefix has no binding (or it is unprefixed with no default
 * namespace in scope).
 */
export function resolveNamespaceUri(name: string, scope: NamespaceScope): string | undefined {
	return scope.get(splitQName(name).prefix);
}

/**
 * Find the key in `data` that denotes the element described by `metadata`, or
 * `undefined` when no child matches.
 *
 * `expectedName` is the fully built element name (prefix included when the member
 * is qualified) and is tried verbatim first, so documents that already agree with
 * our own spelling take a plain property lookup and behave exactly as before.
 *
 * Otherwise candidates are compared on local name, and — when the member declares
 * a namespace — on resolved URI. A candidate whose prefix has no binding in scope
 * is accepted rather than dropped: an undeclared prefix is malformed XML, and
 * silently discarding the value is worse than reading it.
 */
export function findElementKey(
	data: any,
	expectedName: string,
	expectedUri: string | undefined,
	scope: NamespaceScope,
): string | undefined {
	if (data === null || typeof data !== "object") return undefined;

	// Fast path: the document spells the element exactly as we do.
	if (data[expectedName] !== undefined) return expectedName;

	const expectedLocalName = splitQName(expectedName).localName;

	for (const key of Object.keys(data)) {
		if (isNonElementKey(key)) continue;
		if (splitQName(key).localName !== expectedLocalName) continue;

		if (expectedUri === undefined) return key;

		// The element's own declarations are in scope for its own name.
		const candidateScope = extendNamespaceScope(scope, data[key]);
		const actualUri = resolveNamespaceUri(key, candidateScope);
		if (actualUri === undefined || actualUri === expectedUri) return key;
	}

	return undefined;
}
