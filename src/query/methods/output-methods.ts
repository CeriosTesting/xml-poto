/* eslint-disable typescript/no-explicit-any -- Output methods work with dynamic transformation results */
import type { DynamicElement } from "../dynamic-element";
import type { XmlQuery } from "../xml-query";

/**
 * Output methods for XmlQuery
 * Handles transformation, mapping, and output formatting
 * @internal
 */
export class OutputMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	// =====================================================
	// TRANSFORMATION AND MAPPING
	// =====================================================

	/**
	 * Map elements to values
	 */
	map<T>(fn: (element: DynamicElement, index: number) => T): T[] {
		return this.elements.map(fn);
	}

	/**
	 * Execute function for each element
	 */
	each(fn: (element: DynamicElement, index: number) => void): XmlQuery {
		this.elements.forEach(fn);
		return this.createQuery(this.elements);
	}

	/**
	 * Reduce elements to single value
	 */
	reduce<T>(fn: (acc: T, element: DynamicElement, index: number) => T, initial: T): T {
		return this.elements.reduce(fn, initial);
	}

	// =====================================================
	// UTILITY AND OUTPUT
	// =====================================================

	/**
	 * Convert to key-value map
	 */
	toMap(keySelector: (el: DynamicElement) => string, valueSelector?: (el: DynamicElement) => any): Record<string, any> {
		const map: Record<string, any> = {};
		for (const el of this.elements) {
			const key = keySelector(el);
			const value = valueSelector ? valueSelector(el) : (el.text ?? el.children);
			map[key] = value;
		}
		return map;
	}

	/**
	 * Convert elements to JSON structure
	 * @param options Configuration for JSON output
	 * @returns JSON-serializable object or array
	 */
	toJSON(options?: {
		/** Include attributes in output (default: true) */
		includeAttributes?: boolean;
		/** Include metadata like depth, path, etc (default: false) */
		includeMetadata?: boolean;
		/** Flatten single-element arrays (default: true) */
		flattenSingle?: boolean;
		/** Use text content directly for leaf nodes (default: true) */
		simplifyLeaves?: boolean;
	}): any {
		const opts = {
			includeAttributes: options?.includeAttributes ?? true,
			includeMetadata: options?.includeMetadata ?? false,
			flattenSingle: options?.flattenSingle ?? true,
			simplifyLeaves: options?.simplifyLeaves ?? true,
		};

		const convertElement = (el: DynamicElement): any => {
			return this.convertElementToJson(el, opts);
		};

		// Convert all elements
		if (this.elements.length === 0) {
			return null;
		}

		if (this.elements.length === 1 && opts.flattenSingle) {
			return convertElement(this.elements[0]);
		}

		return this.elements.map((el) => convertElement(el));
	}

	/**
	 * Convert a single element to JSON
	 */
	private convertElementToJson(el: DynamicElement, opts: {
		includeAttributes: boolean;
		includeMetadata: boolean;
		flattenSingle: boolean;
		simplifyLeaves: boolean;
	}): any {
		const result: any = {};

		this.addAttributesToJson(result, el, opts);
		this.addMetadataToJson(result, el, opts);

		// Handle leaf nodes
		if (el.isLeaf) {
			return this.handleLeafNodeJson(el, result, opts);
		}

		// Process non-leaf nodes
		this.addChildrenToJson(result, el, opts);
		this.addTextToJson(result, el);

		return result;
	}

	/**
	 * Add attributes to JSON representation
	 */
	private addAttributesToJson(result: any, el: DynamicElement, opts: { includeAttributes: boolean }): void {
		if (opts.includeAttributes && Object.keys(el.attributes).length > 0) {
			result["@attributes"] = { ...el.attributes };
		}
	}

	/**
	 * Add metadata to JSON representation
	 */
	private addMetadataToJson(result: any, el: DynamicElement, opts: { includeMetadata: boolean }): void {
		if (opts.includeMetadata) {
			result["@metadata"] = {
				name: el.name,
				namespace: el.prefix,
				depth: el.depth,
				path: el.path,
				indexInParent: el.indexInParent,
			};
		}
	}

	/**
	 * Handle JSON conversion for leaf nodes
	 */
	private handleLeafNodeJson(el: DynamicElement, result: any, opts: { simplifyLeaves: boolean; includeAttributes: boolean }): any {
		if (opts.simplifyLeaves) {
			// Return simple value for leaves
			if (el.numericValue !== undefined) return el.numericValue;
			if (el.booleanValue !== undefined) return el.booleanValue;
			if (el.text !== undefined) return el.text;
			return opts.includeAttributes && Object.keys(el.attributes).length > 0 ? result : null;
		}

		// Include text in result object
		if (el.text !== undefined) {
			result["#text"] = el.text;
		}
		if (el.numericValue !== undefined) {
			result["#value"] = el.numericValue;
		}
		if (el.booleanValue !== undefined) {
			result["#boolean"] = el.booleanValue;
		}
		return result;
	}

	/**
	 * Add children to JSON representation
	 */
	private addChildrenToJson(
		result: any,
		el: DynamicElement,
		opts: { includeAttributes: boolean; includeMetadata: boolean; flattenSingle: boolean; simplifyLeaves: boolean },
	): void {
		const childGroups = new Map<string, DynamicElement[]>();
		for (const child of el.children) {
			if (!childGroups.has(child.name)) {
				childGroups.set(child.name, []);
			}
			childGroups.get(child.name)?.push(child);
		}

		// Convert children
		for (const [name, children] of childGroups) {
			const converted = children.map((c) => this.convertElementToJson(c, opts));
			result[name] = children.length === 1 && opts.flattenSingle ? converted[0] : converted;
		}
	}

	/**
	 * Add text content to JSON representation
	 */
	private addTextToJson(result: any, el: DynamicElement): void {
		if (el.text !== undefined && el.hasChildren) {
			result["#text"] = el.text;
		}
	}

	/**
	 * Pretty print for debugging
	 */
	print(includeAttributes = true, includeValues = true): string {
		const lines: string[] = [];

		for (const el of this.elements) {
			let line = `${"  ".repeat(el.depth)}${el.name}`;

			if (includeAttributes && Object.keys(el.attributes).length > 0) {
				const attrs = Object.entries(el.attributes)
					.map(([k, v]) => `${k}="${v}"`)
					.join(" ");
				line += ` [${attrs}]`;
			}

			if (includeValues && el.text !== undefined) {
				line += ` = ${el.text}`;
			}

			lines.push(line);
		}

		return lines.join("\n");
	}

	/**
	 * Get summary statistics
	 */
	stats(): {
		count: number;
		withText: number;
		withAttributes: number;
		withChildren: number;
		leafNodes: number;
		namespaces: Set<string>;
		depths: Set<number>;
	} {
		return {
			count: this.elements.length,
			withText: this.elements.filter((el) => el.text).length,
			withAttributes: this.elements.filter((el) => Object.keys(el.attributes).length > 0).length,
			withChildren: this.elements.filter((el) => el.hasChildren).length,
			leafNodes: this.elements.filter((el) => el.isLeaf).length,
			namespaces: new Set(this.elements.flatMap((el) => (el.prefix !== undefined ? [el.prefix] : []))),
			depths: new Set(this.elements.map((el) => el.depth)),
		};
	}
}
