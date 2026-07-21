import type {
	XsdAll,
	XsdAttribute,
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
	/** For elements/arrays referencing a complex type: the class name */
	complexTypeName?: string;
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
	anyURI: { tsType: "string", initializer: "''" },
	QName: { tsType: "string", initializer: "''" },
	integer: { tsType: "number", initializer: "0" },
	int: { tsType: "number", initializer: "0" },
	long: { tsType: "number", initializer: "0" },
	short: { tsType: "number", initializer: "0" },
	byte: { tsType: "number", initializer: "0" },
	nonNegativeInteger: { tsType: "number", initializer: "0" },
	nonPositiveInteger: { tsType: "number", initializer: "0" },
	positiveInteger: { tsType: "number", initializer: "0" },
	negativeInteger: { tsType: "number", initializer: "0" },
	unsignedInt: { tsType: "number", initializer: "0" },
	unsignedLong: { tsType: "number", initializer: "0" },
	unsignedShort: { tsType: "number", initializer: "0" },
	unsignedByte: { tsType: "number", initializer: "0" },
	decimal: { tsType: "number", initializer: "0" },
	float: { tsType: "number", initializer: "0" },
	double: { tsType: "number", initializer: "0" },
	boolean: { tsType: "boolean", initializer: "false" },
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
export class XsdResolver {
	private schema!: XsdSchema;
	private complexTypeMap = new Map<string, XsdComplexType>();
	private simpleTypeMap = new Map<string, XsdSimpleType>();
	private groupMap = new Map<string, XsdSequence | XsdChoice | XsdAll>();
	private attributeGroupMap = new Map<string, XsdAttribute[]>();
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

	resolve(schema: XsdSchema): ResolvedSchema {
		this.schema = schema;
		this.buildLookups();
		this.resolvedTypeMap.clear();
		this.coverageNotes = [];
		this.choiceCounter = 0;
		this.activeTargetNamespace = schema.targetNamespace;
		this.activeElementFormDefault = schema.elementFormDefault;
		this.activeAttributeFormDefault = schema.attributeFormDefault;

		const resolved: ResolvedSchema = {
			targetNamespace: schema.targetNamespace,
			elementFormDefault: schema.elementFormDefault,
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

		// Resolve named complex types
		for (const ct of schema.complexTypes) {
			if (ct.name) {
				this.addResolvedType(this.resolveComplexType(ct, ct.name, false));
			}
		}

		// Resolve top-level elements
		for (const el of schema.elements) {
			this.noteIdentityConstraints(el);
			if (el.complexType) {
				// Element with inline complex type → root class
				const rootType = this.resolveComplexType(el.complexType, el.name, true);
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
		this.substitutionMap.clear();

		this.buildTypeLookups();
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
	}

	private buildGroupLookups(): void {
		for (const g of this.schema.groups) {
			if (g.name) {
				const compositor = g.sequence ?? g.choice ?? g.all;
				if (compositor) this.groupMap.set(g.name, compositor);
			}
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

		const resolveGroup = (name: string): XsdAttribute[] => {
			// Return cached result if already resolved.
			const cached = this.attributeGroupMap.get(name);
			if (cached) return cached;

			const def = groupDefs.get(name);
			if (!def) {
				// Unknown group; nothing to contribute.
				return [];
			}

			// Cycle detection: if we encounter the same name while resolving,
			// break the cycle and do not recurse further.
			if (resolving.has(name)) {
				return [];
			}

			resolving.add(name);
			const attrs: XsdAttribute[] = [...def.attributes];

			// Resolve nested attributeGroup refs recursively.
			for (const ref of def.attributeGroupRefs) {
				const refName = stripPrefix(ref.ref);
				const resolvedAttrs = resolveGroup(refName);
				if (resolvedAttrs.length) {
					attrs.push(...resolvedAttrs);
				}
			}

			resolving.delete(name);
			this.attributeGroupMap.set(name, attrs);
			return attrs;
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
		if (ct.sourceNamespace !== undefined) {
			this.activeTargetNamespace = ct.sourceNamespace;
			this.activeElementFormDefault = ct.sourceElementFormDefault;
			this.activeAttributeFormDefault = ct.sourceAttributeFormDefault;
		}
		try {
			return this.resolveComplexTypeInScope(ct, name, isRoot, classNameOverride);
		} finally {
			this.activeTargetNamespace = savedNamespace;
			this.activeElementFormDefault = savedElementForm;
			this.activeAttributeFormDefault = savedAttributeForm;
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

		// Handle simpleContent (text value + attributes)
		if (ct.simpleContent) {
			resolved.hasSimpleContent = true;
			this.resolveSimpleContent(ct.simpleContent, resolved);
			return resolved;
		}

		// Handle complexContent (extension/restriction of another complex type)
		if (ct.complexContent) {
			this.resolveComplexContent(ct.complexContent, resolved);
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
		for (const agRef of ct.attributeGroupRefs) {
			const refName = stripPrefix(agRef.ref);
			const attrs = this.attributeGroupMap.get(refName);
			if (attrs) this.resolveAttributes(attrs, resolved.properties);
		}

		// Handle xs:anyAttribute
		if (ct.anyAttribute) {
			resolved.properties.push({
				propertyName: "anyAttributes",
				xmlName: "",
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				documentation: "xs:anyAttribute wildcard.",
			});
		}

		return resolved;
	}

	private resolveSimpleContent(sc: NonNullable<XsdComplexType["simpleContent"]>, resolved: ResolvedType): void {
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
		} else if (sc.restriction) {
			const baseInfo = this.resolveTypeReference(sc.restriction.base);
			resolved.properties.push({
				propertyName: "value",
				xmlName: "",
				kind: "text",
				tsType: baseInfo.tsType,
				initializer: baseInfo.initializer,
				enumValues: sc.restriction.enumerations.length > 0 ? sc.restriction.enumerations : undefined,
				pattern: sc.restriction.pattern,
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
		}
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

	private resolveComplexContent(cc: NonNullable<XsdComplexType["complexContent"]>, resolved: ResolvedType): void {
		if (cc.extension) {
			resolved.baseTypeName = toPascalCase(stripPrefix(cc.extension.base));
			this.dropSelfReferentialBase(resolved);

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
			for (const agRef of cc.extension.attributeGroupRefs) {
				const refName = stripPrefix(agRef.ref);
				const attrs = this.attributeGroupMap.get(refName);
				if (attrs) this.resolveAttributes(attrs, resolved.properties);
			}
		} else if (cc.restriction) {
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
			for (const agRef of cc.restriction.attributeGroupRefs) {
				const refName = stripPrefix(agRef.ref);
				const attrs = this.attributeGroupMap.get(refName);
				if (attrs) this.resolveAttributes(attrs, resolved.properties);
			}
		}
	}

	private resolveSequenceProperties(seq: XsdSequence, props: ResolvedProperty[], startOrder: number): number {
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
				order: order++,
				documentation: `xs:any wildcard${wildcardDetails ? ` (${wildcardDetails})` : ""}.`,
			});
			// xs:any defaults minOccurs to 1 when omitted.
			if (any.minOccurs === undefined || any.minOccurs > 0) {
				props[props.length - 1].required = true;
			}
		}

		return order;
	}

	private resolveChoiceProperties(choice: XsdChoice, props: ResolvedProperty[], startOrder: number): number {
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
		// (a sequence branch may set several of them together).
		for (const seq of choice.sequences) {
			order = this.resolveSequenceProperties(seq, props, order);
		}

		for (const gRef of choice.groupRefs) {
			order = this.resolveGroupRef(gRef, props, order);
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
		const compositor = this.groupMap.get(refName);
		if (!compositor) return startOrder;

		// Discriminate by structure: only XsdSequence has 'any';
		// XsdChoice has 'sequences' but no 'any'; XsdAll has neither.
		if ("any" in compositor) {
			return this.resolveSequenceProperties(compositor, props, startOrder);
		}
		if ("sequences" in compositor) {
			return this.resolveChoiceProperties(compositor, props, startOrder);
		}
		this.resolveAllProperties(compositor, props);
		return startOrder;
	}

	private resolveElementProperty(el: XsdElement, order?: number): ResolvedProperty {
		const isArray = el.maxOccurs === "unbounded" || (typeof el.maxOccurs === "number" && el.maxOccurs > 1);
		const isRequired = el.minOccurs === undefined || el.minOccurs > 0;
		const form = el.form ?? this.resolveElementForm();

		this.noteIdentityConstraints(el);

		// Resolve element name (could be a ref)
		const name = el.ref ? stripPrefix(el.ref) : el.name;

		// Check if this element is a substitution group head
		const substitutes = this.substitutionMap.get(name);
		if (substitutes) {
			return this.resolveSubstitutionHeadProperty(el, name, substitutes, isRequired, order);
		}

		const typeInfo = this.resolveElementTypeInfo(el, name);

		const prop: ResolvedProperty = {
			propertyName: toCamelCase(name),
			xmlName: name,
			kind: isArray ? "array" : "element",
			tsType: isArray ? `${typeInfo.tsType}[]` : typeInfo.tsType,
			initializer: isArray ? "[]" : typeInfo.initializer,
			required: isRequired,
			order,
			isNullable: el.nillable,
			form,
			namespace: this.resolveNamespaceForForm(form),
			defaultValue: el.defaultValue ?? el.fixed,
			fixedValue: el.fixed,
			complexTypeName: typeInfo.complexTypeName,
			enumValues: typeInfo.enumValues,
			pattern: typeInfo.pattern,
			enumTypeName: typeInfo.enumTypeName,
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
			documentation: el.documentation ?? typeInfo.documentation,
			isList: typeInfo.isList,
			listItemType: typeInfo.listItemType,
		};

		if (isArray) {
			this.applyArrayOccurs(prop, el, name, typeInfo);
		}

		return prop;
	}

	/** Build the dynamic property emitted for a substitution group head element */
	private resolveSubstitutionHeadProperty(
		el: XsdElement,
		name: string,
		substitutes: string[],
		isRequired: boolean,
		order?: number,
	): ResolvedProperty {
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

	/** Resolve the type information for an element declaration */
	private resolveElementTypeInfo(el: XsdElement, name: string): ResolvedTypeInfo {
		if (el.complexType) {
			// Inline complex type — will need to generate a class for it
			const inlineTypeName = toPascalCase(name) + "Type";
			this.addResolvedType(this.resolveComplexType(el.complexType, name, false, inlineTypeName));
			return {
				tsType: inlineTypeName,
				initializer: `new ${inlineTypeName}()`,
				complexTypeName: inlineTypeName,
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

			let typeInfo: ResolvedTypeInfo;

			if (a.simpleType) {
				typeInfo = this.resolveSimpleTypeInline(a.simpleType);
			} else if (a.type) {
				typeInfo = this.resolveTypeReference(a.type);
			} else {
				typeInfo = { tsType: "string", initializer: "''" };
			}

			const defaultOrFixed = a.defaultValue ?? a.fixed;
			const initializer = defaultOrFixed
				? this.buildDefaultInitializer(typeInfo.tsType, defaultOrFixed)
				: typeInfo.initializer;
			const form = a.form ?? this.resolveAttributeForm();
			const enumValues = typeInfo.enumValues ? [...typeInfo.enumValues] : a.fixed ? [a.fixed] : undefined;

			props.push({
				propertyName: toCamelCase(a.name),
				xmlName: a.name,
				kind: "attribute",
				tsType: typeInfo.tsType,
				initializer,
				required: a.use === "required",
				form,
				namespace: this.resolveNamespaceForForm(form),
				defaultValue: defaultOrFixed,
				fixedValue: a.fixed,
				enumValues,
				pattern: typeInfo.pattern,
				enumTypeName: typeInfo.enumTypeName,
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
				documentation: a.documentation ?? typeInfo.documentation,
				isList: typeInfo.isList,
				listItemType: typeInfo.listItemType,
			});
		}
	}

	/** Resolve an attribute declared via ref="..." */
	private resolveAttributeRef(a: XsdAttribute): ResolvedProperty {
		const form = a.form ?? this.resolveAttributeForm();
		const defaultOrFixed = a.defaultValue ?? a.fixed;
		return {
			propertyName: toCamelCase(stripPrefix(a.ref!)),
			xmlName: stripPrefix(a.ref!),
			kind: "attribute",
			tsType: "string",
			initializer: defaultOrFixed ? `'${escapeString(defaultOrFixed)}'` : "''",
			required: a.use === "required",
			form,
			namespace: this.resolveNamespaceForForm(form),
			defaultValue: defaultOrFixed,
			fixedValue: a.fixed,
			documentation: a.documentation,
		};
	}

	private resolveTypeReference(typeRef: string): ResolvedTypeInfo {
		const localName = stripPrefix(typeRef);

		// Check XSD built-in types
		const builtin = XSD_TYPE_MAP[localName];
		if (builtin) return { ...builtin };

		// Check named complex types
		if (this.complexTypeMap.has(localName)) {
			const className = toPascalCase(localName);
			return {
				tsType: className,
				initializer: `new ${className}()`,
				complexTypeName: className,
			};
		}

		// Check named simple types
		const st = this.simpleTypeMap.get(localName);
		if (st) {
			return this.resolveSimpleTypeInline(st);
		}

		// Unknown type — treat as string
		return { tsType: "string", initializer: "''" };
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
				} else {
					result.enumValues = st.restriction.enumerations;
				}
			}

			if (st.restriction.pattern) {
				result.pattern = st.restriction.pattern;
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

			return result;
		}

		if (st.list) {
			// Copy the item type's facets so they validate each list item
			const itemInfo = this.resolveTypeReference(st.list.itemType);
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
			// Resolve each member type and combine into a TS union
			if (st.union.memberTypes.length > 0) {
				const memberInfos = st.union.memberTypes.map((mt) => this.resolveTypeReference(mt));
				const uniqueTypes = [...new Set(memberInfos.map((m) => m.tsType))];
				const tsType = uniqueTypes.join(" | ");
				// Prefer a string member's initializer as the safest default for mixed unions.
				const stringMember = memberInfos.find((m) => m.tsType === "string");
				const memberDoc = `xs:union of ${st.union.memberTypes.join(", ")}.`;
				return {
					tsType,
					initializer: (stringMember ?? memberInfos[0]).initializer,
					documentation: st.documentation ? `${st.documentation}\n${memberDoc}` : memberDoc,
				};
			}
			return { tsType: "string", initializer: "''", documentation: st.documentation };
		}

		return { tsType: "string", initializer: "''", documentation: st.documentation };
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

	private resolveElementForm(): "qualified" | "unqualified" | undefined {
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

/** Escape single quotes in a string for use in generated code */
function escapeString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export { stripPrefix, toPascalCase, toCamelCase };
