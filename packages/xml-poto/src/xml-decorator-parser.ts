/* eslint-disable typescript/no-explicit-any -- Parser handles dynamic XML content where types are unknown until runtime */
/**
 * High-performance XML parser optimized for decorator-based serialization.
 *
 * Provides low-level XML parsing with support for attributes, text content, CDATA sections,
 * comments, mixed content, and namespaces. Used internally by {@link XmlDecoratorSerializer}
 * but can be used directly for custom parsing scenarios.
 */

export interface ParserOptions {
	attributeNamePrefix?: string;
	textNodeName?: string;
	trimValues?: boolean;
	parseTagValue?: boolean;
	cdataPropName?: string;
}

export interface ParseContext {
	xml: string;
	pos: number;
	length: number;
	options: Required<ParserOptions>;
}

/**
 * Fast XML parser implementation for converting XML strings to JavaScript objects.
 *
 * This parser is optimized for performance and supports modern XML features including
 * mixed content, CDATA sections, comments, and namespaces. Used internally by
 * {@link XmlDecoratorSerializer.fromXml} but can be used standalone for custom parsing.
 */
export class XmlDecoratorParser {
	private options: Required<ParserOptions>;

	/**
	 * Creates a new XML parser with specified parsing options.
	 *
	 * @param options Parser configuration options
	 * @param options.attributeNamePrefix - Prefix for attribute keys in parsed object (default: '@_')
	 * @param options.textNodeName - Property name for text content (default: '#text')
	 * @param options.trimValues - Whether to trim whitespace from text values (default: false)
	 * @param options.parseTagValue - Whether to parse numeric/boolean values (default: true)
	 * @param options.cdataPropName - Property name for CDATA sections (default: '__cdata')
	 *
	 * @example
	 * // Basic parser
	 * const parser = new XmlDecoratorParser();
	 * const obj = parser.parse('<Person><name>John</name></Person>');
	 *
	 * @example
	 * // Custom attribute prefix
	 * const parser = new XmlDecoratorParser({
	 *   attributeNamePrefix: '$',
	 *   trimValues: true
	 * });
	 * const obj = parser.parse('<Person id="123"><name>John</name></Person>');
	 * // Result: { Person: { $id: '123', name: 'John' } }
	 */
	constructor(options: ParserOptions = {}) {
		this.options = {
			attributeNamePrefix: options.attributeNamePrefix ?? "@_",
			textNodeName: options.textNodeName ?? "#text",
			trimValues: options.trimValues ?? false,
			parseTagValue: options.parseTagValue ?? true,
			cdataPropName: options.cdataPropName ?? "__cdata",
		};
	}

	/**
	 * Parses an XML string into a JavaScript object representation.
	 *
	 * Converts XML elements to nested objects, attributes to properties with prefixes,
	 * and text content to special properties. Handles CDATA sections, comments, mixed
	 * content, and namespaces. Automatically removes XML declarations and DOCTYPE.
	 *
	 * @param xmlString The XML string to parse (must be valid XML)
	 * @returns A JavaScript object representing the XML structure
	 *
	 * @throws {Error} If XML is malformed or contains syntax errors
	 *
	 * @example
	 * // Simple element
	 * const parser = new XmlDecoratorParser();
	 * const obj = parser.parse('<Person><name>John</name><age>30</age></Person>');
	 * // Result: { Person: { name: 'John', age: 30 } }
	 *
	 * @example
	 * // With attributes
	 * const obj = parser.parse('<Person id="123" active="true"><name>John</name></Person>');
	 * // Result: { Person: { '@_id': '123', '@_active': true, name: 'John' } }
	 *
	 * @example
	 * // With CDATA
	 * const obj = parser.parse('<Code><![CDATA[if (x < 5) {}]]></Code>');
	 * // Result: { Code: { __cdata: 'if (x < 5) {}' } }
	 *
	 * @example
	 * // Mixed content
	 * const obj = parser.parse('<p>Some <bold>text</bold> here</p>');
	 * // Result: { p: { '#text': ['Some ', ' here'], bold: 'text' } }
	 *
	 * @example
	 * // With namespaces
	 * const obj = parser.parse('<doc:Root xmlns:doc="http://example.com"><doc:Title>Test</doc:Title></doc:Root>');
	 * // Result: { 'doc:Root': { 'doc:Title': 'Test', '@_xmlns:doc': 'http://example.com' } }
	 */
	parse(xmlString: string): any {
		const cleanXml = stripProlog(xmlString);

		if (!cleanXml) {
			return {};
		}

		// Something that does not even start with a tag is not XML. Left alone it
		// parses to `{}` and the caller is told "Root element X not found", which
		// points at the wrong problem — an HTML or JSON error page from a gateway is
		// the usual culprit, and the message should say so.
		if (!cleanXml.startsWith("<")) {
			const preview = cleanXml.slice(0, 40).replace(/\s+/g, " ");
			throw new Error(`Input is not XML: expected the document to start with '<', found '${preview}…'`);
		}

		const ctx: ParseContext = {
			xml: cleanXml,
			pos: 0,
			length: cleanXml.length,
			options: this.options,
		};

		// Parse root element
		this.skipWhitespace(ctx);
		const root = this.parseElement(ctx);

		// Remove internal __isMixed properties
		return this.cleanResult(root ?? {});
	} /**
	 * Parse an XML element
	 */
	private parseElement(ctx: ParseContext): any {
		if (ctx.pos >= ctx.length || ctx.xml[ctx.pos] !== "<") {
			return null;
		}

		ctx.pos++; // Skip '<'

		// Check for special tags
		if (ctx.xml[ctx.pos] === "!") {
			return this.parseSpecial(ctx);
		}

		// Check for closing tag
		if (ctx.xml[ctx.pos] === "/") {
			return null;
		}

		// Parse tag name
		const tagName = this.parseTagName(ctx);
		if (!tagName) {
			return null;
		}

		// Parse attributes
		const attributes = this.parseAttributes(ctx);

		// Check for self-closing
		this.skipWhitespace(ctx);
		if (ctx.xml[ctx.pos] === "/" && ctx.xml[ctx.pos + 1] === ">") {
			ctx.pos += 2;
			return this.buildElementObject(tagName, attributes, null, false);
		}

		if (ctx.xml[ctx.pos] !== ">") {
			throw new Error(`Expected '>' at position ${ctx.pos}`);
		}
		ctx.pos++; // Skip '>'

		// Parse content
		const content = this.parseContent(ctx, tagName);

		// Skip closing tag
		this.skipClosingTag(ctx, tagName);

		return this.buildElementObject(tagName, attributes, content, false);
	}

	/**
	 * Parse tag name
	 */
	private parseTagName(ctx: ParseContext): string {
		const start = ctx.pos;
		while (ctx.pos < ctx.length) {
			const char = ctx.xml[ctx.pos];
			if (char === " " || char === "\t" || char === "\n" || char === "\r" || char === "/" || char === ">") {
				break;
			}
			ctx.pos++;
		}
		return ctx.xml.substring(start, ctx.pos);
	}

	/**
	 * Parse attributes
	 */
	private parseAttributes(ctx: ParseContext): Record<string, string> {
		const attributes: Record<string, string> = {};

		while (ctx.pos < ctx.length) {
			this.skipWhitespace(ctx);

			const char = ctx.xml[ctx.pos];
			if (char === "/" || char === ">") {
				break;
			}

			// Parse attribute name
			const nameStart = ctx.pos;
			while (ctx.pos < ctx.length) {
				const c = ctx.xml[ctx.pos];
				if (c === "=" || c === " " || c === "\t" || c === "\n" || c === "\r") {
					break;
				}
				ctx.pos++;
			}
			const name = ctx.xml.substring(nameStart, ctx.pos);

			this.skipWhitespace(ctx);

			if (ctx.xml[ctx.pos] === "=") {
				ctx.pos++; // Skip '='
				this.skipWhitespace(ctx);

				// Parse attribute value
				const quote = ctx.xml[ctx.pos];
				if (quote === '"' || quote === "'") {
					ctx.pos++; // Skip opening quote
					const valueStart = ctx.pos;
					while (ctx.pos < ctx.length && ctx.xml[ctx.pos] !== quote) {
						ctx.pos++;
					}
					const value = this.decodeEntities(ctx.xml.substring(valueStart, ctx.pos));
					ctx.pos++; // Skip closing quote
					attributes[name] = value;
				}
			}
		}

		return attributes;
	}

	/**
	 * Parse element content (text and child elements)
	 */
	private parseContent(ctx: ParseContext, _parentTag: string): any {
		const children: any[] = [];
		let textContent = "";
		let hasMixedContent = false;
		let pendingComment: string | null = null;

		while (ctx.pos < ctx.length) {
			// Check for closing tag
			if (ctx.xml[ctx.pos] === "<" && ctx.xml[ctx.pos + 1] === "/") {
				break;
			}

			// Check for child element or special content
			if (ctx.xml[ctx.pos] === "<") {
				// Save accumulated text (only if non-whitespace)
				if (textContent.trim()) {
					hasMixedContent = true;
					children.push({ text: textContent });
				}
				textContent = "";

				const child = this.parseElement(ctx);
				if (child !== null) {
					pendingComment = this.processChildElement(child, pendingComment, children);
				}
			} else {
				// Text content
				textContent += ctx.xml[ctx.pos];
				ctx.pos++;
			}
		}

		// Handle remaining text (only if non-whitespace)
		if (textContent.trim() && children.length > 0) {
			hasMixedContent = true;
			children.push({ text: textContent });
		}

		return this.buildContentResult(children, textContent, hasMixedContent);
	}

	/**
	 * Process a parsed child element, handling comments and associating pending comments.
	 * Returns the updated pending comment value.
	 */
	private processChildElement(child: any, pendingComment: string | null, children: any[]): string | null {
		if (child.__comment !== undefined) {
			return child.__comment;
		}

		if (pendingComment !== null) {
			const tagName = Object.keys(child)[0];
			if (tagName && tagName !== "__isMixed") {
				child[`?_${tagName}`] = pendingComment;
			}
		}
		children.push(child);
		return null;
	}

	/**
	 * Build the appropriate content result structure from parsed children.
	 */
	private buildContentResult(children: any[], textContent: string, hasMixedContent: boolean): any {
		if (children.length === 0) {
			return this.processTextValue(textContent);
		}

		// Check if we have CDATA nodes with no other content. Adjacent CDATA sections
		// are a single run of character data as far as XML is concerned — and are
		// produced whenever a value containing ']]>' is written out — so they are
		// joined rather than surfaced as an array.
		if (!hasMixedContent) {
			const cdata = this.joinCdataChildren(children);
			if (cdata !== undefined) {
				return cdata;
			}
		}

		if (hasMixedContent) {
			return { "#mixed": this.formatMixedContent(children) };
		}

		return this.groupChildren(children);
	}

	/**
	 * Collapse a run of CDATA-only children into one node, or return undefined when
	 * the children are not exclusively CDATA.
	 */
	private joinCdataChildren(children: any[]): Record<string, unknown> | undefined {
		if (children.length === 0) return undefined;

		const contents: string[] = [];
		for (const child of children) {
			const content = child?.[this.options.cdataPropName];
			// A CDATA node carries only its content (plus the internal __isMixed flag).
			if (content === undefined || Object.keys(child).length > 2) return undefined;
			contents.push(String(content));
		}

		return { [this.options.cdataPropName]: contents.join(""), __isMixed: false };
	}

	/**
	 * Format children array into mixed content structure.
	 */
	private formatMixedContent(children: any[]): any[] {
		return children
			.map((child) => {
				if (child.text !== undefined) {
					return { text: child.text };
				}
				return this.formatElementForMixedContent(child);
			})
			.filter(Boolean);
	}

	/**
	 * Format a single element node for mixed content output.
	 */
	private formatElementForMixedContent(child: any): any {
		for (const [tagName, value] of Object.entries(child)) {
			if (tagName === "__isMixed") continue;

			const attributes: Record<string, string> = {};
			let content: any = "";

			if (typeof value === "object" && value !== null) {
				for (const [key, val] of Object.entries(value)) {
					if (key.startsWith(this.options.attributeNamePrefix)) {
						const attrName = key.substring(this.options.attributeNamePrefix.length);
						attributes[attrName] = String(val);
					} else if (key === this.options.textNodeName) {
						content = val;
					} else if (!key.startsWith("@_")) {
						content = val;
					}
				}
			} else {
				content = value;
			}

			return {
				element: tagName,
				content: content,
				attributes: Object.keys(attributes).length > 0 ? attributes : {},
			};
		}
		return null;
	}

	/**
	 * Group child elements by tag name
	 */
	private groupChildren(children: any[]): any {
		const grouped: Record<string, any> = {};
		const order: string[] = [];

		for (const child of children) {
			for (const [key, value] of Object.entries(child)) {
				if (key === "__isMixed") continue;

				order.push(key);

				if (grouped[key]) {
					// Convert to array if not already
					if (!Array.isArray(grouped[key])) {
						grouped[key] = [grouped[key]];
					}
					grouped[key].push(value);
				} else {
					grouped[key] = value;
				}
			}
		}

		attachChildOrder(grouped, order);
		return grouped;
	}

	/**
	 * Build element object with attributes and content
	 */
	private buildElementObject(tagName: string, attributes: Record<string, string>, content: any, isMixed: boolean): any {
		const hasAttributes = Object.keys(attributes).length > 0;

		// If no attributes and content is a simple value, return it directly
		if (
			!hasAttributes &&
			(typeof content === "string" || typeof content === "number" || typeof content === "boolean")
		) {
			return { [tagName]: content, __isMixed: isMixed };
		}

		const obj: any = {};

		// Add attributes
		for (const [key, value] of Object.entries(attributes)) {
			obj[`${this.options.attributeNamePrefix}${key}`] = value;
		}

		// Add content
		if (content !== null && content !== undefined) {
			if (typeof content === "object" && "#mixed" in content) {
				// Mixed content
				obj["#mixed"] = content["#mixed"];
			} else if (typeof content === "object") {
				// Child elements. Object.assign copies enumerable properties only, so the
				// child-order channel has to be carried across deliberately.
				Object.assign(obj, content);
				const order = getChildOrder(content);
				if (order) attachChildOrder(obj, order);
			} else {
				// Text content (with attributes)
				obj[this.options.textNodeName] = content;
			}
		}

		return { [tagName]: obj, __isMixed: isMixed };
	}

	/**
	 * Parse special tags (CDATA, comments)
	 */
	private parseSpecial(ctx: ParseContext): any {
		ctx.pos++; // Skip '!'

		// CDATA
		if (ctx.xml.substring(ctx.pos, ctx.pos + 7) === "[CDATA[") {
			ctx.pos += 7;
			const start = ctx.pos;
			const end = ctx.xml.indexOf("]]>", ctx.pos);
			if (end === -1) {
				throw new Error("Unclosed CDATA section");
			}
			const content = ctx.xml.substring(start, end);
			ctx.pos = end + 3;
			return { [this.options.cdataPropName]: content, __isMixed: false };
		}

		// Comment
		if (ctx.xml.substring(ctx.pos, ctx.pos + 2) === "--") {
			ctx.pos += 2; // Skip '--'
			const start = ctx.pos;
			const end = ctx.xml.indexOf("-->", ctx.pos);
			if (end === -1) {
				throw new Error("Unclosed comment");
			}
			const content = ctx.xml.substring(start, end);
			ctx.pos = end + 3;
			return { __comment: content }; // Return comment object
		}

		// Skip other special tags (DOCTYPE, etc.)
		const end = ctx.xml.indexOf(">", ctx.pos);
		if (end !== -1) {
			ctx.pos = end + 1;
		}
		return null;
	}

	/**
	 * Skip closing tag
	 */
	private skipClosingTag(ctx: ParseContext, expectedTag: string): void {
		// Running out of input is not "the element ended" — it means the document was
		// cut short. Accepting it silently turns a truncated response into an object
		// that looks valid but is missing everything after the break.
		if (ctx.pos >= ctx.length) {
			throw new Error(`Unexpected end of XML: element <${expectedTag}> is never closed`);
		}

		if (ctx.xml[ctx.pos] !== "<" || ctx.xml[ctx.pos + 1] !== "/") {
			return;
		}

		ctx.pos += 2;
		const tagName = this.parseTagName(ctx);

		if (tagName !== expectedTag) {
			throw new Error(`Expected closing tag </${expectedTag}>, got </${tagName}>`);
		}

		this.skipWhitespace(ctx);
		if (ctx.xml[ctx.pos] === ">") {
			ctx.pos++;
		}
	}

	/**
	 * Process text value (decode entities, trim, parse)
	 */
	private processTextValue(text: string): any {
		const decoded = this.decodeEntities(text);
		const processed = this.options.trimValues ? decoded.trim() : decoded;

		// Handle empty strings - preserve them
		if (processed === "") {
			return "";
		}

		if (!this.options.parseTagValue) {
			return processed;
		}

		// Try to parse as number
		// Don't parse values with leading zeros (except plain "0" or decimals like "0.5")
		// to preserve IDs and codes like "0001234567"
		if (/^-?\d+(\.\d+)?$/.test(processed) && !/^0\d+/.test(processed)) {
			const num = Number(processed);
			if (!Number.isNaN(num)) {
				return num;
			}
		}

		// Try to parse as boolean
		if (processed === "true") return true;
		if (processed === "false") return false;

		return processed;
	}

	/**
	 * Decode XML entities.
	 *
	 * Done in a single pass: chaining `.replace` calls decodes its own output, so
	 * `&amp;#65;` — the escaped *literal text* `&#65;` — would first become `&#65;`
	 * and then be decoded again into `A`.
	 *
	 * Only the five predefined entities and character references are recognised.
	 * Entities declared in a DTD are not (this parser reads no DTD, which is also
	 * why it is immune to entity-expansion attacks); an unknown `&nbsp;` is left
	 * verbatim rather than guessed at.
	 */
	private decodeEntities(text: string): string {
		if (!text.includes("&")) return text;

		return text.replace(/&(?:(lt|gt|amp|quot|apos)|#(\d+)|#[xX]([0-9a-fA-F]+));/g, (match, named, dec, hex) => {
			if (named) return NAMED_ENTITIES[named as keyof typeof NAMED_ENTITIES];
			// fromCodePoint, not fromCharCode: the latter truncates above U+FFFF, so
			// an astral reference such as &#128512; would decode to the wrong character.
			const code = Number.parseInt(dec ?? hex, dec ? 10 : 16);
			return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
		});
	}

	/**
	 * Skip whitespace
	 */
	private skipWhitespace(ctx: ParseContext): void {
		while (ctx.pos < ctx.length) {
			const char = ctx.xml[ctx.pos];
			if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") {
				break;
			}
			ctx.pos++;
		}
	}

	/**
	 * Clean internal properties from result
	 */
	private cleanResult(obj: any): any {
		if (obj === null || obj === undefined || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.cleanResult(item));
		}

		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (key === "__isMixed") {
				continue;
			}
			cleaned[key] = this.cleanResult(value);
		}
		// cleanResult builds a fresh object, so the non-enumerable order channel has
		// to be carried across explicitly.
		const order = getChildOrder(obj);
		if (order) attachChildOrder(cleaned, order);
		return cleaned;
	}
}

/**
 * Key under which a parsed element records the tag name of each child, in document
 * order.
 *
 * Grouping children by tag — `{ note: [a, b], task: [c] }` — is what makes the
 * parsed shape convenient, but it cannot say whether the document read
 * `note task note` or `note note task`. Anything that must round-trip the order of
 * *differently named* siblings (an `@XmlArray({ items })` member) reads it from here.
 *
 * Non-enumerable on purpose: every existing consumer walks parsed objects with
 * `Object.entries`/`for…in`, and none of them should ever see this.
 */
export const CHILD_ORDER = Symbol.for("xmlPoto.childOrder");

/** Record the document order of an element's children. */
export function attachChildOrder(target: Record<string, unknown>, order: readonly string[]): void {
	Object.defineProperty(target, CHILD_ORDER, {
		value: order,
		enumerable: false,
		configurable: true,
		writable: true,
	});
}

/** The document order of an element's children, when the parser recorded one. */
export function getChildOrder(value: unknown): readonly string[] | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const order = (value as Record<symbol, unknown>)[CHILD_ORDER];
	return Array.isArray(order) ? (order as string[]) : undefined;
}

/**
 * Drop everything before the root element: the XML declaration, any number of
 * processing instructions, comments, and a DOCTYPE.
 *
 * Each is stripped in a loop rather than by one pass of a fixed regex, because a
 * document may carry several — `XmlDecoratorSerializer` itself can write an XML
 * declaration, a list of processing instructions *and* a DOCTYPE — and whatever
 * is left behind would be read as an element name.
 *
 * The DOCTYPE match accounts for an internal subset, whose `[ … ]` legitimately
 * contains `>` characters that a naive "up to the first `>`" match would stop at.
 */
function stripProlog(xmlString: string): string {
	let rest = xmlString.trimStart();

	for (;;) {
		if (rest.startsWith("<?")) {
			const end = rest.indexOf("?>");
			if (end === -1) break;
			rest = rest.slice(end + 2).trimStart();
			continue;
		}

		if (/^<!DOCTYPE/i.test(rest)) {
			const end = findDocTypeEnd(rest);
			if (end === -1) break;
			rest = rest.slice(end + 1).trimStart();
			continue;
		}

		if (rest.startsWith("<!--")) {
			const end = rest.indexOf("-->");
			if (end === -1) break;
			rest = rest.slice(end + 3).trimStart();
			continue;
		}

		break;
	}

	return rest.trim();
}

/** Index of the `>` closing a DOCTYPE declaration, skipping over its internal subset. */
function findDocTypeEnd(text: string): number {
	let inSubset = false;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === "[") inSubset = true;
		else if (char === "]") inSubset = false;
		else if (char === ">" && !inSubset) return i;
	}
	return -1;
}

/** The five entities XML predefines; everything else requires a DTD, which is not read. */
const NAMED_ENTITIES = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
} as const;
