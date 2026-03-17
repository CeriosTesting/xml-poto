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

	resolve(schema: XsdSchema): ResolvedSchema {
		this.schema = schema;
		this.buildLookups();
		this.resolvedTypeMap.clear();

		const resolved: ResolvedSchema = {
			targetNamespace: schema.targetNamespace,
			elementFormDefault: schema.elementFormDefault,
			namespaces: schema.namespaces,
			types: [],
			enums: [],
			rootElements: [],
		};

		// Resolve enums first (simpleTypes with enumerations)
		for (const st of schema.simpleTypes) {
			if (st.name && st.restriction && st.restriction.enumerations.length > 0) {
				resolved.enums.push({
					name: toPascalCase(st.name),
					xmlName: st.name,
					values: st.restriction.enumerations,
					baseType: stripPrefix(st.restriction.base),
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
			if (el.complexType) {
				// Element with inline complex type → root class
				this.addResolvedType(this.resolveComplexType(el.complexType, el.name, true));
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

		return resolved;
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
		for (const ag of this.schema.attributeGroups) {
			if (ag.name) {
				const attrs = [...ag.attributes];
				// Resolve nested attributeGroup refs
				for (const ref of ag.attributeGroupRefs) {
					const refName = stripPrefix(ref.ref);
					const resolved = this.attributeGroupMap.get(refName);
					if (resolved) attrs.push(...resolved);
				}
				this.attributeGroupMap.set(ag.name, attrs);
			}
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
		const resolved: ResolvedType = {
			className: classNameOverride ?? toPascalCase(name),
			xmlName: name,
			properties: [],
			isRootElement: isRoot,
			mixed: ct.mixed,
			abstract: ct.abstract,
		};

		if (this.schema.targetNamespace) {
			const prefix = this.findPrefixForUri(this.schema.targetNamespace);
			resolved.namespace = {
				uri: this.schema.targetNamespace,
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
		let order = 0;
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
				dataType: baseInfo.dataType,
			});
			this.resolveAttributes(sc.restriction.attributes, resolved.properties);
		}
	}

	private resolveComplexContent(cc: NonNullable<XsdComplexType["complexContent"]>, resolved: ResolvedType): void {
		if (cc.extension) {
			resolved.baseTypeName = toPascalCase(stripPrefix(cc.extension.base));

			let order = 0;
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
			resolved.baseTypeName = toPascalCase(stripPrefix(cc.restriction.base));
			if (cc.restriction.sequence) {
				this.resolveSequenceProperties(cc.restriction.sequence, resolved.properties, 0);
			}
			this.resolveAttributes(cc.restriction.attributes, resolved.properties);
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
			props.push({
				propertyName: `dynamicContent${order}`,
				xmlName: "",
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				order: order++,
			});
			// Use minOccurs/maxOccurs from any if needed
			if (any.minOccurs !== undefined && any.minOccurs > 0) {
				props[props.length - 1].required = true;
			}
		}

		return order;
	}

	private resolveChoiceProperties(choice: XsdChoice, props: ResolvedProperty[], startOrder: number): number {
		let order = startOrder;

		// Choice elements are all optional (only one is present at a time)
		for (const el of choice.elements) {
			const prop = this.resolveElementProperty(el, order++);
			prop.required = false; // choices are inherently optional
			props.push(prop);
		}

		for (const seq of choice.sequences) {
			order = this.resolveSequenceProperties(seq, props, order);
		}

		for (const gRef of choice.groupRefs) {
			order = this.resolveGroupRef(gRef, props, order);
		}

		return order;
	}

	private resolveAllProperties(all: XsdAll, props: ResolvedProperty[]): void {
		// xs:all elements have no order requirement
		for (const el of all.elements) {
			props.push(this.resolveElementProperty(el));
		}
	}

	private resolveGroupRef(gRef: XsdGroupRef, props: ResolvedProperty[], startOrder: number): number {
		const refName = stripPrefix(gRef.ref);
		const compositor = this.groupMap.get(refName);
		if (!compositor) return startOrder;

		if ("elements" in compositor && "choices" in compositor) {
			// It's a sequence
			return this.resolveSequenceProperties(compositor, props, startOrder);
		}
		if ("elements" in compositor && !("choices" in compositor)) {
			// Could be XsdAll or XsdChoice
			if ("sequences" in compositor) {
				return this.resolveChoiceProperties(compositor, props, startOrder);
			}
			this.resolveAllProperties(compositor, props);
		}
		return startOrder;
	}

	private resolveElementProperty(el: XsdElement, order?: number): ResolvedProperty {
		const isArray = el.maxOccurs === "unbounded" || (typeof el.maxOccurs === "number" && el.maxOccurs > 1);
		const isRequired = el.minOccurs === undefined || el.minOccurs > 0;

		// Resolve element name (could be a ref)
		const name = el.ref ? stripPrefix(el.ref) : el.name;

		// Check if this element is a substitution group head
		if (this.substitutionMap.has(name)) {
			return {
				propertyName: toCamelCase(name),
				xmlName: name,
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				required: isRequired,
				order,
			};
		}

		// Resolve the type
		let typeInfo: {
			tsType: string;
			initializer: string;
			complexTypeName?: string;
			enumTypeName?: string;
			enumValues?: string[];
			pattern?: string;
			dataType?: string;
		};

		if (el.complexType) {
			// Inline complex type — will need to generate a class for it
			const inlineTypeName = toPascalCase(name) + "Type";
			this.addResolvedType(this.resolveComplexType(el.complexType, name, false, inlineTypeName));
			typeInfo = {
				tsType: inlineTypeName,
				initializer: `new ${inlineTypeName}()`,
				complexTypeName: inlineTypeName,
			};
		} else if (el.simpleType) {
			typeInfo = this.resolveSimpleTypeInline(el.simpleType);
		} else if (el.type) {
			typeInfo = this.resolveTypeReference(el.type);
		} else {
			// No type means xs:anyType
			typeInfo = { tsType: "string", initializer: "''" };
		}

		const prop: ResolvedProperty = {
			propertyName: toCamelCase(name),
			xmlName: name,
			kind: isArray ? "array" : "element",
			tsType: isArray ? `${typeInfo.tsType}[]` : typeInfo.tsType,
			initializer: isArray ? "[]" : typeInfo.initializer,
			required: isRequired,
			order,
			isNullable: el.nillable,
			form: el.form ?? this.resolveElementForm(),
			defaultValue: el.defaultValue,
			complexTypeName: typeInfo.complexTypeName,
			enumValues: typeInfo.enumValues,
			pattern: typeInfo.pattern,
			enumTypeName: typeInfo.enumTypeName,
			dataType: typeInfo.dataType,
		};

		if (isArray) {
			prop.arrayItemName = name;
			prop.arrayItemType = typeInfo.complexTypeName;
		}

		return prop;
	}

	private resolveAttributes(attrs: XsdAttribute[], props: ResolvedProperty[]): void {
		for (const a of attrs) {
			if (a.ref) {
				// Attribute reference — resolve it if possible
				props.push({
					propertyName: toCamelCase(stripPrefix(a.ref)),
					xmlName: stripPrefix(a.ref),
					kind: "attribute",
					tsType: "string",
					initializer: a.defaultValue ? `'${escapeString(a.defaultValue)}'` : "''",
					required: a.use === "required",
					defaultValue: a.defaultValue,
				});
				continue;
			}

			let typeInfo: {
				tsType: string;
				initializer: string;
				enumValues?: string[];
				pattern?: string;
				enumTypeName?: string;
				dataType?: string;
			};

			if (a.simpleType) {
				typeInfo = this.resolveSimpleTypeInline(a.simpleType);
			} else if (a.type) {
				typeInfo = this.resolveTypeReference(a.type);
			} else {
				typeInfo = { tsType: "string", initializer: "''" };
			}

			const initializer = a.defaultValue
				? this.buildDefaultInitializer(typeInfo.tsType, a.defaultValue)
				: typeInfo.initializer;

			props.push({
				propertyName: toCamelCase(a.name),
				xmlName: a.name,
				kind: "attribute",
				tsType: typeInfo.tsType,
				initializer,
				required: a.use === "required",
				form: a.form,
				defaultValue: a.defaultValue,
				enumValues: typeInfo.enumValues,
				pattern: typeInfo.pattern,
				enumTypeName: typeInfo.enumTypeName,
				dataType: typeInfo.dataType,
			});
		}
	}

	private resolveTypeReference(typeRef: string): {
		tsType: string;
		initializer: string;
		complexTypeName?: string;
		enumTypeName?: string;
		enumValues?: string[];
		pattern?: string;
		dataType?: string;
	} {
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

	private resolveSimpleTypeInline(st: XsdSimpleType): {
		tsType: string;
		initializer: string;
		enumValues?: string[];
		pattern?: string;
		enumTypeName?: string;
		dataType?: string;
	} {
		if (st.restriction) {
			const baseInfo = this.resolveTypeReference(st.restriction.base);
			const result: ReturnType<typeof this.resolveSimpleTypeInline> = {
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

			return result;
		}

		if (st.list) {
			const itemInfo = this.resolveTypeReference(st.list.itemType);
			return {
				tsType: `${itemInfo.tsType}[]`,
				initializer: "[]",
			};
		}

		if (st.union) {
			// Resolve each member type and combine into a TS union
			if (st.union.memberTypes.length > 0) {
				const memberInfos = st.union.memberTypes.map((mt) => this.resolveTypeReference(mt));
				const uniqueTypes = [...new Set(memberInfos.map((m) => m.tsType))];
				const tsType = uniqueTypes.join(" | ");
				// Use the initializer of the first member type
				return { tsType, initializer: memberInfos[0].initializer };
			}
			return { tsType: "string", initializer: "''" };
		}

		return { tsType: "string", initializer: "''" };
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
		return this.schema.elementFormDefault;
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
	return name.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
}

/** Convert to camelCase: "MyTypeName" → "myTypeName" */
function toCamelCase(name: string): string {
	const pascal = toPascalCase(name);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Escape single quotes in a string for use in generated code */
function escapeString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export { stripPrefix, toPascalCase, toCamelCase };
