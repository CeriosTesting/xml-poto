import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the documentation against the two ways its samples have silently rotted:
 * option names that do not exist on the option types, and `toXml`/`fromXml` calls
 * given an options argument they do not accept.
 *
 * This deliberately does not type-check the snippets. Most are fragments with no
 * imports, and the repo is on TypeScript 7 (tsgo), whose package does not expose
 * the JavaScript compiler API. Text extraction catches both defect classes.
 */

const PACKAGE_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");

const DOC_ROOTS = [
	path.join(PACKAGE_ROOT, "docs"),
	path.join(PACKAGE_ROOT, "README.md"),
	path.join(REPO_ROOT, "packages/xml-poto-codegen/README.md"),
];

/** Keys that are legitimately used in option-shaped literals but belong to other types. */
const ALLOWED_FOREIGN_KEYS = new Set([
	// validationModeOverrides rule keys
	"pattern",
	"enumValues",
	"length",
	"minLength",
	"maxLength",
	"minInclusive",
	"maxInclusive",
	"minExclusive",
	"maxExclusive",
	"totalDigits",
	"fractionDigits",
	"fixedValue",
	"choiceGroup",
	"minOccurs",
	"maxOccurs",
	// SoapWriteOptions / SoapHeaderSpec / SoapSerializerOptions
	"headers",
	"body",
	"value",
	"mustUnderstand",
	"actor",
	"role",
	"relay",
	"version",
	"prefix",
	"faultDetailTypes",
	// nested option types: XmlNamespace, XmlListOptions, XmlArrayItem, Transform/Converter
	"uri",
	"itemType",
	"serialize",
	"deserialize",
	// ProcessingInstruction / DocType
	"target",
	"data",
	"rootElement",
	"publicId",
	"systemId",
	"internalSubset",
]);

function collectMarkdownFiles(entry: string): string[] {
	if (entry.endsWith(".md")) return [entry];
	return readdirSync(entry, { withFileTypes: true }).flatMap((dirent) => {
		const full = path.join(entry, dirent.name);
		if (dirent.isDirectory()) return collectMarkdownFiles(full);
		return dirent.name.endsWith(".md") ? [full] : [];
	});
}

const DOC_FILES = DOC_ROOTS.flatMap(collectMarkdownFiles);

/** Relative-to-repo path, for readable failure messages. */
function rel(file: string): string {
	return path.relative(REPO_ROOT, file).replace(/\\/g, "/");
}

/**
 * Collects the property names declared by each `export interface` in a source file,
 * following `extends` within the same file.
 */
function parseInterfaces(source: string): Map<string, Set<string>> {
	const own = new Map<string, { keys: Set<string>; bases: string[] }>();
	const header = /export interface (\w+)(?:<[^>]*>)?(?:\s+extends\s+([^{]+))?\s*\{/g;

	for (let match = header.exec(source); match !== null; match = header.exec(source)) {
		const [, name, extendsClause] = match;
		// Walk from the opening brace to its matching close, tracking nesting.
		let depth = 0;
		let end = match.index + match[0].length - 1;
		for (let i = end; i < source.length; i++) {
			if (source[i] === "{") depth++;
			else if (source[i] === "}") {
				depth--;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		const body = source.slice(match.index + match[0].length, end);
		const keys = new Set<string>();
		// Only top-level members: exactly one tab of indentation.
		for (const line of body.split("\n")) {
			const member = /^\t(\w+)\??\s*:/.exec(line);
			if (member) keys.add(member[1]);
		}
		const bases = (extendsClause ?? "")
			.split(",")
			.map((b) => b.trim().replace(/<.*/, ""))
			.filter(Boolean);
		own.set(name, { keys, bases });
	}

	const resolved = new Map<string, Set<string>>();
	const resolve = (name: string, seen = new Set<string>()): Set<string> => {
		const cached = resolved.get(name);
		if (cached) return cached;
		const entry = own.get(name);
		if (!entry || seen.has(name)) return new Set();
		seen.add(name);
		const keys = new Set(entry.keys);
		for (const base of entry.bases) {
			for (const key of resolve(base, seen)) keys.add(key);
		}
		resolved.set(name, keys);
		return keys;
	};
	for (const name of own.keys()) resolve(name);
	return resolved;
}

const optionInterfaces = parseInterfaces(
	readFileSync(path.join(PACKAGE_ROOT, "src/decorators/types/options.ts"), "utf-8"),
);
const serializationInterfaces = parseInterfaces(
	readFileSync(path.join(PACKAGE_ROOT, "src/serialization-options.ts"), "utf-8"),
);

/** Every key legal anywhere in a decorator option literal. */
const decoratorKeys = new Set<string>();
for (const [name, keys] of optionInterfaces) {
	if (!name.startsWith("Xml")) continue;
	for (const key of keys) decoratorKeys.add(key);
}

const serializationKeys = serializationInterfaces.get("SerializationOptions") ?? new Set<string>();

/** Extracts the object literal that follows `open`, balancing braces. */
function objectLiteralAt(source: string, openBraceIndex: number): string | undefined {
	let depth = 0;
	for (let i = openBraceIndex; i < source.length; i++) {
		if (source[i] === "{") depth++;
		else if (source[i] === "}") {
			depth--;
			if (depth === 0) return source.slice(openBraceIndex + 1, i);
		}
	}
	return undefined;
}

/**
 * Blanks out string literals and comments, so a `uri: "http://…"` does not read as
 * a comment and a trailing `// Default: …` does not read as a key. Replacing rather
 * than removing keeps every other index stable.
 */
function blankNonCode(body: string): string {
	const nonCode = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
	return body.replace(nonCode, (match) => " ".repeat(match.length));
}

/** Top-level `key:` names in an object literal body, ignoring nested literals. */
function topLevelKeys(rawBody: string): string[] {
	const body = blankNonCode(rawBody);
	const keys: string[] = [];
	const keyPattern = /(\w+)\s*:/y;
	let depth = 0;
	let atValue = false;

	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (ch === "{" || ch === "[" || ch === "(") depth++;
		else if (ch === "}" || ch === "]" || ch === ")") depth--;
		else if (ch === "," && depth === 0) atValue = false;
		else if (depth === 0 && !atValue && /[A-Za-z_]/.test(ch)) {
			keyPattern.lastIndex = i;
			const match = keyPattern.exec(body);
			if (match) {
				keys.push(match[1]);
				atValue = true;
				i = keyPattern.lastIndex - 1;
			}
		}
	}
	return keys;
}

interface Finding {
	file: string;
	detail: string;
}

describe("documentation samples", () => {
	// If the interface parser breaks, every check below silently passes. Fail loudly instead.
	describe("the option-name extractor still works", () => {
		it("finds the decorator option keys", () => {
			expect(decoratorKeys.size).toBeGreaterThan(30);
			for (const sentinel of ["name", "namespace", "enumMap", "items", "mixed", "form"]) {
				expect(decoratorKeys, `expected ${sentinel} among the decorator keys`).toContain(sentinel);
			}
		});

		it("finds the serialization option keys", () => {
			expect(serializationKeys.size).toBeGreaterThan(15);
			for (const sentinel of ["format", "indent", "omitNullValues", "omitDefaultValues", "schemaLocation"]) {
				expect(serializationKeys, `expected ${sentinel} among the serialization keys`).toContain(sentinel);
			}
		});

		it("resolves keys inherited through extends", () => {
			// XmlElementOptions extends XmlValueFacets
			expect(optionInterfaces.get("XmlElementOptions")).toContain("pattern");
		});
	});

	it("uses only option names that exist on the option types", () => {
		const findings: Finding[] = [];
		for (const file of DOC_FILES) {
			const source = readFileSync(file, "utf-8");
			const decoratorCall = /@Xml[A-Za-z]+\(\s*\{/g;
			for (let m = decoratorCall.exec(source); m !== null; m = decoratorCall.exec(source)) {
				const body = objectLiteralAt(source, m.index + m[0].length - 1);
				if (body === undefined) continue;
				for (const key of topLevelKeys(body)) {
					if (decoratorKeys.has(key) || ALLOWED_FOREIGN_KEYS.has(key)) continue;
					findings.push({ file: rel(file), detail: `${m[0].slice(0, -2)}({ ${key}: … })` });
				}
			}
		}
		expect(findings, `unknown decorator option names:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
	});

	it("uses only serialization option names that exist on SerializationOptions", () => {
		const findings: Finding[] = [];
		for (const file of DOC_FILES) {
			const source = readFileSync(file, "utf-8");
			const ctorCall = /new Xml(?:Decorator)?(?:Serializer|Parser)\(\s*\{/g;
			for (let m = ctorCall.exec(source); m !== null; m = ctorCall.exec(source)) {
				const body = objectLiteralAt(source, m.index + m[0].length - 1);
				if (body === undefined) continue;
				for (const key of topLevelKeys(body)) {
					if (serializationKeys.has(key) || ALLOWED_FOREIGN_KEYS.has(key)) continue;
					findings.push({ file: rel(file), detail: `${m[0].slice(0, -2)}({ ${key}: … })` });
				}
			}
		}
		expect(findings, `unknown serialization option names:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
	});

	it("does not pass an options argument to toXml/fromXml", () => {
		// toXml(obj) takes one argument; fromXml(xml, Type) takes two. Only SoapSerializer's
		// toXml/fromXml accept a further options object.
		const findings: Finding[] = [];
		for (const file of DOC_FILES) {
			const source = readFileSync(file, "utf-8");
			const call = /(\w+)\.(toXml|fromXml)\(([^;]*?)\);/g;
			for (let m = call.exec(source); m !== null; m = call.exec(source)) {
				const [, receiver, method, args] = m;
				if (/soap/i.test(receiver)) continue;
				const commas = args.split("").reduce(
					(acc, ch) => {
						if (ch === "{" || ch === "[" || ch === "(") acc.depth++;
						else if (ch === "}" || ch === "]" || ch === ")") acc.depth--;
						else if (ch === "," && acc.depth === 0) acc.count++;
						return acc;
					},
					{ depth: 0, count: 0 },
				).count;
				const expected = method === "toXml" ? 0 : 1;
				if (commas > expected) {
					findings.push({ file: rel(file), detail: `${receiver}.${method}(${args.trim()})` });
				}
			}
		}
		expect(findings, `too many arguments passed:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
	});
});

describe("documentation links", () => {
	/** GitHub's heading-to-anchor slug rules. */
	function slug(heading: string): string {
		return heading
			.trim()
			.toLowerCase()
			.replace(/[^\w\- ]/g, "")
			.replace(/ /g, "-");
	}

	function headingSlugs(file: string): Set<string> {
		const slugs = new Set<string>();
		for (const line of readFileSync(file, "utf-8").split("\n")) {
			const match = /^#{1,6} (.+)$/.exec(line);
			if (match) slugs.add(slug(match[1]));
		}
		return slugs;
	}

	it("resolves every relative markdown link", () => {
		const findings: Finding[] = [];
		for (const file of DOC_FILES) {
			const source = readFileSync(file, "utf-8");
			const link = /\]\((?!https?:)([^)#\s]*\.md)(?:#[^)\s]*)?\)/g;
			for (let m = link.exec(source); m !== null; m = link.exec(source)) {
				const target = path.resolve(path.dirname(file), m[1]);
				try {
					readFileSync(target, "utf-8");
				} catch {
					findings.push({ file: rel(file), detail: `broken link → ${m[1]}` });
				}
			}
		}
		expect(findings, `broken links:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
	});

	it("resolves every anchor to a real heading", () => {
		const findings: Finding[] = [];
		for (const file of DOC_FILES) {
			const source = readFileSync(file, "utf-8");
			const link = /\]\((?!https?:)([^)#\s]*)#([^)\s]+)\)/g;
			for (let m = link.exec(source); m !== null; m = link.exec(source)) {
				const [, targetPath, anchor] = m;
				const target = targetPath === "" ? file : path.resolve(path.dirname(file), targetPath);
				let slugs: Set<string>;
				try {
					slugs = headingSlugs(target);
				} catch {
					continue; // reported by the broken-link test
				}
				// Case-sensitive: the browser matches the fragment against the generated
				// id exactly, so `#XmlArray-decorator` does not reach `id="xmlarray-decorator"`.
				if (!slugs.has(anchor)) {
					findings.push({ file: rel(file), detail: `${targetPath}#${anchor}` });
				}
			}
		}
		expect(findings, `broken anchors:\n${JSON.stringify(findings, null, 2)}`).toEqual([]);
	});
});
