import { type Constructor, enqueueLazyRegistration } from "./metadata-storage";

/**
 * A runtime type reference for decorator options: either a class constructor,
 * or a zero-argument thunk returning one.
 *
 * Thunks enable forward and circular references. Decorator options are
 * evaluated while the referenced class binding may still be in its temporal
 * dead zone (e.g. a self-recursive type, or two classes referencing each
 * other), so a direct constructor reference would throw at class-definition
 * time. A thunk defers the lookup until (de)serialization:
 *
 * ```
 * @XmlElement({ name: 'Section' })
 * class Section {
 *   @XmlArray({ itemName: 'Section', type: () => Section })
 *   children?: Section[];
 * }
 * ```
 */
export type TypeRef<T = object> = Constructor<T> | (() => Constructor<T>);

/**
 * Distinguish a thunk from a constructor: arrow functions have no `prototype`
 * property, while classes and function declarations always do.
 *
 * Caveat: a bound constructor (`Foo.bind(...)`) also lacks `prototype` and
 * would be misdetected as a thunk — never pass bound constructors as `type`.
 */
export function isTypeThunk<T>(ref: TypeRef<T>): ref is () => Constructor<T> {
	return typeof ref === "function" && !Object.prototype.hasOwnProperty.call(ref, "prototype");
}

/** Resolve a {@link TypeRef} to its constructor (invoking a thunk if needed). */
export function resolveTypeRef<T>(ref: TypeRef<T> | undefined): Constructor<T> | undefined {
	return ref !== undefined && isTypeThunk(ref) ? ref() : ref;
}

/**
 * Run a registration callback with the resolved constructor. Direct
 * constructors register immediately; thunks are deferred to the first registry
 * lookup (they cannot be invoked at decoration time — the referenced class may
 * still be in its temporal dead zone).
 */
export function withResolvedType(ref: TypeRef, register: (ctor: Constructor) => void): void {
	if (isTypeThunk(ref)) {
		enqueueLazyRegistration(() => register(ref()));
	} else {
		register(ref);
	}
}

/**
 * Resolve the `type` of a metadata object and cache the constructor back into
 * it, so subsequent reads (and identity comparisons) see the plain constructor.
 * Safe to call on every read: resolution is a one-time cost per metadata object.
 */
export function resolveMetadataType(meta: { type?: TypeRef } | undefined): Constructor | undefined {
	if (!meta?.type) return undefined;
	if (isTypeThunk(meta.type)) {
		meta.type = meta.type();
	}
	return meta.type as Constructor;
}
