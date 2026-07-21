import fs from "node:fs";
import path from "node:path";

import type { Command } from "commander";

import { loadConfig } from "../config/config-loader";
import type { GeneratedFile } from "../generator/class-generator";
import { ClassGenerator } from "../generator/class-generator";
import { writeGeneratedFile, writeGeneratedFiles } from "../generator/file-writer";
import { generateOperationsFile } from "../generator/operations-generator";
import { XsdParser } from "../xsd/xsd-parser";
import type { ResolvedSchema } from "../xsd/xsd-resolver";
import { XsdResolver } from "../xsd/xsd-resolver";
import type { WsdlDefinitions } from "../xsd/xsd-types";

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

	let totalFiles = 0;
	let totalTypes = 0;

	for (const source of config.sources) {
		const xsdPath = path.resolve(configDir, source.xsdPath);
		const outputPath = path.resolve(configDir, source.outputPath);
		const outputStyle = source.outputStyle ?? config.defaultOutputStyle ?? "per-type";
		const enumStyle = source.enumStyle ?? config.enumStyle ?? "union";
		const useXmlRoot = source.useXmlRoot ?? config.useXmlRoot ?? true;
		const elementForm = source.elementForm ?? config.elementForm ?? "schema";
		const bigIntegerAs = source.bigIntegerAs ?? config.bigIntegerAs ?? "number";

		console.log(`\nProcessing: ${xsdPath}`);

		// Parse XSD
		const schema = parser.parseFile(xsdPath);

		// Resolve types
		const resolved = new XsdResolver({ elementForm, bigIntegerAs }).resolve(schema);
		reportCoverageWarnings(resolved);

		const typeCount = resolved.types.length + resolved.enums.length;
		console.log(`  Found ${resolved.types.length} type(s), ${resolved.enums.length} enum(s)`);

		// Generate code
		const generator = new ClassGenerator({
			xsdPath: source.xsdPath,
			enumStyle,
			useXmlRoot,
			elementFormDefault: resolved.elementFormDefault,
		});

		// A WSDL also describes its operations; those become a sibling operations.ts.
		const wsdl = parser.getWsdlDefinitions();

		if (outputStyle === "per-xsd") {
			assertPerXsdOutputPath(outputPath, source.outputPath);

			const outputFileName = path.basename(outputPath, ".ts");
			const files = generator.generatePerXsd(resolved, outputFileName);
			const writtenFile = writeGeneratedFile(outputPath, files[0]);

			console.log(`  Generated 1 file → ${writtenFile}`);
			totalFiles += 1;

			const operations = buildOperationsFile(wsdl, resolved, source.xsdPath, true, outputFileName);
			if (operations) {
				writeGeneratedFile(path.join(path.dirname(outputPath), operations.fileName), operations);
				console.log(`  Generated operations → ${path.join(path.dirname(outputPath), operations.fileName)}`);
				totalFiles += 1;
			}

			totalTypes += typeCount;
			continue;
		}

		assertPerTypeOutputPath(outputPath, source.outputPath);
		const files = generator.generatePerType(resolved);

		const operations = buildOperationsFile(wsdl, resolved, source.xsdPath, false);
		if (operations) files.push(operations);

		// Write files
		const { written } = writeGeneratedFiles(outputPath, files);

		console.log(`  Generated ${written.length} file(s) → ${outputPath}`);

		totalFiles += written.length;
		totalTypes += typeCount;
	}

	console.log(`\nDone! ${totalTypes} type(s) → ${totalFiles} file(s)`);
}

/**
 * Build the operations file for a WSDL source, reporting anything it had to skip.
 * Returns undefined for a plain XSD, or a WSDL with no usable operation.
 */
function buildOperationsFile(
	wsdl: WsdlDefinitions | undefined,
	resolved: ResolvedSchema,
	xsdPath: string,
	singleFile: boolean,
	singleFileName?: string,
): GeneratedFile | undefined {
	if (!wsdl) return undefined;

	const notes: string[] = [];
	const file = generateOperationsFile(wsdl, resolved, { xsdPath, singleFile, singleFileName }, notes);

	for (const note of notes) {
		console.warn(`  Note: ${note}`);
	}

	return file;
}

function assertPerTypeOutputPath(resolvedPath: string, configuredPath: string): void {
	if (looksLikeTypeScriptFile(configuredPath)) {
		throw new Error(
			`Invalid output path for outputStyle 'per-type': '${configuredPath}' looks like a file path. Use a directory path instead.`,
		);
	}

	if (!fs.existsSync(resolvedPath)) {
		return;
	}

	if (!fs.statSync(resolvedPath).isDirectory()) {
		throw new Error(
			`Invalid output path for outputStyle 'per-type': '${configuredPath}' resolves to a file. Use a directory path instead.`,
		);
	}
}

function assertPerXsdOutputPath(resolvedPath: string, configuredPath: string): void {
	if (!looksLikeTypeScriptFile(configuredPath)) {
		throw new Error(
			`Invalid output path for outputStyle 'per-xsd': '${configuredPath}' must be a TypeScript file path ending with '.ts'.`,
		);
	}

	const outputDir = path.dirname(resolvedPath);
	if (fs.existsSync(outputDir) && !fs.statSync(outputDir).isDirectory()) {
		throw new Error(
			`Invalid output path for outputStyle 'per-xsd': parent path '${path.dirname(configuredPath)}' is not a directory.`,
		);
	}

	if (!fs.existsSync(resolvedPath)) {
		return;
	}

	if (fs.statSync(resolvedPath).isDirectory()) {
		throw new Error(
			`Invalid output path for outputStyle 'per-xsd': '${configuredPath}' resolves to a directory. Use a file path instead.`,
		);
	}
}

function looksLikeTypeScriptFile(value: string): boolean {
	return path.extname(value).toLowerCase() === ".ts";
}

function reportCoverageWarnings(resolved: ReturnType<XsdResolver["resolve"]>): void {
	reportMultiRootAliasWarnings(resolved);

	for (const note of resolved.coverageNotes ?? []) {
		console.warn(`  Warning: ${note}`);
	}
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
