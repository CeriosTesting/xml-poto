import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/cli.ts"],
	tsconfig: "./tsconfig.build.json",
	format: ["cjs", "esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	outDir: "dist",
});
