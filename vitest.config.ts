import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: ["packages/xml-poto/vitest.config.ts"],
	},
});
