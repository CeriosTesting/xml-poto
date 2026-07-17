import path from "node:path";

import { transform } from "esbuild";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * Vitest 4.1+ ships rolldown-vite, which transpiles TypeScript with oxc.
 * Oxc only lowers legacy (experimentalDecorators) decorators; TC39 stage-3
 * decorator syntax passes through untouched and crashes Node.js with
 * "SyntaxError: Invalid or unexpected token". Transpile .ts modules with
 * esbuild instead, which fully lowers stage-3 decorators. This also covers
 * the generated classes the round-trip tests import from tests/tmp-*.
 * Remove once oxc supports the decorators proposal transform.
 */
function esbuildStage3Decorators(): Plugin {
	return {
		name: "esbuild-stage3-decorators",
		enforce: "pre",
		async transform(code, id) {
			const filePath = id.split("?")[0];
			if (!filePath.endsWith(".ts") || filePath.endsWith(".d.ts")) {
				return null;
			}
			const result = await transform(code, {
				loader: "ts",
				target: "es2022",
				// Match tsc class-field semantics for tsconfig target es2019
				tsconfigRaw: { compilerOptions: { useDefineForClassFields: false } },
				sourcefile: filePath,
				sourcemap: true,
			});
			return { code: result.code, map: result.map };
		},
	};
}

export default defineConfig({
	plugins: [esbuildStage3Decorators()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@cerios/xml-poto": path.resolve(__dirname, "../xml-poto/src/index.ts"),
		},
	},
	test: {
		environment: "node",
		globals: true,
		include: ["./tests/**/*.test.ts"],
		coverage: {
			include: ["./src/**/*.ts"],
			exclude: ["./src/**/*.d.ts"],
			reporter: ["text", "lcov", "html"],
		},
		clearMocks: true,
		restoreMocks: true,
		mockReset: true,
	},
});
