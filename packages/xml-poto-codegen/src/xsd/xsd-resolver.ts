import type { BigIntegerAs, ElementForm } from "../config/config-types";

import { translateXsdPattern } from "./xsd-pattern";
import type {
	XsdAll,
	XsdAny,
	XsdAttribute,
	XsdAttributeGroupRef,
	XsdChoice,
	XsdComplexType,
	XsdElement,
	XsdGroupRef,
	XsdSchema,
	XsdSequence,
	XsdSimpleType,
} from "./xsd-types";

// ── Resolved Model Types ──
// These represent the fully resolved output from the XSD resolver,
// ready for consumption by the code generator.

export interface ResolvedSchema {
	targetNamespace?: string;
	elementFormDefault?: "qualified" | "unqualified";
	namespaces: Map<string, string>;
	types: ResolvedType[];
	enums: ResolvedEnum[];
	/** Top-level elements that reference named types (root element candidates) */
	rootElements: ResolvedRootElement[];
	/** Notes about XSD constructs that are not (fully) represented in generated code */
	coverageNotes?: string[];
}

export interface ResolvedRootElement {
	name: string;
	typeName: string;
	nillable?: boolean;
}

export interface ResolvedType {
	/** Class name (PascalCase) */
	className: string;
	/** Original XML element/type name */
	xmlName: string;
	/** Properties of this type */
	properties: ResolvedProperty[];
	/** Base type name if this type extends another */
	baseTypeName?: string;
	/**
	 * Class names of types that directly extend this one (via xs:extension).
	 * Emitted as `@XmlInclude(() => Derived)` so xsi:type resolves to the subtype.
	 */
	derivedTypeNames?: string[];
	/** Whether this is a root element (gets @XmlRoot instead of @XmlElement) */
	isRootElement: boolean;
	/**
	 * Whether the complexType was declared inline on an element rather than named at
	 * the top level. Such a type has no schema type identity, so its `@XmlType` is
	 * emitted with `anonymous: true` and stays out of the runtime's name registries.
	 */
	isAnonymousType?: boolean;
	/** mixed content model */
	mixed?: boolean;
	/** Namespace info */
	namespace?: { uri: string; prefix?: string };
	/** Whether abstract (cannot be instantiated directly) */
	abstract?: boolean;
	/** Has simpleContent (text value + attributes) */
	hasSimpleContent?: boolean;
	/** Root-level nillable flag when promoted from top-level element reference */
	rootNillable?: boolean;
	/** Namespace form (qualified/unqualified) */
	form?: "qualified" | "unqualified";
	/** xs:documentation text, emitted as JSDoc */
	documentation?: string;
}

export type PropertyKind = "element" | "attribute" | "text" | "array" | "dynamic";

/** One alternative of a repeating compositor, generated as an `@XmlArray` item. */
export interface ResolvedArrayItem {
	/** The element name this alternative matches */
	xmlName: string;
	/** TypeScript type of a value read from it */
	tsType: string;
	/** Generated class name, for a complex-typed alternative */
	complexTypeName?: string;
	/** XSD data type, for a scalar alternative */
	dataType?: string;
	/** Namespace the element is qualified with, when it is */
	namespace?: { uri: string; prefix?: string };
}

export interface ResolvedProperty {
	/** TypeScript property name (camelCase) */
	propertyName: string;
	/** Original XML name */
	xmlName: string;
	/** Kind of decorator to apply */
	kind: PropertyKind;
	/** TypeScript type string */
	tsType: string;
	/** Default initializer expression */
	initializer: string;
	/** Whether required (minOccurs > 0 or use="required") */
	required?: boolean;
	/** Element order in sequence */
	order?: number;
	/** Whether nullable (xsi:nil) */
	isNullable?: boolean;
	/** Form qualification */
	form?: "qualified" | "unqualified";
	/** Default value from XSD */
	defaultValue?: string;
	/** For arrays: the item element name */
	arrayItemName?: string;
	/** For arrays: wrapper container name */
	arrayContainerName?: string;
	/** For arrays: the item type class name (if complex type) */
	arrayItemType?: string;
	/**
	 * For a repeating compositor: the alternatives this one collection holds, in
	 * declaration order. Emitted as `@XmlArray({ items })`, which keeps the document
	 * order of differently named siblings.
	 */
	arrayItems?: ResolvedArrayItem[];
	/** For elements/arrays referencing a complex type: the class name */
	complexTypeName?: string;
	/**
	 * Whether the referenced complex type is abstract. Such a type is generated as
	 * an `abstract class`, so the property cannot be initialized with `new Type()`.
	 */
	isAbstractType?: boolean;
	/** Enum values restriction */
	enumValues?: string[];
	/** Pattern restriction */
	pattern?: string;
	/** Referenced enum type name */
	enumTypeName?: string;
	/** Namespace for this property */
	namespace?: { uri: string; prefix?: string };
	/** XSD dataType (e.g. 'xs:dateTime') */
	dataType?: string;
	/** XSD fixed value constraint */
	fixedValue?: string;
	/** XSD restriction facets, emitted as decorator validation options */
	length?: number;
	minLength?: number;
	maxLength?: number;
	minInclusive?: number;
	maxInclusive?: number;
	minExclusive?: number;
	maxExclusive?: number;
	totalDigits?: number;
	fractionDigits?: number;
	whiteSpace?: "preserve" | "replace" | "collapse";
	/** xs:documentation text, emitted as JSDoc */
	documentation?: string;
	/** Collects the interleaved text runs of a mixed complex type (`@XmlText({ mixed: true })`) */
	isMixedText?: boolean;
	/** xs:list — value is a space-separated list serialized in a single element/attribute */
	isList?: boolean;
	/** Item type for xs:list values */
	listItemType?: "string" | "number" | "boolean";
	/** xs:choice group name shared by all direct members of the same choice */
	choiceGroup?: string;
	/** Whether at least one member of the choice group must be present */
	choiceRequired?: boolean;
	/** For arrays: minimum item count (xs:minOccurs > 1) */
	minOccursCount?: number;
	/** For arrays: maximum item count (finite xs:maxOccurs) */
	maxOccursCount?: number;
}

export interface ResolvedEnum {
	/** TypeScript enum name (PascalCase) */
	name: string;
	/** Original XSD type name */
	xmlName: string;
	/** Enum values */
	values: string[];
	/** Base restriction type */
	baseType: string;
	/** xs:documentation text, emitted as JSDoc */
	documentation?: string;
}

/** Type information resolved from an XSD type reference or inline simpleType */
export interface ResolvedTypeInfo {
	tsType: string;
	initializer: string;
	complexTypeName?: string;
	/** Whether the referenced complex type is generated as an `abstract class` */
	isAbstractType?: boolean;
	enumTypeName?: string;
	enumValues?: string[];
	pattern?: string;
	dataType?: string;
	length?: number;
	minLength?: number;
	maxLength?: number;
	minInclusive?: number;
	maxInclusive?: number;
	minExclusive?: number;
	maxExclusive?: number;
	totalDigits?: number;
	fractionDigits?: number;
	whiteSpace?: "preserve" | "replace" | "collapse";
	documentation?: string;
	isList?: boolean;
	listItemType?: "string" | "number" | "boolean";
}

// ── XSD Built-in Type Mapping ──

/**
 * XSD built-ins that are themselves lists — their value space is a space-separated
 * sequence of items, so they generate as arrays with the `list` decorator option
 * rather than as a single string.
 */
const XSD_LIST_TYPES = new Set(["IDREFS", "NMTOKENS", "ENTITIES"]);

const XSD_TYPE_MAP: Record<string, { tsType: string; initializer: string; dataType?: string }> = {
	string: { tsType: "string", initializer: "''" },
	normalizedString: { tsType: "string", initializer: "''" },
	token: { tsType: "string", initializer: "''" },
	language: { tsType: "string", initializer: "''" },
	Name: { tsType: "string", initializer: "''" },
	NCName: { tsType: "string", initializer: "''" },
	NMTOKEN: { tsType: "string", initializer: "''" },
	ID: { tsType: "string", initializer: "''" },
	IDREF: { tsType: "string", initializer: "''" },
	ENTITY: { tsType: "string", initializer: "''" },
	NOTATION: { tsType: "string", initializer: "''" },
	anyURI: { tsType: "string", initializer: "''" },
	QName: { tsType: "string", initializer: "''" },
	// Numeric and boolean types carry an explicit dataType so the serializer coerces
	// the parsed value back to the declared TypeScript type. Without it an attribute
	// deserializes as a string — and `"false"` is truthy, so the mistake is silent.
	// Elements need it too: the parser leaves `<amount>007</amount>` as the string
	// "007" because it is not a canonical number.
	integer: { tsType: "number", initializer: "0", dataType: "xs:integer" },
	int: { tsType: "number", initializer: "0", dataType: "xs:int" },
	long: { tsType: "number", initializer: "0", dataType: "xs:long" },
	short: { tsType: "number", initializer: "0", dataType: "xs:short" },
	byte: { tsType: "number", initializer: "0", dataType: "xs:byte" },
	nonNegativeInteger: { tsType: "number", initializer: "0", dataType: "xs:nonNegativeInteger" },
	nonPositiveInteger: { tsType: "number", initializer: "0", dataType: "xs:nonPositiveInteger" },
	positiveInteger: { tsType: "number", initializer: "0", dataType: "xs:positiveInteger" },
	negativeInteger: { tsType: "number", initializer: "0", dataType: "xs:negativeInteger" },
	unsignedInt: { tsType: "number", initializer: "0", dataType: "xs:unsignedInt" },
	unsignedLong: { tsType: "number", initializer: "0", dataType: "xs:unsignedLong" },
	unsignedShort: { tsType: "number", initializer: "0", dataType: "xs:unsignedShort" },
	unsignedByte: { tsType: "number", initializer: "0", dataType: "xs:unsignedByte" },
	decimal: { tsType: "number", initializer: "0", dataType: "xs:decimal" },
	float: { tsType: "number", initializer: "0", dataType: "xs:float" },
	double: { tsType: "number", initializer: "0", dataType: "xs:double" },
	boolean: { tsType: "boolean", initializer: "false", dataType: "xs:boolean" },
	dateTime: {
		tsType: "string",
		initializer: "''",
		dataType: "xs:dateTime",
	},
	date: { tsType: "string", initializer: "''", dataType: "xs:date" },
	time: { tsType: "string", initializer: "''", dataType: "xs:time" },
	duration: { tsType: "string", initializer: "''" },
	gYear: { tsType: "string", initializer: "''" },
	gMonth: { tsType: "string", initializer: "''" },
	gDay: { tsType: "string", initializer: "''" },
	gYearMonth: { tsType: "string", initializer: "''" },
	gMonthDay: { tsType: "string", initializer: "''" },
	base64Binary: { tsType: "string", initializer: "''" },
	hexBinary: { tsType: "string", initializer: "''" },
	anyType: { tsType: "unknown", initializer: "undefined" },
	anySimpleType: { tsType: "string", initializer: "''" },
};

/**
 * Resolves an XsdSchema into a set of ResolvedTypes and ResolvedEnums,
 * ready for code generation.
 */
export interface XsdResolverOptions {
	/**
	 * Overrides the schema's elementFormDefault for local elements. `'schema'` (the
	 * default) honours whatever the XSD declares, which itself defaults to
	 * `unqualified` when absent.
	 */
	elementForm?: ElementForm;
	/**
	 * How integer types too wide for a JavaScript number are generated. Defaults to
	 * `'number'`, which is ergonomic but silently loses precision above 2^53.
	 */
	bigIntegerAs?: BigIntegerAs;
}

/**
 * A named model group together with which compositor it is. Tagged rather than
 * discriminated by shape, because xs:sequence and xs:choice carry the same field
 * names once both can hold `xs:any` wildcards.
 */
type TaggedCompositor =
	| { kind: "sequence"; compositor: XsdSequence }
	| { kind: "choice"; compositor: XsdChoice }
	| { kind: "all"; compositor: XsdAll };

/**
 * An attribute group flattened over the groups it references: every attribute it
 * contributes, plus whether any of them — at any depth — declares an
 * `xs:anyAttribute` wildcard, which a referencing type must emit as its own.
 */
interface ResolvedAttributeGroup {
	attributes: XsdAttribute[];
	anyAttribute?: boolean;
}

/**
 * Second-choice class name for an anonymous type whose preferred one is taken,
 * plus the element it was declared on so the coverage note can name it (see
 * claimClassName).
 */
interface AnonymousNameFallback {
	className: string;
	elementName: string;
}

/** Decimal digits a JavaScript number represents exactly (Number.MAX_SAFE_INTEGER has 16). */
const SAFE_INTEGER_DIGITS = 15;

/** Bound to the `xml` prefix by the XML spec itself; schemas never declare it. */
const XML_NAMESPACE_URI = "http://www.w3.org/XML/1998/namespace";

/** Integer types whose XSD value space exceeds Number.MAX_SAFE_INTEGER. */
const UNBOUNDED_INTEGER_TYPES = new Set([
	"integer",
	"long",
	"nonNegativeInteger",
	"nonPositiveInteger",
	"positiveInteger",
	"negativeInteger",
	"unsignedLong",
]);

export class XsdResolver {
	private readonly elementForm: ElementForm;
	private readonly bigIntegerAs: BigIntegerAs;
	private schema!: XsdSchema;

	constructor(options: XsdResolverOptions = {}) {
		this.elementForm = options.elementForm ?? "schema";
		this.bigIntegerAs = options.bigIntegerAs ?? "number";
	}

	private complexTypeMap = new Map<string, XsdComplexType>();
	private simpleTypeMap = new Map<string, XsdSimpleType>();
	private groupMap = new Map<string, TaggedCompositor>();
	private attributeGroupMap = new Map<string, ResolvedAttributeGroup>();
	/** Global (top-level) element declarations, the targets of `xs:element ref="…"` */
	private globalElementMap = new Map<string, XsdElement>();
	/** Global (top-level) attribute declarations, the targets of `xs:attribute ref="…"` */
	private globalAttributeMap = new Map<string, XsdAttribute>();
	/** Class name assigned to each complex type, by identity (see claimClassName) */
	private classNameByType = new Map<XsdComplexType, string>();
	/** Every class name handed out so far, so a collision can be detected */
	private takenClassNames = new Set<string>();
	/** Names an xs:redefine pair shares, where a duplicate is intentional */
	private redefinedClassNames = new Set<string>();
	private resolvedTypeMap = new Map<string, ResolvedType>();
	/** Maps head element name → list of substitute element names */
	private substitutionMap = new Map<string, string[]>();
	/** Notes about constructs not (fully) represented in generated code */
	private coverageNotes: string[] = [];
	/** Counter for unique xs:choice group names across the schema */
	private choiceCounter = 0;
	/**
	 * The namespace/forms in effect for the type currently being resolved. Defaults
	 * to the main schema's values, but is scoped to a type's own source schema while
	 * resolving an imported type (see XsdComplexType.sourceNamespace), so that type
	 * and its members are qualified with their own namespace.
	 */
	private activeTargetNamespace?: string;
	private activeElementFormDefault?: "qualified" | "unqualified";
	private activeAttributeFormDefault?: "qualified" | "unqualified";
	/**
	 * Class name of the type currently being resolved, so an anonymous type declared
	 * on one of its elements can be named after where it lives when its own preferred
	 * name is taken (see resolveElementTypeInfo). Scoped like the namespace fields
	 * above, which keeps it correct for an anonymous type nested inside another.
	 */
	private activeOwnerClassName?: string;

	resolve(schema: XsdSchema): ResolvedSchema {
		this.schema = schema;
		this.resolvedTypeMap.clear();
		// Reset before buildLookups: claiming class names there can already report a
		// collision, and those notes must survive.
		this.coverageNotes = [];
		this.buildLookups();
		this.choiceCounter = 0;
		this.activeTargetNamespace = schema.targetNamespace;
		this.activeElementFormDefault = schema.elementFormDefault;
		this.activeAttributeFormDefault = schema.attributeFormDefault;

		const resolved: ResolvedSchema = {
			targetNamespace: schema.targetNamespace,
			// The *effective* form, so downstream generation sees the same decision the
			// property decorators were built from (see resolveElementForm).
			elementFormDefault: this.resolveElementForm(),
			namespaces: schema.namespaces,
			types: [],
			enums: [],
			rootElements: [],
			coverageNotes: [],
		};

		for (const notation of schema.notations) {
			this.coverageNotes.push(`xs:notation '${notation}' is not represented in generated code.`);
		}

		// Resolve enums first (simpleTypes with enumerations)
		for (const st of schema.simpleTypes) {
			if (st.name && st.restriction && st.restriction.enumerations.length > 0) {
				resolved.enums.push({
					name: toPascalCase(st.name),
					xmlName: st.name,
					values: st.restriction.enumerations,
					baseType: stripPrefix(st.restriction.base),
					documentation: st.documentation,
				});
			}
		}

		// Resolve named complex types, each under the class name claimed for it in
		// buildLookups (which differs from the type's own name only on a collision).
		for (const ct of schema.complexTypes) {
			if (ct.name) {
				this.addResolvedType(this.resolveComplexType(ct, ct.name, false, this.classNameByType.get(ct)));
			}
		}

		// Resolve top-level elements
		for (const el of schema.elements) {
			this.noteIdentityConstraints(el);
			if (el.complexType) {
				// Element with inline complex type → root class
				const rootType = this.resolveComplexType(
					el.complexType,
					el.name,
					true,
					this.claimClassName(toPascalCase(el.name), el.complexType),
				);
				rootType.documentation = el.documentation ?? rootType.documentation;
				this.addResolvedType(rootType);
			} else if (el.type) {
				const localType = stripPrefix(el.type);
				// Reference to a named complex type → mark as root element
				if (this.complexTypeMap.has(localType)) {
					resolved.rootElements.push({
						name: el.name,
						typeName: toPascalCase(localType),
						nillable: el.nillable,
					});
				} else {
					// Element with simple type at root level — create a wrapper class
					this.addResolvedType(this.resolveSimpleRootElement(el));
				}
			} else if (el.simpleType) {
				this.addResolvedType(this.resolveSimpleRootElement(el));
			}
		}

		resolved.types = [...this.resolvedTypeMap.values()];
		for (const type of resolved.types) {
			this.dedupeProperties(type);
		}
		this.linkDerivedTypes(resolved.types);
		resolved.coverageNotes = [...new Set(this.coverageNotes)];

		return resolved;
	}

	/**
	 * Invert the `baseTypeName` links so each base lists the class names of the
	 * types that directly extend it. Codegen emits these as `@XmlInclude(() => Derived)`
	 * so an xsi:type naming a subtype resolves during polymorphic deserialization.
	 */
	private linkDerivedTypes(types: ResolvedType[]): void {
		const byClassName = new Map(types.map((t) => [t.className, t]));
		for (const type of types) {
			if (!type.baseTypeName) continue;
			const base = byClassName.get(type.baseTypeName);
			if (!base) continue;
			(base.derivedTypeNames ??= []).push(type.className);
		}
	}

	/**
	 * Merge duplicate properties within a type. Duplicates arise when the same
	 * element appears in multiple xs:choice branches (e.g. a choice between two
	 * sequences that both contain the element). One class property represents
	 * all occurrences; it is only required when every occurrence is required.
	 */
	private dedupeProperties(type: ResolvedType): void {
		const seen = new Map<string, ResolvedProperty>();
		const deduped: ResolvedProperty[] = [];
		for (const prop of type.properties) {
			const existing = seen.get(prop.propertyName);
			if (!existing) {
				seen.set(prop.propertyName, prop);
				deduped.push(prop);
				continue;
			}
			if (prop.required !== true) {
				existing.required = false;
			}
		}
		type.properties = deduped;
	}

	private noteIdentityConstraints(el: XsdElement): void {
		for (const constraint of el.identityConstraints ?? []) {
			this.coverageNotes.push(
				`Identity constraint '${constraint.name}' (xs:${constraint.kind}) on element '${el.name}' is not enforced by generated code.`,
			);
		}
	}

	private addResolvedType(type: ResolvedType): void {
		if (!this.resolvedTypeMap.has(type.className)) {
			this.resolvedTypeMap.set(type.className, type);
		}
	}

	private buildLookups(): void {
		this.complexTypeMap.clear();
		this.simpleTypeMap.clear();
		this.groupMap.clear();
		this.attributeGroupMap.clear();
		this.globalElementMap.clear();
		this.globalAttributeMap.clear();
		this.classNameByType.clear();
		this.takenClassNames.clear();
		this.redefinedClassNames.clear();
		this.substitutionMap.clear();

		this.buildTypeLookups();
		this.buildGlobalDeclarationLookups();
		this.buildGroupLookups();
		this.buildAttributeGroupLookups();
		this.buildSubstitutionLookups();
	}

	private buildTypeLookups(): void {
		for (const ct of this.schema.complexTypes) {
			if (ct.name) this.complexTypeMap.set(ct.name, ct);
		}
		for (const st of this.schema.simpleTypes) {
			if (st.name) this.simpleTypeMap.set(st.name, st);
		}

		// Claim every named type's class name up front, so a reference resolved while
		// an earlier type is still being walked sees the same name the class will
		// eventually be generated under.
		for (const ct of this.schema.complexTypes) {
			if (ct.name) this.claimClassName(toPascalCase(ct.name), ct);
		}
	}

	/**
	 * Reserve the TypeScript class name for a complex type, keeping distinct types
	 * distinct.
	 *
	 * Two schemas merged from different target namespaces may each define a type
	 * with the same local name — routine after a WSDL merges its `<types>` schemas —
	 * and two elements in different parents may each carry an inline complexType of
	 * the same name. Both used to collapse onto one class, silently giving every
	 * reference to the second the content model of the first. Colliding names are
	 * now disambiguated and reported instead.
	 *
	 * `fallback` is a second choice to try before resorting to a numeric suffix. An
	 * anonymous type passes the name of where it was declared (see
	 * resolveElementTypeInfo), which says far more than a trailing '2'; a named type
	 * has no such context and passes nothing.
	 *
	 * Claims are keyed by object identity, so asking twice for the same type is
	 * idempotent.
	 */
	private claimClassName(preferred: string, ct: XsdComplexType, fallback?: AnonymousNameFallback): string {
		const existing = this.classNameByType.get(ct);
		if (existing) return existing;

		if (ct.isRedefinition) this.redefinedClassNames.add(preferred);

		if (!this.takenClassNames.has(preferred)) {
			this.takenClassNames.add(preferred);
			this.classNameByType.set(ct, preferred);
			return preferred;
		}

		if (this.redefinedClassNames.has(preferred)) {
			// An xs:redefine restates a type under its existing name on purpose, so
			// both halves of the pair share one class: whichever was claimed first
			// keeps it (redefinition overrides are not applied — the parser already
			// warns about that). Splitting them would be noise, not disambiguation.
			this.classNameByType.set(ct, preferred);
			return preferred;
		}

		if (fallback && fallback.className !== preferred && !this.takenClassNames.has(fallback.className)) {
			this.coverageNotes.push(
				`The inline complexType on element '${fallback.elementName}' maps to the class name ` +
					`'${preferred}', already used by another complex type; it was generated as ` +
					`'${fallback.className}', after the type that declares it. Being anonymous, it is not ` +
					`referenced by name anywhere.`,
			);

			this.takenClassNames.add(fallback.className);
			this.classNameByType.set(ct, fallback.className);
			return fallback.className;
		}

		const base = fallback?.className ?? preferred;
		let suffix = 2;
		while (this.takenClassNames.has(`${base}${suffix}`)) suffix++;
		const claimed = `${base}${suffix}`;

		this.coverageNotes.push(
			`Two distinct complex types both map to the class name '${preferred}'` +
				`${ct.sourceNamespace ? ` (one from namespace '${ct.sourceNamespace}')` : ""}; ` +
				`the second was generated as '${claimed}'. References by that local name resolve to '${preferred}'.`,
		);

		this.takenClassNames.add(claimed);
		this.classNameByType.set(ct, claimed);
		return claimed;
	}

	/**
	 * Index the schema's top-level element and attribute declarations so that
	 * `ref="…"` can be resolved to the declaration it names.
	 */
	private buildGlobalDeclarationLookups(): void {
		for (const el of this.schema.elements) {
			if (el.name) this.globalElementMap.set(el.name, el);
		}
		for (const a of this.schema.attributes) {
			if (a.name) this.globalAttributeMap.set(a.name, a);
		}
	}

	private buildGroupLookups(): void {
		for (const g of this.schema.groups) {
			if (!g.name) continue;
			// Tag the compositor with its kind rather than sniffing its shape later:
			// xs:sequence and xs:choice now carry the same field names.
			if (g.sequence) this.groupMap.set(g.name, { kind: "sequence", compositor: g.sequence });
			else if (g.choice) this.groupMap.set(g.name, { kind: "choice", compositor: g.choice });
			else if (g.all) this.groupMap.set(g.name, { kind: "all", compositor: g.all });
		}
	}

	private buildAttributeGroupLookups(): void {
		// Index all attribute group definitions by name first so that
		// references can be resolved regardless of declaration order.
		const groupDefs = new Map<string, (typeof this.schema.attributeGroups)[number]>();
		for (const ag of this.schema.attributeGroups) {
			if (ag.name) {
				groupDefs.set(ag.name, ag);
			}
		}

		const resolving = new Set<string>();

		const resolveGroup = (name: string): ResolvedAttributeGroup => {
			// Return cached result if already resolved.
			const cached = this.attributeGroupMap.get(name);
			if (cached) return cached;

			const def = groupDefs.get(name);
			if (!def) {
				// Unknown group; nothing to contribute.
				return { attributes: [] };
			}

			// Cycle detection: if we encounter the same name while resolving,
			// break the cycle and do not recurse further.
			if (resolving.has(name)) {
				return { attributes: [] };
			}

			resolving.add(name);
			const attrs: XsdAttribute[] = [...def.attributes];
			// A wildcard anywhere in the chain belongs to every group that pulls the
			// chain in: the members a referencing type gets are the flattened set.
			let anyAttribute = def.anyAttribute === true;

			// Resolve nested attributeGroup refs recursively.
			for (const ref of def.attributeGroupRefs) {
				const refName = stripPrefix(ref.ref);
				const resolved = resolveGroup(refName);
				if (resolved.attributes.length) {
					attrs.push(...resolved.attributes);
				}
				anyAttribute ||= resolved.anyAttribute === true;
			}

			resolving.delete(name);
			const group: ResolvedAttributeGroup = { attributes: attrs, anyAttribute: anyAttribute || undefined };
			this.attributeGroupMap.set(name, group);
			return group;
		};

		// Ensure all groups are resolved.
		for (const name of groupDefs.keys()) {
			resolveGroup(name);
		}
	}

	private buildSubstitutionLookups(): void {
		// Build substitution group map from top-level elements
		for (const el of this.schema.elements) {
			if (el.substitutionGroup) {
				const headName = stripPrefix(el.substitutionGroup);
				const substitutes = this.substitutionMap.get(headName);
				if (substitutes) {
					substitutes.push(el.name);
				} else {
					this.substitutionMap.set(headName, [el.name]);
				}
			}
		}
	}

	private resolveComplexType(
		ct: XsdComplexType,
		name: string,
		isRoot: boolean,
		classNameOverride?: string,
	): ResolvedType {
		// Scope the active namespace/forms to this type's own source schema while we
		// resolve it and its members (restored below). Imported types carry their own
		// namespace; main-schema types leave the defaults in place. Save/restore keeps
		// this correct even if a nested inline type is resolved re-entrantly.
		const savedNamespace = this.activeTargetNamespace;
		const savedElementForm = this.activeElementFormDefault;
		const savedAttributeForm = this.activeAttributeFormDefault;
		const savedOwner = this.activeOwnerClassName;
		if (ct.sourceNamespace !== undefined) {
			this.activeTargetNamespace = ct.sourceNamespace;
			this.activeElementFormDefault = ct.sourceElementFormDefault;
			this.activeAttributeFormDefault = ct.sourceAttributeFormDefault;
		}
		// Mirrors the class name resolveComplexTypeInScope is about to settle on.
		this.activeOwnerClassName = classNameOverride ?? toPascalCase(name);
		try {
			return this.resolveComplexTypeInScope(ct, name, isRoot, classNameOverride);
		} finally {
			this.activeTargetNamespace = savedNamespace;
			this.activeElementFormDefault = savedElementForm;
			this.activeAttributeFormDefault = savedAttributeForm;
			this.activeOwnerClassName = savedOwner;
		}
	}

	private resolveComplexTypeInScope(
		ct: XsdComplexType,
		name: string,
		isRoot: boolean,
		classNameOverride?: string,
	): ResolvedType {
		const resolved: ResolvedType = {
			className: classNameOverride ?? toPascalCase(name),
			xmlName: name,
			properties: [],
			isRootElement: isRoot,
			mixed: ct.mixed,
			abstract: ct.abstract,
			documentation: ct.documentation,
		};

		if (this.activeTargetNamespace) {
			const prefix = this.findPrefixForUri(this.activeTargetNamespace);
			resolved.namespace = {
				uri: this.activeTargetNamespace,
				prefix: prefix ?? undefined,
			};
		}

		// An xs:anyAttribute may be declared by the type itself, by either half of its
		// content model, or by any attributeGroup it references — directly or through
		// a nested reference. All of them mean the same one wildcard member, so the
		// sources are collected here and emitted once (see appendAnyAttributeProperty).
		let hasAnyAttribute = ct.anyAttribute === true;

		// Handle simpleContent (text value + attributes)
		if (ct.simpleContent) {
			resolved.hasSimpleContent = true;
			hasAnyAttribute = this.resolveSimpleContent(ct.simpleContent, resolved) || hasAnyAttribute;
			this.appendAnyAttributeProperty(resolved, hasAnyAttribute);
			return resolved;
		}

		// Handle complexContent (extension/restriction of another complex type)
		if (ct.complexContent) {
			// `mixed` may be declared on the complexContent rather than the type.
			if (ct.complexContent.mixed) resolved.mixed = true;
			hasAnyAttribute = this.resolveComplexContent(ct.complexContent, resolved) || hasAnyAttribute;
		}

		// Handle compositors
		let order = 1;
		if (ct.sequence) {
			order = this.resolveSequenceProperties(ct.sequence, resolved.properties, order);
		}
		if (ct.choice) {
			order = this.resolveChoiceProperties(ct.choice, resolved.properties, order);
		}
		if (ct.all) {
			this.resolveAllProperties(ct.all, resolved.properties);
		}

		// Resolve group refs
		for (const gRef of ct.groupRefs) {
			order = this.resolveGroupRef(gRef, resolved.properties, order);
		}

		// Resolve attributes
		this.resolveAttributes(ct.attributes, resolved.properties);

		// Resolve attribute group refs
		hasAnyAttribute = this.resolveAttributeGroupRefs(ct.attributeGroupRefs, resolved.properties) || hasAnyAttribute;

		this.appendAnyAttributeProperty(resolved, hasAnyAttribute);

		// A mixed type interleaves text with its declared children. Without a member
		// to hold it, that text is simply lost on round-trip.
		if (resolved.mixed) {
			resolved.properties.unshift({
				propertyName: "text",
				xmlName: "",
				kind: "text",
				tsType: "string[]",
				initializer: "[]",
				isMixedText: true,
				documentation:
					"Text runs of this mixed complex type, in document order. On write, run i precedes child element i.",
			});
		}

		return resolved;
	}

	/**
	 * Append the member that holds the attributes an `xs:anyAttribute` admits.
	 *
	 * One member however many sources named the wildcard: a type may declare it and
	 * reference an attributeGroup that declares it too, and two `anyAttributes`
	 * members on one class would be a duplicate property, not a second wildcard.
	 */
	private appendAnyAttributeProperty(resolved: ResolvedType, hasAnyAttribute: boolean): void {
		if (!hasAnyAttribute) return;

		resolved.properties.push({
			propertyName: "anyAttributes",
			xmlName: "",
			kind: "dynamic",
			tsType: "DynamicElement",
			initializer: "undefined!",
			documentation: "xs:anyAttribute wildcard.",
		});
	}

	/** Returns whether the content model declares (or pulls in) an xs:anyAttribute. */
	private resolveSimpleContent(sc: NonNullable<XsdComplexType["simpleContent"]>, resolved: ResolvedType): boolean {
		if (sc.extension) {
			const baseInfo = this.resolveTypeReference(sc.extension.base);
			resolved.properties.push({
				propertyName: "value",
				xmlName: "",
				kind: "text",
				tsType: baseInfo.tsType,
				initializer: baseInfo.initializer,
				dataType: baseInfo.dataType,
			});
			this.resolveAttributes(sc.extension.attributes, resolved.properties);
			const fromGroups = this.resolveAttributeGroupRefs(sc.extension.attributeGroupRefs, resolved.properties);
			return sc.extension.anyAttribute === true || fromGroups;
		}
		if (sc.restriction) {
			const baseInfo = this.resolveTypeReference(sc.restriction.base);
			resolved.properties.push({
				propertyName: "value",
				xmlName: "",
				kind: "text",
				tsType: baseInfo.tsType,
				initializer: baseInfo.initializer,
				enumValues: sc.restriction.enumerations.length > 0 ? sc.restriction.enumerations : undefined,
				pattern: this.resolvePattern(sc.restriction.pattern, resolved.className),
				length: sc.restriction.length,
				minLength: sc.restriction.minLength,
				maxLength: sc.restriction.maxLength,
				minInclusive: sc.restriction.minInclusive,
				maxInclusive: sc.restriction.maxInclusive,
				minExclusive: sc.restriction.minExclusive,
				maxExclusive: sc.restriction.maxExclusive,
				totalDigits: sc.restriction.totalDigits,
				fractionDigits: sc.restriction.fractionDigits,
				whiteSpace: sc.restriction.whiteSpace,
				dataType: baseInfo.dataType,
			});
			this.resolveAttributes(sc.restriction.attributes, resolved.properties);
			const fromGroups = this.resolveAttributeGroupRefs(sc.restriction.attributeGroupRefs, resolved.properties);
			return sc.restriction.anyAttribute === true || fromGroups;
		}

		return false;
	}

	/**
	 * Drop a base type that resolves to the type itself. This happens with
	 * xs:redefine, where the redefinition derives from the original definition
	 * of the same name: redefines are merged like includes (overrides are not
	 * applied), so keeping the base would generate `class X extends X`.
	 */
	private dropSelfReferentialBase(resolved: ResolvedType): void {
		if (resolved.baseTypeName !== resolved.className) return;
		this.coverageNotes.push(
			`Type '${resolved.className}' derives from itself (xs:redefine); the extends clause was dropped.`,
		);
		resolved.baseTypeName = undefined;
	}

	/**
	 * Resolve `xs:attributeGroup ref="…"` declarations onto a type's properties.
	 *
	 * A reference that names no known group contributes nothing — every attribute it
	 * carries simply disappears from the generated class — so it is reported rather
	 * than skipped in silence.
	 *
	 * Returns whether any referenced group declares an `xs:anyAttribute`, which the
	 * referencing type owns just as if it had declared the wildcard itself.
	 */
	private resolveAttributeGroupRefs(refs: XsdAttributeGroupRef[], props: ResolvedProperty[]): boolean {
		let anyAttribute = false;
		for (const agRef of refs) {
			const refName = stripPrefix(agRef.ref);
			const group = this.attributeGroupMap.get(refName);
			if (group) {
				this.resolveAttributes(group.attributes, props);
				anyAttribute ||= group.anyAttribute === true;
				continue;
			}
			this.coverageNotes.push(
				`xs:attributeGroup ref='${agRef.ref}' names no group defined in the schema; ` +
					`any attributes it declares are absent from the generated code.`,
			);
		}
		return anyAttribute;
	}

	/**
	 * Drop a base type that no definition in the schema provides.
	 *
	 * Keeping it emits `class X extends Missing` against a class that is never
	 * declared or imported — a module that does not compile, failing for code that
	 * never touched the type. The usual cause is legitimate: an `xs:import` whose
	 * `schemaLocation` is remote and therefore not fetched. The derived members are
	 * kept; only the inheritance link goes.
	 */
	private dropUnresolvableBase(resolved: ResolvedType, base: string): void {
		if (resolved.baseTypeName === undefined) return;
		if (this.complexTypeMap.has(stripPrefix(base))) return;

		this.coverageNotes.push(
			`Type '${resolved.className}' derives from '${base}', which is not defined in the schema ` +
				`(an unfetched xs:import declares it?); the extends clause was dropped and its inherited members are absent.`,
		);
		resolved.baseTypeName = undefined;
	}

	/** Returns whether the content model declares (or pulls in) an xs:anyAttribute. */
	private resolveComplexContent(cc: NonNullable<XsdComplexType["complexContent"]>, resolved: ResolvedType): boolean {
		if (cc.extension) {
			resolved.baseTypeName = toPascalCase(stripPrefix(cc.extension.base));
			this.dropSelfReferentialBase(resolved);
			this.dropUnresolvableBase(resolved, cc.extension.base);

			let order = 1;
			if (cc.extension.sequence) {
				order = this.resolveSequenceProperties(cc.extension.sequence, resolved.properties, order);
			}
			if (cc.extension.choice) {
				order = this.resolveChoiceProperties(cc.extension.choice, resolved.properties, order);
			}
			if (cc.extension.all) {
				this.resolveAllProperties(cc.extension.all, resolved.properties);
			}
			for (const gRef of cc.extension.groupRefs) {
				order = this.resolveGroupRef(gRef, resolved.properties, order);
			}
			this.resolveAttributes(cc.extension.attributes, resolved.properties);
			const fromGroups = this.resolveAttributeGroupRefs(cc.extension.attributeGroupRefs, resolved.properties);
			return cc.extension.anyAttribute === true || fromGroups;
		}
		if (cc.restriction) {
			// A complexContent restriction RESTATES the complete (narrowed) content
			// model: the listed particles are the derived type's full member set, not
			// additions to the base. Emitting `extends Base` would wrongly re-inherit
			// members the restriction dropped, so the derived type is generated as a
			// standalone, flattened class (matching how .NET collapses a restriction).
			const baseName = toPascalCase(stripPrefix(cc.restriction.base));
			this.coverageNotes.push(
				`Type '${resolved.className}' restricts '${baseName}' (xs:restriction): generated as a flattened ` +
					`standalone type with only the restricted members (no 'extends ${baseName}').`,
			);
			let order = 1;
			if (cc.restriction.sequence) {
				order = this.resolveSequenceProperties(cc.restriction.sequence, resolved.properties, order);
			}
			if (cc.restriction.choice) {
				order = this.resolveChoiceProperties(cc.restriction.choice, resolved.properties, order);
			}
			if (cc.restriction.all) {
				this.resolveAllProperties(cc.restriction.all, resolved.properties);
			}
			for (const gRef of cc.restriction.groupRefs) {
				order = this.resolveGroupRef(gRef, resolved.properties, order);
			}
			this.resolveAttributes(cc.restriction.attributes, resolved.properties);
			const fromGroups = this.resolveAttributeGroupRefs(cc.restriction.attributeGroupRefs, resolved.properties);
			return cc.restriction.anyAttribute === true || fromGroups;
		}

		return false;
	}

	private resolveSequenceProperties(seq: XsdSequence, props: ResolvedProperty[], startOrder: number): number {
		// A repeating sequence, like a repeating choice, is an interleaved run.
		if (repeats(seq)) {
			const collection = this.resolveRepeatingCompositor(seq.elements, seq, props, startOrder, "xs:sequence");
			if (collection !== undefined) return collection;
		}

		let order = startOrder;

		for (const el of seq.elements) {
			props.push(this.resolveElementProperty(el, order++));
		}

		for (const choice of seq.choices) {
			order = this.resolveChoiceProperties(choice, props, order);
		}

		for (const nested of seq.sequences) {
			order = this.resolveSequenceProperties(nested, props, order);
		}

		for (const gRef of seq.groupRefs) {
			order = this.resolveGroupRef(gRef, props, order);
		}

		for (const any of seq.any) {
			order = this.resolveWildcardProperty(any, props, order);
		}

		return order;
	}

	/**
	 * Emit a repeating compositor as one ordered collection.
	 *
	 * `<xs:choice maxOccurs="unbounded">` over `note`/`task` describes a run like
	 * `note task note`. A member per branch would hold `note: [a, b], task: [c]`,
	 * which writes back as `note note task` — the document order is gone. One
	 * `@XmlArray({ items })` member keeps it.
	 *
	 * Returns undefined when the compositor has branches that are not plain element
	 * declarations (a nested sequence, a group reference, a wildcard); those cannot
	 * be named as items, so the caller falls back to expanding them individually.
	 */
	private resolveRepeatingCompositor(
		elements: XsdElement[],
		compositor: XsdChoice | XsdSequence,
		props: ResolvedProperty[],
		startOrder: number,
		label: string,
	): number | undefined {
		const hasNonElementBranches =
			compositor.sequences.length > 0 ||
			compositor.groupRefs.length > 0 ||
			compositor.any.length > 0 ||
			("choices" in compositor && compositor.choices.length > 0);

		if (elements.length === 0 || hasNonElementBranches) {
			this.coverageNotes.push(
				`A repeating ${label} has branches that are not plain element declarations; its members were ` +
					`generated individually, so the order of differently named siblings is not preserved on round-trip.`,
			);
			return undefined;
		}

		const items: ResolvedArrayItem[] = elements.map((el) => {
			const name = el.ref ? stripPrefix(el.ref) : el.name;
			const { typeInfo, form } = this.resolveElementDeclaration(el, name);
			return {
				xmlName: name,
				tsType: typeInfo.tsType,
				complexTypeName: typeInfo.complexTypeName,
				dataType: typeInfo.dataType,
				namespace: this.resolveNamespaceForForm(form),
			};
		});

		// Writing recovers an item's element name from the value itself — its class for
		// a complex alternative, its JavaScript type for a scalar one. Alternatives
		// that look identical to that test cannot be told apart on the way out, so a
		// collection would round-trip to the wrong element names. Expand instead.
		const indistinguishable = indistinguishableItems(items);
		if (indistinguishable) {
			this.coverageNotes.push(
				`A repeating ${label} offers '${indistinguishable}' as alternatives that share a type; a value ` +
					`cannot say which element it came from, so its members were generated individually and the ` +
					`document order of differently named siblings is not preserved on round-trip.`,
			);
			return undefined;
		}

		const tsTypes = [...new Set(items.map((i) => i.tsType))];

		props.push({
			propertyName: this.uniqueCollectionName(props),
			xmlName: "",
			kind: "array",
			tsType: tsTypes.length === 1 ? `${tsTypes[0]}[]` : `(${tsTypes.join(" | ")})[]`,
			initializer: "[]",
			order: startOrder,
			// A repeating compositor is present at least minOccurs times; the members
			// themselves are never individually required.
			required: compositor.minOccurs !== undefined && compositor.minOccurs > 0,
			arrayItems: items,
			minOccursCount:
				typeof compositor.minOccurs === "number" && compositor.minOccurs > 1 ? compositor.minOccurs : undefined,
			maxOccursCount: typeof compositor.maxOccurs === "number" ? compositor.maxOccurs : undefined,
			documentation:
				`Repeating ${label}: ${items.map((i) => i.xmlName).join(", ")}. ` +
				`Held in one collection so the document order of these elements round-trips.`,
		});

		return startOrder + 1;
	}

	/** A collection property name not already taken on this type (`items`, `items2`, …). */
	private uniqueCollectionName(props: ResolvedProperty[]): string {
		const taken = new Set(props.map((p) => p.propertyName));
		if (!taken.has("items")) return "items";
		let suffix = 2;
		while (taken.has(`items${suffix}`)) suffix++;
		return `items${suffix}`;
	}

	/**
	 * Emit the `@XmlDynamic` member that stands in for an `xs:any` wildcard.
	 *
	 * Shared by sequences and choices — a wildcard is equally legal as a choice
	 * branch, where it used to be dropped silently.
	 */
	private resolveWildcardProperty(any: XsdAny, props: ResolvedProperty[], order: number): number {
		const wildcardDetails = [
			any.namespace ? `namespace="${any.namespace}"` : undefined,
			any.processContents ? `processContents="${any.processContents}"` : undefined,
		]
			.filter(Boolean)
			.join(", ");

		props.push({
			propertyName: `dynamicContent${order}`,
			xmlName: "",
			kind: "dynamic",
			tsType: "DynamicElement",
			initializer: "undefined!",
			order,
			documentation: `xs:any wildcard${wildcardDetails ? ` (${wildcardDetails})` : ""}.`,
			// xs:any defaults minOccurs to 1 when omitted.
			required: any.minOccurs === undefined || any.minOccurs > 0 || undefined,
		});

		return order + 1;
	}

	private resolveChoiceProperties(choice: XsdChoice, props: ResolvedProperty[], startOrder: number): number {
		// A repeating choice is a run of interleaved elements, not one of each: it
		// needs a single ordered collection rather than a member per branch.
		if (repeats(choice)) {
			const collection = this.resolveRepeatingCompositor(choice.elements, choice, props, startOrder, "xs:choice");
			if (collection !== undefined) return collection;
		}

		let order = startOrder;
		const groupName = `choice${++this.choiceCounter}`;
		// XSD defaults minOccurs to 1: one member of the choice must be present.
		const choiceRequired = choice.minOccurs === undefined || choice.minOccurs > 0;

		// Choice elements are all optional (only one is present at a time)
		for (const el of choice.elements) {
			const prop = this.resolveElementProperty(el, order++);
			prop.required = false; // choices are inherently optional
			prop.choiceGroup = groupName;
			prop.choiceRequired = choiceRequired || undefined;
			props.push(prop);
		}

		// Members of nested sequences are not part of the exclusive group
		// (a sequence branch may set several of them together), but nothing inside a
		// branch can be required at the type level: a document that takes a different
		// branch contains none of it. Marking them required rejects valid documents.
		//
		// The converse — "these are required together iff this branch is taken" — is
		// not expressible per-property and stays unmodelled.
		for (const seq of choice.sequences) {
			const branchStart = props.length;
			order = this.resolveSequenceProperties(seq, props, order);
			relaxBranchMembers(props, branchStart);
		}

		for (const gRef of choice.groupRefs) {
			const branchStart = props.length;
			order = this.resolveGroupRef(gRef, props, order);
			relaxBranchMembers(props, branchStart);
		}

		// A wildcard branch. Never required: taking a different branch means the
		// document contains none of it.
		for (const any of choice.any) {
			order = this.resolveWildcardProperty(any, props, order);
			props[props.length - 1].required = undefined;
		}

		return order;
	}

	private resolveAllProperties(all: XsdAll, props: ResolvedProperty[]): void {
		// When the xs:all group itself is optional, none of its members can be required.
		const allOptional = all.minOccurs === 0;

		// xs:all elements have no order requirement
		for (const el of all.elements) {
			const prop = this.resolveElementProperty(el);
			if (allOptional) prop.required = false;
			props.push(prop);
		}

		// XSD 1.1 allows xs:choice inside xs:all
		for (const choice of all.choices) {
			const before = props.length;
			this.resolveChoiceProperties(choice, props, 0);
			for (let i = before; i < props.length; i++) {
				props[i].order = undefined; // xs:all members are unordered
			}
		}
	}

	private resolveGroupRef(gRef: XsdGroupRef, props: ResolvedProperty[], startOrder: number): number {
		const refName = stripPrefix(gRef.ref);
		const group = this.groupMap.get(refName);
		if (!group) {
			this.coverageNotes.push(
				`xs:group ref='${gRef.ref}' names no group defined in the schema; ` +
					`any elements it declares are absent from the generated code.`,
			);
			return startOrder;
		}

		// The *reference* may repeat even when the group's own compositor does not,
		// which makes its content an interleaved run just the same. xs:all cannot
		// repeat, so only sequences and choices reach this.
		if (repeats(gRef) && group.kind !== "all") {
			const collection = this.resolveRepeatingCompositor(
				group.compositor.elements,
				{ ...group.compositor, minOccurs: gRef.minOccurs, maxOccurs: gRef.maxOccurs },
				props,
				startOrder,
				`xs:group ref='${gRef.ref}'`,
			);
			if (collection !== undefined) return collection;
		}

		if (group.kind === "sequence") {
			return this.resolveSequenceProperties(group.compositor, props, startOrder);
		}
		if (group.kind === "choice") {
			return this.resolveChoiceProperties(group.compositor, props, startOrder);
		}
		this.resolveAllProperties(group.compositor, props);
		return startOrder;
	}

	private resolveElementProperty(el: XsdElement, order?: number): ResolvedProperty {
		const isArray = el.maxOccurs === "unbounded" || (typeof el.maxOccurs === "number" && el.maxOccurs > 1);
		const isRequired = el.minOccurs === undefined || el.minOccurs > 0;

		this.noteIdentityConstraints(el);

		// Resolve element name (could be a ref)
		const name = el.ref ? stripPrefix(el.ref) : el.name;

		// Check if this element is a substitution group head
		const substitutes = this.substitutionMap.get(name);
		if (substitutes) {
			return this.resolveSubstitutionHeadProperty(el, name, substitutes, isRequired, order);
		}

		// Occurrence constraints stay with the reference; everything describing the
		// element itself comes from the declaration it points at.
		const { declaration, typeInfo, form } = this.resolveElementDeclaration(el, name);

		const prop: ResolvedProperty = {
			propertyName: toCamelCase(name),
			xmlName: name,
			kind: isArray ? "array" : "element",
			tsType: isArray ? `${typeInfo.tsType}[]` : typeInfo.tsType,
			initializer: isArray ? "[]" : typeInfo.initializer,
			required: isRequired,
			order,
			isNullable: declaration.nillable,
			form,
			namespace: this.resolveNamespaceForForm(form),
			defaultValue: declaration.defaultValue ?? declaration.fixed,
			fixedValue: declaration.fixed,
			complexTypeName: typeInfo.complexTypeName,
			isAbstractType: typeInfo.isAbstractType,
			enumValues: typeInfo.enumValues,
			enumTypeName: typeInfo.enumTypeName,
			...copyValueFacets(typeInfo),
			documentation: el.documentation ?? declaration.documentation ?? typeInfo.documentation,
		};

		if (isArray) {
			this.applyArrayOccurs(prop, el, name, typeInfo);
		}

		return prop;
	}

	/**
	 * Build the property emitted for a substitution group head element.
	 *
	 * At the head's position a document may carry the head element *or* any of its
	 * substitutes — different element names, each with its own type. That is the
	 * same shape as a choice, so it generates as an ordered collection of named
	 * alternatives, giving typed access instead of the untyped `DynamicElement` this
	 * used to be.
	 *
	 * Falls back to `DynamicElement` when an alternative's type cannot be resolved,
	 * since an item with no type would silently read back as a string.
	 */
	private resolveSubstitutionHeadProperty(
		el: XsdElement,
		name: string,
		substitutes: string[],
		isRequired: boolean,
		order?: number,
	): ResolvedProperty {
		const isArray = el.maxOccurs === "unbounded" || (typeof el.maxOccurs === "number" && el.maxOccurs > 1);
		const items = this.resolveSubstitutionItems(name, substitutes);

		if (!items) {
			this.coverageNotes.push(
				`Substitution group head '${name}' has members whose type could not be resolved; ` +
					`it was generated as an untyped DynamicElement.`,
			);
			return {
				propertyName: toCamelCase(name),
				xmlName: name,
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				required: isRequired,
				order,
				documentation:
					el.documentation ?? `Substitution group head '${name}'; substitutable elements: ${substitutes.join(", ")}.`,
			};
		}

		const tsTypes = [...new Set(items.map((i) => i.tsType))];

		return {
			propertyName: toCamelCase(name),
			xmlName: name,
			kind: "array",
			tsType: tsTypes.length === 1 ? `${tsTypes[0]}[]` : `(${tsTypes.join(" | ")})[]`,
			initializer: "[]",
			required: isRequired,
			order,
			arrayItems: items,
			// A non-repeating head still generates a collection: the element name varies,
			// which a single-named member cannot express. At most one item will be present.
			maxOccursCount: isArray ? undefined : 1,
			documentation:
				el.documentation ?? `Substitution group head '${name}'. Any one of: ${items.map((i) => i.xmlName).join(", ")}.`,
		};
	}

	/** The head and its substitutes as array items, or undefined if any lacks a type. */
	private resolveSubstitutionItems(headName: string, substitutes: string[]): ResolvedArrayItem[] | undefined {
		const items: ResolvedArrayItem[] = [];

		for (const memberName of [headName, ...substitutes]) {
			const declaration = this.globalElementMap.get(memberName);
			if (!declaration) return undefined;

			// An abstract head cannot appear in a document — only its substitutes can.
			const isAbstractHead = memberName === headName && declaration.abstract;
			if (isAbstractHead) continue;

			const { typeInfo, form } = this.resolveElementDeclaration(declaration, memberName);
			if (!typeInfo.complexTypeName && !typeInfo.dataType) return undefined;

			items.push({
				xmlName: memberName,
				tsType: typeInfo.tsType,
				complexTypeName: typeInfo.complexTypeName,
				dataType: typeInfo.dataType,
				namespace: this.resolveNamespaceForForm(form),
			});
		}

		return items.length > 0 ? items : undefined;
	}

	/**
	 * Resolve which declaration an element property draws from, its type, and how it
	 * is namespace-qualified.
	 *
	 * A `ref` names a *global* element declaration, which is where the type,
	 * nillability and default live. Global elements are always namespace-qualified,
	 * whatever `elementFormDefault` says about local ones.
	 */
	private resolveElementDeclaration(
		el: XsdElement,
		name: string,
	): { declaration: XsdElement; typeInfo: ResolvedTypeInfo; form: "qualified" | "unqualified" | undefined } {
		const referenced = el.ref ? this.globalElementMap.get(name) : undefined;

		if (referenced) {
			return {
				declaration: referenced,
				typeInfo: this.resolveReferencedElementTypeInfo(referenced, name),
				form: el.form ?? "qualified",
			};
		}

		if (el.ref) {
			// The reference carries no type of its own, so the member falls back to
			// `string` and to the local element form — both likely wrong for what is,
			// by definition, a global declaration.
			this.coverageNotes.push(
				`xs:element ref='${el.ref}' names no global element defined in the schema ` +
					`(an unfetched xs:import declares it?); the member was generated as 'string'.`,
			);
		}

		return {
			declaration: el,
			typeInfo: this.resolveElementTypeInfo(el, name),
			form: el.form ?? this.resolveElementForm(),
		};
	}

	/**
	 * Resolve the type of an element reached through `ref="…"`.
	 *
	 * Differs from a local declaration in one place: a global element carrying an
	 * *inline* complexType already has a class, generated from the top-level element
	 * loop and named after the element. Routing through
	 * {@link resolveElementTypeInfo} would mint a second, identical `<Name>Type`
	 * class for the same content model.
	 */
	private resolveReferencedElementTypeInfo(referenced: XsdElement, name: string): ResolvedTypeInfo {
		if (referenced.complexType) {
			const className = toPascalCase(name);
			return {
				tsType: className,
				initializer: this.initializerFor(className, referenced.complexType.abstract),
				complexTypeName: className,
				isAbstractType: referenced.complexType.abstract,
			};
		}
		return this.resolveElementTypeInfo(referenced, name);
	}

	/** Resolve the type information for an element declaration */
	private resolveElementTypeInfo(el: XsdElement, name: string): ResolvedTypeInfo {
		if (el.complexType) {
			// Inline complex type — will need to generate a class for it. `<Element>Type`
			// is the natural name but collides with the named type `<Element>Type` under
			// the convention most schemas follow, so where the type was declared is the
			// fallback: 'TijdvakCorrectieCollectieveAangifte' over 'CollectieveAangifteType2'.
			const local = toPascalCase(name);
			const inlineTypeName = this.claimClassName(local + "Type", el.complexType, this.anonymousFallback(local, name));
			const inlineType = this.resolveComplexType(el.complexType, name, false, inlineTypeName);
			// The type is declared inline, so it has no schema type identity to claim.
			inlineType.isAnonymousType = true;
			this.addResolvedType(inlineType);
			return {
				tsType: inlineTypeName,
				initializer: this.initializerFor(inlineTypeName, el.complexType.abstract),
				complexTypeName: inlineTypeName,
				isAbstractType: el.complexType.abstract,
			};
		}
		if (el.simpleType) {
			return this.resolveSimpleTypeInline(el.simpleType);
		}
		if (el.type) {
			return this.resolveTypeReference(el.type);
		}
		// No type means xs:anyType
		return { tsType: "string", initializer: "''" };
	}

	/**
	 * Name an anonymous type after the type that declares it, for when its own
	 * preferred name is taken. The owner's trailing 'Type' is dropped so the result
	 * reads as a path rather than stuttering: TijdvakCorrectieType + CollectieveAangifte
	 * → TijdvakCorrectieCollectieveAangifte.
	 *
	 * Returns undefined at the top level, where there is no declaring type to name.
	 */
	private anonymousFallback(pascalName: string, elementName: string): AnonymousNameFallback | undefined {
		const owner = this.activeOwnerClassName;
		if (!owner) return undefined;
		const ownerStem = owner.length > "Type".length && owner.endsWith("Type") ? owner.slice(0, -"Type".length) : owner;
		return { className: ownerStem + pascalName, elementName };
	}

	/** Populate array-specific fields (item name/type and occurs bounds) */
	private applyArrayOccurs(prop: ResolvedProperty, el: XsdElement, name: string, typeInfo: ResolvedTypeInfo): void {
		prop.arrayItemName = name;
		prop.arrayItemType = typeInfo.complexTypeName;
		if (typeof el.minOccurs === "number" && el.minOccurs > 1) {
			prop.minOccursCount = el.minOccurs;
		}
		if (typeof el.maxOccurs === "number" && el.maxOccurs > 1) {
			prop.maxOccursCount = el.maxOccurs;
		}
	}

	private resolveAttributes(attrs: XsdAttribute[], props: ResolvedProperty[]): void {
		for (const a of attrs) {
			// Prohibited attributes must not appear in instances — omit the property.
			if (a.use === "prohibited") {
				this.coverageNotes.push(
					`Attribute '${a.name || stripPrefix(a.ref ?? "")}' with use="prohibited" was omitted from generated code.`,
				);
				continue;
			}

			if (a.ref) {
				props.push(this.resolveAttributeRef(a));
				continue;
			}

			const typeInfo = this.resolveAttributeTypeInfo(a);
			const defaultOrFixed = a.defaultValue ?? a.fixed;
			const form = a.form ?? this.resolveAttributeForm();

			props.push({
				propertyName: toCamelCase(a.name),
				xmlName: a.name,
				kind: "attribute",
				tsType: typeInfo.tsType,
				initializer: defaultOrFixed
					? this.buildDefaultInitializer(typeInfo.tsType, defaultOrFixed)
					: typeInfo.initializer,
				required: a.use === "required",
				form,
				namespace: this.resolveNamespaceForForm(form),
				defaultValue: defaultOrFixed,
				fixedValue: a.fixed,
				enumValues: resolveAttributeEnumValues(typeInfo, a.fixed),
				enumTypeName: typeInfo.enumTypeName,
				...copyValueFacets(typeInfo),
				documentation: a.documentation ?? typeInfo.documentation,
			});
		}
	}

	/**
	 * Resolve an attribute declared via `ref="…"`.
	 *
	 * The reference contributes only `use`; the type, facets, default and namespace
	 * all come from the global declaration it names. A referenced attribute is
	 * always qualified — that is what makes `ref="xml:lang"` land in the XML
	 * namespace rather than becoming a bare local `lang`.
	 */
	private resolveAttributeRef(a: XsdAttribute): ResolvedProperty {
		const qualifiedRef = a.ref!;
		const name = stripPrefix(qualifiedRef);
		const declaration = this.globalAttributeMap.get(name);
		const typeInfo = this.resolveAttributeTypeInfo(declaration);

		const defaultOrFixed = a.defaultValue ?? a.fixed ?? declaration?.defaultValue ?? declaration?.fixed;
		const fixedValue = a.fixed ?? declaration?.fixed;

		return {
			propertyName: toCamelCase(name),
			xmlName: name,
			kind: "attribute",
			tsType: typeInfo.tsType,
			initializer: defaultOrFixed
				? this.buildDefaultInitializer(typeInfo.tsType, defaultOrFixed)
				: typeInfo.initializer,
			required: a.use === "required",
			form: "qualified",
			namespace: this.resolveNamespaceForRef(qualifiedRef),
			defaultValue: defaultOrFixed,
			fixedValue,
			enumValues: resolveAttributeEnumValues(typeInfo, fixedValue),
			enumTypeName: typeInfo.enumTypeName,
			...copyValueFacets(typeInfo),
			documentation: a.documentation ?? declaration?.documentation ?? typeInfo.documentation,
		};
	}

	/** Type info for an attribute declaration: inline simpleType, named type, or plain string. */
	private resolveAttributeTypeInfo(a: XsdAttribute | undefined): ResolvedTypeInfo {
		if (a?.simpleType) return this.resolveSimpleTypeInline(a.simpleType);
		if (a?.type) return this.resolveTypeReference(a.type);
		return { tsType: "string", initializer: "''" };
	}

	/**
	 * The namespace a `ref="prefix:name"` points into, resolved through the schema's
	 * prefix bindings. An unprefixed ref targets the schema's own target namespace.
	 */
	private resolveNamespaceForRef(qualifiedRef: string): { uri: string; prefix?: string } | undefined {
		const colon = qualifiedRef.indexOf(":");
		if (colon < 0) {
			return this.activeTargetNamespace
				? { uri: this.activeTargetNamespace, prefix: this.findPrefixForUri(this.activeTargetNamespace) }
				: undefined;
		}

		const prefix = qualifiedRef.substring(0, colon);
		// The `xml` prefix is bound implicitly by the XML spec, so schemas that use
		// `ref="xml:lang"` never declare it.
		const uri = prefix === "xml" ? XML_NAMESPACE_URI : this.schema.namespaces.get(prefix);
		return uri ? { uri, prefix } : undefined;
	}

	/**
	 * The initializer for a complex-type-valued member.
	 *
	 * An abstract type is generated as an `abstract class`, so `new Type()` would
	 * not compile. Such members are emitted with a definite-assignment assertion
	 * instead (see the generator); this value is only a placeholder for the paths
	 * that always want an expression.
	 */
	private initializerFor(className: string, isAbstract?: boolean): string {
		return isAbstract ? "undefined!" : `new ${className}()`;
	}

	private resolveTypeReference(typeRef: string): ResolvedTypeInfo {
		const localName = stripPrefix(typeRef);

		// The built-in list types (IDREFS, NMTOKENS, ENTITIES) hold a space-separated
		// sequence, which the `list` option round-trips as a typed array.
		if (XSD_LIST_TYPES.has(localName)) {
			return { tsType: "string[]", initializer: "[]", isList: true, listItemType: "string" };
		}

		// Check XSD built-in types
		const builtin = XSD_TYPE_MAP[localName];
		if (builtin) return { ...builtin };

		// Check named complex types
		const ct = this.complexTypeMap.get(localName);
		if (ct) {
			const className = this.classNameByType.get(ct) ?? toPascalCase(localName);
			return {
				tsType: className,
				initializer: this.initializerFor(className, ct.abstract),
				complexTypeName: className,
				isAbstractType: ct.abstract,
			};
		}

		// Check named simple types
		const st = this.simpleTypeMap.get(localName);
		if (st) {
			return this.resolveSimpleTypeInline(st);
		}

		// Unknown type — treat as string, but say so. A member silently typed `string`
		// because its type could not be found looks identical to one the schema really
		// declares as a string, and the usual cause (an xs:import that was not fetched)
		// is invisible from the generated code.
		this.coverageNotes.push(
			`Type '${typeRef}' is not defined in the schema (an unfetched xs:import declares it?); ` +
				`members using it were generated as 'string'.`,
		);
		return { tsType: "string", initializer: "''" };
	}

	/**
	 * Demote a numeric type to `string` when its lexical form carries meaning the
	 * numeric value would lose. Mutates `info` in place.
	 *
	 * Two cases:
	 *
	 * - **A pattern facet.** Patterns constrain the *lexical* space, which is how a
	 *   schema says "nine digits, leading zero permitted" — a Dutch BSN of
	 *   `012345678` read as the number 12345678 is a different, invalid identifier.
	 *   Keeping it a string also makes the pattern enforceable at all, since pattern
	 *   validation only inspects strings.
	 * - **An integer wider than JavaScript can represent**, when the caller opted in
	 *   via `bigIntegerAs: 'string'`. `xs:integer` is arbitrary-precision and
	 *   `xs:long` reaches 9223372036854775807, both past `Number.MAX_SAFE_INTEGER`.
	 *
	 * `dataType` is cleared in both cases: leaving it would coerce the string
	 * straight back to a number on deserialization.
	 */
	private applyLexicalTypeOverrides(info: ResolvedTypeInfo): void {
		if (info.tsType !== "number") return;
		if (info.pattern === undefined && !this.exceedsSafeIntegerWidth(info)) return;

		info.tsType = "string";
		info.initializer = "''";
		info.dataType = undefined;
	}

	/**
	 * Is this an integer type whose declared width can exceed the 15 decimal digits
	 * a JavaScript number represents exactly? Only consulted when the caller opted
	 * into `bigIntegerAs: 'string'`; a `totalDigits` bound within range keeps the
	 * ergonomic `number`.
	 */
	private exceedsSafeIntegerWidth(info: ResolvedTypeInfo): boolean {
		if (this.bigIntegerAs !== "string") return false;
		if (!info.dataType || !UNBOUNDED_INTEGER_TYPES.has(stripPrefix(info.dataType))) return false;
		return info.totalDigits === undefined || info.totalDigits > SAFE_INTEGER_DIGITS;
	}

	/**
	 * Translate an `xs:pattern` into JavaScript regex source, dropping it with a
	 * coverage note when XSD uses syntax JavaScript cannot express.
	 *
	 * Dropping is the safe failure: the generated code passes the source to
	 * `new RegExp` at decoration time, so an untranslatable pattern would throw when
	 * the module is imported rather than when the value is validated.
	 */
	private resolvePattern(pattern: string | undefined, owner: string | undefined): string | undefined {
		if (!pattern) return undefined;

		const { source, unsupported } = translateXsdPattern(pattern);
		if (source !== undefined) return source;

		this.coverageNotes.push(
			`The xs:pattern on '${owner ?? "an anonymous type"}' uses ${unsupported}, ` +
				`which has no JavaScript equivalent; the pattern constraint was omitted.`,
		);
		return undefined;
	}

	private resolveSimpleTypeInline(st: XsdSimpleType): ResolvedTypeInfo {
		if (st.restriction) {
			const baseInfo = this.resolveTypeReference(st.restriction.base);
			const result: ResolvedTypeInfo = {
				...baseInfo,
			};

			if (st.restriction.enumerations.length > 0) {
				if (st.name) {
					// Named enum type
					result.enumTypeName = toPascalCase(st.name);
					result.tsType = toPascalCase(st.name);
				}
				// Carry the vocabulary whether the enumeration is named or anonymous.
				// A named one generates a string-union type, but the runtime still needs
				// the tokens to validate against and to restore the lexical form of a
				// numeric-looking token the parser turned into a number.
				result.enumValues = st.restriction.enumerations;
				// An enumeration's members are wire tokens that must round-trip
				// verbatim, whatever their base type. Inheriting the base's dataType
				// would coerce them — an xs:int-based enum would turn the token "1"
				// into the number 1, which no longer matches the generated union type.
				result.dataType = undefined;
			}

			if (st.restriction.pattern) {
				result.pattern = this.resolvePattern(st.restriction.pattern, st.name);
			}
			result.length = st.restriction.length;
			result.minLength = st.restriction.minLength;
			result.maxLength = st.restriction.maxLength;
			result.minInclusive = st.restriction.minInclusive;
			result.maxInclusive = st.restriction.maxInclusive;
			result.minExclusive = st.restriction.minExclusive;
			result.maxExclusive = st.restriction.maxExclusive;
			result.totalDigits = st.restriction.totalDigits;
			result.fractionDigits = st.restriction.fractionDigits;
			result.whiteSpace = st.restriction.whiteSpace;
			result.documentation = st.documentation ?? result.documentation;

			this.applyLexicalTypeOverrides(result);

			return result;
		}

		if (st.list) {
			// The item type is named by `itemType` or declared inline; either way its
			// facets are copied so they validate each list item.
			const itemInfo = st.list.itemSimpleType
				? this.resolveSimpleTypeInline(st.list.itemSimpleType)
				: this.resolveTypeReference(st.list.itemType);
			return {
				...itemInfo,
				tsType: `${itemInfo.tsType}[]`,
				initializer: "[]",
				isList: true,
				listItemType: itemInfo.tsType === "number" ? "number" : itemInfo.tsType === "boolean" ? "boolean" : "string",
				complexTypeName: undefined,
				enumTypeName: undefined,
				documentation: st.documentation ?? itemInfo.documentation,
			};
		}

		if (st.union) {
			return this.resolveUnionType(st, st.union);
		}

		return { tsType: "string", initializer: "''", documentation: st.documentation };
	}

	/**
	 * Combine an `xs:union`'s members into a TypeScript union.
	 *
	 * Members arrive two ways — named by the `memberTypes` attribute, or declared as
	 * inline `<xs:simpleType>` children — and a union may use either or both.
	 */
	private resolveUnionType(st: XsdSimpleType, union: NonNullable<XsdSimpleType["union"]>): ResolvedTypeInfo {
		const memberInfos = [
			...union.memberTypes.map((mt) => this.resolveTypeReference(mt)),
			...(union.memberSimpleTypes ?? []).map((mst) => this.resolveSimpleTypeInline(mst)),
		];

		if (memberInfos.length === 0) {
			return { tsType: "string", initializer: "''", documentation: st.documentation };
		}

		const uniqueTypes = [...new Set(memberInfos.map((m) => m.tsType))];
		// Prefer a string member's initializer as the safest default for mixed unions.
		const stringMember = memberInfos.find((m) => m.tsType === "string");

		const memberNames = [
			...union.memberTypes,
			...(union.memberSimpleTypes ?? []).map((_, i) => `inline member ${i + 1}`),
		];
		const memberDoc = `xs:union of ${memberNames.join(", ")}.`;

		// A union accepts a value if *any* member does, so the members' enumerations
		// combine — but only when every member is enumerated. One unconstrained member
		// (an xs:string, say) admits everything, and an enumValues list would then
		// reject values the schema allows.
		const everyMemberEnumerated = memberInfos.every((m) => m.enumValues && m.enumValues.length > 0);
		const enumValues = everyMemberEnumerated ? [...new Set(memberInfos.flatMap((m) => m.enumValues ?? []))] : undefined;

		return {
			tsType: uniqueTypes.join(" | "),
			initializer: (stringMember ?? memberInfos[0]).initializer,
			enumValues,
			documentation: st.documentation ? `${st.documentation}\n${memberDoc}` : memberDoc,
		};
	}

	private resolveSimpleRootElement(el: XsdElement): ResolvedType {
		const typeInfo = el.simpleType
			? this.resolveSimpleTypeInline(el.simpleType)
			: el.type
				? this.resolveTypeReference(el.type)
				: { tsType: "string", initializer: "''" };

		const resolved: ResolvedType = {
			className: toPascalCase(el.name),
			xmlName: el.name,
			properties: [
				{
					propertyName: "value",
					xmlName: "",
					kind: "text",
					tsType: typeInfo.tsType,
					initializer: typeInfo.initializer,
					dataType: typeInfo.dataType,
				},
			],
			isRootElement: true,
			documentation: el.documentation ?? typeInfo.documentation,
		};

		if (this.schema.targetNamespace) {
			const prefix = this.findPrefixForUri(this.schema.targetNamespace);
			resolved.namespace = {
				uri: this.schema.targetNamespace,
				prefix: prefix ?? undefined,
			};
		}

		return resolved;
	}

	/**
	 * The form local elements take. `elementForm: 'schema'` defers to the schema's
	 * own elementFormDefault; anything else overrides it outright.
	 */
	private resolveElementForm(): "qualified" | "unqualified" | undefined {
		if (this.elementForm !== "schema") return this.elementForm;
		return this.activeElementFormDefault;
	}

	private resolveAttributeForm(): "qualified" | "unqualified" | undefined {
		return this.activeAttributeFormDefault;
	}

	private resolveNamespaceForForm(
		form: "qualified" | "unqualified" | undefined,
	): { uri: string; prefix?: string } | undefined {
		if (form !== "qualified" || !this.activeTargetNamespace) {
			return undefined;
		}

		const prefix = this.findPrefixForUri(this.activeTargetNamespace);
		return {
			uri: this.activeTargetNamespace,
			prefix: prefix ?? undefined,
		};
	}

	private findPrefixForUri(uri: string): string | undefined {
		for (const [prefix, nsUri] of this.schema.namespaces) {
			if (nsUri === uri && prefix !== "") return prefix;
		}
		return undefined;
	}

	private buildDefaultInitializer(tsType: string, defaultValue: string): string {
		if (tsType === "number") return defaultValue;
		if (tsType === "boolean") return defaultValue === "true" ? "true" : "false";
		return `'${escapeString(defaultValue)}'`;
	}
}

// ── Naming Utils ──

/** Strip namespace prefix from a type reference (e.g. "xs:string" → "string", "tns:Foo" → "Foo") */
/**
 * Clear `required` on the properties a choice branch contributed, from
 * `branchStart` onward. A branch is one alternative: a document that takes a
 * different one contains none of these elements, so requiring them would reject
 * documents the schema allows.
 */
function relaxBranchMembers(props: ResolvedProperty[], branchStart: number): void {
	for (let i = branchStart; i < props.length; i++) {
		props[i].required = false;
	}
}

/**
 * The enumeration an attribute validates against: its own type's, or — for an
 * attribute pinned with `fixed` — the single value it is allowed to take.
 */
function resolveAttributeEnumValues(typeInfo: ResolvedTypeInfo, fixedValue: string | undefined): string[] | undefined {
	if (typeInfo.enumValues) return [...typeInfo.enumValues];
	return fixedValue ? [fixedValue] : undefined;
}

/**
 * Copy the XSD facets a resolved type carries onto a property. Shared by the
 * element, attribute and attribute-reference paths, which all pass the same set
 * straight through.
 */
function copyValueFacets(
	typeInfo: ResolvedTypeInfo,
): Pick<
	ResolvedProperty,
	| "pattern"
	| "dataType"
	| "length"
	| "minLength"
	| "maxLength"
	| "minInclusive"
	| "maxInclusive"
	| "minExclusive"
	| "maxExclusive"
	| "totalDigits"
	| "fractionDigits"
	| "whiteSpace"
	| "isList"
	| "listItemType"
> {
	return {
		pattern: typeInfo.pattern,
		dataType: typeInfo.dataType,
		length: typeInfo.length,
		minLength: typeInfo.minLength,
		maxLength: typeInfo.maxLength,
		minInclusive: typeInfo.minInclusive,
		maxInclusive: typeInfo.maxInclusive,
		minExclusive: typeInfo.minExclusive,
		maxExclusive: typeInfo.maxExclusive,
		totalDigits: typeInfo.totalDigits,
		fractionDigits: typeInfo.fractionDigits,
		whiteSpace: typeInfo.whiteSpace,
		isList: typeInfo.isList,
		listItemType: typeInfo.listItemType,
	};
}

/**
 * The first pair of alternatives that a written value could not distinguish
 * between, as `"a, b"`, or undefined when all of them are distinguishable.
 *
 * A complex alternative is identified on write by its class, a scalar one by the
 * JavaScript type its `dataType` implies — so two alternatives sharing either are
 * ambiguous. Two string-valued elements (`key`/`value`) are the common case.
 */
function indistinguishableItems(items: ResolvedArrayItem[]): string | undefined {
	const seen = new Map<string, string>();

	for (const item of items) {
		// Scalars collapse to their TypeScript type; complex items to their class.
		const identity = item.complexTypeName ?? `scalar:${item.tsType}`;
		const previous = seen.get(identity);
		if (previous) return `${previous}, ${item.xmlName}`;
		seen.set(identity, item.xmlName);
	}

	return undefined;
}

/** Does this compositor occur more than once, making its content an interleaved run? */
function repeats(compositor: { maxOccurs?: number | "unbounded" }): boolean {
	return compositor.maxOccurs === "unbounded" || (typeof compositor.maxOccurs === "number" && compositor.maxOccurs > 1);
}

function stripPrefix(name: string): string {
	const idx = name.indexOf(":");
	return idx >= 0 ? name.substring(idx + 1) : name;
}

/** Convert to PascalCase: "my-type_name" → "MyTypeName" */
function toPascalCase(name: string): string {
	const converted = name
		.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
		.replace(/^[a-z]/, (c) => c.toUpperCase());
	return sanitizeIdentifier(converted, true);
}

/** Convert to camelCase: "MyTypeName" → "myTypeName" */
function toCamelCase(name: string): string {
	const pascal = toPascalCase(name);
	return sanitizeIdentifier(pascal.charAt(0).toLowerCase() + pascal.slice(1), false);
}

function sanitizeIdentifier(value: string, pascal: boolean): string {
	const normalized = value.replace(/[^a-zA-Z0-9_$]/g, "");
	const nonEmpty = normalized.length > 0 ? normalized : pascal ? "GeneratedType" : "generatedField";
	const withLeading = /^[A-Za-z_$]/.test(nonEmpty) ? nonEmpty : `_${nonEmpty}`;
	if (RESERVED_TS_IDENTIFIERS.has(withLeading)) {
		return `${withLeading}_`;
	}
	return withLeading;
}

const RESERVED_TS_IDENTIFIERS = new Set([
	"abstract",
	"any",
	"as",
	"asserts",
	"async",
	"await",
	"boolean",
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"declare",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"from",
	"function",
	"get",
	"if",
	"implements",
	"import",
	"in",
	"infer",
	"instanceof",
	"interface",
	"is",
	"keyof",
	"let",
	"module",
	"namespace",
	"never",
	"new",
	"null",
	"number",
	"object",
	"package",
	"private",
	"protected",
	"public",
	"readonly",
	"require",
	"return",
	"set",
	"static",
	"string",
	"super",
	"switch",
	"symbol",
	"this",
	"throw",
	"true",
	"try",
	"type",
	"typeof",
	"undefined",
	"unique",
	"unknown",
	"var",
	"void",
	"while",
	"with",
	"yield",
]);

/**
 * Escape a value for use inside a single-quoted string literal in generated code.
 *
 * Routed through JSON.stringify so control characters — a newline inside an
 * enumeration token or a default value — become escape sequences rather than
 * breaking the literal across lines.
 */
function escapeString(value: string): string {
	const jsonLiteral = JSON.stringify(value);
	// Strip JSON's surrounding double quotes, then swap which quote is escaped.
	return jsonLiteral.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'");
}

export { stripPrefix, toPascalCase, toCamelCase };
