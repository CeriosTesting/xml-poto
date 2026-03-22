import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findConfigFile, loadConfig, validateConfig } from "../../src/config/config-loader";
import type { XmlPotoCodegenConfig } from "../../src/config/config-types";

const TMP = join(__dirname, "..", "tmp-config-test");

describe("ConfigLoader", () => {
	beforeEach(async () => {
		await mkdir(TMP, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(TMP)) {
			await rm(TMP, { recursive: true, force: true });
		}
	});

	describe("findConfigFile", () => {
		it("should find .ts config", async () => {
			await writeFile(join(TMP, "xml-poto-codegen.config.ts"), "export default { sources: [] };");

			const found = findConfigFile(TMP);
			expect(found).toBeDefined();
			expect(found!).toContain("xml-poto-codegen.config.ts");
		});

		it("should find .json config", async () => {
			await writeFile(join(TMP, "xml-poto-codegen.config.json"), '{ "sources": [] }');

			const found = findConfigFile(TMP);
			expect(found).toBeDefined();
			expect(found!).toContain("xml-poto-codegen.config.json");
		});

		it("should prefer .ts over .json", async () => {
			await writeFile(join(TMP, "xml-poto-codegen.config.ts"), "export default { sources: [] };");
			await writeFile(join(TMP, "xml-poto-codegen.config.json"), '{ "sources": [] }');

			const found = findConfigFile(TMP);
			expect(found!).toContain(".config.ts");
		});

		it("should return undefined when no config exists", () => {
			const found = findConfigFile(TMP);
			expect(found).toBeUndefined();
		});
	});

	describe("loadConfig", () => {
		it("should load TS config", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			await writeFile(
				configPath,
				`export default { sources: [{ xsdPath: "./schema.xsd", outputDir: "./generated" }] };`,
			);

			const loaded = await loadConfig(configPath);
			expect(loaded.config.sources).toHaveLength(1);
			expect(loaded.config.sources[0].xsdPath).toBe("./schema.xsd");
			expect(loaded.config.sources[0].outputDir).toBe("./generated");
		});

		it("should load JSON config", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.json");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: "./schema.xsd",
						outputDir: "./generated",
					},
				],
			};
			await writeFile(configPath, JSON.stringify(config));

			const loaded = await loadConfig(configPath);
			expect(loaded.config.sources).toHaveLength(1);
			expect(loaded.config.sources[0].xsdPath).toBe("./schema.xsd");
			expect(loaded.config.sources[0].outputDir).toBe("./generated");
		});

		it("should throw when config file does not exist", async () => {
			await expect(loadConfig(join(TMP, "nonexistent.json"))).rejects.toThrow("Config file not found");
		});

		it("should throw when no config file is found via auto-detect", async () => {
			// Use a directory with no config file
			const emptyDir = join(TMP, "empty");
			await mkdir(emptyDir, { recursive: true });
			const origCwd = process.cwd();
			process.chdir(emptyDir);
			try {
				await expect(loadConfig()).rejects.toThrow("No config file found");
			} finally {
				process.chdir(origCwd);
			}
		});

		it("should throw for unsupported config format", async () => {
			const configPath = join(TMP, "config.yaml");
			await writeFile(configPath, "sources: []");
			await expect(loadConfig(configPath)).rejects.toThrow("Unsupported config file format");
		});

		it("should return configDir as the directory of the config file", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.json");
			await writeFile(configPath, JSON.stringify({ sources: [{ xsdPath: "a.xsd", outputDir: "./out" }] }));

			const loaded = await loadConfig(configPath);
			expect(loaded.configDir).toBe(TMP);
		});
	});

	describe("validateConfig", () => {
		it("should accept valid config", () => {
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: "./schema.xsd",
						outputDir: "./out",
					},
				],
			};
			expect(() => validateConfig(config)).not.toThrow();
		});

		it("should reject config without sources", () => {
			expect(() => validateConfig({} as XmlPotoCodegenConfig)).toThrow("non-empty 'sources' array");
		});

		it("should reject config with empty sources", () => {
			expect(() => validateConfig({ sources: [] })).toThrow("non-empty 'sources' array");
		});

		it("should reject source without xsdPath", () => {
			expect(() =>
				validateConfig({
					sources: [{ outputDir: "./out" }] as unknown,
				}),
			).toThrow("xsdPath must be a non-empty string");
		});

		it("should reject source without outputDir", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./schema.xsd" }] as unknown,
				}),
			).toThrow("outputDir must be a non-empty string");
		});

		it("should reject null config", () => {
			expect(() => validateConfig(null)).toThrow("Config must be an object");
		});

		it("should reject non-object config", () => {
			expect(() => validateConfig("string")).toThrow("Config must be an object");
		});

		it("should reject invalid source outputStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out", outputStyle: "invalid" }],
				}),
			).toThrow("outputStyle must be 'per-type' or 'per-xsd'");
		});

		it("should accept valid source outputStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out", outputStyle: "per-type" }],
				}),
			).not.toThrow();
		});

		it("should reject invalid source enumStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out", enumStyle: "bad" }],
				}),
			).toThrow("enumStyle must be 'union', 'enum', or 'const-object'");
		});

		it("should accept valid source enumStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out", enumStyle: "const-object" }],
				}),
			).not.toThrow();
		});

		it("should reject invalid defaultOutputStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out" }],
					defaultOutputStyle: "bad" as unknown,
				}),
			).toThrow("defaultOutputStyle must be 'per-type' or 'per-xsd'");
		});

		it("should reject invalid top-level enumStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out" }],
					enumStyle: "invalid" as unknown,
				}),
			).toThrow("enumStyle must be 'union', 'enum', or 'const-object'");
		});

		it("should accept valid top-level enumStyle", () => {
			expect(() =>
				validateConfig({
					sources: [{ xsdPath: "./a.xsd", outputDir: "./out" }],
					enumStyle: "enum",
				}),
			).not.toThrow();
		});
	});
});
