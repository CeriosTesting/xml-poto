import { DynamicElement } from "./dynamic-element";
import { XmlQuery } from "./xml-query";

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
		parent: DynamicElement | null,
		depth: number,
		parentPath: string,
		indexInParent: number,
	): DynamicElement {
		let pos = 0;

		// Skip whitespace and comments
		pos = this.skipInitialWhitespaceAndComments(xml, pos);

		if (xml[pos] !== "<") {
			throw new Error("Expected '<' at start of element");
		}
		pos++; // Skip '<'

		// Parse tag name
		const { name, pos: posAfterName } = this.parseTagName(xml, pos);
		pos = posAfterName;

		const path = parentPath ? `${parentPath}/${name}` : name;

		const element = new DynamicElement({
			name,
			namespaceUri: undefined,
			attributes: {},
			xmlnsDeclarations: undefined,
			children: [],
			siblings: [],
			parent: parent ?? undefined,
			depth,
			path,
			indexInParent,
			indexAmongAllSiblings: 0,
			hasChildren: false,
			isLeaf: true,
			textNodes: undefined,
			comments: undefined,
		});

		// Parse attributes
		pos = this.parseAttributes(xml, pos, element);

		// Resolve namespace URI from ancestors if not found in own declarations
		this.resolveElementNamespace(element);

		// Check for self-closing tag
		if (xml[pos] === "/" && xml[pos + 1] === ">") {
			return element;
		}

		if (xml[pos] === ">") {
			pos++; // Skip '>'
		}

		// Parse content
		const contentStart = pos;
		const closeTagPos = this.findClosingTag(xml, contentStart, name);

		if (closeTagPos === -1) {
			throw new Error(`Missing closing tag for <${name}>`);
		}
		const content = xml.substring(contentStart, closeTagPos);
		const trimmedContent = content.trim();

		// Parse content (text or child elements)
		if (trimmedContent) {
			this.parseElementContent(content, trimmedContent, element, depth, path);
		}

		// Set indexAmongAllSiblings after all children are parsed
		if (parent) {
			element.indexAmongAllSiblings = parent.children.length;
		}

		return element;
	}

	/**
	 * Skip initial whitespace and comments
	 */
	private skipInitialWhitespaceAndComments(xml: string, pos: number): number {
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
		return pos;
	}

	/**
	 * Parse tag name from XML
	 */
	private parseTagName(xml: string, pos: number): { name: string; pos: number } {
		let nameEnd = pos;
		while (nameEnd < xml.length && !/[\s/>]/.test(xml[nameEnd])) nameEnd++;
		const name = xml.substring(pos, nameEnd);
		return { name, pos: nameEnd };
	}

	/**
	 * Parse attributes from XML element
	 */
	private parseAttributes(xml: string, pos: number, element: DynamicElement): number {
		while (pos < xml.length) {
			// Skip whitespace
			while (pos < xml.length && /\s/.test(xml[pos])) pos++;

			if (xml[pos] === "/" || xml[pos] === ">") break;

			const result = this.parseAttribute(xml, pos, element);
			pos = result.pos;
		}
		return pos;
	}

	/**
	 * Parse a single attribute
	 */
	private parseAttribute(xml: string, pos: number, element: DynamicElement): { pos: number } {
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

			this.processNamespaceAttribute(attrName, attrValue, element);
			element.attributes[attrName] = attrValue;
		}
		return { pos };
	}

	/**
	 * Process namespace attribute (xmlns declarations)
	 */
	private processNamespaceAttribute(attrName: string, attrValue: string, element: DynamicElement): void {
		if (attrName === "xmlns") {
			// Default namespace: xmlns="uri"
			element.xmlnsDeclarations ??= {};
			element.xmlnsDeclarations.default = attrValue;
			if (!element.prefix) {
				// If element has no prefix, use this as its namespace URI
				// Empty string xmlns="" means explicitly no namespace
				element.namespaceUri = attrValue === "" ? undefined : attrValue;
			}
		} else if (attrName.startsWith("xmlns:")) {
			// Prefixed namespace: xmlns:prefix="uri"
			const prefix = attrName.substring(6);
			element.xmlnsDeclarations ??= {};
			element.xmlnsDeclarations[prefix] = attrValue;
			if (element.prefix === prefix) {
				// If this element uses this prefix, set its namespace URI
				element.namespaceUri = attrValue;
			}
		}
	}

	/**
	 * Resolve namespace URI for element
	 */
	private resolveElementNamespace(element: DynamicElement): void {
		if (element.prefix && !element.namespaceUri) {
			element.namespaceUri = this.resolveNamespaceUri(element.prefix, element);
		} else if (!element.prefix && !element.namespaceUri) {
			// If element has no prefix, check for default namespace in scope
			const defaultNs = this.resolveDefaultNamespace(element);
			if (defaultNs) {
				element.namespaceUri = defaultNs;
			}
		}
	}

	/**
	 * Parse element content (text or child elements)
	 */
	private parseElementContent(
		content: string,
		trimmedContent: string,
		element: DynamicElement,
		depth: number,
		path: string,
	): void {
		const hasChildElements = /<[a-zA-Z]/.test(content);
		const hasCommentsOrCDATA = /<!--/.test(content) || /<!\[CDATA\[/.test(content);

		if (hasChildElements || hasCommentsOrCDATA) {
			// Has child elements - parse as mixed content
			this.parseMixedContent(content, element, depth + 1, path);
			element.hasChildren = element.children.length > 0;
			element.isLeaf = element.children.length === 0;
		} else {
			this.parseTextContent(content, trimmedContent, element);
		}
	}

	/**
	 * Parse text content for element
	 */
	private parseTextContent(content: string, trimmedContent: string, element: DynamicElement): void {
		const rawText = content;
		const text = this.options.trimValues ? trimmedContent : content;

		element.text = this.decodeEntities(text);
		if (this.options.preserveRawText) {
			element.rawText = this.decodeEntities(rawText);
		}

		this.parseNumericValue(element);
		this.parseBooleanValue(element);
	}

	/**
	 * Try to parse element text as numeric value
	 */
	private parseNumericValue(element: DynamicElement): void {
		if (!element.text) return;
		// Don't parse values with leading zeros (except plain "0" or decimals like "0.5")
		// to preserve IDs and codes like "0001234567"
		if (this.options.parseNumbers && /^-?\d+(\.\d+)?$/.test(element.text) && !/^0\d+/.test(element.text)) {
			element.numericValue = Number(element.text);
		}
	}

	/**
	 * Try to parse element text as boolean value
	 */
	private parseBooleanValue(element: DynamicElement): void {
		if (!element.text || !this.options.parseBooleans) return;
		const lowerText = element.text.toLowerCase();
		if (lowerText === "true" || lowerText === "false") {
			element.booleanValue = lowerText === "true";
		}
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
	 * Parse mixed content (elements, text nodes, and comments)
	 */
	private parseMixedContent(xml: string, parent: DynamicElement, depth: number, parentPath: string): void {
		let pos = 0;
		const childIndexMap = new Map<string, number>();
		const textNodes: string[] = [];
		const comments: string[] = [];
		let currentTextBuffer = "";

		while (pos < xml.length) {
			const result = this.processMixedContentNode(
				xml,
				pos,
				currentTextBuffer,
				textNodes,
				comments,
				parent,
				depth,
				parentPath,
				childIndexMap,
			);
			pos = result.pos;
			currentTextBuffer = result.currentTextBuffer;
		}

		// Save any remaining text
		if (currentTextBuffer) {
			const text = this.decodeEntities(currentTextBuffer);
			if (text.trim()) {
				textNodes.push(text);
			}
		}

		this.setMixedContentMetadata(parent, textNodes, comments);
		this.setSiblingsMetadata(parent);
	}

	/**
	 * Process a single node in mixed content
	 */
	private processMixedContentNode(
		xml: string,
		pos: number,
		currentTextBuffer: string,
		textNodes: string[],
		comments: string[],
		parent: DynamicElement,
		depth: number,
		parentPath: string,
		childIndexMap: Map<string, number>,
	): { pos: number; currentTextBuffer: string } {
		let buffer = currentTextBuffer;

		if (xml.substring(pos, pos + 4) === "<!--") {
			const result = this.handleComment(xml, pos, buffer, textNodes, comments);
			return { pos: result.pos, currentTextBuffer: "" };
		}

		if (xml.substring(pos, pos + 9) === "<![CDATA[") {
			const result = this.handleCDATA(xml, pos, buffer, textNodes, parent);
			return { pos: result.pos, currentTextBuffer: "" };
		}

		if (xml[pos] === "<" && xml[pos + 1] !== "/") {
			const result = this.handleElement(xml, pos, buffer, textNodes, parent, depth, parentPath, childIndexMap);
			return { pos: result.pos, currentTextBuffer: "" };
		}

		// Accumulate text content
		if (xml[pos] !== "<") {
			buffer += xml[pos];
		}

		return { pos: pos + 1, currentTextBuffer: buffer };
	}

	/**
	 * Handle comment in mixed content
	 */
	private handleComment(
		xml: string,
		pos: number,
		currentTextBuffer: string,
		textNodes: string[],
		comments: string[],
	): { pos: number } {
		if (currentTextBuffer) {
			const text = this.decodeEntities(currentTextBuffer);
			if (text.trim()) {
				textNodes.push(text);
			}
		}

		const endComment = xml.indexOf("-->", pos);
		if (endComment !== -1) {
			const commentContent = xml.substring(pos + 4, endComment);
			comments.push(commentContent);
			return { pos: endComment + 3 };
		}

		return { pos: pos + 1 };
	}

	/**
	 * Handle CDATA section in mixed content
	 */
	private handleCDATA(
		xml: string,
		pos: number,
		currentTextBuffer: string,
		textNodes: string[],
		parent: DynamicElement,
	): { pos: number } {
		if (currentTextBuffer) {
			const text = this.decodeEntities(currentTextBuffer);
			if (text.trim()) {
				textNodes.push(text);
			}
		}

		const endCdata = xml.indexOf("]]>", pos);
		if (endCdata !== -1) {
			const cdataContent = xml.substring(pos + 9, endCdata);
			textNodes.push(cdataContent);
			if (!parent.text) {
				parent.text = cdataContent;
				parent.rawText = cdataContent;
			}
			return { pos: endCdata + 3 };
		}

		return { pos: pos + 1 };
	}

	/**
	 * Handle element in mixed content
	 */
	private handleElement(
		xml: string,
		pos: number,
		currentTextBuffer: string,
		textNodes: string[],
		parent: DynamicElement,
		depth: number,
		parentPath: string,
		childIndexMap: Map<string, number>,
	): { pos: number } {
		if (currentTextBuffer) {
			const text = this.decodeEntities(currentTextBuffer);
			if (text.trim()) {
				textNodes.push(text);
			}
		}

		// Get tag name for this element
		let tagNameEnd = pos + 1;
		while (tagNameEnd < xml.length && !/[\s/>]/.test(xml[tagNameEnd])) tagNameEnd++;
		const tagName = xml.substring(pos + 1, tagNameEnd);

		// Track index for this tag name
		const currentIndex = childIndexMap.get(tagName) ?? 0;
		childIndexMap.set(tagName, currentIndex + 1);

		// Check for self-closing tag
		const nextClosePos = xml.indexOf(">", pos);
		if (nextClosePos !== -1 && xml[nextClosePos - 1] === "/") {
			const elementXml = xml.substring(pos, nextClosePos + 1);
			const childElement = this.parseElement(elementXml, parent, depth, parentPath, currentIndex);
			parent.children.push(childElement);
			return { pos: nextClosePos + 1 };
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

		return { pos: elementEnd + closeTagLength };
	}

	/**
	 * Set metadata for mixed content
	 */
	private setMixedContentMetadata(parent: DynamicElement, textNodes: string[], comments: string[]): void {
		const hasMixedContent = parent.children.length > 0 || comments.length > 0 || textNodes.length > 1;
		if (hasMixedContent && textNodes.length > 0) {
			parent.textNodes = textNodes;
			if (!parent.text) {
				const allText = textNodes.join("");
				parent.text = this.options.trimValues ? allText.trim() : allText;
			}
		}
		if (comments.length > 0) {
			parent.comments = comments;
		}
	}

	/**
	 * Set sibling relationships and index metadata
	 */
	private setSiblingsMetadata(parent: DynamicElement): void {
		for (let i = 0; i < parent.children.length; i++) {
			parent.children[i].siblings = parent.children.filter((_, index) => index !== i);
			parent.children[i].indexAmongAllSiblings = i;
		}
	}

	/**
	 * Resolve namespace URI by walking up the tree
	 */
	private resolveNamespaceUri(prefix: string, element: DynamicElement): string | undefined {
		let current: DynamicElement | undefined = element;

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
	private resolveDefaultNamespace(element: DynamicElement): string | undefined {
		let current: DynamicElement | undefined = element;

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
