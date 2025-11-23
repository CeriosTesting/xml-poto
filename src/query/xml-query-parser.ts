import { QueryableElement, XmlQuery } from "./xml-query";

/**
 * High-performance queryable XML parser with fluent API
 * Zero dependencies, optimized for dynamic XML querying
 */
export interface XmlQueryParserOptions {
	/** Whether to trim text values (default: true) */
	trimValues?: boolean;
	/** Whether to parse numeric values (default: true) */
	parseNumbers?: boolean;
	/** Whether to parse boolean values (default: true) */
	parseBooleans?: boolean;
	/** Whether to preserve raw text with whitespace (default: false) */
	preserveRawText?: boolean;
}

/**
 * Queryable XML Parser with comprehensive fluent API
 */
export class XmlQueryParser {
	private options: Required<XmlQueryParserOptions>;

	constructor(options?: XmlQueryParserOptions) {
		this.options = {
			trimValues: options?.trimValues ?? true,
			parseNumbers: options?.parseNumbers ?? true,
			parseBooleans: options?.parseBooleans ?? true,
			preserveRawText: options?.preserveRawText ?? false,
		};
	}

	/**
	 * Parse XML string into queryable structure
	 */
	parse(xmlString: string): XmlQuery {
		const cleanXml = xmlString
			.replace(/<\?xml[^?]*\?>/gi, "")
			.replace(/<!DOCTYPE[^>]*>/gi, "")
			.trim();

		if (!cleanXml) {
			throw new Error("Empty XML string");
		}

		const root = this.parseElement(cleanXml, null, 0, "", 0);
		return new XmlQuery([root]);
	}

	/**
	 * Parse a single element
	 */
	private parseElement(
		xml: string,
		parent: QueryableElement | null,
		depth: number,
		parentPath: string,
		indexInParent: number
	): QueryableElement {
		let pos = 0;

		// Skip whitespace and comments
		while (pos < xml.length) {
			if (/\s/.test(xml[pos])) {
				pos++;
				continue;
			}
			if (xml.substring(pos, pos + 4) === "<!--") {
				const endComment = xml.indexOf("-->", pos);
				if (endComment !== -1) {
					pos = endComment + 3;
					continue;
				}
			}
			break;
		}

		if (xml[pos] !== "<") {
			throw new Error("Expected '<' at start of element");
		}
		pos++; // Skip '<'

		// Parse tag name
		let nameEnd = pos;
		while (nameEnd < xml.length && !/[\s/>]/.test(xml[nameEnd])) nameEnd++;
		const fullName = xml.substring(pos, nameEnd);
		pos = nameEnd;

		// Split namespace and name
		const [namespace, name] = fullName.includes(":")
			? [fullName.split(":")[0], fullName.split(":")[1]]
			: [undefined, fullName];

		const localName = name;
		const path = parentPath ? `${parentPath}/${name}` : name;

		const element: QueryableElement = {
			name,
			namespace,
			namespaceUri: undefined,
			localName,
			qualifiedName: fullName,
			attributes: {},
			xmlnsDeclarations: undefined,
			children: [],
			siblings: [],
			parent: parent || undefined,
			depth,
			path,
			indexInParent,
			indexAmongAllSiblings: 0,
			hasChildren: false,
			isLeaf: true,
			textNodes: undefined,
			comments: undefined,
		};

		// Parse attributes
		while (pos < xml.length) {
			// Skip whitespace
			while (pos < xml.length && /\s/.test(xml[pos])) pos++;

			if (xml[pos] === "/" || xml[pos] === ">") break;

			// Parse attribute name
			const attrNameStart = pos;
			while (pos < xml.length && xml[pos] !== "=" && !/\s/.test(xml[pos])) pos++;
			const attrName = xml.substring(attrNameStart, pos).trim();

			// Skip whitespace and =
			while (pos < xml.length && (xml[pos] === "=" || /\s/.test(xml[pos]))) pos++;

			// Parse attribute value
			const quote = xml[pos];
			if (quote === '"' || quote === "'") {
				pos++; // Skip opening quote
				const attrValueStart = pos;
				while (pos < xml.length && xml[pos] !== quote) pos++;
				const attrValue = this.decodeEntities(xml.substring(attrValueStart, pos));
				pos++; // Skip closing quote

				// Check if this is an xmlns declaration
				if (attrName === "xmlns") {
					// Default namespace: xmlns="uri"
					if (!element.xmlnsDeclarations) element.xmlnsDeclarations = {};
					element.xmlnsDeclarations.default = attrValue;
					if (!namespace) {
						// If element has no prefix, use this as its namespace URI
						// Empty string xmlns="" means explicitly no namespace
						element.namespaceUri = attrValue === "" ? undefined : attrValue;
					}
				} else if (attrName.startsWith("xmlns:")) {
					// Prefixed namespace: xmlns:prefix="uri"
					const prefix = attrName.substring(6);
					if (!element.xmlnsDeclarations) element.xmlnsDeclarations = {};
					element.xmlnsDeclarations[prefix] = attrValue;
					if (namespace === prefix) {
						// If this element uses this prefix, set its namespace URI
						element.namespaceUri = attrValue;
					}
				}

				element.attributes[attrName] = attrValue;
			}
		}

		// Resolve namespace URI from ancestors if not found in own declarations
		if (namespace && !element.namespaceUri) {
			element.namespaceUri = this.resolveNamespaceUri(namespace, element);
		} else if (!namespace && !element.namespaceUri) {
			// If element has no prefix, check for default namespace in scope
			const defaultNs = this.resolveDefaultNamespace(element);
			if (defaultNs) {
				element.namespaceUri = defaultNs;
			}
		}

		// Check for self-closing tag
		if (xml[pos] === "/" && xml[pos + 1] === ">") {
			return element;
		}

		if (xml[pos] === ">") {
			pos++; // Skip '>'
		}

		// Parse content
		const contentStart = pos;
		const closeTagPos = this.findClosingTag(xml, contentStart, fullName);

		if (closeTagPos === -1) {
			throw new Error(`Missing closing tag for <${fullName}>`);
		}
		const content = xml.substring(contentStart, closeTagPos);
		const trimmedContent = content.trim();

		// Parse content (text or child elements)
		if (trimmedContent) {
			// Check if content contains any child elements, comments, or CDATA
			// Must match < followed by a letter (elements), ! (comments/CDATA), or ? (processing instructions)
			const hasChildElements = /<[a-zA-Z]/.test(content);
			const hasCommentsOrCDATA = /<!--/.test(content) || /<!\[CDATA\[/.test(content);

			if (hasChildElements || hasCommentsOrCDATA) {
				// Has child elements - parse as mixed content
				this.parseMixedContent(content, element, depth + 1, path);
				element.hasChildren = element.children.length > 0;
				element.isLeaf = element.children.length === 0;
			} else {
				// Text content only (no elements, possibly with comments or CDATA)
				const rawText = content;
				const text = this.options.trimValues ? trimmedContent : content;

				element.text = this.decodeEntities(text);
				if (this.options.preserveRawText) {
					element.rawText = this.decodeEntities(rawText);
				}

				// Try to parse as number
				if (this.options.parseNumbers && /^-?\d+(\.\d+)?$/.test(element.text)) {
					element.numericValue = Number(element.text);
				}

				// Try to parse as boolean
				if (this.options.parseBooleans) {
					const lowerText = element.text.toLowerCase();
					if (lowerText === "true" || lowerText === "false") {
						element.booleanValue = lowerText === "true";
					}
				}
			}
		}

		// Set indexAmongAllSiblings after all children are parsed
		if (parent) {
			element.indexAmongAllSiblings = parent.children.length;
		}

		return element;
	}

	/**
	 * Find the position of the closing tag
	 */
	private findClosingTag(xml: string, startPos: number, tagName: string): number {
		const closeTag = `</${tagName}>`;
		let pos = startPos;
		let nestLevel = 0;

		while (pos < xml.length) {
			// Check for opening tag with same name
			if (xml[pos] === "<" && xml[pos + 1] !== "/") {
				const tagEnd = pos + 1;
				let tagNameEnd = tagEnd;
				while (tagNameEnd < xml.length && !/[\s/>]/.test(xml[tagNameEnd])) tagNameEnd++;
				const foundTag = xml.substring(tagEnd, tagNameEnd);

				if (foundTag === tagName) {
					const nextChar = xml[tagNameEnd];
					if (nextChar === " " || nextChar === ">" || nextChar === "/") {
						nestLevel++;
					}
				}
			}

			// Check for closing tag
			if (xml.substring(pos, pos + closeTag.length) === closeTag) {
				if (nestLevel === 0) {
					return pos;
				}
				nestLevel--;
			}

			pos++;
		}

		return -1;
	}

	/**
	 * Parse multiple child elements
	 */
	/**
	 * Parse mixed content (elements, text nodes, and comments)
	 */
	private parseMixedContent(xml: string, parent: QueryableElement, depth: number, parentPath: string): void {
		let pos = 0;
		const childIndexMap = new Map<string, number>();
		const textNodes: string[] = [];
		const comments: string[] = [];
		let currentTextBuffer = "";

		while (pos < xml.length) {
			// Check for comments
			if (xml.substring(pos, pos + 4) === "<!--") {
				// Save any accumulated text (don't trim yet)
				if (currentTextBuffer) {
					const text = this.decodeEntities(currentTextBuffer);
					if (text.trim()) {
						// Only push if not purely whitespace
						textNodes.push(text);
					}
					currentTextBuffer = "";
				}

				const endComment = xml.indexOf("-->", pos);
				if (endComment !== -1) {
					const commentContent = xml.substring(pos + 4, endComment);
					comments.push(commentContent);
					pos = endComment + 3;
					continue;
				}
			}

			// Check for CDATA
			if (xml.substring(pos, pos + 9) === "<![CDATA[") {
				// Save any accumulated text (don't trim yet)
				if (currentTextBuffer) {
					const text = this.decodeEntities(currentTextBuffer);
					if (text.trim()) {
						// Only push if not purely whitespace
						textNodes.push(text);
					}
					currentTextBuffer = "";
				}

				const endCdata = xml.indexOf("]]>", pos);
				if (endCdata !== -1) {
					const cdataContent = xml.substring(pos + 9, endCdata);
					textNodes.push(cdataContent);
					if (!parent.text) {
						parent.text = cdataContent;
						parent.rawText = cdataContent;
					}
					pos = endCdata + 3;
					continue;
				}
			}

			// Check for element start
			if (xml[pos] === "<" && xml[pos + 1] !== "/") {
				// Save any accumulated text (don't trim yet)
				if (currentTextBuffer) {
					const text = this.decodeEntities(currentTextBuffer);
					if (text.trim()) {
						// Only push if not purely whitespace
						textNodes.push(text);
					}
					currentTextBuffer = "";
				}

				// Get tag name for this element
				let tagNameEnd = pos + 1;
				while (tagNameEnd < xml.length && !/[\s/>]/.test(xml[tagNameEnd])) tagNameEnd++;
				const tagName = xml.substring(pos + 1, tagNameEnd);

				// Track index for this tag name
				const currentIndex = childIndexMap.get(tagName) || 0;
				childIndexMap.set(tagName, currentIndex + 1);

				// Check for self-closing tag
				const nextClosePos = xml.indexOf(">", pos);
				if (nextClosePos !== -1 && xml[nextClosePos - 1] === "/") {
					const elementXml = xml.substring(pos, nextClosePos + 1);
					const childElement = this.parseElement(elementXml, parent, depth, parentPath, currentIndex);
					parent.children.push(childElement);
					pos = nextClosePos + 1;
					continue;
				}

				// Find matching closing tag
				const elementEnd = this.findClosingTag(xml, pos + 1, tagName);
				if (elementEnd === -1) {
					throw new Error(`Missing closing tag for <${tagName}>`);
				}

				const closeTagLength = `</${tagName}>`.length;
				const elementXml = xml.substring(pos, elementEnd + closeTagLength);
				const childElement = this.parseElement(elementXml, parent, depth, parentPath, currentIndex);
				parent.children.push(childElement);

				pos = elementEnd + closeTagLength;
				continue;
			}

			// Accumulate text content
			if (xml[pos] !== "<") {
				currentTextBuffer += xml[pos];
			}

			pos++;
		}

		// Save any remaining text
		if (currentTextBuffer) {
			const text = this.decodeEntities(currentTextBuffer);
			if (text.trim()) {
				// Only push if not purely whitespace
				textNodes.push(text);
			}
		}

		// Set text nodes and comments if found
		// Set textNodes if there are child elements OR if there are comments/CDATA (true mixed content)
		const hasMixedContent = parent.children.length > 0 || comments.length > 0 || textNodes.length > 1;
		if (hasMixedContent && textNodes.length > 0) {
			parent.textNodes = textNodes;
			// Set primary text to concatenated text nodes if not already set
			if (!parent.text) {
				const allText = textNodes.join("");
				parent.text = this.options.trimValues ? allText.trim() : allText;
			}
		}
		if (comments.length > 0) {
			parent.comments = comments;
		}

		// Set siblings for all children and update indexAmongAllSiblings
		for (let i = 0; i < parent.children.length; i++) {
			// Siblings should exclude the element itself
			parent.children[i].siblings = parent.children.filter((_, index) => index !== i);
			parent.children[i].indexAmongAllSiblings = i;
		}
	}

	/**
	 * Resolve namespace URI by walking up the tree
	 */
	private resolveNamespaceUri(prefix: string, element: QueryableElement): string | undefined {
		let current: QueryableElement | undefined = element;

		while (current) {
			if (current.xmlnsDeclarations?.[prefix]) {
				return current.xmlnsDeclarations[prefix];
			}
			current = current.parent;
		}

		return undefined;
	}

	/**
	 * Resolve default namespace (xmlns="...") by walking up the tree
	 */
	private resolveDefaultNamespace(element: QueryableElement): string | undefined {
		let current: QueryableElement | undefined = element;

		while (current) {
			// Check for default namespace declaration (xmlns="..." maps to "default" key)
			if (current.xmlnsDeclarations?.default) {
				const nsUri = current.xmlnsDeclarations.default;
				// Empty string xmlns="" means explicitly no namespace
				return nsUri === "" ? undefined : nsUri;
			}
			current = current.parent;
		}

		return undefined;
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
			.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
			.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
	}
}
