#!/usr/bin/env node
import { Command } from "commander";

import { registerGenerateCommand } from "./commands/generate";
import { registerInitCommand } from "./commands/init";

// Read the CLI version from this package's package.json so it stays in sync.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version } = require("../package.json");

const program = new Command();

program
	.name("xml-poto-codegen")
	.description("Generate TypeScript classes with @cerios/xml-poto decorators from XSD schemas")
	.version(version);

registerInitCommand(program);
registerGenerateCommand(program);

program.parse();
