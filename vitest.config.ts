import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/xml-poto/vitest.config.ts", "packages/xml-poto-codegen/vitest.config.ts"],
	},
});
