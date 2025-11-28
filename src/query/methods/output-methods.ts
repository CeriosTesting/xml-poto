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
			const value = valueSelector ? valueSelector(el) : el.text || el.children;
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
			const result: any = {};

			// Add attributes if requested
			if (opts.includeAttributes && Object.keys(el.attributes).length > 0) {
				result["@attributes"] = { ...el.attributes };
			}

			// Add metadata if requested
			if (opts.includeMetadata) {
				result["@metadata"] = {
					name: el.name,
					namespace: el.prefix,
					depth: el.depth,
					path: el.path,
					indexInParent: el.indexInParent,
				};
			}

			// Handle leaf nodes
			if (el.isLeaf) {
				if (opts.simplifyLeaves) {
					// Return simple value for leaves
					if (el.numericValue !== undefined) return el.numericValue;
					if (el.booleanValue !== undefined) return el.booleanValue;
					if (el.text !== undefined) return el.text;
					return opts.includeAttributes && Object.keys(el.attributes).length > 0 ? result : null;
				} else {
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
			}

			// Group children by name
			const childGroups = new Map<string, DynamicElement[]>();
			for (const child of el.children) {
				if (!childGroups.has(child.name)) {
					childGroups.set(child.name, []);
				}
				childGroups.get(child.name)?.push(child);
			}

			// Convert children
			for (const [name, children] of childGroups) {
				if (children.length === 1 && opts.flattenSingle) {
					result[name] = convertElement(children[0]);
				} else {
					result[name] = children.map(c => convertElement(c));
				}
			}

			// Add text content if present and has children
			if (el.text !== undefined && el.hasChildren) {
				result["#text"] = el.text;
			}

			return result;
		};

		// Convert all elements
		if (this.elements.length === 0) {
			return null;
		}

		if (this.elements.length === 1 && opts.flattenSingle) {
			return convertElement(this.elements[0]);
		}

		return this.elements.map(el => convertElement(el));
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
			withText: this.elements.filter(el => el.text).length,
			withAttributes: this.elements.filter(el => Object.keys(el.attributes).length > 0).length,
			withChildren: this.elements.filter(el => el.hasChildren).length,
			leafNodes: this.elements.filter(el => el.isLeaf).length,
			namespaces: new Set(this.elements.map(el => el.prefix).filter(ns => ns !== undefined)),
			depths: new Set(this.elements.map(el => el.depth)),
		};
	}
}
