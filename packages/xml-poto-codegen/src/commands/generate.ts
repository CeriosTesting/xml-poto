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
