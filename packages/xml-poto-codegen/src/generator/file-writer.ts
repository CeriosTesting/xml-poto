import fs from "node:fs";
import path from "node:path";

import type { GeneratedFile } from "./class-generator";

/**
 * Writes generated files to the output directory.
 */
export function writeGeneratedFiles(outputDir: string, files: GeneratedFile[]): { written: string[] } {
	const written: string[] = [];

	fs.mkdirSync(outputDir, { recursive: true });

	for (const file of files) {
		const filePath = path.join(outputDir, file.fileName);
		fs.writeFileSync(filePath, file.content, "utf-8");
		written.push(filePath);
	}

	return { written };
}
