import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { Command } from "commander";

import type { CodegenConfig, XsdSource } from "../config/config-types";

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Create a xml-poto-codegen config file interactively")
		.option("--format <format>", "Config file format: json or ts", "json")
		.action(async (opts: { format: string }) => {
			await runInit(opts.format as "json" | "ts");
		});
}

async function runInit(format: "json" | "ts"): Promise<void> {
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
		const xsdPath = await ask("XSD file path: ");
		if (!xsdPath) {
			console.log("XSD path is required.");
			continue;
		}

		const outputDir = (await ask("Output directory (default: ./src/generated): ")) || "./src/generated";

		sources.push({ xsdPath, outputDir });

		const more = await ask("Add another XSD source? (y/N): ");
		addMore = more.toLowerCase() === "y";
	}

	if (sources.length === 0) {
		console.log("No sources configured. Aborted.");
		return;
	}

	const config: CodegenConfig = {
		sources,
		defaultOutputStyle: "per-type",
	};

	if (format === "ts") {
		writeTsConfig(configPath, config);
	} else {
		writeJsonConfig(configPath, config);
	}

	console.log(`\nConfig written to ${configFile}`);
	console.log("Run 'xml-poto-codegen generate' to generate classes.");
}

function writeJsonConfig(configPath: string, config: CodegenConfig): void {
	fs.writeFileSync(configPath, JSON.stringify(config, null, "\t") + "\n", "utf-8");
}

function writeTsConfig(configPath: string, config: CodegenConfig): void {
	const sourcesStr = config.sources
		.map((s) => `\t\t{\n\t\t\txsdPath: "${s.xsdPath}",\n\t\t\toutputDir: "${s.outputDir}",\n\t\t}`)
		.join(",\n");

	const content = `import type { CodegenConfig } from "@cerios/xml-poto-codegen";

const config: CodegenConfig = {
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
