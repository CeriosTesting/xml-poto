import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GeneratedFile } from "../../src/generator/class-generator";
import { writeGeneratedFile, writeGeneratedFiles } from "../../src/generator/file-writer";

const TMP = join(__dirname, "..", "tmp-file-writer-test");

describe("file-writer", () => {
	beforeEach(async () => {
		await mkdir(TMP, { recursive: true });
	});

	afterEach(async () => {
		if (existsSync(TMP)) {
			await rm(TMP, { recursive: true, force: true });
		}
	});

	it("writeGeneratedFiles writes all files into the output directory", () => {
		const outputDir = join(TMP, "generated");
		const files: GeneratedFile[] = [
			{ fileName: "a.ts", content: "export const a = 1;\n", exports: ["a"] },
			{ fileName: "b.ts", content: "export const b = 2;\n", exports: ["b"] },
		];

		const { written } = writeGeneratedFiles(outputDir, files);

		expect(written).toHaveLength(2);
		expect(readFileSync(join(outputDir, "a.ts"), "utf-8")).toContain("export const a = 1;");
		expect(readFileSync(join(outputDir, "b.ts"), "utf-8")).toContain("export const b = 2;");
	});

	it("writeGeneratedFile writes to the explicit file path", () => {
		const outputFilePath = join(TMP, "nested", "single.ts");
		const file: GeneratedFile = {
			fileName: "ignored.ts",
			content: "export const value = 42;\n",
			exports: ["value"],
		};

		const writtenPath = writeGeneratedFile(outputFilePath, file);

		expect(writtenPath).toBe(outputFilePath);
		expect(readFileSync(outputFilePath, "utf-8")).toContain("export const value = 42;");
	});
});
