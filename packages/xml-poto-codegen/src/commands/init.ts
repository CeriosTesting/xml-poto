import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { Command } from "commander";

import type { XmlPotoCodegenConfig, XsdSource } from "../config/config-types";

import { getRandomCeriosMessage } from "./cli-messages";

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Create an xml-poto-codegen config file interactively")
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
		const outputStyle = await askForOutputStyle();
		const outputPath = await askForOutputPath(outputStyle, xsdPath);

		sources.push({ xsdPath, outputPath, outputStyle });

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

function toPosixPath(p: string): string {
	return p.replace(/\\/g, "/");
}

export function writeJsonConfig(configPath: string, config: XmlPotoCodegenConfig): void {
	const normalized = {
		...config,
		sources: config.sources.map((s) => ({
			...s,
			xsdPath: toPosixPath(s.xsdPath),
			outputPath: toPosixPath(s.outputPath),
		})),
	};
	fs.writeFileSync(configPath, JSON.stringify(normalized, null, "\t") + "\n", "utf-8");
}

export function writeTsConfig(configPath: string, config: XmlPotoCodegenConfig): void {
	const sourcesStr = config.sources
		.map((s) => {
			const xsdPath = toPosixPath(s.xsdPath);
			const outputPath = toPosixPath(s.outputPath);
			const styleLine = s.outputStyle ? `,\n\t\t\toutputStyle: "${s.outputStyle}"` : "";
			return `\t\t{\n\t\t\txsdPath: "${xsdPath}",\n\t\t\toutputPath: "${outputPath}"${styleLine}\n\t\t}`;
		})
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

async function askForOutputStyle(): Promise<"per-type" | "per-xsd"> {
	console.log("\nSelect output style:");
	console.log("  1. per-type [default] - generates one file per class/enum into a folder");
	console.log("  2. per-xsd - generates all types into a single TypeScript file");

	while (true) {
		const answer = await ask("Choose output style (1/2, per-type/per-xsd, Enter for per-type): ");
		const style = parseOutputStyleChoice(answer);

		if (style) {
			return style;
		}

		console.log("Invalid choice. Please enter 1, 2, per-type, or per-xsd.");
	}
}

function parseOutputStyleChoice(input: string): "per-type" | "per-xsd" | undefined {
	const normalized = input.trim().toLowerCase();

	if (!normalized) {
		return "per-type";
	}

	if (normalized === "1" || normalized === "per-type") {
		return "per-type";
	}

	if (normalized === "2" || normalized === "per-xsd") {
		return "per-xsd";
	}

	return undefined;
}

async function askForOutputPath(outputStyle: "per-type" | "per-xsd", xsdPath: string): Promise<string> {
	if (outputStyle === "per-xsd") {
		return askForOutputFilePath(xsdPath);
	}

	return askForOutputDirectoryPath();
}

async function askForOutputDirectoryPath(): Promise<string> {
	while (true) {
		const output = (await ask("Output folder (default: ./src/generated): ")) || "./src/generated";

		if (path.extname(output).toLowerCase() === ".ts") {
			console.log("This looks like a file path. For 'per-type', enter a folder path (example: ./src/generated).");
			continue;
		}

		const resolvedPath = path.resolve(process.cwd(), output);
		if (!fs.existsSync(resolvedPath)) {
			return output;
		}

		if (!fs.statSync(resolvedPath).isDirectory()) {
			console.log("The selected path is an existing file. For 'per-type', choose a folder path.");
			continue;
		}

		return output;
	}
}

async function askForOutputFilePath(xsdPath: string): Promise<string> {
	const defaultOutput = buildPerXsdDefaultOutputPath(xsdPath);

	while (true) {
		const output = (await ask(`Output file (default: ${defaultOutput}): `)) || defaultOutput;
		const resolvedPath = path.resolve(process.cwd(), output);

		if (path.extname(output).toLowerCase() !== ".ts") {
			console.log("For 'per-xsd', enter a TypeScript file path ending in '.ts' (example: ./src/generated/schema.ts).");
			continue;
		}

		if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
			console.log("The selected path is an existing directory. For 'per-xsd', choose a file path.");
			continue;
		}

		const parentPath = path.dirname(resolvedPath);
		if (fs.existsSync(parentPath) && !fs.statSync(parentPath).isDirectory()) {
			console.log("The parent path is not a directory. Please choose a valid file path.");
			continue;
		}

		return output;
	}
}

function buildPerXsdDefaultOutputPath(xsdPath: string): string {
	const base = path.basename(xsdPath, path.extname(xsdPath)).trim();
	const fileName = base || "generated";
	return `./src/generated/${fileName}.ts`;
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
