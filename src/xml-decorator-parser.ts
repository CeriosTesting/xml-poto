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
		// Remove XML declaration and DOCTYPE
		const cleanXml = xmlString
			.replace(/<\?xml[^?]*\?>/i, "")
			.replace(/<!DOCTYPE[^>]*>/i, "")
			.trim();

		if (!cleanXml) {
			return {};
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
		return this.cleanResult(root || {});
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

		while (ctx.pos < ctx.length) {
			// Check for closing tag
			if (ctx.xml[ctx.pos] === "<" && ctx.xml[ctx.pos + 1] === "/") {
				break;
			}

			// Check for child element or special content
			if (ctx.xml[ctx.pos] === "<") {
				// Save accumulated text (only if non-whitespace)
				const trimmedText = textContent.trim();
				if (trimmedText) {
					hasMixedContent = true;
					children.push({ text: textContent });
				}
				textContent = "";

				const child = this.parseElement(ctx);
				if (child !== null) {
					children.push(child);
				}
			} else {
				// Text content
				const char = ctx.xml[ctx.pos];
				textContent += char;
				ctx.pos++;
			}
		}

		// Handle remaining text (only if non-whitespace)
		const trimmedRemainingText = textContent.trim();
		if (trimmedRemainingText) {
			if (children.length > 0) {
				hasMixedContent = true;
				children.push({ text: textContent });
			}
		}

		// Return appropriate structure
		if (children.length === 0) {
			// Pure text content
			return this.processTextValue(textContent);
		}

		// Check if we have a single CDATA node with no other content
		if (children.length === 1 && !hasMixedContent) {
			const singleChild = children[0];
			// Check if it's a pure CDATA node
			if (singleChild[this.options.cdataPropName] !== undefined && Object.keys(singleChild).length <= 2) {
				// Return just the CDATA object (will be handled by mapping util)
				return singleChild;
			}
		}

		if (hasMixedContent) {
			// Mixed content - format with proper structure for mapping util
			const mixedArray = children
				.map(child => {
					// Already formatted as text node
					if (child.text !== undefined) {
						return { text: child.text };
					}

					// Format element nodes for mixed content
					for (const [tagName, value] of Object.entries(child)) {
						if (tagName === "__isMixed") continue;

						// Extract attributes and content
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
									// Has nested content
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
				})
				.filter(Boolean);

			return { "#mixed": mixedArray };
		}

		// Group child elements by tag name
		return this.groupChildren(children);
	}

	/**
	 * Group child elements by tag name
	 */
	private groupChildren(children: any[]): any {
		const grouped: Record<string, any> = {};

		for (const child of children) {
			for (const [key, value] of Object.entries(child)) {
				if (key === "__isMixed") continue;

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
				// Child elements
				Object.assign(obj, content);
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
		if (ctx.xml.substr(ctx.pos, 7) === "[CDATA[") {
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
		if (ctx.xml.substr(ctx.pos, 2) === "--") {
			const end = ctx.xml.indexOf("-->", ctx.pos);
			if (end === -1) {
				throw new Error("Unclosed comment");
			}
			ctx.pos = end + 3;
			return null; // Skip comments
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
	 * Decode XML entities
	 */
	private decodeEntities(text: string): string {
		return text
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&amp;/g, "&")
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'")
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
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
			return obj.map(item => this.cleanResult(item));
		}

		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (key === "__isMixed") {
				continue;
			}
			cleaned[key] = this.cleanResult(value);
		}
		return cleaned;
	}
}
