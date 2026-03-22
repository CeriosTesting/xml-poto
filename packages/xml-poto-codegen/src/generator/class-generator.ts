import type { EnumStyle } from "../config/config-types";
import type { ResolvedEnum, ResolvedSchema, ResolvedType } from "../xsd/xsd-resolver";

import { collectImports, mapClassDecorator, mapPropertyDecorator } from "./decorator-mapper";
import { buildFileHeader, buildImport, buildProperty, toKebabCase } from "./ts-builder";

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

	constructor(options: { xsdPath: string; enumStyle?: EnumStyle }) {
		this.xsdPath = options.xsdPath;
		this.enumStyle = options.enumStyle ?? "union";
	}

	/**
	 * Generate files in 'per-type' mode: one file per class/enum + barrel index.
	 */
	generatePerType(schema: ResolvedSchema): GeneratedFile[] {
		const files: GeneratedFile[] = [];
		const resolvedTypes = this.applyRootElements(schema.types, schema.rootElements);

		// Generate enum files
		for (const enumDef of schema.enums) {
			files.push(this.generateEnumFile(enumDef));
		}

		// Generate class files
		for (const type of resolvedTypes) {
			files.push(this.generateClassFile(type, resolvedTypes, schema.enums));
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

	private generateClassFile(type: ResolvedType, allTypes: ResolvedType[], allEnums: ResolvedEnum[]): GeneratedFile {
		const fileName = `${toKebabCase(type.className)}.ts`;
		const imports = collectImports(type);
		const localImports = this.collectLocalImports(type, allTypes, allEnums);

		const lines: string[] = [buildFileHeader(this.xsdPath), buildImport([...imports], this.importPath)];

		// Add local imports for referenced types
		for (const [name, file] of localImports) {
			lines.push(buildImport([name], `./${file.replace(".ts", "")}`));
		}

		lines.push("");
		lines.push(this.generateClassSource(type));
		lines.push("");

		return {
			fileName,
			content: lines.join("\n"),
			exports: [type.className],
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
		const resolvedTypes = this.applyRootElements(schema.types, schema.rootElements);

		// Collect all imports
		for (const type of resolvedTypes) {
			for (const imp of collectImports(type)) {
				allImports.add(imp);
			}
		}

		// Check if DynamicElement is needed
		const needsDynamic = resolvedTypes.some((t) => t.properties.some((p) => p.kind === "dynamic"));
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
		for (const type of resolvedTypes) {
			parts.push(this.generateClassSource(type));
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
		switch (this.enumStyle) {
			case "enum":
				return this.generateEnumAsEnum(enumDef);
			case "const-object":
				return this.generateEnumAsConstObject(enumDef);
			case "union":
			default:
				return this.generateEnumAsUnion(enumDef);
		}
	}

	private generateEnumAsUnion(enumDef: ResolvedEnum): string {
		const values = enumDef.values.map((v) => `"${v}"`).join(" | ");
		return `export type ${enumDef.name} = ${values};`;
	}

	private generateEnumAsEnum(enumDef: ResolvedEnum): string {
		const members = enumDef.values
			.map((v) => {
				const key = toEnumKey(v);
				return `\t${key} = "${v}",`;
			})
			.join("\n");

		return `export enum ${enumDef.name} {\n${members}\n}`;
	}

	private generateEnumAsConstObject(enumDef: ResolvedEnum): string {
		const members = enumDef.values
			.map((v) => {
				const key = toEnumKey(v);
				return `\t${key}: "${v}",`;
			})
			.join("\n");

		const constDecl = `export const ${enumDef.name} = {\n${members}\n} as const;`;
		const typeDecl = `export type ${enumDef.name} = (typeof ${enumDef.name})[keyof typeof ${enumDef.name}];`;

		return `${constDecl}\n${typeDecl}`;
	}

	private generateClassSource(type: ResolvedType): string {
		const lines: string[] = [];

		// Class decorator
		lines.push(mapClassDecorator(type));

		// Class declaration
		const extendsClause = type.baseTypeName ? ` extends ${type.baseTypeName}` : "";
		lines.push(`export class ${type.className}${extendsClause} {`);

		// Properties
		for (const prop of type.properties) {
			const decorator = mapPropertyDecorator(prop);
			const isOptional = prop.required === false && prop.kind !== "dynamic";
			const initializer = isOptional ? undefined : prop.initializer;
			lines.push(`\t${decorator}`);
			lines.push(`\t${buildProperty(prop.propertyName, prop.tsType, initializer, isOptional)}`);
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

	private collectLocalImports(
		type: ResolvedType,
		allTypes: ResolvedType[],
		allEnums: ResolvedEnum[],
	): Map<string, string> {
		const imports = new Map<string, string>();
		const typeNames = new Set(allTypes.map((t) => t.className));
		const enumNames = new Set(allEnums.map((e) => e.name));

		// Check base type
		if (type.baseTypeName && typeNames.has(type.baseTypeName)) {
			imports.set(type.baseTypeName, `${toKebabCase(type.baseTypeName)}.ts`);
		}

		// Check property types
		for (const prop of type.properties) {
			if (prop.complexTypeName && typeNames.has(prop.complexTypeName)) {
				imports.set(prop.complexTypeName, `${toKebabCase(prop.complexTypeName)}.ts`);
			}
			if (prop.arrayItemType && typeNames.has(prop.arrayItemType)) {
				imports.set(prop.arrayItemType, `${toKebabCase(prop.arrayItemType)}.ts`);
			}
			if (prop.enumTypeName && enumNames.has(prop.enumTypeName)) {
				imports.set(prop.enumTypeName, `${toKebabCase(prop.enumTypeName)}.ts`);
			}
		}

		// Remove self-reference
		imports.delete(type.className);

		return imports;
	}

	private applyRootElements(types: ResolvedType[], rootElements: ResolvedSchema["rootElements"]): ResolvedType[] {
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
	// Replace non-alphanumeric with underscore, ensure starts with letter
	let key = value.replace(/[^a-zA-Z0-9_]/g, "_");
	if (/^[0-9]/.test(key)) {
		key = `_${key}`;
	}
	// PascalCase
	return key
		.split("_")
		.filter(Boolean)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join("");
}
