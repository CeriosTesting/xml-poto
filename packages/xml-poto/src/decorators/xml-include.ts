/* eslint-disable typescript/no-explicit-any -- Decorators work with dynamic this contexts and runtime values */
import { getMetadata } from "./storage";
import {
	type Constructor,
	enqueueLazyRegistration,
	registerConstructorByName,
	registerTypeByQualifiedName,
} from "./storage/metadata-storage";
import { resolveTypeRef, type TypeRef } from "./storage/type-ref";

/**
 * Register a derived type so that `xsi:type` referencing it resolves to its
 * constructor. Reads the class's own type identity (@XmlType/@XmlRoot/@XmlElement)
 * to derive the schema-qualified name; falls back to the plain class name.
 */
function registerIncludedType(ctor: Constructor): void {
	const metadata = getMetadata(ctor);
	const identity = metadata.root ?? metadata.xmlType ?? metadata.element;
	const localName = identity?.name ?? ctor.name;
	const uri = identity?.namespaces?.[0]?.uri;
	if (uri) registerTypeByQualifiedName(uri, localName, ctor);
	registerConstructorByName(ctor.name, ctor);
}

/**
 * Declares derived types that may substitute for this class during polymorphic
 * (de)serialization, mirroring C# `[XmlInclude(typeof(Derived))]`.
 *
 * When a base-typed property, array item, or document root carries an
 * `xsi:type="prefix:Derived"` attribute, the serializer resolves it to the
 * concrete constructor and deserializes into that subclass. `@XmlInclude` makes
 * each derived type discoverable for this resolution even if the caller never
 * otherwise references it. Pair with `useXsiType: true` on the serializer to emit
 * `xsi:type` when writing.
 *
 * Each included type is registered under its schema-qualified type name
 * (`@XmlType`/`@XmlRoot`/`@XmlElement` namespace + name). Registration is deferred
 * to the first registry lookup, so subclasses declared *after* the base — and
 * `() => Derived` thunks for forward/circular references — resolve correctly.
 *
 * @param types One or more derived-type constructors or `() => Constructor` thunks.
 * @returns A class decorator that registers the included types.
 *
 * @example
 * ```
 * @XmlType({ name: 'Shape', namespace: { uri: 'urn:shapes', prefix: 's' } })
 * @XmlInclude(() => Circle, () => Square)
 * abstract class Shape {}
 *
 * @XmlType({ name: 'Circle', namespace: { uri: 'urn:shapes', prefix: 's' } })
 * class Circle extends Shape { @XmlElement() radius!: number; }
 *
 * // <shape xsi:type="s:Circle"><radius>3</radius></shape> deserializes to a Circle.
 * ```
 */
export function XmlInclude(
	...types: TypeRef[]
): <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>) => T {
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		void context;
		for (const ref of types) {
			// Always defer: the derived class (and its @XmlType metadata) is typically
			// defined after this base class, so its identity is not yet available here.
			enqueueLazyRegistration(() => {
				const ctor = resolveTypeRef(ref);
				if (ctor) registerIncludedType(ctor);
			});
		}
		return target;
	};
}
