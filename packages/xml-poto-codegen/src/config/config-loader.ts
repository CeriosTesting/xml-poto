import fs from "node:fs";
import path from "node:path";

import { createJiti } from "jiti";

import type { XmlPotoCodegenConfig } from "./config-types";

const CONFIG_NAMES = ["xml-poto-codegen.config.ts", "xml-poto-codegen.config.json"];

export function validateConfig(config: unknown): XmlPotoCodegenConfig {
	if (!config || typeof config !== "object") {
		throw new Error("Config must be an object.");
	}

	const cfg = config as Record<string, unknown>;

	if (!Array.isArray(cfg.sources) || cfg.sources.length === 0) {
		throw new Error("Config must have a non-empty 'sources' array.");
	}

	for (let i = 0; i < cfg.sources.length; i++) {
		validateSourceConfig(cfg.sources[i], i);
	}

	if (!isValidOutputStyle(cfg.defaultOutputStyle)) {
		throw new Error("defaultOutputStyle must be 'per-type' or 'per-xsd'.");
	}

	if (!isValidEnumStyle(cfg.enumStyle)) {
		throw new Error("enumStyle must be 'union', 'enum', or 'const-object'.");
	}

	return config as XmlPotoCodegenConfig;
}

function validateSourceConfig(source: unknown, index: number): void {
	if (!source || typeof source !== "object") {
		throw new Error(`sources[${index}] must be an object.`);
	}

	const src = source as Record<string, unknown>;

	if (!src.xsdPath || typeof src.xsdPath !== "string") {
		throw new Error(`sources[${index}].xsdPath must be a non-empty string.`);
	}
	if (!src.outputPath || typeof src.outputPath !== "string") {
		throw new Error(`sources[${index}].outputPath must be a non-empty string.`);
	}
	if (!isValidOutputStyle(src.outputStyle)) {
		throw new Error(`sources[${index}].outputStyle must be 'per-type' or 'per-xsd'.`);
	}
	if (!isValidEnumStyle(src.enumStyle)) {
		throw new Error(`sources[${index}].enumStyle must be 'union', 'enum', or 'const-object'.`);
	}
}

function isValidOutputStyle(value: unknown): boolean {
	return value === undefined || value === "per-type" || value === "per-xsd";
}

function isValidEnumStyle(value: unknown): boolean {
	return value === undefined || value === "union" || value === "enum" || value === "const-object";
}

export function findConfigFile(cwd: string): string | undefined {
	for (const name of CONFIG_NAMES) {
		const fullPath = path.resolve(cwd, name);
		if (fs.existsSync(fullPath)) {
			return fullPath;
		}
	}
	return undefined;
}

export async function loadConfig(configPath?: string): Promise<{ config: XmlPotoCodegenConfig; configDir: string }> {
	const resolvedPath = configPath ? path.resolve(configPath) : findConfigFile(process.cwd());

	if (!resolvedPath) {
		throw new Error("No config file found. Run 'xml-poto-codegen init' to create one.");
	}

	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Config file not found: ${resolvedPath}`);
	}

	const configDir = path.dirname(resolvedPath);
	let raw: unknown;

	if (resolvedPath.endsWith(".json")) {
		const content = fs.readFileSync(resolvedPath, "utf-8");
		raw = JSON.parse(content);
	} else if (resolvedPath.endsWith(".ts")) {
		const jiti = createJiti(__filename);
		const mod = await jiti.import(resolvedPath, { default: true });
		if (mod && typeof mod === "object" && "default" in mod) {
			raw = (mod as { default: unknown }).default;
		} else {
			raw = mod;
		}
	} else {
		throw new Error(`Unsupported config file format: ${resolvedPath}`);
	}

	const config = validateConfig(raw);
	return { config, configDir };
}
