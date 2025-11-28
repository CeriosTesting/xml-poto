import type { DynamicElement } from "../dynamic-element";
import { getNestedProperty, patternToRegex } from "../utils/query-helpers";
import type { XmlQuery } from "../xml-query";

/**
 * Filter methods for XmlQuery
 * Handles filtering by attributes, text, numeric values, boolean values, and structure
 * @internal
 */
export class FilterMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	// =====================================================
	// FILTER BY ATTRIBUTES
	// =====================================================

	/**
	 * Filter by attribute existence
	 */
	hasAttribute(name: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => name in el.attributes));
	}

	/**
	 * Filter by multiple attributes existence
	 */
	hasAttributes(...names: string[]): XmlQuery {
		return this.createQuery(this.elements.filter(el => names.every(name => name in el.attributes)));
	}

	/**
	 * Filter by attribute value (exact match)
	 */
	whereAttribute(name: string, value: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.attributes[name] === value));
	}

	/**
	 * Filter by attribute pattern
	 */
	whereAttributeMatches(name: string, pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? patternToRegex(pattern) : pattern;
		return this.createQuery(this.elements.filter(el => el.attributes[name] && regex.test(el.attributes[name])));
	}

	/**
	 * Filter by attribute predicate
	 */
	whereAttributePredicate(name: string, predicate: (value: string) => boolean): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.attributes[name] && predicate(el.attributes[name])));
	}

	/**
	 * Filter elements with any attributes
	 */
	hasAnyAttribute(): XmlQuery {
		return this.createQuery(this.elements.filter(el => Object.keys(el.attributes).length > 0));
	}

	/**
	 * Filter elements without any attributes
	 */
	noAttributes(): XmlQuery {
		return this.createQuery(this.elements.filter(el => Object.keys(el.attributes).length === 0));
	}

	// =====================================================
	// FILTER BY TEXT CONTENT
	// =====================================================

	/**
	 * Filter by exact text
	 */
	whereText(text: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text === text));
	}

	/**
	 * Filter by text pattern
	 */
	whereTextMatches(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? patternToRegex(pattern) : pattern;
		return this.createQuery(this.elements.filter(el => el.text && regex.test(el.text)));
	}

	/**
	 * Filter by text predicate
	 */
	whereTextPredicate(predicate: (text: string) => boolean): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text && predicate(el.text)));
	}

	/**
	 * Filter by text contains
	 */
	whereTextContains(substring: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text?.includes(substring)));
	}

	/**
	 * Filter by text starts with
	 */
	whereTextStartsWith(prefix: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text?.startsWith(prefix)));
	}

	/**
	 * Filter by text ends with
	 */
	whereTextEndsWith(suffix: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text?.endsWith(suffix)));
	}

	/**
	 * Filter elements with text
	 */
	hasText(): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.text !== undefined && el.text !== ""));
	}

	/**
	 * Filter elements without text
	 */
	noText(): XmlQuery {
		return this.createQuery(this.elements.filter(el => !el.text || el.text === ""));
	}

	// =====================================================
	// FILTER BY NUMERIC VALUE
	// =====================================================

	/**
	 * Filter by numeric value
	 */
	whereValue(predicate: (value: number) => boolean): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.numericValue !== undefined && predicate(el.numericValue)));
	}

	/**
	 * Filter by value equals
	 */
	whereValueEquals(value: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.numericValue === value));
	}

	/**
	 * Filter by value greater than
	 */
	whereValueGreaterThan(value: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.numericValue !== undefined && el.numericValue > value));
	}

	/**
	 * Filter by value less than
	 */
	whereValueLessThan(value: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.numericValue !== undefined && el.numericValue < value));
	}

	/**
	 * Filter by value in range
	 */
	whereValueBetween(min: number, max: number): XmlQuery {
		return this.createQuery(
			this.elements.filter(el => el.numericValue !== undefined && el.numericValue >= min && el.numericValue <= max)
		);
	}

	/**
	 * Filter elements with numeric values
	 */
	hasNumericValue(): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.numericValue !== undefined));
	}

	// =====================================================
	// FILTER BY BOOLEAN VALUE
	// =====================================================

	/**
	 * Filter by boolean value
	 */
	whereBooleanEquals(value: boolean): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.booleanValue === value));
	}

	/**
	 * Filter elements with boolean values
	 */
	hasBooleanValue(): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.booleanValue !== undefined));
	}

	// =====================================================
	// FILTER BY STRUCTURE
	// =====================================================

	/**
	 * Filter elements with children
	 */
	hasChildren(): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.hasChildren));
	}

	/**
	 * Filter elements without children (leaf nodes)
	 */
	isLeaf(): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.isLeaf));
	}

	/**
	 * Filter by number of children
	 */
	whereChildCount(predicate: (count: number) => boolean): XmlQuery {
		return this.createQuery(this.elements.filter(el => predicate(el.children.length)));
	}

	/**
	 * Filter by depth in tree
	 */
	atDepth(depth: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.depth === depth));
	}

	/**
	 * Filter by minimum depth
	 */
	minDepth(depth: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.depth >= depth));
	}

	/**
	 * Filter by maximum depth
	 */
	maxDepth(depth: number): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.depth <= depth));
	}

	/**
	 * Filter by path
	 */
	wherePath(path: string): XmlQuery {
		return this.createQuery(this.elements.filter(el => el.path === path));
	}

	/**
	 * Filter by path pattern
	 */
	wherePathMatches(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? patternToRegex(pattern) : pattern;
		return this.createQuery(this.elements.filter(el => regex.test(el.path)));
	}

	// =====================================================
	// ADVANCED FILTERS
	// =====================================================

	/**
	 * Filter by custom predicate
	 */
	where(predicate: (element: DynamicElement, index: number) => boolean): XmlQuery {
		return this.createQuery(this.elements.filter(predicate));
	}

	/**
	 * Filter by multiple conditions (AND logic)
	 */
	whereAll(...predicates: Array<(element: DynamicElement) => boolean>): XmlQuery {
		return this.createQuery(this.elements.filter(el => predicates.every(pred => pred(el))));
	}

	/**
	 * Filter by any condition (OR logic)
	 */
	whereAny(...predicates: Array<(element: DynamicElement) => boolean>): XmlQuery {
		return this.createQuery(this.elements.filter(el => predicates.some(pred => pred(el))));
	}

	/**
	 * Select first element matching any of the predicates
	 * Returns a query with the first element that matches any predicate
	 * @param predicates Array of predicate functions to test
	 * @returns Query with the first matching element, or empty query if none match
	 */
	selectFirst(...predicates: Array<(element: DynamicElement) => boolean>): XmlQuery {
		for (const el of this.elements) {
			if (predicates.some(pred => pred(el))) {
				return this.createQuery([el]);
			}
		}
		return this.createQuery([]);
	}

	/**
	 * Filter by complex query object
	 */
	whereMatches(query: Partial<DynamicElement> | Record<string, any>): XmlQuery {
		return this.createQuery(
			this.elements.filter(el => {
				return Object.entries(query).every(([key, value]) => {
					const actualValue = getNestedProperty(el, key);

					if (value instanceof RegExp) {
						return value.test(String(actualValue));
					}

					if (typeof value === "function") {
						return value(actualValue, el);
					}

					return actualValue === value;
				});
			})
		);
	}
}
