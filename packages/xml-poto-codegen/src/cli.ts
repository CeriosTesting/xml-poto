#!/usr/bin/env node
import { Command } from "commander";

// Read the CLI version from this package's package.json so it stays in sync.
import { version } from "../package.json";

import { registerGenerateCommand } from "./commands/generate";
import { registerInitCommand } from "./commands/init";

const program = new Command();

program
	.name("xml-poto-codegen")
	.description("Generate TypeScript classes with @cerios/xml-poto decorators from XSD schemas")
	.version(version);

registerInitCommand(program);
registerGenerateCommand(program);

program.parse();
