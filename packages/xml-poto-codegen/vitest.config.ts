import path from "node:path";

import * as esbuild from "esbuild";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

// Vite 8 uses OXC for TypeScript transforms, which does not correctly handle
// TC39 stage 3 decorators (field decorators are silently removed; class
// decorators are left as raw syntax). Use esbuild instead, which implements
// the full TC39 decorator specification.
// TODO: Remove this plugin and switch to native Vite transforms once https://github.com/vitest-dev/vitest/issues/9876 is resolved.
const esbuildDecoratorPlugin: Plugin = {
	name: "esbuild-decorator-transform",
	enforce: "pre",
	async transform(code, id) {
		if (!/\.[cm]?tsx?$/.test(id) || id.includes("node_modules")) return null;
		const loader = id.endsWith(".tsx") ? "tsx" : "ts";
		const result = await esbuild.transform(code, {
			loader,
			target: "node18",
			// Force class fields to be lowered to __publicField() in constructors.
			// Without this, esbuild emits native `prop;` syntax for classes that only
			// have class decorators (not field decorators). Vite 8's OXC plugin then
			// strips those declarations, thinking they are TypeScript ambient property
			// declarations, causing the instance to have no own properties at runtime.
			supported: { "class-field": false },
			sourcemap: "inline",
		});
		return { code: result.code, map: null };
	},
};

export default defineConfig({
	plugins: [esbuildDecoratorPlugin],
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
