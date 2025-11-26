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
			// Skip special properties
			if (key.startsWith(this.options.attributeNamePrefix) || key === this.options.textNodeName || key === "?") {
				continue;
			}

			// Skip DynamicElement internal properties only if this is actually a DynamicElement
			if (isDynamic && DYNAMIC_ELEMENT_INTERNAL_PROPS.has(key)) {
				continue;
			}

			// Handle DynamicElement: serialize its children inline
			if (this.isDynamicElement(value)) {
				// Serialize the DynamicElement's children as siblings
				xml += this.serializeDynamicElement(value, depth, indent, newline);
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
	 * Build single XML element
	 */
	private buildSingleElement(tagName: string, value: any, depth: number, indent: string, newline: string): string {
		// Extract attributes
		const attributes = this.extractAttributes(value);
		const attrString = this.buildAttributes(attributes);

		// Check for comment (special property "?") - add it as first child, not exclusive
		let commentXml = "";
		if (typeof value === "object" && value !== null && "?" in value) {
			const commentContent = value["?"];
			commentXml = `${newline}${indent}${this.options.indentBy}<!--${commentContent}-->`;
		}

		// Check for CDATA
		if (typeof value === "object" && value !== null && this.options.cdataPropName in value) {
			const cdataContent = value[this.options.cdataPropName];
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
			.map(([key, value]) => `${key}="${this.escapeXml(value)}"`)
			.join(" ");

		return attrs ? ` ${attrs}` : "";
	}

	/**
	 * Check if value is a DynamicElement instance
	 * DynamicElement has specific properties: name, qualifiedName, children, etc.
	 */
	private isDynamicElement(value: any): boolean {
		if (typeof value !== "object" || value === null) {
			return false;
		}

		// Check for characteristic DynamicElement properties
		// These properties together uniquely identify a DynamicElement
		return (
			"name" in value &&
			"qualifiedName" in value &&
			"localName" in value &&
			"children" in value &&
			"attributes" in value &&
			typeof value.name === "string" &&
			typeof value.qualifiedName === "string" &&
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
		const tagName = child.qualifiedName || child.name;

		// Build attributes string
		const attributes: Record<string, string> = {};
		if (child.attributes && typeof child.attributes === "object") {
			for (const [key, value] of Object.entries(child.attributes)) {
				attributes[key] = String(value);
			}
		}
		const attrString = this.buildAttributes(attributes);

		// Check if element has text content
		if (child.text && (!child.children || child.children.length === 0)) {
			const escapedText = this.escapeXml(String(child.text));
			return `${indent}<${tagName}${attrString}>${escapedText}</${tagName}>${newline}`;
		}

		// Check if element is empty
		if ((!child.text || child.text === "") && (!child.children || child.children.length === 0)) {
			if (this.options.emptyElementStyle === "explicit") {
				return `${indent}<${tagName}${attrString}></${tagName}>${newline}`;
			}
			return `${indent}<${tagName}${attrString}/>${newline}`;
		}

		// Has children - recursively serialize them
		let childXml = "";
		if (Array.isArray(child.children)) {
			for (const grandchild of child.children) {
				childXml += this.serializeDynamicChild(
					grandchild,
					depth + 1,
					this.options.format ? this.options.indentBy.repeat(depth + 1) : "",
					newline
				);
			}
		}

		return `${indent}<${tagName}${attrString}>${newline}${childXml}${indent}</${tagName}>${newline}`;
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
}
