/* eslint-disable typescript/no-explicit-any -- Builder works with dynamic objects during XML serialization */
/**
 * Key holding an ordered run of differently named sibling elements.
 *
 * The intermediate representation is a keyed object, so it can only say "all the
 * notes, then all the tasks" — it cannot express `note task note`. A member that
 * must preserve the order of differently named siblings (`@XmlArray({ items })`)
 * writes them here instead, as an array of single-key objects, and the builder
 * splices them into the parent element in that order.
 */
export const ORDERED_SEQUENCE_KEY = "#sequence";

/**
 * Properties to skip when serializing DynamicElement instances
 */
const DYNAMIC_ELEMENT_INTERNAL_PROPS = new Set([
	"parent",
	"siblings",
	"depth",
	"path",
	"indexInParent",
	"indexAmongAllSiblings",
	"hasChildren",
	"isLeaf",
	"rawText",
	"textNodes",
	"comments",
]);

/**
 * Properties to always skip during attribute extraction
 */
const SKIP_ATTRIBUTE_PROPS = new Set([
	"parent",
	"siblings",
	"children",
	"depth",
	"path",
	"indexInParent",
	"indexAmongAllSiblings",
	"hasChildren",
	"isLeaf",
	"rawText",
	"textNodes",
	"comments",
]);

/**
 * Fast XML builder for converting JavaScript objects to XML strings.
 *
 * Provides low-level XML generation with support for attributes, text content, CDATA sections,
 * formatting, and empty element syntax control. Used internally by {@link XmlDecoratorSerializer}
 * but can be used directly for custom XML generation.
 */
export class XmlBuilder {
	private options: {
		format: boolean;
		indentBy: string;
		attributeNamePrefix: string;
		textNodeName: string;
		cdataPropName: string;
		emptyElementStyle: "self-closing" | "explicit";
	};

	/**
	 * Creates a new XML builder with specified generation options.
	 *
	 * @param options Builder configuration options
	 * @param options.format - Whether to format output with indentation (default: false)
	 * @param options.indentBy - Indentation string per level (default: '  ')
	 * @param options.attributeNamePrefix - Prefix for attribute keys in object (default: '@_')
	 * @param options.textNodeName - Property name for text content (default: '#text')
	 * @param options.cdataPropName - Property name for CDATA sections (default: '__cdata')
	 * @param options.emptyElementStyle - How to render empty elements: 'self-closing' or 'explicit' (default: 'self-closing')
	 *
	 * @example
	 * // Basic builder
	 * const builder = new XmlBuilder();
	 * const xml = builder.build({ Person: { name: 'John', age: 30 } });
	 * // Output: <Person><name>John</name><age>30</age></Person>
	 *
	 * @example
	 * // Formatted output
	 * const builder = new XmlBuilder({ format: true, indentBy: '  ' });
	 * const xml = builder.build({ Person: { name: 'John', age: 30 } });
	 * // Output:
	 * // <Person>
	 * //   <name>John</name>
	 * //   <age>30</age>
	 * // </Person>
	 *
	 * @example
	 * // Empty element syntax control
	 * const selfClosing = new XmlBuilder({ emptyElementStyle: 'self-closing' });
	 * selfClosing.build({ Config: { enabled: '' } }); // <Config><enabled/></Config>
	 *
	 * const explicit = new XmlBuilder({ emptyElementStyle: 'explicit' });
	 * explicit.build({ Config: { enabled: '' } }); // <Config><enabled></enabled></Config>
	 */
	constructor(options: any = {}) {
		this.options = {
			format: options.format ?? false,
			indentBy: options.indentBy ?? "  ",
			attributeNamePrefix: options.attributeNamePrefix ?? "@_",
			textNodeName: options.textNodeName ?? "#text",
			cdataPropName: options.cdataPropName ?? "__cdata",
			emptyElementStyle: options.emptyElementStyle ?? "self-closing",
		};
	}

	/**
	 * Builds an XML string from a JavaScript object representation.
	 *
	 * Converts object properties to XML elements, prefixed properties to attributes,
	 * and special properties to text content or CDATA sections. Handles arrays,
	 * nested objects, and empty elements.
	 *
	 * @param obj The object to convert to XML
	 * @returns An XML string representation of the object
	 *
	 * @example
	 * // Simple object
	 * const builder = new XmlBuilder();
	 * const xml = builder.build({ Person: { name: 'John', age: 30 } });
	 * // Output: <Person><name>John</name><age>30</age></Person>
	 *
	 * @example
	 * // With attributes (using @_ prefix)
	 * const xml = builder.build({
	 *   Person: {
	 *     '@_id': '123',
	 *     '@_active': 'true',
	 *     name: 'John'
	 *   }
	 * });
	 * // Output: <Person id="123" active="true"><name>John</name></Person>
	 *
	 * @example
	 * // With CDATA
	 * const xml = builder.build({
	 *   Code: {
	 *     __cdata: 'if (x < 5) {}'
	 *   }
	 * });
	 * // Output: <Code><![CDATA[if (x < 5) {}]]></Code>
	 *
	 * @example
	 * // Arrays
	 * const xml = builder.build({
	 *   People: {
	 *     Person: [
	 *       { name: 'John' },
	 *       { name: 'Jane' }
	 *     ]
	 *   }
	 * });
	 * // Output: <People><Person><name>John</name></Person><Person><name>Jane</name></Person></People>
	 */
	build(obj: any): string {
		return this.buildElement(obj, 0);
	}

	/**
	 * Determine whether a key should be skipped during element building.
	 */
	private shouldSkipKey(key: string, isDynamic: boolean): boolean {
		if (
			key.startsWith(this.options.attributeNamePrefix) ||
			key === this.options.textNodeName ||
			key === "?" ||
			key.startsWith("?_")
		) {
			return true;
		}
		return isDynamic && DYNAMIC_ELEMENT_INTERNAL_PROPS.has(key);
	}

	/**
	 * Build XML element
	 */
	private buildElement(obj: any, depth: number): string {
		if (typeof obj !== "object" || obj === null) {
			return this.escapeXml(String(obj));
		}

		const indent = this.options.format ? this.options.indentBy.repeat(depth) : "";
		const newline = this.options.format ? "\n" : "";

		let xml = "";

		// Check if this object is a DynamicElement to determine which properties to skip
		const isDynamic = this.isDynamicElement(obj);

		for (const [key, value] of Object.entries(obj)) {
			if (this.shouldSkipKey(key, isDynamic)) {
				continue;
			}

			// Check if there's a comment for this element
			const commentKey = `?_${key}`;
			if (commentKey in obj) {
				const commentContent = obj[commentKey];
				xml += `${indent}<!--${this.escapeComment(String(commentContent))}-->${newline}`;
			}

			// Handle DynamicElement: serialize its children inline
			if (this.isDynamicElement(value)) {
				// Serialize the DynamicElement's children as siblings
				xml += this.serializeDynamicElement(value, depth, indent, newline);
				continue;
			}

			// An ordered run of differently named siblings, spliced in at this level
			// rather than nested under a key of its own.
			if (key === ORDERED_SEQUENCE_KEY && Array.isArray(value)) {
				xml += this.buildOrderedSequence(value, depth, indent, newline);
				continue;
			}

			if (Array.isArray(value)) {
				// Handle arrays
				for (const item of value) {
					xml += this.buildSingleElement(key, item, depth, indent, newline);
				}
			} else {
				xml += this.buildSingleElement(key, value, depth, indent, newline);
			}
		}

		return xml;
	}

	/**
	 * Render an ordered run of siblings — differently named elements, and the text
	 * runs of a mixed complex type — at the current level.
	 */
	private buildOrderedSequence(entries: any[], depth: number, indent: string, newline: string): string {
		let xml = "";

		for (const entry of entries) {
			if (typeof entry !== "object" || entry === null) continue;
			for (const [entryKey, entryValue] of Object.entries(entry)) {
				// A text run is character data at this level, not an element of its own.
				if (entryKey === this.options.textNodeName) {
					xml += this.escapeXml(String(entryValue));
					continue;
				}
				xml += this.buildSingleElement(entryKey, entryValue, depth, indent, newline);
			}
		}

		return xml;
	}

	/**
	 * Build single XML element
	 */
	private buildSingleElement(tagName: string, value: any, depth: number, indent: string, newline: string): string {
		// Extract attributes
		const attributes = this.extractAttributes(value);
		const attrString = this.buildAttributes(attributes);

		// Check for comment (special property "?") - add it as first child, not exclusive
		let commentXml = "";
		if (typeof value === "object" && value !== null && "?" in value) {
			const commentContent = this.escapeComment(String(value["?"]));
			commentXml = `${newline}${indent}${this.options.indentBy}<!--${commentContent}-->`;
		}

		// Check for CDATA
		if (typeof value === "object" && value !== null && this.options.cdataPropName in value) {
			const cdataContent = this.escapeCdata(String(value[this.options.cdataPropName]));
			return `${indent}<${tagName}${attrString}><![CDATA[${cdataContent}]]></${tagName}>${newline}`;
		}

		// Check for empty element first (before text content extraction)
		if (value === "" || value === null || value === undefined) {
			if (this.options.emptyElementStyle === "explicit") {
				return `${indent}<${tagName}${attrString}></${tagName}>${newline}`;
			}
			return `${indent}<${tagName}${attrString}/>${newline}`;
		}

		// Check for text content
		const textContent = this.extractTextContent(value);

		if (textContent !== null) {
			const escapedText = this.escapeXml(textContent);
			return `${indent}<${tagName}${attrString}>${escapedText}</${tagName}>${newline}`;
		}

		// Handle child elements
		const childXml = this.buildElement(value, depth + 1);
		if (childXml || commentXml) {
			return `${indent}<${tagName}${attrString}>${commentXml}${newline}${childXml}${indent}</${tagName}>${newline}`;
		}

		if (this.options.emptyElementStyle === "explicit") {
			return `${indent}<${tagName}${attrString}></${tagName}>${newline}`;
		}
		return `${indent}<${tagName}${attrString}/>${newline}`;
	}

	/**
	 * Extract attributes from object
	 */
	private extractAttributes(obj: any): Record<string, string> {
		if (typeof obj !== "object" || obj === null) {
			return {};
		}

		const attributes: Record<string, string> = {};
		const prefix = this.options.attributeNamePrefix;

		for (const [key, value] of Object.entries(obj)) {
			// Skip special properties and DynamicElement internal properties
			if (
				key === this.options.textNodeName ||
				key === this.options.cdataPropName ||
				key === "?" ||
				SKIP_ATTRIBUTE_PROPS.has(key)
			) {
				continue;
			}

			if (key.startsWith(prefix)) {
				const attrName = key.substring(prefix.length);
				attributes[attrName] = String(value);
			}
		}

		return attributes;
	}

	/**
	 * Extract text content from object
	 */
	private extractTextContent(obj: any): string | null {
		if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
			return String(obj);
		}

		if (typeof obj === "object" && obj !== null && this.options.textNodeName in obj) {
			return String(obj[this.options.textNodeName]);
		}

		return null;
	}

	/**
	 * Build attributes string
	 */
	private buildAttributes(attributes: Record<string, string>): string {
		const attrs = Object.entries(attributes)
			.map(([key, value]) => `${key}="${this.escapeAttributeValue(value)}"`)
			.join(" ");

		return attrs ? ` ${attrs}` : "";
	}

	/**
	 * Check if value is a DynamicElement instance
	 * DynamicElement has specific properties: name, children, etc.
	 */
	private isDynamicElement(value: any): boolean {
		if (typeof value !== "object" || value === null) {
			return false;
		}

		// Check for characteristic DynamicElement properties
		// These properties together uniquely identify a DynamicElement
		return (
			"name" in value &&
			"localName" in value &&
			"children" in value &&
			"attributes" in value &&
			typeof value.name === "string" &&
			Array.isArray(value.children)
		);
	}

	/**
	 * Serialize a DynamicElement's children inline
	 * This allows DynamicElement content to be part of the parent structure
	 */
	private serializeDynamicElement(element: any, depth: number, indent: string, newline: string): string {
		let xml = "";

		// Serialize each child of the DynamicElement
		if (Array.isArray(element.children)) {
			for (const child of element.children) {
				xml += this.serializeDynamicChild(child, depth, indent, newline);
			}
		}

		return xml;
	}

	/**
	 * Serialize a single DynamicElement child
	 */
	private serializeDynamicChild(child: any, depth: number, indent: string, newline: string): string {
		// Build the tag name (with namespace if present)
		const tagName = child.name;
		const attrString = this.buildAttributes(this.dynamicChildAttributes(child));

		// Text interleaved with child elements — mixed content. `DynamicElement.toXml`
		// writes these; this path used to drop them whenever the element also had
		// children, so the same tree serialized differently depending on whether it
		// went through the decorator pipeline.
		const textNodes: string[] = Array.isArray(child.textNodes) ? child.textNodes : [];
		const hasChildren = Array.isArray(child.children) && child.children.length > 0;
		const hasText = Boolean(child.text) || textNodes.length > 0;

		// Check if element has text content
		if (child.text && !hasChildren) {
			const escapedText = this.escapeXml(String(child.text));
			return `${indent}<${tagName}${attrString}>${escapedText}</${tagName}>${newline}`;
		}

		// Check if element is empty
		if (!hasText && !hasChildren) {
			if (this.options.emptyElementStyle === "explicit") {
				return `${indent}<${tagName}${attrString}></${tagName}>${newline}`;
			}
			return `${indent}<${tagName}${attrString}/>${newline}`;
		}

		const leadingText = this.serializeDynamicText(child, textNodes);

		// Has children - recursively serialize them
		let childXml = "";
		if (Array.isArray(child.children)) {
			for (const grandchild of child.children) {
				childXml += this.serializeDynamicChild(
					grandchild,
					depth + 1,
					this.options.format ? this.options.indentBy.repeat(depth + 1) : "",
					newline,
				);
			}
		}

		if (!hasChildren) {
			return `${indent}<${tagName}${attrString}>${leadingText}</${tagName}>${newline}`;
		}

		return `${indent}<${tagName}${attrString}>${leadingText}${newline}${childXml}${indent}</${tagName}>${newline}`;
	}

	/** A DynamicElement child's attributes, stringified for emission. */
	private dynamicChildAttributes(child: any): Record<string, string> {
		const attributes: Record<string, string> = {};
		if (child.attributes && typeof child.attributes === "object") {
			for (const [key, value] of Object.entries(child.attributes)) {
				attributes[key] = String(value);
			}
		}
		return attributes;
	}

	/**
	 * The text a DynamicElement carries alongside its children, matching what
	 * `DynamicElement.toXml` emits: its own `text`, then its mixed-content runs.
	 */
	private serializeDynamicText(child: any, textNodes: string[]): string {
		let text = "";
		if (child.text) {
			text += this.escapeXml(String(child.text));
		}
		for (const node of textNodes) {
			text += this.escapeXml(String(node));
		}
		return text;
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(text: string): string {
		return String(text)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	/**
	 * Escape a value for use inside an attribute.
	 *
	 * Beyond the usual markup characters, literal tabs and line breaks must be
	 * written as character references: attribute-value normalization replaces them
	 * with spaces in every conforming reader, so a multi-line attribute value would
	 * otherwise come back collapsed. Text content is unaffected — line breaks are
	 * significant there and must stay literal.
	 */
	private escapeAttributeValue(text: string): string {
		return this.escapeXml(text).replace(/\t/g, "&#9;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
	}

	/**
	 * Make text safe to place inside a CDATA section.
	 *
	 * `]]>` terminates the section, so a value containing it would close the section
	 * early and produce a document no parser can read. The standard remedy is to
	 * split across two sections at the offending sequence.
	 */
	private escapeCdata(text: string): string {
		return String(text).replace(/]]>/g, "]]]]><![CDATA[>");
	}

	/**
	 * Make text safe to place inside a comment.
	 *
	 * XML forbids `--` anywhere in a comment and a `-` immediately before the
	 * closing delimiter, so both are padded rather than emitted verbatim.
	 */
	private escapeComment(text: string): string {
		const padded = String(text).replace(/--/g, "- -");
		return padded.endsWith("-") ? `${padded} ` : padded;
	}
}
