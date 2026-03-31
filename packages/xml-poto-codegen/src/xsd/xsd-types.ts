// ── XSD Schema Model Types ──
// These types represent a parsed XSD schema in a structured form.
// They are produced by the XSD parser and consumed by the resolver and generator.

export interface XsdNamespace {
	uri: string;
	prefix?: string;
}

// ── Top-level Schema ──

export interface XsdSchema {
	targetNamespace?: string;
	elementFormDefault?: "qualified" | "unqualified";
	attributeFormDefault?: "qualified" | "unqualified";
	namespaces: Map<string, string>; // prefix → URI
	elements: XsdElement[];
	complexTypes: XsdComplexType[];
	simpleTypes: XsdSimpleType[];
	groups: XsdGroup[];
	attributeGroups: XsdAttributeGroup[];
	imports: XsdImport[];
	includes: XsdInclude[];
}

// ── Elements ──

export interface XsdElement {
	name: string;
	type?: string;
	ref?: string;
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
	nillable?: boolean;
	defaultValue?: string;
	fixed?: string;
	form?: "qualified" | "unqualified";
	/** Substitution group head element name */
	substitutionGroup?: string;
	/** Inline complexType definition */
	complexType?: XsdComplexType;
	/** Inline simpleType definition */
	simpleType?: XsdSimpleType;
}

// ── Complex Types ──

export interface XsdComplexType {
	name?: string;
	mixed?: boolean;
	abstract?: boolean;
	sequence?: XsdSequence;
	choice?: XsdChoice;
	all?: XsdAll;
	attributes: XsdAttribute[];
	simpleContent?: XsdSimpleContent;
	complexContent?: XsdComplexContent;
	/** Group references within this type */
	groupRefs: XsdGroupRef[];
	/** Attribute group references */
	attributeGroupRefs: XsdAttributeGroupRef[];
	/** xs:anyAttribute */
	anyAttribute?: boolean;
}

// ── Simple Types ──

export interface XsdSimpleType {
	name?: string;
	restriction?: XsdRestriction;
	list?: XsdList;
	union?: XsdUnion;
}

export interface XsdRestriction {
	base: string;
	enumerations: string[];
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	minInclusive?: number;
	maxInclusive?: number;
	minExclusive?: number;
	maxExclusive?: number;
	totalDigits?: number;
	fractionDigits?: number;
	whiteSpace?: "preserve" | "replace" | "collapse";
}

export interface XsdList {
	itemType: string;
}

export interface XsdUnion {
	memberTypes: string[];
}

// ── Attributes ──

export interface XsdAttribute {
	name: string;
	type?: string;
	use?: "required" | "optional" | "prohibited";
	defaultValue?: string;
	fixed?: string;
	form?: "qualified" | "unqualified";
	ref?: string;
	simpleType?: XsdSimpleType;
}

// ── Compositors ──

export interface XsdSequence {
	elements: XsdElement[];
	choices: XsdChoice[];
	sequences: XsdSequence[];
	groupRefs: XsdGroupRef[];
	any: XsdAny[];
}

export interface XsdChoice {
	elements: XsdElement[];
	sequences: XsdSequence[];
	groupRefs: XsdGroupRef[];
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
}

export interface XsdAll {
	elements: XsdElement[];
}

export interface XsdAny {
	namespace?: string;
	processContents?: "strict" | "lax" | "skip";
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
}

// ── Content Models ──

export interface XsdSimpleContent {
	extension?: XsdSimpleContentExtension;
	restriction?: XsdSimpleContentRestriction;
}

export interface XsdSimpleContentExtension {
	base: string;
	attributes: XsdAttribute[];
}

export interface XsdSimpleContentRestriction {
	base: string;
	enumerations: string[];
	pattern?: string;
	minLength?: number;
	maxLength?: number;
	minInclusive?: number;
	maxInclusive?: number;
	minExclusive?: number;
	maxExclusive?: number;
	totalDigits?: number;
	fractionDigits?: number;
	whiteSpace?: "preserve" | "replace" | "collapse";
	attributes: XsdAttribute[];
}

export interface XsdComplexContent {
	extension?: XsdComplexContentExtension;
	restriction?: XsdComplexContentRestriction;
	mixed?: boolean;
}

export interface XsdComplexContentExtension {
	base: string;
	sequence?: XsdSequence;
	choice?: XsdChoice;
	all?: XsdAll;
	attributes: XsdAttribute[];
	groupRefs: XsdGroupRef[];
	attributeGroupRefs: XsdAttributeGroupRef[];
}

export interface XsdComplexContentRestriction {
	base: string;
	sequence?: XsdSequence;
	attributes: XsdAttribute[];
}

// ── Groups ──

export interface XsdGroup {
	name: string;
	sequence?: XsdSequence;
	choice?: XsdChoice;
	all?: XsdAll;
}

export interface XsdGroupRef {
	ref: string;
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
}

export interface XsdAttributeGroup {
	name: string;
	attributes: XsdAttribute[];
	attributeGroupRefs: XsdAttributeGroupRef[];
}

export interface XsdAttributeGroupRef {
	ref: string;
}

// ── Schema References ──

export interface XsdImport {
	namespace?: string;
	schemaLocation?: string;
}

export interface XsdInclude {
	schemaLocation: string;
}
