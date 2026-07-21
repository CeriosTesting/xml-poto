import type { EnumStyle } from "../config/config-types";
import type { ResolvedEnum, ResolvedProperty, ResolvedSchema, ResolvedType } from "../xsd/xsd-resolver";

export interface ClassGeneratorOptions {
	xsdPath: string;
	enumStyle?: EnumStyle;
	useXmlRoot?: boolean;
	elementFormDefault?: "qualified" | "unqualified";
}

import { collectImports, mapClassDecorator, mapIncludeDecorator, mapPropertyDecorator } from "./decorator-mapper";
import { buildFileHeader, buildImport, buildJsDoc, buildProperty, indent, toKebabCase } from "./ts-builder";
import { sortTypesByDependency } from "./type-sorter";

export interface GeneratedFile {
	/** Filename (without directory) */
	fileName: string;
	/** Full TypeScript source content */
	content: string;
	/** Exported class/enum names */
	exports: string[];
}

/**
 * Generates TypeScript source files from a resolved XSD schema.
 */
export class ClassGenerator {
	private readonly importPath = "@cerios/xml-poto";
	private xsdPath: string;
	private enumStyle: EnumStyle;
	private useXmlRoot: boolean;
	private elementFormDefault?: "qualified" | "unqualified";

	constructor(options: ClassGeneratorOptions) {
		this.xsdPath = options.xsdPath;
		this.enumStyle = options.enumStyle ?? "union";
		this.useXmlRoot = options.useXmlRoot ?? true;
		this.elementFormDefault = options.elementFormDefault;
	}

	/**
	 * Generate files in 'per-type' mode: one file per class/enum + barrel index.
	 */
	generatePerType(schema: ResolvedSchema): GeneratedFile[] {
		const { sorted, lazyRefs, sameModuleClusters } = sortTypesByDependency(
			this.applyRootElements(schema.types, schema.rootElements),
		);

		// One file per class, except classes linked by an extends edge inside a
		// dependency cycle: those must share a module (an extends clause
		// evaluates eagerly, so splitting the cycle across modules always leaves
		// some import order that hits the base class's temporal dead zone).
		// A shared file is named after its first (base) class.
		const fileBaseByClass = new Map<string, string>();
		for (const cluster of sameModuleClusters) {
			const fileBase = toKebabCase(cluster[0]);
			for (const className of cluster) {
				fileBaseByClass.set(className, fileBase);
			}
		}
		for (const type of sorted) {
			if (!fileBaseByClass.has(type.className)) {
				fileBaseByClass.set(type.className, toKebabCase(type.className));
			}
		}

		const fileGroups = new Map<string, ResolvedType[]>();
		for (const type of sorted) {
			const fileBase = fileBaseByClass.get(type.className) as string;
			const group = fileGroups.get(fileBase);
			if (group) group.push(type);
			else fileGroups.set(fileBase, [type]);
		}

		const files = schema.enums.map((enumDef) => this.generateEnumFile(enumDef));
		for (const [fileBase, groupTypes] of fileGroups) {
			files.push(this.generateClassFile(fileBase, groupTypes, fileBaseByClass, schema.enums, lazyRefs));
		}

		// Generate barrel export
		if (files.length > 0) {
			files.push(this.generateBarrelExport(files));
		}

		return files;
	}

	/**
	 * Generate files in 'per-xsd' mode: all types in a single file.
	 */
	generatePerXsd(schema: ResolvedSchema, fileName?: string): GeneratedFile[] {
		const output = fileName ?? "generated";
		const file = this.generateSingleFile(schema, `${toKebabCase(output)}.ts`);
		return [file];
	}

	// ── Per-type generation ──

	private generateEnumFile(enumDef: ResolvedEnum): GeneratedFile {
		const fileName = `${toKebabCase(enumDef.name)}.ts`;
		const lines: string[] = [buildFileHeader(this.xsdPath), this.generateEnumSource(enumDef), ""];

		return {
			fileName,
			content: lines.join("\n"),
			exports: [enumDef.name],
		};
	}

	private generateClassFile(
		fileBase: string,
		types: ResolvedType[],
		fileBaseByClass: ReadonlyMap<string, string>,
		allEnums: ResolvedEnum[],
		lazyRefs: ReadonlyMap<string, Set<string>>,
	): GeneratedFile {
		const imports = new Set<string>();
		for (const type of types) {
			for (const imp of collectImports(type, this.useXmlRoot)) {
				imports.add(imp);
			}
		}
		const localImports = this.collectLocalImports(types, fileBase, fileBaseByClass, allEnums);

		const lines: string[] = [buildFileHeader(this.xsdPath), buildImport([...imports], this.importPath)];

		// Add local imports for referenced types
		for (const [file, names] of localImports) {
			lines.push(buildImport(names, `./${file}`));
		}

		lines.push("");
		for (const type of types) {
			lines.push(this.generateClassSource(type, lazyRefs.get(type.className)));
			lines.push("");
		}

		return {
			fileName: `${fileBase}.ts`,
			content: lines.join("\n"),
			exports: types.map((type) => type.className),
		};
	}

	private generateBarrelExport(files: GeneratedFile[]): GeneratedFile {
		const exports = files
			.filter((f) => f.fileName !== "index.ts")
			.map((f) => {
				const moduleName = f.fileName.replace(".ts", "");
				return `export { ${f.exports.join(", ")} } from "./${moduleName}";`;
			});

		return {
			fileName: "index.ts",
			content: buildFileHeader(this.xsdPath) + exports.join("\n") + "\n",
			exports: files.flatMap((f) => f.exports),
		};
	}

	// ── Single-file generation ──

	private generateSingleFile(schema: ResolvedSchema, fileName: string): GeneratedFile {
		const allImports = new Set<string>();
		const allExports: string[] = [];
		const parts: string[] = [buildFileHeader(this.xsdPath)];
		// Emit classes dependency-first: extends clauses and decorator `type:`
		// references are evaluated at class-definition time, so a class must be
		// declared after everything it references (thunks cover the cyclic rest).
		const { sorted, lazyRefs } = sortTypesByDependency(this.applyRootElements(schema.types, schema.rootElements));

		// Collect all imports (single-file mode emits @XmlInclude for polymorphism)
		for (const type of sorted) {
			for (const imp of collectImports(type, this.useXmlRoot, true)) {
				allImports.add(imp);
			}
		}

		// Check if DynamicElement is needed
		const needsDynamic = sorted.some((t) => t.properties.some((p) => p.kind === "dynamic"));
		if (needsDynamic) {
			allImports.add("DynamicElement");
		}

		parts.push(buildImport([...allImports], this.importPath));
		parts.push("");

		// Generate enums
		for (const enumDef of schema.enums) {
			parts.push(this.generateEnumSource(enumDef));
			parts.push("");
			allExports.push(enumDef.name);
		}

		// Generate classes
		for (const type of sorted) {
			parts.push(this.generateClassSource(type, lazyRefs.get(type.className), true));
			parts.push("");
			allExports.push(type.className);
		}

		return {
			fileName,
			content: parts.join("\n"),
			exports: allExports,
		};
	}

	// ── Source generation ──

	private generateEnumSource(enumDef: ResolvedEnum): string {
		const jsDoc = enumDef.documentation ? `${buildJsDoc(enumDef.documentation)}\n` : "";
		switch (this.enumStyle) {
			case "enum":
				return jsDoc + this.generateEnumAsEnum(enumDef);
			case "const-object":
				return jsDoc + this.generateEnumAsConstObject(enumDef);
			case "union":
			default:
				return jsDoc + this.generateEnumAsUnion(enumDef);
		}
	}

	private generateEnumAsUnion(enumDef: ResolvedEnum): string {
		// JSON.stringify, not raw interpolation: an enumeration token may contain a
		// quote or a control character, which would otherwise break the literal.
		const values = enumDef.values.map((v) => JSON.stringify(v)).join(" | ");
		return `export type ${enumDef.name} = ${values};`;
	}

	private generateEnumAsEnum(enumDef: ResolvedEnum): string {
		const members = enumDef.values
			.map((v) => {
				const key = toEnumKey(v);
				return `\t${key} = ${JSON.stringify(v)},`;
			})
			.join("\n");

		return `export enum ${enumDef.name} {\n${members}\n}`;
	}

	private generateEnumAsConstObject(enumDef: ResolvedEnum): string {
		const members = enumDef.values
			.map((v) => {
				const key = toEnumKey(v);
				return `\t${key}: ${JSON.stringify(v)},`;
			})
			.join("\n");

		const constDecl = `export const ${enumDef.name} = {\n${members}\n} as const;`;
		const typeDecl = `export type ${enumDef.name} = (typeof ${enumDef.name})[keyof typeof ${enumDef.name}];`;

		return `${constDecl}\n${typeDecl}`;
	}

	private generateClassSource(type: ResolvedType, lazyTypeNames?: ReadonlySet<string>, emitIncludes = false): string {
		const lines: string[] = [];

		// JSDoc from xs:documentation
		if (type.documentation) {
			lines.push(buildJsDoc(type.documentation));
		}

		// Class decorator
		lines.push(mapClassDecorator(type, this.useXmlRoot));

		// @XmlInclude for base types with subtypes (polymorphism via xsi:type).
		// Single-file mode only — in per-type mode subtypes self-register via @XmlType.
		if (emitIncludes) {
			const includeDecorator = mapIncludeDecorator(type);
			if (includeDecorator) {
				lines.push(includeDecorator);
			}
		}

		// Class declaration
		const extendsClause = type.baseTypeName ? ` extends ${type.baseTypeName}` : "";
		const abstractKeyword = type.abstract ? "abstract " : "";
		lines.push(`export ${abstractKeyword}class ${type.className}${extendsClause} {`);

		// Properties
		for (const prop of type.properties) {
			const decorator = mapPropertyDecorator(prop, lazyTypeNames);
			// Treat only `required === true` as required; `false` or `undefined` are optional.
			const isOptional = prop.required !== true;
			// Required enum-typed properties: the resolver's initializer is the base
			// type's ('' / 0), which is not assignable to the enum type. Emit a
			// definite-assignment assertion instead of inventing an enum value.
			//
			// Same for a required property whose facets no default can satisfy: an
			// initializer the schema rejects only defers the problem to a runtime facet
			// error at serialization time, so let the type system catch it instead.
			//
			// And for an abstract complex type: it is generated as an `abstract class`,
			// so there is no `new Type()` to initialize it with at all.
			const useDefiniteAssignment =
				!isOptional &&
				(prop.enumTypeName !== undefined || prop.isAbstractType === true || initializerViolatesFacets(prop));
			const initializer = isOptional || useDefiniteAssignment ? undefined : prop.initializer;
			if (prop.documentation) {
				lines.push(indent(buildJsDoc(prop.documentation), 1));
			}
			lines.push(`\t${decorator}`);
			lines.push(`\t${buildProperty(prop.propertyName, prop.tsType, initializer, isOptional, useDefiniteAssignment)}`);
			lines.push("");
		}

		// Remove trailing empty line inside class
		if (lines[lines.length - 1] === "") {
			lines.pop();
		}

		lines.push("}");

		return lines.join("\n");
	}

	// ── Helpers ──

	/**
	 * Collect imports for the referenced classes/enums of all types in a file,
	 * grouped by the target file they are generated into. References to classes
	 * in the same file (including self-references) need no import.
	 */
	private collectLocalImports(
		types: ResolvedType[],
		ownFileBase: string,
		fileBaseByClass: ReadonlyMap<string, string>,
		allEnums: ResolvedEnum[],
	): Map<string, string[]> {
		const enumNames = new Set(allEnums.map((e) => e.name));
		const namesByFile = new Map<string, Set<string>>();

		const addImport = (name: string | undefined): void => {
			if (!name) return;
			// Classes live in the file the sorter assigned them to; enums each in their own file.
			const targetFile = fileBaseByClass.get(name) ?? (enumNames.has(name) ? toKebabCase(name) : undefined);
			if (targetFile === undefined || targetFile === ownFileBase) return;
			const names = namesByFile.get(targetFile);
			if (names) names.add(name);
			else namesByFile.set(targetFile, new Set([name]));
		};

		for (const type of types) {
			addImport(type.baseTypeName);
			for (const prop of type.properties) {
				addImport(prop.complexTypeName);
				addImport(prop.arrayItemType);
				for (const item of prop.arrayItems ?? []) {
					addImport(item.complexTypeName);
				}
				addImport(prop.enumTypeName);
			}
		}

		return new Map([...namesByFile.entries()].map(([file, names]) => [file, [...names]]));
	}

	private applyRootElements(types: ResolvedType[], rootElements: ResolvedSchema["rootElements"]): ResolvedType[] {
		if (!this.useXmlRoot) {
			return types.map((type) =>
				type.isRootElement ? { ...type, isRootElement: false, form: this.elementFormDefault } : type,
			);
		}

		if (rootElements.length === 0) {
			return types;
		}

		const rootMap = new Map<string, ResolvedSchema["rootElements"]>();
		for (const root of rootElements) {
			const entries = rootMap.get(root.typeName);
			if (entries) {
				entries.push(root);
			} else {
				rootMap.set(root.typeName, [root]);
			}
		}

		return types.map((type) => {
			if (type.isRootElement) {
				return type;
			}

			const roots = rootMap.get(type.className);
			if (!roots || roots.length === 0) {
				return type;
			}
			const root = roots[0];

			return {
				...type,
				isRootElement: true,
				xmlName: root.name,
				rootNillable: root.nillable,
			};
		});
	}
}

/** Convert an enum value to a valid TypeScript enum key */
function toEnumKey(value: string): string {
	// Replace non-alphanumeric with underscore
	let key = value.replace(/[^a-zA-Z0-9_]/g, "_");

	// If it starts with a digit, prefix underscore to make it identifier-safe
	if (/^[0-9]/.test(key)) {
		key = `_${key}`;
	}

	// Remember if we had a leading underscore after digit-handling
	const hadLeadingUnderscore = key.startsWith("_");

	// PascalCase the underscore-separated segments
	let result = key
		.split("_")
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");

	// If we originally had a leading underscore but lost it during split/filter,
	// reintroduce it to avoid starting with a digit (e.g. "1star" -> "_1star" -> "1star")
	if (hadLeadingUnderscore && !result.startsWith("_")) {
		result = `_${result}`;
	}

	// Ensure the final result is a valid TypeScript identifier: /^[A-Za-z_][A-Za-z0-9_]*$/
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(result)) {
		// Strip any invalid leading characters
		result = result.replace(/^[^A-Za-z_]+/, "");
		// If still invalid or empty, prefix underscore
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(result)) {
			result = `_${result}`;
		}
		// If everything was stripped and we only have "_", fall back to a generic name
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(result)) {
			result = "_Value";
		}
	}

	return result;
}

/**
 * Would this property's default initializer violate the facets its own schema
 * declares? Such a default can never serialize — it only turns a missing
 * assignment into a runtime facet error, so the caller is better served by a
 * definite-assignment assertion that `tsc` enforces.
 *
 * A property carrying `defaultValue`/`fixedValue` is exempt: the schema chose
 * that value, so it is expected to be valid.
 */
function initializerViolatesFacets(prop: ResolvedProperty): boolean {
	if (prop.defaultValue !== undefined || prop.fixedValue !== undefined) return false;
	// A complex-type member is initialized with `new Foo()`, not a scalar default.
	if (prop.complexTypeName !== undefined) return false;
	// xs:list members are arrays; the facets describe their items, not the `[]` default.
	if (prop.isList) return false;

	switch (prop.tsType) {
		case "string":
			return emptyStringViolatesFacets(prop);
		case "number":
			return zeroViolatesFacets(prop);
		case "boolean":
			return excludedFromEnum(prop, "false");
		default:
			return false;
	}
}

/** Is the generated `''` default rejected by this property's facets? */
function emptyStringViolatesFacets(prop: ResolvedProperty): boolean {
	if (prop.pattern !== undefined) return true;
	if (prop.minLength !== undefined && prop.minLength > 0) return true;
	if (prop.length !== undefined && prop.length > 0) return true;
	return excludedFromEnum(prop, "");
}

/** Is the generated `0` default rejected by this property's facets? */
function zeroViolatesFacets(prop: ResolvedProperty): boolean {
	if (prop.minInclusive !== undefined && prop.minInclusive > 0) return true;
	if (prop.minExclusive !== undefined && prop.minExclusive >= 0) return true;
	if (prop.maxInclusive !== undefined && prop.maxInclusive < 0) return true;
	if (prop.maxExclusive !== undefined && prop.maxExclusive <= 0) return true;
	return excludedFromEnum(prop, "0");
}

/** Does an enumeration exist that does not list `lexical` among its tokens? */
function excludedFromEnum(prop: ResolvedProperty, lexical: string): boolean {
	return !!prop.enumValues && prop.enumValues.length > 0 && !prop.enumValues.includes(lexical);
}
