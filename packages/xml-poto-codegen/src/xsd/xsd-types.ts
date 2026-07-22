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
	/** Top-level attribute declarations, the targets of `xs:attribute ref="…"` */
	attributes: XsdAttribute[];
	attributeGroups: XsdAttributeGroup[];
	imports: XsdImport[];
	includes: XsdInclude[];
	/** xs:redefine references (merged like includes; redefinition overrides are not applied) */
	redefines: XsdRedefine[];
	/** xs:notation names declared in the schema */
	notations: string[];
	/** Schema-level xs:annotation/xs:documentation text */
	documentation?: string;
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
	/**
	 * `abstract="true"`: the element itself may not appear in a document, only the
	 * members of the substitution group it heads.
	 */
	abstract?: boolean;
	/** Inline complexType definition */
	complexType?: XsdComplexType;
	/** Inline simpleType definition */
	simpleType?: XsdSimpleType;
	/** xs:annotation/xs:documentation text */
	documentation?: string;
	/** Identity constraints (xs:key/xs:keyref/xs:unique) declared on this element */
	identityConstraints?: XsdIdentityConstraint[];
}

export interface XsdIdentityConstraint {
	kind: "key" | "keyref" | "unique";
	name: string;
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
	/** xs:annotation/xs:documentation text */
	documentation?: string;
	/**
	 * Target namespace of the schema this type was defined in, set during merge when
	 * it differs from the importing schema (xs:import of another namespace). Lets the
	 * resolver qualify each type and its members with their OWN namespace instead of
	 * the importing schema's. Undefined for types defined in the main schema and for
	 * chameleon includes (which adopt the including schema's namespace).
	 */
	sourceNamespace?: string;
	/** elementFormDefault of the schema this type was defined in (see sourceNamespace). */
	sourceElementFormDefault?: "qualified" | "unqualified";
	/** attributeFormDefault of the schema this type was defined in (see sourceNamespace). */
	sourceAttributeFormDefault?: "qualified" | "unqualified";
	/**
	 * Declared inside an `xs:redefine`, so it deliberately reuses the name of the
	 * type it redefines. Marks the duplicate name as intentional rather than the
	 * collision between two unrelated types that generation must keep apart.
	 */
	isRedefinition?: boolean;
}

// ── Simple Types ──

export interface XsdSimpleType {
	name?: string;
	restriction?: XsdRestriction;
	list?: XsdList;
	union?: XsdUnion;
	/** xs:annotation/xs:documentation text */
	documentation?: string;
}

export interface XsdRestriction {
	base: string;
	enumerations: string[];
	pattern?: string;
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
}

export interface XsdList {
	/** The `itemType` attribute; empty when the item type is declared inline instead */
	itemType: string;
	/** Inline `<xs:simpleType>` item declaration, the alternative to `itemType` */
	itemSimpleType?: XsdSimpleType;
}

export interface XsdUnion {
	/** Types named by the `memberTypes` attribute */
	memberTypes: string[];
	/** Inline `<xs:simpleType>` members, which may appear with or instead of `memberTypes` */
	memberSimpleTypes: XsdSimpleType[];
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
	/** xs:annotation/xs:documentation text */
	documentation?: string;
}

// ── Compositors ──

export interface XsdSequence {
	elements: XsdElement[];
	choices: XsdChoice[];
	sequences: XsdSequence[];
	groupRefs: XsdGroupRef[];
	any: XsdAny[];
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
}

export interface XsdChoice {
	elements: XsdElement[];
	sequences: XsdSequence[];
	groupRefs: XsdGroupRef[];
	/** xs:any wildcards declared as a branch of this choice */
	any: XsdAny[];
	minOccurs?: number;
	maxOccurs?: number | "unbounded";
}

export interface XsdAll {
	elements: XsdElement[];
	/** Nested choices (XSD 1.1 allows xs:choice inside xs:all) */
	choices: XsdChoice[];
	minOccurs?: number;
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
	attributeGroupRefs: XsdAttributeGroupRef[];
	/** xs:anyAttribute */
	anyAttribute?: boolean;
}

export interface XsdSimpleContentRestriction {
	base: string;
	enumerations: string[];
	pattern?: string;
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
	attributes: XsdAttribute[];
	attributeGroupRefs: XsdAttributeGroupRef[];
	/** xs:anyAttribute */
	anyAttribute?: boolean;
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
	/** xs:anyAttribute */
	anyAttribute?: boolean;
}

export interface XsdComplexContentRestriction {
	base: string;
	sequence?: XsdSequence;
	choice?: XsdChoice;
	all?: XsdAll;
	attributes: XsdAttribute[];
	groupRefs: XsdGroupRef[];
	attributeGroupRefs: XsdAttributeGroupRef[];
	/** xs:anyAttribute */
	anyAttribute?: boolean;
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
	/** xs:anyAttribute */
	anyAttribute?: boolean;
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

export interface XsdRedefine {
	schemaLocation: string;
}

// ── WSDL ──
// Only what is needed to describe an operation: which element a message carries,
// which messages an operation exchanges, and the soapAction to send it with.

/** A WSDL `<message>`: a name and the element its parts carry. */
export interface WsdlMessage {
	name: string;
	/** Qualified element name of the first (document/literal) part, when it has one */
	elementName?: string;
	/** Number of parts, so a multi-part (RPC-style) message can be reported and skipped */
	partCount: number;
}

/** One `<operation>` of a `<portType>`, with the messages it exchanges. */
export interface WsdlOperation {
	name: string;
	documentation?: string;
	/** Message name of the input, without prefix */
	inputMessage?: string;
	/** Message name of the output, without prefix */
	outputMessage?: string;
	/** Fault name → message name */
	faults: Record<string, string>;
	/** `soapAction` from the SOAP binding, when one is declared */
	soapAction?: string;
	/** Binding style: `document` (supported) or `rpc` (reported and skipped) */
	style?: "document" | "rpc";
	/** `use` from the SOAP body: `literal` (supported) or `encoded` (reported and skipped) */
	use?: "literal" | "encoded";
}

/** A WSDL `<portType>` and its operations. */
export interface WsdlPortType {
	name: string;
	operations: WsdlOperation[];
}

/** The parts of a WSDL document that describe its operations. */
export interface WsdlDefinitions {
	/** targetNamespace of the `<definitions>` element */
	targetNamespace?: string;
	messages: WsdlMessage[];
	portTypes: WsdlPortType[];
}
