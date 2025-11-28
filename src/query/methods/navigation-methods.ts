import type { DynamicElement } from "../dynamic-element";
import type { XmlQuery } from "../xml-query";

/**
 * Navigation methods for XmlQuery
 * Handles tree traversal, sorting, and slicing
 * @internal
 */
export class NavigationMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	/**
	 * Walk up the tree from current elements, collecting ancestors
	 * @param predicate Optional filter for which ancestors to collect
	 * @returns Array of ancestor elements (not wrapped in XmlQuery)
	 */
	walkUp(predicate?: (element: DynamicElement) => boolean): DynamicElement[] {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (!seen.has(current)) {
					if (!predicate || predicate(current)) {
						results.push(current);
						seen.add(current);
					}
				}
				current = current.parent;
			}
		}

		return results;
	}

	/**
	 * Walk down the tree from current elements, collecting descendants
	 * @param predicate Optional filter for which descendants to collect
	 * @returns Array of descendant elements (not wrapped in XmlQuery)
	 */
	walkDown(predicate?: (element: DynamicElement) => boolean): DynamicElement[] {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		const walk = (element: DynamicElement) => {
			for (const child of element.children) {
				if (!seen.has(child)) {
					if (!predicate || predicate(child)) {
						results.push(child);
						seen.add(child);
					}
					walk(child);
				}
			}
		};

		for (const el of this.elements) {
			walk(el);
		}

		return results;
	}

	/**
	 * Traverse elements in breadth-first order
	 * Starts from current elements and visits all children before grandchildren
	 * @returns Query with elements in breadth-first order
	 */
	breadthFirst(): XmlQuery {
		const results: DynamicElement[] = [];
		const queue: DynamicElement[] = [...this.elements];
		const seen = new Set<DynamicElement>();

		for (const el of this.elements) {
			seen.add(el);
		}

		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) break;
			results.push(current);

			for (const child of current.children) {
				if (!seen.has(child)) {
					queue.push(child);
					seen.add(child);
				}
			}
		}

		return this.createQuery(results);
	}

	/**
	 * Traverse elements in depth-first order
	 * This is the default traversal order, visiting children before siblings
	 * @returns Query with elements in depth-first order
	 */
	depthFirst(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		const walk = (element: DynamicElement) => {
			if (seen.has(element)) return;
			seen.add(element);
			results.push(element);

			for (const child of element.children) {
				walk(child);
			}
		};

		for (const el of this.elements) {
			walk(el);
		}

		return this.createQuery(results);
	}

	/**
	 * Get all following nodes in document order
	 * Returns all elements that appear after the current elements in the document
	 * @returns Query with all following nodes
	 */
	followingNodes(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		for (const el of this.elements) {
			// If element has no parent, it has no following siblings
			if (!el.parent) continue;

			// Get following siblings
			const siblings = el.parent.children;
			const currentIndex = siblings.indexOf(el);

			// Add all following siblings and their descendants
			for (let i = currentIndex + 1; i < siblings.length; i++) {
				const sibling = siblings[i];
				if (!seen.has(sibling)) {
					results.push(sibling);
					seen.add(sibling);
				}

				// Add descendants of following sibling
				const collect = (node: DynamicElement) => {
					for (const child of node.children) {
						if (!seen.has(child)) {
							results.push(child);
							seen.add(child);
						}
						collect(child);
					}
				};
				collect(sibling);
			}
		}

		return this.createQuery(results);
	}

	/**
	 * Get all preceding nodes in document order
	 * Returns all elements that appear before the current elements in the document
	 * Excludes ancestors of the current elements
	 * @returns Query with all preceding nodes
	 */
	precedingNodes(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		for (const el of this.elements) {
			// Get root
			let root = el;
			while (root.parent) {
				root = root.parent;
			}

			// Collect all nodes in document order
			const allNodes: DynamicElement[] = [];
			const collect = (node: DynamicElement) => {
				allNodes.push(node);
				for (const child of node.children) {
					collect(child);
				}
			};
			collect(root);

			// Find current element and add all preceding (excluding ancestors)
			const index = allNodes.indexOf(el);
			if (index !== -1) {
				// Collect ancestors to exclude them
				const ancestors = new Set<DynamicElement>();
				let current = el.parent;
				while (current) {
					ancestors.add(current);
					current = current.parent;
				}

				for (let i = 0; i < index; i++) {
					if (!ancestors.has(allNodes[i]) && !seen.has(allNodes[i])) {
						results.push(allNodes[i]);
						seen.add(allNodes[i]);
					}
				}
			}
		}

		return this.createQuery(results);
	}

	// =====================================================
	// SORTING AND ORDERING
	// =====================================================

	/**
	 * Sort by element name
	 */
	sortByName(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			const compare = a.name.localeCompare(b.name);
			return ascending ? compare : -compare;
		});
		return this.createQuery(sorted);
	}

	/**
	 * Sort by attribute value
	 */
	sortByAttribute(name: string, ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			const valA = a.attributes[name] || "";
			const valB = b.attributes[name] || "";
			const compare = valA.localeCompare(valB);
			return ascending ? compare : -compare;
		});
		return this.createQuery(sorted);
	}

	/**
	 * Sort by text content
	 */
	sortByText(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			const compare = (a.text || "").localeCompare(b.text || "");
			return ascending ? compare : -compare;
		});
		return this.createQuery(sorted);
	}

	/**
	 * Sort by numeric value
	 */
	sortByValue(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			const valA = a.numericValue ?? 0;
			const valB = b.numericValue ?? 0;
			return ascending ? valA - valB : valB - valA;
		});
		return this.createQuery(sorted);
	}

	/**
	 * Sort by depth
	 */
	sortByDepth(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			return ascending ? a.depth - b.depth : b.depth - a.depth;
		});
		return this.createQuery(sorted);
	}

	/**
	 * Sort by custom comparator
	 */
	sortBy(comparator: (a: DynamicElement, b: DynamicElement) => number): XmlQuery {
		const sorted = [...this.elements].sort(comparator);
		return this.createQuery(sorted);
	}

	/**
	 * Reverse current order
	 */
	reverse(): XmlQuery {
		return this.createQuery([...this.elements].reverse());
	}

	// =====================================================
	// SLICING AND PAGINATION
	// =====================================================

	/**
	 * Take first n elements
	 */
	take(count: number): XmlQuery {
		return this.createQuery(this.elements.slice(0, count));
	}

	/**
	 * Skip first n elements
	 */
	skip(count: number): XmlQuery {
		return this.createQuery(this.elements.slice(count));
	}

	/**
	 * Slice elements
	 */
	slice(start: number, end?: number): XmlQuery {
		return this.createQuery(this.elements.slice(start, end));
	}

	/**
	 * Get distinct elements by property
	 */
	distinctBy(selector: (element: DynamicElement) => any): XmlQuery {
		const seen = new Set();
		const results: DynamicElement[] = [];

		for (const el of this.elements) {
			const key = selector(el);
			if (!seen.has(key)) {
				seen.add(key);
				results.push(el);
			}
		}

		return this.createQuery(results);
	}

	/**
	 * Select elements at even positions (0-indexed: 0, 2, 4, ...)
	 * @returns Query with elements at even indices
	 */
	even(): XmlQuery {
		return this.createQuery(this.elements.filter((_, index) => index % 2 === 0));
	}

	/**
	 * Select elements at odd positions (0-indexed: 1, 3, 5, ...)
	 * @returns Query with elements at odd indices
	 */
	odd(): XmlQuery {
		return this.createQuery(this.elements.filter((_, index) => index % 2 === 1));
	}

	/**
	 * Select element at specific index (0-indexed)
	 * @param n Index of element to select
	 * @returns Query with element at index n, or empty if out of bounds
	 * @throws Error if n is negative
	 */
	nthChild(n: number): XmlQuery {
		if (n < 0) {
			return this.createQuery([]);
		}
		const element = this.elements[n];
		return this.createQuery(element ? [element] : []);
	}

	/**
	 * Select elements in index range [start, end)
	 * @param start Start index (inclusive)
	 * @param end End index (exclusive)
	 * @returns Query with elements in the specified range
	 * @throws Error if indices are invalid
	 */
	range(start: number, end: number): XmlQuery {
		if (start < 0 || end < 0) {
			throw new Error(`Range indices must be non-negative, got start=${start}, end=${end}`);
		}
		if (start > end) {
			throw new Error(`Range end must be >= start, got start=${start}, end=${end}`);
		}
		return this.createQuery(this.elements.slice(start, end));
	}
}
