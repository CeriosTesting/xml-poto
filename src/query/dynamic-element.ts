// Store reference to XmlQuery to avoid circular dependency issues
let XmlQueryClass: any = null;

export function setXmlQueryClass(cls: any): void {
	XmlQueryClass = cls;
}

/**
 * Dynamic XML element that can be queried, modified, and serialized.
 *
 * This is the recommended type to use with @XmlDynamic decorator for bi-directional XML manipulation.
 * Provides full access to element properties, children, attributes, and supports both
 * read and write operations.
 *
 * @example
 * ```typescript
 * @XmlRoot({ elementName: 'Document' })
 * class Document {
 *   @XmlDynamic()
 *   dynamic!: DynamicElement;
 * }
 *
 * const doc = serializer.fromXml(xml, Document);
 *
 * // Query
 * const title = doc.dynamic.children.find(c => c.name === 'Title');
 *
 * // Modify
 * doc.dynamic.createChild({ name: 'Author', text: 'John Doe' });
 *
 * // Serialize
 * const xml = doc.dynamic.toXml({ indent: '  ' });
 * ```
 */
export class DynamicElement {
	/** The element tag name, full qualified name (prefix:name) */
	name: string;
	/** Namespace prefix (if any) */
	readonly prefix?: string;
	/** Namespace URI (if any) */
	namespaceUri?: string;
	/** Element name without namespace prefix (same as name if no prefix) */
	readonly localName: string;
	/** Element text content */
	text?: string;
	/** Numeric value (auto-parsed if applicable) */
	numericValue?: number;
	/** Boolean value (auto-parsed if applicable) */
	booleanValue?: boolean;
	/** All attributes */
	attributes: Record<string, string>;
	/** Namespace declarations on this element (xmlns attributes) */
	xmlnsDeclarations?: Record<string, string>;
	/** Child elements */
	children: DynamicElement[];
	/** All sibling elements (including self) */
	siblings: DynamicElement[];
	/** Parent element reference */
	parent?: DynamicElement;
	/** Element depth in tree (0 = root) */
	depth: number;
	/** Path from root (e.g., "root/child/grandchild") */
	path: string;
	/** Index among siblings with same name */
	indexInParent: number;
	/** Index among all siblings */
	indexAmongAllSiblings: number;
	/** Whether element has any children */
	hasChildren: boolean;
	/** Whether element is a leaf node (no children) */
	isLeaf: boolean;
	/** Raw text including all whitespace */
	rawText?: string;
	/** All text nodes in mixed content (separate from element children) */
	textNodes?: string[];
	/** XML comments within this element */
	comments?: string[];

	constructor(data: {
		name: string;
		namespaceUri?: string;
		text?: string;
		numericValue?: number;
		booleanValue?: boolean;
		attributes?: Record<string, string>;
		xmlnsDeclarations?: Record<string, string>;
		children?: DynamicElement[];
		siblings?: DynamicElement[];
		parent?: DynamicElement;
		depth?: number;
		path?: string;
		indexInParent?: number;
		indexAmongAllSiblings?: number;
		hasChildren?: boolean;
		isLeaf?: boolean;
		rawText?: string;
		textNodes?: string[];
		comments?: string[];
	}) {
		this.name = data.name;
		this.prefix = data.name.split(":").length > 1 ? data.name.split(":")[0] : undefined;
		this.namespaceUri = data.namespaceUri;
		this.localName = data.name.split(":").length > 1 ? data.name.split(":")[1] : data.name;
		this.text = data.text;
		this.numericValue = data.numericValue;
		this.booleanValue = data.booleanValue;
		this.attributes = data.attributes || {};
		this.xmlnsDeclarations = data.xmlnsDeclarations;
		this.children = data.children || [];
		this.siblings = data.siblings || [];
		this.parent = data.parent;
		this.depth = data.depth ?? 0;
		this.path = data.path || data.name;
		this.indexInParent = data.indexInParent ?? 0;
		this.indexAmongAllSiblings = data.indexAmongAllSiblings ?? 0;
		this.hasChildren = data.hasChildren ?? false;
		this.isLeaf = data.isLeaf ?? true;
		this.rawText = data.rawText;
		this.textNodes = data.textNodes;
		this.comments = data.comments;
	}

	// =====================================================
	// MUTATION METHODS (BI-DIRECTIONAL SUPPORT)
	// =====================================================

	/**
	 * Add a child element to this element
	 * @param child The DynamicElement to add as a child
	 * @returns The added child element for chaining
	 */
	addChild(child: DynamicElement): DynamicElement {
		// Set parent reference
		child.parent = this;

		// Update depth and path
		child.depth = this.depth + 1;
		child.path = `${this.path}/${child.name}`;

		// Set index in parent
		child.indexInParent = this.children.length;

		// Add to children
		this.children.push(child);

		// Update flags
		this.hasChildren = true;
		this.isLeaf = false;

		// Recursively update all descendants
		this.updateDescendantPaths(child);

		return child;
	}

	/**
	 * Create and add a child element from data
	 * @param data Element data
	 * @returns The created child element
	 */
	createChild(data: {
		name: string;
		namespace?: string;
		namespaceUri?: string;
		text?: string;
		attributes?: Record<string, string>;
		children?: DynamicElement[];
	}): DynamicElement {
		// Parse numeric and boolean values from text
		let numericValue: number | undefined;
		let booleanValue: boolean | undefined;

		if (data.text !== undefined && data.text !== "") {
			const num = Number(data.text);
			if (!Number.isNaN(num) && data.text.trim() !== "" && !/^0\d+/.test(data.text)) {
				numericValue = num;
			}
			const lowerText = data.text.toLowerCase();
			if (lowerText === "true" || lowerText === "false") {
				booleanValue = lowerText === "true";
			}
		}

		// Build qualified name if namespace prefix is provided
		const qualifiedName = data.namespace ? `${data.namespace}:${data.name}` : data.name;

		const child = new DynamicElement({
			name: qualifiedName,
			namespaceUri: data.namespaceUri,
			text: data.text,
			numericValue,
			booleanValue,
			attributes: data.attributes || {},
			children: data.children || [],
		});

		return this.addChild(child);
	}

	/**
	 * Remove a child element
	 * @param child The child element to remove (can be reference or index)
	 * @returns true if removed, false if not found
	 */
	removeChild(child: DynamicElement | number): boolean {
		const index = typeof child === "number" ? child : this.children.indexOf(child);

		if (index < 0 || index >= this.children.length) {
			return false;
		}

		// Remove from children
		const removed = this.children.splice(index, 1)[0];

		// Clear parent reference
		if (removed) {
			removed.parent = undefined;
		}

		// Update indices for remaining children
		for (let i = index; i < this.children.length; i++) {
			this.children[i].indexInParent = i;
		}

		// Update flags
		this.hasChildren = this.children.length > 0;
		this.isLeaf = this.children.length === 0;

		return true;
	}

	/**
	 * Remove this element from its parent
	 * @returns true if removed, false if no parent
	 */
	remove(): boolean {
		if (!this.parent) {
			return false;
		}

		return this.parent.removeChild(this);
	}

	/**
	 * Update element properties
	 * @param updates Partial element data to update
	 */
	update(updates: { name?: string; namespaceUri?: string; text?: string; attributes?: Record<string, string> }): void {
		if (updates.name !== undefined) {
			this.name = updates.name;
			this.updatePaths();
		}

		if (updates.namespaceUri !== undefined) {
			this.namespaceUri = updates.namespaceUri;
		}

		if (updates.text !== undefined) {
			this.text = updates.text;
			// Auto-parse numeric and boolean values
			const num = Number(updates.text);
			if (!Number.isNaN(num) && updates.text.trim() !== "") {
				this.numericValue = num;
			}
			const lowerText = updates.text.toLowerCase();
			if (lowerText === "true" || lowerText === "false") {
				this.booleanValue = lowerText === "true";
			}
		}

		if (updates.attributes !== undefined) {
			this.attributes = { ...updates.attributes };
		}
	}

	/**
	 * Set an attribute value
	 * @param name Attribute name
	 * @param value Attribute value
	 */
	setAttribute(name: string, value: string): void {
		this.attributes[name] = value;
	}

	/**
	 * Remove an attribute
	 * @param name Attribute name
	 * @returns true if attribute was removed, false if not found
	 */
	removeAttribute(name: string): boolean {
		if (name in this.attributes) {
			delete this.attributes[name];
			return true;
		}
		return false;
	}

	/**
	 * Set text content
	 * @param text New text content
	 */
	setText(text: string): void {
		this.update({ text });
	}

	/**
	 * Set namespace declaration
	 * @param prefix Namespace prefix (empty string for default namespace)
	 * @param uri Namespace URI
	 */
	setNamespaceDeclaration(prefix: string, uri: string): void {
		if (!this.xmlnsDeclarations) {
			this.xmlnsDeclarations = {};
		}
		const key = prefix === "" ? "default" : prefix;
		this.xmlnsDeclarations[key] = uri;
	}

	/**
	 * Clear all children
	 */
	clearChildren(): void {
		for (const child of this.children) {
			child.parent = undefined;
		}
		this.children = [];
		this.hasChildren = false;
		this.isLeaf = true;
	}

	/**
	 * Replace a child element
	 * @param oldChild The child to replace
	 * @param newChild The new child element
	 * @returns true if replaced, false if old child not found
	 */
	replaceChild(oldChild: DynamicElement, newChild: DynamicElement): boolean {
		const index = this.children.indexOf(oldChild);
		if (index < 0) {
			return false;
		}

		// Clear old child's parent
		oldChild.parent = undefined;

		// Set new child's parent and properties
		newChild.parent = this;
		newChild.depth = this.depth + 1;
		newChild.path = `${this.path}/${newChild.name}`;
		newChild.indexInParent = index;

		// Replace in array
		this.children[index] = newChild;

		// Update descendant paths
		this.updateDescendantPaths(newChild);

		return true;
	}

	/**
	 * Serialize this element (and its children) to XML string
	 * @param options Serialization options
	 * @returns XML string representation
	 */
	toXml(options?: {
		/** Include XML declaration (default: false) */
		includeDeclaration?: boolean;
		/** Indentation string (default: no indentation) */
		indent?: string;
		/** Current indentation level (used internally) */
		indentLevel?: number;
		/** Include empty elements as self-closing (default: true) */
		selfClosing?: boolean;
	}): string {
		const opts = {
			includeDeclaration: options?.includeDeclaration ?? false,
			indent: options?.indent ?? "",
			indentLevel: options?.indentLevel ?? 0,
			selfClosing: options?.selfClosing ?? true,
		};

		let xml = "";

		// Add XML declaration if requested
		if (opts.includeDeclaration && opts.indentLevel === 0) {
			xml += '<?xml version="1.0" encoding="UTF-8"?>';
			if (opts.indent) xml += "\n";
		}

		// Add indentation
		const currentIndent = opts.indent.repeat(opts.indentLevel);
		xml += currentIndent;

		// Opening tag
		xml += `<${this.name}`;

		// Add xmlns declarations
		if (this.xmlnsDeclarations) {
			for (const [prefix, uri] of Object.entries(this.xmlnsDeclarations)) {
				if (prefix === "default") {
					xml += ` xmlns="${uri}"`;
				} else {
					xml += ` xmlns:${prefix}="${uri}"`;
				}
			}
		}

		// Add attributes
		for (const [name, value] of Object.entries(this.attributes)) {
			xml += ` ${name}="${this.escapeXml(value)}"`;
		}

		// Check if element is empty
		const isEmpty = !this.text && !this.hasChildren && (!this.textNodes || this.textNodes.length === 0);

		if (isEmpty && opts.selfClosing) {
			// Self-closing tag
			xml += "/>";
		} else {
			// Closing opening tag
			xml += ">";

			// Add text content
			if (this.text) {
				xml += this.escapeXml(this.text);
			}

			// Add text nodes (mixed content)
			if (this.textNodes && this.textNodes.length > 0) {
				xml += this.textNodes.map(t => this.escapeXml(t)).join("");
			}

			// Add children
			if (this.hasChildren) {
				if (opts.indent) xml += "\n";

				for (const child of this.children) {
					xml += child.toXml({
						indent: opts.indent,
						indentLevel: opts.indentLevel + 1,
						selfClosing: opts.selfClosing,
					});
					if (opts.indent) xml += "\n";
				}

				// Add indentation before closing tag
				if (opts.indent) {
					xml += currentIndent;
				}
			}

			// Closing tag
			xml += `</${this.name}>`;
		}

		return xml;
	}

	/**
	 * Clone this element (deep copy)
	 * Creates a complete copy of the element tree without circular references.
	 * The cloned element will have no parent or siblings references.
	 *
	 * @returns A new DynamicElement with the same data
	 */
	clone(): DynamicElement {
		const cloned = new DynamicElement({
			name: this.name,
			namespaceUri: this.namespaceUri,
			text: this.text,
			numericValue: this.numericValue,
			booleanValue: this.booleanValue,
			attributes: { ...this.attributes },
			xmlnsDeclarations: this.xmlnsDeclarations ? { ...this.xmlnsDeclarations } : undefined,
			children: [], // Will be populated below
			siblings: [], // Break circular reference - cloned element has no siblings context
			parent: undefined, // Break circular reference - cloned element has no parent
			depth: this.depth,
			path: this.path,
			indexInParent: this.indexInParent,
			indexAmongAllSiblings: this.indexAmongAllSiblings,
			hasChildren: this.hasChildren,
			isLeaf: this.isLeaf,
			rawText: this.rawText,
			textNodes: this.textNodes ? [...this.textNodes] : undefined,
			comments: this.comments ? [...this.comments] : undefined,
		});

		// Clone children and establish parent references in the cloned tree
		for (const child of this.children) {
			const clonedChild = child.clone();
			clonedChild.parent = cloned;
			cloned.children.push(clonedChild);
		}

		return cloned;
	}

	/**
	 * Get a query interface for this element (lazy initialization)
	 * Provides access to the full XmlQuery API for querying and manipulating
	 * this element and its descendants.
	 *
	 * @returns XmlQuery interface for querying this element and its descendants
	 *
	 * @example
	 * ```typescript
	 * const element = new DynamicElement({ name: 'root', ... });
	 *
	 * // Query operations
	 * const titles = element.query().find('title').texts();
	 * const prices = element.query().find('price').values();
	 *
	 * // Mutation operations
	 * element.query()
	 *   .find('product')
	 *   .whereAttribute('id', '123')
	 *   .setAttr('price', '99.99');
	 *
	 * // Chain operations
	 * const expensive = element.query()
	 *   .find('product')
	 *   .whereValueGreaterThan(100)
	 *   .sortByValue();
	 *
	 * // XPath queries
	 * const book = element.query().xpath("//book[@id='123']");
	 * ```
	 */
	query(): import("./xml-query").XmlQuery {
		if (!XmlQueryClass) {
			throw new Error(
				"XmlQuery class not initialized. Make sure xml-query module is imported before using DynamicElement.query()"
			);
		}
		return new XmlQueryClass([this]);
	}

	// =====================================================
	// PRIVATE HELPER METHODS
	// =====================================================

	/**
	 * Update paths for this element and all descendants
	 */
	private updatePaths(): void {
		if (this.parent) {
			this.path = `${this.parent.path}/${this.name}`;
		} else {
			this.path = this.name;
		}

		// Update all children
		for (const child of this.children) {
			child.updatePaths();
		}
	}

	/**
	 * Update descendant paths after adding/moving an element
	 */
	private updateDescendantPaths(element: DynamicElement): void {
		for (const child of element.children) {
			child.depth = element.depth + 1;
			child.path = `${element.path}/${child.name}`;
			this.updateDescendantPaths(child);
		}
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}
}

/**
 * @deprecated Use DynamicElement instead. QueryableElement will be removed in a future version.
 * DynamicElement better reflects the bi-directional nature of the element.
 */
export class QueryableElement extends DynamicElement {}
