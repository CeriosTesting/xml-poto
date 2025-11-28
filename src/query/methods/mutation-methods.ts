import type { DynamicElement } from "../dynamic-element";
import type { XmlQuery } from "../xml-query";

/**
 * Mutation methods for XmlQuery
 * Handles bi-directional XML manipulation
 * @internal
 */
export class MutationMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	/**
	 * Set attribute on all matched elements
	 * @param name Attribute name
	 * @param value Attribute value (or function to compute value per element)
	 * @returns This query for chaining
	 */
	setAttr(name: string, value: string | ((el: DynamicElement) => string)): XmlQuery {
		for (const el of this.elements) {
			const val = typeof value === "function" ? value(el) : value;
			el.setAttribute(name, val);
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Remove attribute from all matched elements
	 * @param name Attribute name
	 * @returns This query for chaining
	 */
	removeAttr(name: string): XmlQuery {
		for (const el of this.elements) {
			el.removeAttribute(name);
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Set text content on all matched elements
	 * @param text Text content (or function to compute text per element)
	 * @returns This query for chaining
	 */
	setText(text: string | ((el: DynamicElement) => string)): XmlQuery {
		for (const el of this.elements) {
			const txt = typeof text === "function" ? text(el) : text;
			el.setText(txt);
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Update properties on all matched elements
	 * @param updates Update data (or function to compute updates per element)
	 * @returns This query for chaining
	 */
	updateElements(
		updates:
			| {
					name?: string;
					namespace?: string;
					namespaceUri?: string;
					text?: string;
					attributes?: Record<string, string>;
			  }
			| ((el: DynamicElement) => {
					name?: string;
					namespace?: string;
					namespaceUri?: string;
					text?: string;
					attributes?: Record<string, string>;
			  })
	): XmlQuery {
		for (const el of this.elements) {
			const upd = typeof updates === "function" ? updates(el) : updates;
			el.update(upd);
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Remove all matched elements from their parents
	 * @returns Count of elements removed
	 */
	removeElements(): number {
		let count = 0;
		for (const el of this.elements) {
			if (el.remove()) {
				count++;
			}
		}
		return count;
	}

	/**
	 * Add a child to all matched elements
	 * @param child Child element (or function to create child per element)
	 * @returns This query for chaining
	 */
	appendChild(child: DynamicElement | ((parent: DynamicElement) => DynamicElement)): XmlQuery {
		for (const el of this.elements) {
			const c = typeof child === "function" ? child(el) : child.clone();
			el.addChild(c);
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Clear children from all matched elements
	 * @returns This query for chaining
	 */
	clearChildren(): XmlQuery {
		for (const el of this.elements) {
			el.clearChildren();
		}
		return this.createQuery(this.elements);
	}

	/**
	 * Serialize all matched elements to XML strings
	 * @param options Serialization options
	 * @returns Array of XML strings
	 */
	toXmlStrings(options?: { includeDeclaration?: boolean; indent?: string; selfClosing?: boolean }): string[] {
		return this.elements.map(el => el.toXml(options));
	}

	/**
	 * Serialize first matched element to XML string
	 * @param options Serialization options
	 * @returns XML string or undefined if no elements
	 */
	toXml(options?: { includeDeclaration?: boolean; indent?: string; selfClosing?: boolean }): string | undefined {
		return this.elements[0]?.toXml(options);
	}
}
