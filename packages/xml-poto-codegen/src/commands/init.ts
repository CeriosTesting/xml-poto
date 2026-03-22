import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { Command } from "commander";

import type { XmlPotoCodegenConfig, XsdSource } from "../config/config-types";

import { getRandomCeriosMessage } from "./cli-messages";

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Create a xml-poto-codegen config file interactively")
		.action(async () => {
			await runInit();
		});
}

async function runInit(): Promise<void> {
	const format = await askForConfigFormat();
	const configFile = format === "ts" ? "xml-poto-codegen.config.ts" : "xml-poto-codegen.config.json";
	const configPath = path.resolve(process.cwd(), configFile);

	if (fs.existsSync(configPath)) {
		const overwrite = await ask(`${configFile} already exists. Overwrite? (y/N): `);
		if (overwrite.toLowerCase() !== "y") {
			console.log("Aborted.");
			return;
		}
	}

	const sources: XsdSource[] = [];
	let addMore = true;

	while (addMore) {
		const xsdPath = await askForXsdPath();

		const outputDir = (await ask("Output directory (default: ./src/generated): ")) || "./src/generated";

		sources.push({ xsdPath, outputDir });

		const more = await ask("Add another XSD source? (y/N): ");
		addMore = more.toLowerCase() === "y";
	}

	if (sources.length === 0) {
		console.log("No sources configured. Aborted.");
		return;
	}

	const config: XmlPotoCodegenConfig = {
		sources,
		defaultOutputStyle: "per-type",
	};

	if (format === "ts") {
		writeTsConfig(configPath, config);
	} else {
		writeJsonConfig(configPath, config);
	}

	console.log(`\n✓ Created ${configFile}`);
	console.log("\nNext steps:");
	console.log("  1. Review and customize your config file if needed");
	console.log("  2. Run 'xml-poto-codegen generate' to generate classes\n");

	console.log(`${getRandomCeriosMessage()}\n`);
}

function writeJsonConfig(configPath: string, config: XmlPotoCodegenConfig): void {
	fs.writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n", "utf-8");
}

function writeTsConfig(configPath: string, config: XmlPotoCodegenConfig): void {
	const sourcesStr = config.sources
		.map((s) => `\t\t{\n\t\t\txsdPath: "${s.xsdPath}",\n\t\t\toutputDir: "${s.outputDir}",\n\t\t}`)
		.join(",\n");

	const content = `import type { XmlPotoCodegenConfig } from "@cerios/xml-poto-codegen";

const config: XmlPotoCodegenConfig = {
\tsources: [
${sourcesStr},
\t],
\tdefaultOutputStyle: "${config.defaultOutputStyle ?? "per-type"}",
};

export default config;
`;

	fs.writeFileSync(configPath, content, "utf-8");
}

function ask(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function askForConfigFormat(): Promise<"json" | "ts"> {
	console.log("Select config file format:");
	console.log("  1. TypeScript (xml-poto-codegen.config.ts) [default]");
	console.log("  2. JSON (xml-poto-codegen.config.json)");

	while (true) {
		const answer = await ask("Choose format (1/2, ts/json, Enter for ts): ");
		const format = parseFormatChoice(answer);

		if (format) {
			return format;
		}

		console.log("Invalid choice. Please enter 1, 2, ts, or json.");
	}
}

function parseFormatChoice(input: string): "json" | "ts" | undefined {
	const normalized = input.trim().toLowerCase();

	if (!normalized) {
		return "ts";
	}

	if (normalized === "1" || normalized === "ts" || normalized === "typescript" || normalized === ".ts") {
		return "ts";
	}

	if (normalized === "2" || normalized === "json" || normalized === ".json") {
		return "json";
	}

	return undefined;
}

async function askForXsdPath(): Promise<string> {
	while (true) {
		const xsdPath = await ask("XSD file path: ");

		if (!xsdPath) {
			console.log("XSD path is required.");
			continue;
		}

		const resolvedPath = path.resolve(process.cwd(), xsdPath);

		if (!fs.existsSync(resolvedPath)) {
			console.log(`Path does not exist yet: ${resolvedPath}`);
			const useAnyway = await ask("Use this path anyway? (y/N): ");
			if (useAnyway.toLowerCase() === "y") {
				return xsdPath;
			}
			continue;
		}

		if (fs.statSync(resolvedPath).isDirectory()) {
			console.log("The path points to a directory. Please enter a file path to an XSD file.");
			continue;
		}

		return xsdPath;
	}
}
