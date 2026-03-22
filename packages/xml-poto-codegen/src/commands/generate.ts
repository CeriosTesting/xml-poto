import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../config/config-loader";
import { ClassGenerator } from "../generator/class-generator";
import { writeGeneratedFiles } from "../generator/file-writer";
import { XsdParser } from "../xsd/xsd-parser";
import { XsdResolver } from "../xsd/xsd-resolver";

export function registerGenerateCommand(program: Command): void {
	program
		.command("generate")
		.description("Generate TypeScript classes from XSD schemas defined in config")
		.action(async () => {
			await runGenerate();
		});
}

async function runGenerate(): Promise<void> {
	const { config, configDir } = await loadConfig();

	const parser = new XsdParser();
	const resolver = new XsdResolver();

	let totalFiles = 0;
	let totalTypes = 0;

	for (const source of config.sources) {
		const xsdPath = path.resolve(configDir, source.xsdPath);
		const outputDir = path.resolve(configDir, source.outputDir);
		const outputStyle = source.outputStyle ?? config.defaultOutputStyle ?? "per-type";
		const enumStyle = source.enumStyle ?? config.enumStyle ?? "union";

		console.log(`\nProcessing: ${xsdPath}`);

		// Parse XSD
		const schema = parser.parseFile(xsdPath);

		// Resolve types
		const resolved = resolver.resolve(schema);
		reportCoverageWarnings(resolved);

		const typeCount = resolved.types.length + resolved.enums.length;
		console.log(`  Found ${resolved.types.length} type(s), ${resolved.enums.length} enum(s)`);

		// Generate code
		const generator = new ClassGenerator({
			xsdPath: source.xsdPath,
			enumStyle,
		});

		const files = outputStyle === "per-xsd" ? generator.generatePerXsd(resolved) : generator.generatePerType(resolved);

		// Write files
		const { written } = writeGeneratedFiles(outputDir, files);

		console.log(`  Generated ${written.length} file(s) → ${outputDir}`);

		totalFiles += written.length;
		totalTypes += typeCount;
	}

	console.log(`\nDone! ${totalTypes} type(s) → ${totalFiles} file(s)`);
}

function reportCoverageWarnings(resolved: ReturnType<XsdResolver["resolve"]>): void {
	reportMultiRootAliasWarnings(resolved);

	const { unsupportedFacetProps, fixedConstraintProps } = collectPropertyCoverageWarnings(resolved);
	warnUnsupportedFacets(unsupportedFacetProps);
	warnFixedConstraints(fixedConstraintProps);
}

function reportMultiRootAliasWarnings(resolved: ReturnType<XsdResolver["resolve"]>): void {
	const multiRootAliases = new Map<string, string[]>();

	for (const root of resolved.rootElements) {
		const names = multiRootAliases.get(root.typeName);
		if (names) {
			names.push(root.name);
			continue;
		}

		multiRootAliases.set(root.typeName, [root.name]);
	}

	for (const [typeName, rootNames] of multiRootAliases) {
		if (rootNames.length <= 1) {
			continue;
		}

		console.warn(
			`  Warning: Type '${typeName}' is referenced by multiple root elements (${rootNames.join(", ")}). Using '${rootNames[0]}' as the generated @XmlRoot name.`,
		);
	}
}

function collectPropertyCoverageWarnings(resolved: ReturnType<XsdResolver["resolve"]>): {
	unsupportedFacetProps: string[];
	fixedConstraintProps: string[];
} {
	const unsupportedFacetProps: string[] = [];
	const fixedConstraintProps: string[] = [];

	for (const type of resolved.types) {
		for (const prop of type.properties) {
			if (hasUnsupportedFacet(prop)) {
				unsupportedFacetProps.push(`${type.className}.${prop.propertyName}`);
			}

			if (prop.fixedValue !== undefined) {
				fixedConstraintProps.push(`${type.className}.${prop.propertyName}`);
			}
		}
	}

	return { unsupportedFacetProps, fixedConstraintProps };
}

function hasUnsupportedFacet(prop: ReturnType<XsdResolver["resolve"]>["types"][number]["properties"][number]): boolean {
	return (
		prop.minLength !== undefined ||
		prop.maxLength !== undefined ||
		prop.minInclusive !== undefined ||
		prop.maxInclusive !== undefined ||
		prop.minExclusive !== undefined ||
		prop.maxExclusive !== undefined ||
		prop.totalDigits !== undefined ||
		prop.fractionDigits !== undefined ||
		prop.whiteSpace !== undefined
	);
}

function warnUnsupportedFacets(unsupportedFacetProps: string[]): void {
	if (unsupportedFacetProps.length === 0) {
		return;
	}

	console.warn(
		`  Warning: ${unsupportedFacetProps.length} property(ies) use XSD facets not fully enforced by generated decorators (${unsupportedFacetProps.join(", ")}).`,
	);
}

function warnFixedConstraints(fixedConstraintProps: string[]): void {
	if (fixedConstraintProps.length === 0) {
		return;
	}

	console.warn(
		`  Warning: ${fixedConstraintProps.length} property(ies) use XSD fixed constraints. Generated code applies defaults, but strict fixed-value enforcement may require manual validation (${fixedConstraintProps.join(", ")}).`,
	);
}
