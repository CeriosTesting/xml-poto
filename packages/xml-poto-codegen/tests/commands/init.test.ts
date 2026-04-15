import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeJsonConfig, writeTsConfig } from "../../src/commands/init";
import type { XmlPotoCodegenConfig } from "../../src/config/config-types";

const TMP = join(__dirname, "..", "tmp-init-test");

describe("init – path normalization", () => {
	beforeEach(async () => {
		await mkdir(TMP, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(TMP)) {
			await rm(TMP, { recursive: true, force: true });
		}
	});

	describe("writeTsConfig", () => {
		it("writes forward slashes when xsdPath and outputPath use backslashes", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: ".\\schemas\\myschema.xsd",
						outputPath: ".\\src\\generated",
					},
				],
			};

			writeTsConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			expect(content).toContain(`xsdPath: "./schemas/myschema.xsd"`);
			expect(content).toContain(`outputPath: "./src/generated"`);
			expect(content).not.toContain("\\");
		});

		it("writes forward slashes for mixed-slash paths", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: "./schemas\\nested\\schema.xsd",
						outputPath: "src\\generated",
					},
				],
			};

			writeTsConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			expect(content).toContain(`xsdPath: "./schemas/nested/schema.xsd"`);
			expect(content).toContain(`outputPath: "src/generated"`);
			expect(content).not.toContain("\\");
		});

		it("preserves forward-slash paths unchanged", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: "./schemas/myschema.xsd",
						outputPath: "./src/generated",
					},
				],
			};

			writeTsConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			expect(content).toContain(`xsdPath: "./schemas/myschema.xsd"`);
			expect(content).toContain(`outputPath: "./src/generated"`);
		});

		it("writes valid importable TypeScript with backslash paths normalized", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: ".\\schemas\\schema.xsd",
						outputPath: ".\\src\\generated\\schema.ts",
						outputStyle: "per-xsd",
					},
				],
				defaultOutputStyle: "per-xsd",
			};

			writeTsConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			expect(content).toContain(`outputStyle: "per-xsd"`);
			expect(content).toContain(`xsdPath: "./schemas/schema.xsd"`);
			expect(content).toContain(`outputPath: "./src/generated/schema.ts"`);
		});

		it("normalizes multiple sources independently", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.ts");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: ".\\schemas\\first.xsd",
						outputPath: ".\\src\\first",
					},
					{
						xsdPath: ".\\schemas\\second.xsd",
						outputPath: ".\\src\\second",
					},
				],
			};

			writeTsConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			expect(content).toContain(`xsdPath: "./schemas/first.xsd"`);
			expect(content).toContain(`outputPath: "./src/first"`);
			expect(content).toContain(`xsdPath: "./schemas/second.xsd"`);
			expect(content).toContain(`outputPath: "./src/second"`);
			expect(content).not.toContain("\\");
		});
	});

	describe("writeJsonConfig", () => {
		it("writes forward slashes when xsdPath and outputPath use backslashes", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.json");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: ".\\schemas\\myschema.xsd",
						outputPath: ".\\src\\generated",
					},
				],
			};

			writeJsonConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			const parsed = JSON.parse(content) as XmlPotoCodegenConfig;
			expect(parsed.sources[0].xsdPath).toBe("./schemas/myschema.xsd");
			expect(parsed.sources[0].outputPath).toBe("./src/generated");
		});

		it("preserves forward-slash paths unchanged", async () => {
			const configPath = join(TMP, "xml-poto-codegen.config.json");
			const config: XmlPotoCodegenConfig = {
				sources: [
					{
						xsdPath: "./schemas/myschema.xsd",
						outputPath: "./src/generated",
					},
				],
			};

			writeJsonConfig(configPath, config);

			const content = await readFile(configPath, "utf-8");
			const parsed = JSON.parse(content) as XmlPotoCodegenConfig;
			expect(parsed.sources[0].xsdPath).toBe("./schemas/myschema.xsd");
			expect(parsed.sources[0].outputPath).toBe("./src/generated");
		});
	});
});
