#!/usr/bin/env node
import { Command } from "commander";

import { registerGenerateCommand } from "./commands/generate";
import { registerInitCommand } from "./commands/init";

const program = new Command();

program
	.name("xml-poto-codegen")
	.description("Generate TypeScript classes with @cerios/xml-poto decorators from XSD schemas")
	.version("1.0.0");

registerInitCommand(program);
registerGenerateCommand(program);

program.parse();
