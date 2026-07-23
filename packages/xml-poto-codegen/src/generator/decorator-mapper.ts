import type { ResolvedProperty, ResolvedType } from "../xsd/xsd-resolver";

import { buildDecorator } from "./ts-builder";

/**
 * Maps resolved XSD types and properties to xml-poto decorator strings.
 */

/** Class-level decorators sit at column 0; property-level ones use buildDecorator's default. */
const CLASS_INDENT_LEVEL = 0;

/**
 * Get the class-level decorator string for a resolved type.
 *
 * Root/global elements get `@XmlRoot`. A non-root XSD complexType is a type
 * definition (schema type identity, not a global element declaration), so it gets
 * `@XmlType` — this lets the serializer treat the type's namespace as a fallback
 * that qualifies referencing elements and declare it once, instead of emitting a
 * redundant namespace declaration on every nested object. A complexType declared
 * inline on an element is a type definition too, but an anonymous one: it gets
 * `@XmlType({ anonymous: true })`, which keeps the namespace fallback but withholds
 * the schema type identity it does not have. When `useXmlRoot` is false the model is
 * flattened to class-level `@XmlElement` everywhere (the caller opted out of the
 * root/type distinction).
 */
export function mapClassDecorator(type: ResolvedType, useXmlRoot = true): string {
	if (type.isRootElement) {
		const opts: Record<string, unknown> = { name: `'${type.xmlName}'` };
		if (type.namespace) {
			opts.namespace = buildNamespaceObj(type.namespace);
		}
		if (type.rootNillable) {
			opts.isNullable = true;
		}
		return buildDecorator("XmlRoot", opts, CLASS_INDENT_LEVEL);
	}

	const opts: Record<string, unknown> = { name: `'${type.xmlName}'` };
	if (type.namespace) {
		opts.namespace = buildNamespaceObj(type.namespace);
	}
	if (type.form) {
		opts.form = `'${type.form}'`;
	}

	if (useXmlRoot) {
		// A complexType declared inline on an element names no schema type, so it must
		// not answer lookups for the element name it happens to carry. Only @XmlType
		// takes this option — the flattened @XmlElement form below declares an element,
		// where the question does not arise.
		if (type.isAnonymousType) {
			opts.anonymous = true;
		}
		return buildDecorator("XmlType", opts, CLASS_INDENT_LEVEL);
	}

	if (type.rootNillable) {
		opts.isNullable = true;
	}
	return buildDecorator("XmlElement", opts, CLASS_INDENT_LEVEL);
}

/**
 * Get the `@XmlInclude` decorator string listing this type's direct subtypes, or
 * an empty string when it has none. Subtypes are emitted as `() => Derived` thunks
 * because a base class is declared before its subtypes (temporal dead zone).
 *
 * Only used in single-file mode: there, every class shares one module, so the
 * thunks resolve without any import. In per-type mode a base referencing its
 * subtypes would create an import cycle whose eager `extends` hits the base's
 * temporal dead zone; there, polymorphic resolution relies instead on each
 * subtype self-registering its `@XmlType` identity when the barrel is loaded.
 */
export function mapIncludeDecorator(type: ResolvedType): string {
	if (!type.derivedTypeNames || type.derivedTypeNames.length === 0) return "";
	const refs = type.derivedTypeNames.map((name) => `() => ${name}`).join(", ");
	return `@XmlInclude(${refs})`;
}

/**
 * Get the property-level decorator string for a resolved property.
 *
 * `lazyTypeNames` lists referenced classes that cannot be declared before this
 * one (circular/self references); their `type:` options are emitted as
 * `() => Foo` thunks instead of direct identifiers, which would be evaluated
 * while the referenced class is still in its temporal dead zone.
 */
export function mapPropertyDecorator(prop: ResolvedProperty, lazyTypeNames?: ReadonlySet<string>): string {
	switch (prop.kind) {
		case "element":
			return buildElementDecorator(prop, lazyTypeNames);
		case "attribute":
			return buildAttributeDecorator(prop);
		case "text":
			return buildTextDecorator(prop);
		case "array":
			return buildArrayDecorator(prop, lazyTypeNames);
		case "dynamic":
			return buildDynamicDecorator(prop);
		default:
			return buildDecorator("XmlElement", { name: `'${prop.xmlName}'` });
	}
}

/** Collect all xml-poto import names needed for a type */
export function collectImports(type: ResolvedType, useXmlRoot = true, emitIncludes = false): Set<string> {
	const imports = new Set<string>();

	// Class decorator: @XmlRoot for global elements, @XmlType for complexTypes,
	// or flat @XmlElement when the root/type distinction is disabled.
	if (type.isRootElement) {
		imports.add("XmlRoot");
	} else {
		imports.add(useXmlRoot ? "XmlType" : "XmlElement");
	}

	// @XmlInclude for a base type that has subtypes (polymorphism via xsi:type).
	// Only emitted in single-file mode — see mapIncludeDecorator.
	if (emitIncludes && type.derivedTypeNames && type.derivedTypeNames.length > 0) {
		imports.add("XmlInclude");
	}

	for (const prop of type.properties) {
		switch (prop.kind) {
			case "element":
				imports.add("XmlElement");
				break;
			case "attribute":
				imports.add("XmlAttribute");
				break;
			case "text":
				imports.add("XmlText");
				break;
			case "array":
				imports.add("XmlArray");
				break;
			case "dynamic":
				imports.add("XmlDynamic");
				imports.add("DynamicElement");
				break;
		}
	}

	return imports;
}

// ── Individual Decorator Builders ──

/**
 * Emit the shared XSD facet options (validated at runtime by xml-poto).
 * enumValues/pattern come first to keep the historical option order.
 */
function applyFacetOptions(opts: Record<string, unknown>, prop: ResolvedProperty): void {
	if (prop.enumValues && prop.enumValues.length > 0)
		opts.enumValues = prop.enumValues.map((v) => `'${escapeString(v)}'`);
	if (prop.pattern) opts.pattern = `new RegExp(${JSON.stringify(prop.pattern)})`;
	if (prop.length !== undefined) opts.length = prop.length;
	if (prop.minLength !== undefined) opts.minLength = prop.minLength;
	if (prop.maxLength !== undefined) opts.maxLength = prop.maxLength;
	if (prop.minInclusive !== undefined) opts.minInclusive = prop.minInclusive;
	if (prop.maxInclusive !== undefined) opts.maxInclusive = prop.maxInclusive;
	if (prop.minExclusive !== undefined) opts.minExclusive = prop.minExclusive;
	if (prop.maxExclusive !== undefined) opts.maxExclusive = prop.maxExclusive;
	if (prop.totalDigits !== undefined) opts.totalDigits = prop.totalDigits;
	if (prop.fractionDigits !== undefined) opts.fractionDigits = prop.fractionDigits;
	if (prop.whiteSpace) opts.whiteSpace = `'${prop.whiteSpace}'`;
	if (prop.fixedValue !== undefined) opts.fixedValue = formatFixedValue(prop, prop.fixedValue);
}

/** Emit the xs:list option for list-valued properties */
function applyListOption(opts: Record<string, unknown>, prop: ResolvedProperty): void {
	if (!prop.isList) return;
	opts.list = prop.listItemType && prop.listItemType !== "string" ? `{ itemType: '${prop.listItemType}' }` : true;
}

/** Emit choice group options for xs:choice members */
function applyChoiceOptions(opts: Record<string, unknown>, prop: ResolvedProperty): void {
	if (!prop.choiceGroup) return;
	opts.choiceGroup = `'${prop.choiceGroup}'`;
	if (prop.choiceRequired) opts.choiceRequired = true;
}

/** Emit a runtime class reference: a direct identifier, or a thunk for lazy (circular) references */
function formatTypeRef(className: string, lazyTypeNames?: ReadonlySet<string>): string {
	return lazyTypeNames?.has(className) ? `() => ${className}` : className;
}

function buildElementDecorator(prop: ResolvedProperty, lazyTypeNames?: ReadonlySet<string>): string {
	const opts: Record<string, unknown> = {};

	opts.name = `'${prop.xmlName}'`;

	if (prop.required) opts.required = true;
	if (prop.order !== undefined) opts.order = prop.order;
	if (prop.isNullable) opts.isNullable = true;
	if (prop.form) opts.form = `'${prop.form}'`;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);
	if (prop.defaultValue !== undefined) opts.defaultValue = formatDefault(prop.tsType, prop.defaultValue);
	if (prop.complexTypeName) opts.type = formatTypeRef(prop.complexTypeName, lazyTypeNames);
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;
	applyFacetOptions(opts, prop);
	applyListOption(opts, prop);
	applyChoiceOptions(opts, prop);

	return buildDecorator("XmlElement", opts);
}

function buildAttributeDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	opts.name = `'${prop.xmlName}'`;

	if (prop.required) opts.required = true;
	if (prop.form) opts.form = `'${prop.form}'`;
	if (prop.defaultValue !== undefined) opts.defaultValue = formatDefault(prop.tsType, prop.defaultValue);
	applyFacetOptions(opts, prop);
	applyListOption(opts, prop);
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);

	return buildDecorator("XmlAttribute", opts);
}

function buildTextDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	if (prop.isMixedText) opts.mixed = true;
	if (prop.required) opts.required = true;
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;
	applyFacetOptions(opts, prop);
	applyListOption(opts, prop);

	return buildDecorator("XmlText", opts);
}

/**
 * `@XmlArray({ items })` for a collection of differently named elements — a
 * repeating compositor or a substitution group head.
 */
function buildItemsArrayDecorator(prop: ResolvedProperty, lazyTypeNames?: ReadonlySet<string>): string {
	const opts: Record<string, unknown> = {
		items: (prop.arrayItems ?? []).map((item) => {
			const parts = [`name: '${item.xmlName}'`];
			if (item.complexTypeName) parts.push(`type: ${formatTypeRef(item.complexTypeName, lazyTypeNames)}`);
			else if (item.dataType) parts.push(`dataType: '${item.dataType}'`);
			if (item.namespace) parts.push(`namespace: ${buildNamespaceObj(item.namespace)}`);
			return `{ ${parts.join(", ")} }`;
		}),
	};

	if (prop.order !== undefined) opts.order = prop.order;
	if (prop.required) opts.required = true;
	if (prop.minOccursCount !== undefined) opts.minOccurs = prop.minOccursCount;
	if (prop.maxOccursCount !== undefined) opts.maxOccurs = prop.maxOccursCount;

	return buildDecorator("XmlArray", opts);
}

function buildArrayDecorator(prop: ResolvedProperty, lazyTypeNames?: ReadonlySet<string>): string {
	const opts: Record<string, unknown> = {};

	// A repeating compositor: several alternatives in one ordered collection.
	if (prop.arrayItems && prop.arrayItems.length > 0) {
		return buildItemsArrayDecorator(prop, lazyTypeNames);
	}

	if (prop.arrayItemName) opts.itemName = `'${prop.arrayItemName}'`;
	if (prop.arrayContainerName) opts.containerName = `'${prop.arrayContainerName}'`;
	if (prop.arrayItemType) opts.type = formatTypeRef(prop.arrayItemType, lazyTypeNames);
	if (prop.order !== undefined) opts.order = prop.order;
	if (prop.isNullable) opts.isNullable = true;
	if (prop.form) opts.form = `'${prop.form}'`;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;
	applyFacetOptions(opts, prop);
	if (prop.minOccursCount !== undefined) opts.minOccurs = prop.minOccursCount;
	if (prop.maxOccursCount !== undefined) opts.maxOccurs = prop.maxOccursCount;
	applyChoiceOptions(opts, prop);

	return buildDecorator("XmlArray", opts);
}

function buildDynamicDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	if (prop.required) opts.required = true;
	if (prop.order !== undefined) opts.order = prop.order;

	return buildDecorator("XmlDynamic", opts);
}

function buildNamespaceObj(ns: { uri: string; prefix?: string }): string {
	if (ns.prefix) {
		return `{ uri: '${ns.uri}', prefix: '${ns.prefix}' }`;
	}
	return `{ uri: '${ns.uri}' }`;
}

function formatDefault(tsType: string, value: string): string {
	if (tsType === "number") return value;
	if (tsType === "boolean") return value === "true" ? "true" : "false";
	return `'${escapeString(value)}'`;
}

function formatFixedValue(prop: ResolvedProperty, value: string): string {
	// For lists, the fixed value applies to items — format by the item type.
	const tsType = prop.isList ? (prop.listItemType ?? "string") : prop.tsType;
	return formatDefault(tsType, value);
}

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
