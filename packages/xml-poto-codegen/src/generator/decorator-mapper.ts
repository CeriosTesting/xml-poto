import type { ResolvedProperty, ResolvedType } from "../xsd/xsd-resolver";

import { buildDecorator } from "./ts-builder";

/**
 * Maps resolved XSD types and properties to xml-poto decorator strings.
 */

/** Get the class-level decorator string for a resolved type */
export function mapClassDecorator(type: ResolvedType): string {
	if (type.isRootElement) {
		const opts: Record<string, unknown> = { name: `'${type.xmlName}'` };
		if (type.namespace) {
			opts.namespace = buildNamespaceObj(type.namespace);
		}
		if (type.rootNillable) {
			opts.isNullable = true;
		}
		return buildDecorator("XmlRoot", opts);
	}

	const opts: Record<string, unknown> = { name: `'${type.xmlName}'` };
	if (type.namespace) {
		opts.namespace = buildNamespaceObj(type.namespace);
	}

	return buildDecorator("XmlElement", opts);
}

/** Get the property-level decorator string for a resolved property */
export function mapPropertyDecorator(prop: ResolvedProperty): string {
	switch (prop.kind) {
		case "element":
			return buildElementDecorator(prop);
		case "attribute":
			return buildAttributeDecorator(prop);
		case "text":
			return buildTextDecorator(prop);
		case "array":
			return buildArrayDecorator(prop);
		case "dynamic":
			return buildDynamicDecorator(prop);
		default:
			return buildDecorator("XmlElement", { name: `'${prop.xmlName}'` });
	}
}

/** Collect all xml-poto import names needed for a type */
export function collectImports(type: ResolvedType): Set<string> {
	const imports = new Set<string>();

	// Class decorator
	imports.add(type.isRootElement ? "XmlRoot" : "XmlElement");

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

function buildElementDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	opts.name = `'${prop.xmlName}'`;

	if (prop.required) opts.required = true;
	if (prop.order !== undefined) opts.order = prop.order;
	if (prop.isNullable) opts.isNullable = true;
	if (prop.form) opts.form = `'${prop.form}'`;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);
	if (prop.defaultValue !== undefined) opts.defaultValue = formatDefault(prop.tsType, prop.defaultValue);
	if (prop.complexTypeName) opts.type = prop.complexTypeName;
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;

	return buildDecorator("XmlElement", opts);
}

function buildAttributeDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	opts.name = `'${prop.xmlName}'`;

	if (prop.required) opts.required = true;
	if (prop.form) opts.form = `'${prop.form}'`;
	if (prop.defaultValue !== undefined) opts.defaultValue = formatDefault(prop.tsType, prop.defaultValue);
	if (prop.enumValues && prop.enumValues.length > 0)
		opts.enumValues = prop.enumValues.map((v) => `'${escapeString(v)}'`);
	if (prop.pattern) opts.pattern = `new RegExp(${JSON.stringify(prop.pattern)})`;
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);

	return buildDecorator("XmlAttribute", opts);
}

function buildTextDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	if (prop.required) opts.required = true;
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;

	return buildDecorator("XmlText", opts);
}

function buildArrayDecorator(prop: ResolvedProperty): string {
	const opts: Record<string, unknown> = {};

	if (prop.arrayItemName) opts.itemName = `'${prop.arrayItemName}'`;
	if (prop.arrayContainerName) opts.containerName = `'${prop.arrayContainerName}'`;
	if (prop.arrayItemType) opts.type = prop.arrayItemType;
	if (prop.order !== undefined) opts.order = prop.order;
	if (prop.isNullable) opts.isNullable = true;
	if (prop.namespace) opts.namespace = buildNamespaceObj(prop.namespace);
	if (prop.dataType) opts.dataType = `'${prop.dataType}'`;

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

function escapeString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
