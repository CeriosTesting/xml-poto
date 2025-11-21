/**
 * Custom XML parser for handling mixed content.
 * Used as a fallback when fast-xml-parser cannot handle the structure.
 */

interface ParsedNode {
	type: "element" | "text" | "cdata" | "comment";
	name?: string;
	attributes?: Record<string, string>;
	children?: ParsedNode[];
	content?: string;
}

interface Token {
	type: "openTag" | "closeTag" | "selfClosingTag" | "text" | "cdata" | "comment" | "declaration";
	name?: string;
	attributes?: Record<string, string>;
	content?: string;
	position: number;
}

/**
 * Tokenizer for XML mixed content parsing
 */
class XmlTokenizer {
	private xml: string;
	private position: number;
	private length: number;

	constructor(xml: string) {
		this.xml = xml;
		this.position = 0;
		this.length = xml.length;
	}

	/**
	 * Get all tokens from the XML string
	 */
	tokenize(): Token[] {
		const tokens: Token[] = [];

		while (this.position < this.length) {
			const char = this.xml[this.position];

			if (char === "<") {
				const token = this.parseTag();
				if (token) {
					tokens.push(token);
				}
			} else {
				const token = this.parseText();
				if (token?.content?.trim()) {
					tokens.push(token);
				}
			}
		}

		return tokens;
	}

	/**
	 * Parse a tag (opening, closing, self-closing, comment, CDATA, etc.)
	 */
	private parseTag(): Token | null {
		const start = this.position;
		this.position++; // Skip '<'

		// Check for special tags
		if (this.peek() === "!") {
			this.position++; // Skip '!'

			// CDATA
			if (this.peek(7) === "[CDATA[") {
				return this.parseCDATA(start);
			}

			// Comment
			if (this.peek(2) === "--") {
				return this.parseComment(start);
			}

			// DOCTYPE (skip for now)
			if (this.peek(7) === "DOCTYPE") {
				this.skipUntil(">");
				this.position++; // Skip '>'
				return null;
			}
		}

		// XML Declaration
		if (this.peek() === "?") {
			this.skipUntil(">");
			this.position++; // Skip '>'
			return { type: "declaration", position: start };
		}

		// Closing tag
		if (this.peek() === "/") {
			this.position++; // Skip '/'
			const name = this.parseTagName();
			this.skipWhitespace();
			this.position++; // Skip '>'
			return { type: "closeTag", name, position: start };
		}

		// Opening or self-closing tag
		const name = this.parseTagName();
		this.skipWhitespace();
		const attributes = this.parseAttributes();
		this.skipWhitespace();

		// Self-closing tag
		if (this.peek() === "/") {
			this.position++; // Skip '/'
			this.position++; // Skip '>'
			return { type: "selfClosingTag", name, attributes, position: start };
		}

		this.position++; // Skip '>'
		return { type: "openTag", name, attributes, position: start };
	}

	/**
	 * Parse CDATA section
	 */
	private parseCDATA(start: number): Token {
		this.position += 7; // Skip "[CDATA["
		const contentStart = this.position;
		const endIndex = this.xml.indexOf("]]>", this.position);

		if (endIndex === -1) {
			throw new Error(`Unclosed CDATA section at position ${start}`);
		}

		const content = this.xml.substring(contentStart, endIndex);
		this.position = endIndex + 3; // Move past "]]>"

		return { type: "cdata", content, position: start };
	}

	/**
	 * Parse comment
	 */
	private parseComment(start: number): Token {
		this.position += 2; // Skip "--"
		const contentStart = this.position;
		const endIndex = this.xml.indexOf("-->", this.position);

		if (endIndex === -1) {
			throw new Error(`Unclosed comment at position ${start}`);
		}

		const content = this.xml.substring(contentStart, endIndex);
		this.position = endIndex + 3; // Move past "-->"

		return { type: "comment", content, position: start };
	}

	/**
	 * Parse tag name
	 */
	private parseTagName(): string {
		let name = "";
		while (this.position < this.length) {
			const char = this.xml[this.position];
			if (char === " " || char === "\t" || char === "\n" || char === "\r" || char === "/" || char === ">") {
				break;
			}
			name += char;
			this.position++;
		}
		return name;
	}

	/**
	 * Parse attributes
	 */
	private parseAttributes(): Record<string, string> {
		const attributes: Record<string, string> = {};

		while (this.position < this.length) {
			this.skipWhitespace();

			const char = this.peek();
			if (char === "/" || char === ">") {
				break;
			}

			// Parse attribute name
			let name = "";
			while (this.position < this.length) {
				const c = this.xml[this.position];
				if (c === "=" || c === " " || c === "\t" || c === "\n" || c === "\r") {
					break;
				}
				name += c;
				this.position++;
			}

			this.skipWhitespace();

			if (this.peek() === "=") {
				this.position++; // Skip '='
				this.skipWhitespace();

				// Parse attribute value
				const quote = this.peek();
				if (quote === '"' || quote === "'") {
					this.position++; // Skip opening quote
					let value = "";
					while (this.position < this.length) {
						const c = this.xml[this.position];
						if (c === quote) {
							this.position++; // Skip closing quote
							break;
						}
						value += c;
						this.position++;
					}
					attributes[name] = this.decodeEntities(value);
				}
			}
		}

		return attributes;
	}

	/**
	 * Parse text content
	 */
	private parseText(): Token {
		const start = this.position;
		let content = "";

		while (this.position < this.length) {
			const char = this.xml[this.position];
			if (char === "<") {
				break;
			}
			content += char;
			this.position++;
		}

		return { type: "text", content: this.decodeEntities(content), position: start };
	}

	/**
	 * Decode HTML/XML entities
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
	 * Skip whitespace characters
	 */
	private skipWhitespace(): void {
		while (this.position < this.length) {
			const char = this.xml[this.position];
			if (char !== " " && char !== "\t" && char !== "\n" && char !== "\r") {
				break;
			}
			this.position++;
		}
	}

	/**
	 * Skip until a specific string is found
	 */
	private skipUntil(target: string): void {
		const index = this.xml.indexOf(target, this.position);
		if (index !== -1) {
			this.position = index;
		} else {
			this.position = this.length;
		}
	}

	/**
	 * Peek at the next character(s) without consuming
	 */
	private peek(length: number = 1): string {
		return this.xml.substring(this.position, this.position + length);
	}
}

/**
 * Parser that converts tokens into a DOM-like structure
 */
class XmlParser {
	private tokens: Token[];
	private position: number;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
		this.position = 0;
	}

	/**
	 * Parse tokens into a tree structure
	 */
	parse(): ParsedNode | null {
		if (this.position >= this.tokens.length) {
			return null;
		}

		const token = this.tokens[this.position];

		if (token.type === "text") {
			this.position++;
			return {
				type: "text",
				content: token.content,
			};
		}

		if (token.type === "cdata") {
			this.position++;
			return {
				type: "cdata",
				content: token.content,
			};
		}

		if (token.type === "comment") {
			this.position++;
			return {
				type: "comment",
				content: token.content,
			};
		}

		if (token.type === "selfClosingTag") {
			this.position++;
			return {
				type: "element",
				name: token.name,
				attributes: token.attributes,
				children: [],
			};
		}

		if (token.type === "openTag") {
			return this.parseElement(token);
		}

		// Skip other token types
		this.position++;
		return null;
	}

	/**
	 * Parse an element with its children
	 */
	private parseElement(openToken: Token): ParsedNode {
		this.position++; // Move past open tag

		const element: ParsedNode = {
			type: "element",
			name: openToken.name,
			attributes: openToken.attributes,
			children: [],
		};

		// Parse children until we hit the closing tag
		while (this.position < this.tokens.length) {
			const token = this.tokens[this.position];

			if (token.type === "closeTag" && token.name === openToken.name) {
				this.position++; // Move past close tag
				break;
			}

			const child = this.parse();
			if (child && element.children) {
				element.children.push(child);
			}
		}

		return element;
	}

	/**
	 * Parse all nodes at the current level
	 */
	parseAll(): ParsedNode[] {
		const nodes: ParsedNode[] = [];

		while (this.position < this.tokens.length) {
			const node = this.parse();
			if (node) {
				nodes.push(node);
			}
		}

		return nodes;
	}
}

/**
 * Custom XML parser that handles mixed content properly
 */
export class CustomXmlParser {
	/**
	 * Parse XML string into a structure that supports mixed content
	 */
	parse(xmlString: string): any {
		// Remove XML declaration if present
		const cleanXml = xmlString.replace(/<\?xml[^?]*\?>/i, "").trim();

		// Tokenize
		const tokenizer = new XmlTokenizer(cleanXml);
		const tokens = tokenizer.tokenize();

		// Parse tokens into tree
		const parser = new XmlParser(tokens);
		const nodes = parser.parseAll();

		// Convert to object structure
		if (nodes.length === 0) {
			return {};
		}

		// Return the first element (root)
		const root = nodes.find(n => n.type === "element");
		if (!root) {
			return {};
		}

		return this.nodeToObject(root);
	}

	/**
	 * Convert a parsed node to an object structure compatible with our mapping util
	 */
	private nodeToObject(node: ParsedNode): any {
		if (node.type === "text") {
			return node.content;
		}

		if (node.type === "cdata") {
			return { __cdata: node.content };
		}

		if (node.type === "element") {
			const obj: any = {};

			// Add attributes
			if (node.attributes && Object.keys(node.attributes).length > 0) {
				for (const [key, value] of Object.entries(node.attributes)) {
					obj[`@_${key}`] = value;
				}
			}

			// Process children
			if (node.children && node.children.length > 0) {
				// Check if this is mixed content (has both text and element children)
				const hasTextChildren = node.children.some(c => c.type === "text" || c.type === "cdata");
				const hasElementChildren = node.children.some(c => c.type === "element");

				if (hasTextChildren && hasElementChildren) {
					// Mixed content - return as array
					obj["#mixed"] = node.children
						.map(child => {
							if (child.type === "text") {
								// Preserve text content exactly as parsed, don't trim
								if (child.content !== undefined && child.content !== null) {
									return { text: child.content };
								}
								return null;
							}
							if (child.type === "cdata") {
								return { text: child.content }; // Treat CDATA as text in mixed content
							}
							if (child.type === "element") {
								return {
									element: child.name,
									content: this.extractContent(child),
									attributes: child.attributes || {},
								};
							}
							return null;
						})
						.filter(Boolean);
				} else if (hasTextChildren) {
					// Only text content
					const textContent = node.children
						.filter(c => c.type === "text" || c.type === "cdata")
						.map(c => c.content)
						.join("");

					if (node.children.some(c => c.type === "cdata")) {
						obj.__cdata = textContent;
					} else {
						obj["#text"] = textContent;
					}
				} else {
					// Only element children - group by element name
					const elementGroups: Record<string, any[]> = {};

					for (const child of node.children) {
						if (child.type === "element" && child.name) {
							if (!elementGroups[child.name]) {
								elementGroups[child.name] = [];
							}
							// nodeToObject returns { elementName: {...} }, so unwrap it
							const childObj = this.nodeToObject(child);
							if (child.name && childObj && childObj[child.name]) {
								elementGroups[child.name].push(childObj[child.name]);
							}
						}
					}

					// Add grouped elements to object
					for (const [name, elements] of Object.entries(elementGroups)) {
						obj[name] = elements.length === 1 ? elements[0] : elements;
					}
				}
			}

			if (node.name) {
				return { [node.name]: obj };
			}
		}

		return null;
	}

	/**
	 * Extract content from an element (for mixed content children)
	 */
	private extractContent(node: ParsedNode): any {
		if (!node.children || node.children.length === 0) {
			return "";
		}

		// If only text/CDATA children, return as string
		const hasOnlyText = node.children.every(c => c.type === "text" || c.type === "cdata");
		if (hasOnlyText) {
			return node.children.map(c => c.content).join("");
		}

		// If has element children, return as mixed content array
		return node.children
			.map(child => {
				if (child.type === "text") {
					if (child.content !== undefined && child.content !== null) {
						return { text: child.content };
					}
					return null;
				}
				if (child.type === "cdata") {
					return { text: child.content };
				}
				if (child.type === "element") {
					return {
						element: child.name,
						content: this.extractContent(child),
						attributes: child.attributes || {},
					};
				}
				return null;
			})
			.filter(Boolean);
	}
}
