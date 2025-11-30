import type { DynamicElement } from "../dynamic-element";
import { collectDescendants, getAllTextRecursive } from "../utils/query-helpers";
import type { XmlQuery } from "../xml-query";

/**
 * Aggregation methods for XmlQuery
 * Handles extraction, aggregation, grouping, and mixed content
 * @internal
 */
export class AggregationMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	// =====================================================
	// EXTRACTION AND AGGREGATION
	// =====================================================

	/**
	 * Get first element
	 */
	first(): DynamicElement | undefined {
		return this.elements[0];
	}

	/**
	 * Get last element
	 */
	last(): DynamicElement | undefined {
		return this.elements[this.elements.length - 1];
	}

	/**
	 * Get element at index
	 */
	at(index: number): DynamicElement | undefined {
		return index >= 0 ? this.elements[index] : this.elements[this.elements.length + index];
	}

	/**
	 * Get all elements as array
	 */
	toArray(): DynamicElement[] {
		return [...this.elements];
	}

	/**
	 * Get count
	 */
	count(): number {
		return this.elements.length;
	}

	/**
	 * Check if any elements exist
	 */
	exists(): boolean {
		return this.elements.length > 0;
	}

	/**
	 * Check if all elements match predicate
	 */
	all(predicate: (element: DynamicElement) => boolean): boolean {
		return this.elements.every(predicate);
	}

	/**
	 * Check if any element matches predicate
	 */
	any(predicate: (element: DynamicElement) => boolean): boolean {
		return this.elements.some(predicate);
	}

	/**
	 * Get all text values
	 */
	texts(): string[] {
		return this.elements.flatMap(el => (el.text ? [el.text] : []));
	}

	/**
	 * Get all numeric values
	 */
	values(): number[] {
		return this.elements
			.map(el => el.numericValue ?? (el.text ? Number.parseFloat(el.text) : undefined))
			.filter(v => v !== undefined && !Number.isNaN(v)) as number[];
	}

	/**
	 * Get all attribute values
	 */
	attributes(name: string): string[] {
		return this.elements.flatMap(el => {
			const value = el.attributes[name];
			return value !== undefined ? [value] : [];
		});
	}

	/**
	 * Get all unique attribute values
	 */
	distinctAttributes(name: string): string[] {
		return [...new Set(this.attributes(name))];
	}

	/**
	 * Sum numeric values
	 */
	sum(): number {
		return this.values().reduce((a, b) => a + b, 0);
	}

	/**
	 * Average of numeric values
	 */
	average(): number {
		const values = this.values();
		if (values.length === 0) return 0;
		return values.reduce((a, b) => a + b, 0) / values.length;
	}

	/**
	 * Minimum numeric value
	 */
	min(): number | undefined {
		const values = this.values();
		return values.length > 0 ? Math.min(...values) : undefined;
	}

	/**
	 * Maximum numeric value
	 */
	max(): number | undefined {
		const values = this.values();
		return values.length > 0 ? Math.max(...values) : undefined;
	}

	/**
	 * Median numeric value
	 * @returns The median (middle value) of all numeric values, or undefined if none exist
	 */
	median(): number | undefined {
		const values = this.values().sort((a, b) => a - b);
		if (values.length === 0) return undefined;
		const mid = Math.floor(values.length / 2);
		return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
	}

	/**
	 * Mode (most frequent) numeric value
	 * @returns The most frequently occurring numeric value, or undefined if none exist
	 */
	mode(): number | undefined {
		const values = this.values();
		if (values.length === 0) return undefined;

		const frequency = new Map<number, number>();
		for (const value of values) {
			frequency.set(value, (frequency.get(value) || 0) + 1);
		}

		let maxFreq = 0;
		let mode: number | undefined;
		for (const [value, freq] of frequency) {
			if (freq > maxFreq) {
				maxFreq = freq;
				mode = value;
			}
		}

		return mode;
	}

	/**
	 * Variance of numeric values
	 * @returns The variance of all numeric values, or undefined if none exist
	 */
	variance(): number | undefined {
		const values = this.values();
		if (values.length === 0) return undefined;

		const avg = this.average();
		const squaredDiffs = values.map(v => (v - avg) ** 2);
		return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
	}

	/**
	 * Standard deviation of numeric values
	 * @returns The standard deviation of all numeric values, or undefined if none exist
	 */
	standardDeviation(): number | undefined {
		const v = this.variance();
		return v !== undefined ? Math.sqrt(v) : undefined;
	}

	/**
	 * Percentile of numeric values
	 * @param p Percentile to calculate (0-100)
	 * @returns The value at the specified percentile, or undefined if no values exist
	 * @throws Error if p is not between 0 and 100
	 */
	percentile(p: number): number | undefined {
		if (p < 0 || p > 100) {
			throw new Error(`Percentile must be between 0 and 100, got ${p}`);
		}

		const values = this.values().sort((a, b) => a - b);
		if (values.length === 0) return undefined;

		const index = (p / 100) * (values.length - 1);
		const lower = Math.floor(index);
		const upper = Math.ceil(index);
		const weight = index - lower;

		if (lower === upper) return values[lower];
		return values[lower] * (1 - weight) + values[upper] * weight;
	}

	/**
	 * Get all attributes from matched elements as Map objects
	 * @returns Array of Maps, each containing the attributes of one element
	 */
	attributeMaps(): Map<string, string>[] {
		return this.elements.map(el => {
			const map = new Map<string, string>();
			for (const [key, value] of Object.entries(el.attributes)) {
				map.set(key, value);
			}
			return map;
		});
	}

	// =====================================================
	// MIXED CONTENT METHODS
	// =====================================================

	/**
	 * Get all text nodes from mixed content
	 */
	textNodes(): string[][] {
		return this.elements.map(el => el.textNodes || []);
	}

	/**
	 * Get all text nodes flattened
	 */
	allTextNodes(): string[] {
		const result: string[] = [];
		for (const el of this.elements) {
			if (el.textNodes) {
				result.push(...el.textNodes);
			}
		}
		return result;
	}

	/**
	 * Get concatenated text from element and all descendants
	 */
	allText(): string[] {
		return this.elements.map(el => getAllTextRecursive(el));
	}

	/**
	 * Get all comments
	 */
	comments(): string[][] {
		return this.elements.map(el => el.comments || []);
	}

	/**
	 * Get all comments flattened
	 */
	allComments(): string[] {
		const result: string[] = [];
		for (const el of this.elements) {
			if (el.comments) {
				result.push(...el.comments);
			}
		}
		return result;
	}

	/**
	 * Filter elements that have text nodes (mixed content)
	 * Searches recursively through all descendants
	 */
	hasMixedContent(): XmlQuery {
		const result: DynamicElement[] = [];
		for (const el of this.elements) {
			// Check the element itself
			if (el.textNodes !== undefined && el.textNodes.length > 0) {
				result.push(el);
			}
		}
		// Check all descendants recursively
		const descendants = this.descendants();
		for (const desc of descendants.toArray()) {
			if (desc.textNodes !== undefined && desc.textNodes.length > 0) {
				result.push(desc);
			}
		}
		return this.createQuery(result);
	}

	/**
	 * Filter elements that have comments
	 * Searches recursively through all descendants
	 */
	hasComments(): XmlQuery {
		const result: DynamicElement[] = [];
		for (const el of this.elements) {
			// Check the element itself
			if (el.comments !== undefined && el.comments.length > 0) {
				result.push(el);
			}
		}
		// Check all descendants recursively
		const descendants = this.descendants();
		for (const desc of descendants.toArray()) {
			if (desc.comments !== undefined && desc.comments.length > 0) {
				result.push(desc);
			}
		}
		return this.createQuery(result);
	}

	// =====================================================
	// GROUPING
	// =====================================================

	/**
	 * Group by element name
	 */
	groupByName(): Map<string, DynamicElement[]> {
		return this.groupBy(el => el.name);
	}

	/**
	 * Group by namespace
	 */
	groupByNamespace(): Map<string, DynamicElement[]> {
		return this.groupBy(el => el.prefix || "(no-namespace)");
	}

	/**
	 * Group by attribute value
	 */
	groupByAttribute(name: string): Map<string, DynamicElement[]> {
		return this.groupBy(el => el.attributes[name] || "(no-value)");
	}

	/**
	 * Group by depth
	 */
	groupByDepth(): Map<number, DynamicElement[]> {
		const grouped = new Map<number, DynamicElement[]>();
		for (const el of this.elements) {
			if (!grouped.has(el.depth)) {
				grouped.set(el.depth, []);
			}
			grouped.get(el.depth)?.push(el);
		}
		return grouped;
	}

	/**
	 * Group by custom selector
	 */
	groupBy<K>(selector: (element: DynamicElement) => K): Map<K, DynamicElement[]> {
		const grouped = new Map<K, DynamicElement[]>();
		for (const el of this.elements) {
			const key = selector(el);
			if (!grouped.has(key)) {
				grouped.set(key, []);
			}
			grouped.get(key)?.push(el);
		}
		return grouped;
	}

	// Helper method used by hasMixedContent and hasComments
	private descendants(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			collectDescendants(el, results);
		}
		return this.createQuery(results);
	}
}
