import type { ResolvedSchema } from "../xsd/xsd-resolver";
import { stripPrefix, toPascalCase } from "../xsd/xsd-resolver";
import type { WsdlDefinitions, WsdlOperation } from "../xsd/xsd-types";

import type { GeneratedFile } from "./class-generator";
import { buildFileHeader, buildImport, buildJsDoc, toKebabCase } from "./ts-builder";

/**
 * Generates the operations map for a WSDL source: what each operation is called
 * on the wire, and which generated classes it exchanges.
 *
 * Deliberately data rather than a client. `SoapSerializer` handles the envelope
 * and `faults` is shaped to drop straight into its `faultDetailTypes` option, but
 * how the request is actually sent stays the caller's choice.
 */
export interface OperationsGeneratorOptions {
	/** Path of the WSDL, for the generated file header */
	xsdPath: string;
	/** Whether generation puts every class in one file (per-xsd) or one file each */
	singleFile: boolean;
	/** Basename of the single file, when in per-xsd mode */
	singleFileName?: string;
}

/** An operation that could be generated, with its class references resolved. */
interface ResolvedOperation {
	name: string;
	soapAction?: string;
	documentation?: string;
	inputClass?: string;
	outputClass?: string;
	/** Fault name → generated class name */
	faultClasses: Record<string, string>;
}

/**
 * Generate `operations.ts` from a WSDL's portTypes, or nothing when there is no
 * usable operation to describe.
 *
 * `notes` collects the reasons any operation was skipped, so the caller can report
 * them alongside the resolver's own coverage notes.
 */
export function generateOperationsFile(
	wsdl: WsdlDefinitions,
	schema: ResolvedSchema,
	options: OperationsGeneratorOptions,
	notes: string[],
): GeneratedFile | undefined {
	const classByElement = buildElementToClassMap(schema);

	const portTypes = wsdl.portTypes
		.map((portType) => ({
			name: portType.name,
			operations: portType.operations
				.map((operation) => resolveOperation(operation, wsdl, classByElement, notes))
				.filter((operation): operation is ResolvedOperation => operation !== undefined),
		}))
		.filter((portType) => portType.operations.length > 0);

	if (portTypes.length === 0) return undefined;

	const referenced = new Set<string>();
	for (const portType of portTypes) {
		for (const operation of portType.operations) {
			for (const className of [operation.inputClass, operation.outputClass, ...Object.values(operation.faultClasses)]) {
				if (className) referenced.add(className);
			}
		}
	}

	const lines: string[] = [buildFileHeader(options.xsdPath)];

	if (referenced.size > 0) {
		const from = options.singleFile ? `./${toKebabCase(options.singleFileName ?? "generated")}` : "./index";
		lines.push(buildImport([...referenced].sort(), from));
	}
	lines.push("");

	const exports: string[] = [];
	for (const portType of portTypes) {
		const constName = `${toPascalCase(portType.name)}Operations`;
		exports.push(constName);
		lines.push(buildPortTypeConst(constName, portType.name, portType.operations));
		lines.push("");
	}

	return {
		fileName: "operations.ts",
		content: lines.join("\n"),
		exports,
	};
}

/** Emit one port type's operations as a `const … as const` object. */
function buildPortTypeConst(constName: string, portTypeName: string, operations: ResolvedOperation[]): string {
	const lines: string[] = [
		buildJsDoc(
			`Operations of the '${portTypeName}' port type.\n\n` +
				`Each entry pairs the wire-level soapAction with the generated classes the ` +
				`operation exchanges. Pass \`faults\` to SoapSerializer's \`faultDetailTypes\` ` +
				`to have fault details deserialize into their own type.`,
		),
		`export const ${constName} = {`,
	];

	for (const operation of operations) {
		if (operation.documentation) {
			lines.push(indentLines(buildJsDoc(operation.documentation), 1));
		}
		lines.push(`\t${propertyKey(operation.name)}: {`);
		lines.push(`\t\tsoapAction: ${JSON.stringify(operation.soapAction ?? "")},`);
		if (operation.inputClass) lines.push(`\t\tinput: ${operation.inputClass},`);
		if (operation.outputClass) lines.push(`\t\toutput: ${operation.outputClass},`);

		const faultEntries = Object.entries(operation.faultClasses);
		if (faultEntries.length > 0) {
			lines.push(`\t\tfaults: {`);
			for (const [faultName, className] of faultEntries) {
				lines.push(`\t\t\t${propertyKey(faultName)}: ${className},`);
			}
			lines.push(`\t\t},`);
		}
		lines.push(`\t},`);
	}

	lines.push("} as const;");
	return lines.join("\n");
}

/**
 * Resolve one operation's messages to generated class names, or skip it.
 *
 * RPC and SOAP-encoded operations are skipped rather than half-generated: their
 * body is not a single document-literal element, so the classes here would not
 * round-trip. Multi-part messages are skipped for the same reason.
 */
function resolveOperation(
	operation: WsdlOperation,
	wsdl: WsdlDefinitions,
	classByElement: Map<string, string>,
	notes: string[],
): ResolvedOperation | undefined {
	if (operation.style === "rpc") {
		notes.push(`WSDL operation '${operation.name}' uses style="rpc", which is not supported; it was skipped.`);
		return undefined;
	}
	if (operation.use === "encoded") {
		notes.push(
			`WSDL operation '${operation.name}' uses SOAP encoding (use="encoded"), which is not supported; it was skipped.`,
		);
		return undefined;
	}

	const messageClass = (messageName: string | undefined): string | undefined => {
		if (!messageName) return undefined;
		const message = wsdl.messages.find((candidate) => candidate.name === messageName);
		if (!message) return undefined;
		if (message.partCount > 1) {
			notes.push(
				`WSDL message '${messageName}' has ${message.partCount} parts; only single-part ` +
					`document/literal messages map to one class, so operation '${operation.name}' omits it.`,
			);
			return undefined;
		}
		return message.elementName ? classByElement.get(stripPrefix(message.elementName)) : undefined;
	};

	const faultClasses: Record<string, string> = {};
	for (const [faultName, messageName] of Object.entries(operation.faults)) {
		const className = messageClass(messageName);
		if (className) faultClasses[faultName] = className;
	}

	const resolved: ResolvedOperation = {
		name: operation.name,
		soapAction: operation.soapAction,
		documentation: operation.documentation,
		inputClass: messageClass(operation.inputMessage),
		outputClass: messageClass(operation.outputMessage),
		faultClasses,
	};

	// An operation with no class at all says nothing useful.
	if (!resolved.inputClass && !resolved.outputClass && Object.keys(faultClasses).length === 0) {
		notes.push(`WSDL operation '${operation.name}' references no element that generated a class; it was skipped.`);
		return undefined;
	}

	return resolved;
}

/**
 * Element name → generated class name.
 *
 * A message names the *element* it carries; the class that element generated is
 * either a root element promoted onto its type, or a type named after it.
 */
function buildElementToClassMap(schema: ResolvedSchema): Map<string, string> {
	const map = new Map<string, string>();

	for (const root of schema.rootElements) {
		map.set(root.name, root.typeName);
	}
	// Types win over rootElements: an element with an inline complexType generates a
	// class of its own, and `xmlName` is the element it was generated from.
	for (const type of schema.types) {
		if (type.isRootElement) map.set(type.xmlName, type.className);
	}

	return map;
}

/** A valid object key: bare when it is an identifier, quoted otherwise. */
function propertyKey(name: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

/** Indent every line of a block by `level` tabs. */
function indentLines(block: string, level: number): string {
	const pad = "\t".repeat(level);
	return block
		.split("\n")
		.map((line) => (line ? pad + line : line))
		.join("\n");
}
