/* eslint-disable typescript/no-explicit-any -- Decorators work with dynamic this contexts and runtime values */
import { getMetadata } from "./storage";
import {
	registerConstructorByName,
	registerElementClass,
	registerTypeByQualifiedName,
} from "./storage/metadata-storage";
import { XmlNamespace, XmlTypeOptions } from "./types";
import { XmlElementMetadata } from "./types/metadata";
import { processPendingAttributes, processPendingFieldElements, processPendingQueryables } from "./xml-root";

/**
 * Decorator that describes a class's XML *type identity* — its schema type
 * name and namespace — mirroring C# `[XmlType]`.
 *
 * Unlike {@link XmlRoot} (which declares the document root element) and the
 * class form of {@link XmlElement} (which declares a wrapper element), `@XmlType`
 * does not create an independent element decision. It supplies the class-level
 * name/namespace as a **fallback**:
 *
 * - When the class is referenced by a property/array, the referencing
 *   `@XmlElement`/`@XmlArray` decides the element name and — if it declares no
 *   namespace of its own — the `@XmlType` namespace qualifies it. This avoids the
 *   "unqualified wrapper around prefixed children" shape and lets the serializer
 *   declare the namespace once at the highest necessary point.
 * - When the class is serialized directly and carries no `@XmlRoot`/`@XmlElement`,
 *   its `@XmlType` name/namespace is used for the root element (matching how C#
 *   `XmlSerializer` derives root defaults from `[XmlType]`).
 *
 * Codegen emits `@XmlType` for XSD complex types (which are type definitions, not
 * global element declarations), reserving `@XmlRoot` for global/root elements.
 *
 * @param options Type identity configuration
 * @returns A class decorator that stores type-identity metadata
 *
 * @example
 * ```
 * @XmlType({ name: 'GbavAntwoord', namespace: { uri: 'http://www.competent.nl/gbav/v1', prefix: 'tns' } })
 * class GbavAntwoord {
 *   @XmlElement({ name: 'identificatie' })
 *   identificatie!: Identificatie;
 * }
 *
 * // Referenced by @XmlElement({ name: 'gbavAntwoord' }) with no namespace, this
 * // serializes to <tns:gbavAntwoord xmlns:tns="...">...</tns:gbavAntwoord>
 * ```
 */
export function XmlType(
	options: XmlTypeOptions = {},
): <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>) => T {
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		const typeName = options.name ?? String(context.name);

		// Combine namespace and namespaces into a single array (first is primary)
		const allNamespaces: XmlNamespace[] = [];
		if (options.namespace) {
			allNamespaces.push(options.namespace);
		}
		if (options.namespaces) {
			allNamespaces.push(...options.namespaces);
		}

		const typeMetadata: XmlElementMetadata = {
			name: typeName,
			namespaces: allNamespaces.length > 0 ? allNamespaces : undefined,
			form: options.form,
			required: false,
		};

		// Store as class-level type-identity metadata (fallback, not a wrapper)
		getMetadata(target).xmlType = typeMetadata;

		// Register for auto-discovery during deserialization, matching class @XmlElement
		const prefix = typeMetadata.namespaces?.[0]?.prefix;
		const fullName = prefix ? `${prefix}:${typeMetadata.name}` : typeMetadata.name;
		registerElementClass(fullName, target);
		registerConstructorByName(target.name, target);

		// Register the schema-qualified type name so xsi:type="prefix:Local" resolves to
		// this class during polymorphic deserialization (keyed by namespace URI).
		const uri = typeMetadata.namespaces?.[0]?.uri;
		if (uri) registerTypeByQualifiedName(uri, typeMetadata.name, target);

		// Flush metadata collected during field decoration
		processPendingAttributes(context, target);
		processPendingFieldElements(context, target);
		processPendingQueryables(context, target, typeName);

		return target;
	};
}
