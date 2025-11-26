import { DynamicElement } from "./dynamic-element";

/**
 * Fluent query interface for XML elements with comprehensive querying capabilities
 */
export class XmlQuery {
	private elements: DynamicElement[];

	/** @internal */
	constructor(elements: DynamicElement[]) {
		this.elements = elements;
	}

	// =====================================================
	// SELECTION BY NAME
	// =====================================================

	/**
	 * Find all descendants by element name (recursive search)
	 */
	find(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.name === name, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find by qualified name (namespace:name)
	 */
	findQualified(qualifiedName: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.qualifiedName === qualifiedName, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find by name pattern (supports wildcards)
	 */
	findPattern(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? this.patternToRegex(pattern) : pattern;
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => regex.test(e.name), results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find first occurrence by name
	 */
	findFirst(name: string): XmlQuery {
		for (const el of this.elements) {
			const result: DynamicElement[] = [];
			this.findRecursive(el, e => e.name === name, result);
			if (result.length > 0) {
				return new XmlQuery([result[0]]);
			}
		}
		return new XmlQuery([]);
	}

	// =====================================================
	// SELECTION BY NAMESPACE
	// =====================================================

	/**
	 * Find by namespace prefix
	 */
	namespace(ns: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.namespace === ns, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find elements with any namespace
	 */
	hasNamespace(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.namespace !== undefined, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find elements without namespace
	 */
	noNamespace(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.namespace === undefined, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find by namespace URI
	 */
	namespaceUri(uri: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.namespaceUri === uri, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find by local name (name without prefix)
	 */
	localName(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.localName === name, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Find elements that have xmlns declarations
	 */
	hasXmlnsDeclarations(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(
				el,
				e => e.xmlnsDeclarations !== undefined && Object.keys(e.xmlnsDeclarations).length > 0,
				results
			);
		}
		return new XmlQuery(results);
	}

	/**
	 * Get namespace URI for a given prefix in current context
	 */
	resolveNamespace(prefix: string): string | undefined {
		if (this.elements.length === 0) return undefined;

		const element = this.elements[0];

		// Check current element's xmlns declarations
		if (element.xmlnsDeclarations?.[prefix]) {
			return element.xmlnsDeclarations[prefix];
		}

		// Walk up the tree to find namespace declaration
		let current = element.parent;
		while (current) {
			if (current.xmlnsDeclarations?.[prefix]) {
				return current.xmlnsDeclarations[prefix];
			}
			current = current.parent;
		}

		return undefined;
	}

	/**
	 * Find elements in the default namespace (xmlns="...")
	 */
	defaultNamespace(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(
				el,
				e => {
					// Element is in default namespace if it has no prefix but has a namespaceUri
					return !e.namespace && e.namespaceUri !== undefined;
				},
				results
			);
		}
		return new XmlQuery(results);
	}

	/**
	 * Get the default namespace URI (xmlns="...") in current context
	 */
	getDefaultNamespace(): string | undefined {
		if (this.elements.length === 0) return undefined;

		const element = this.elements[0];

		// Check current element's xmlns declarations for default namespace
		if (element.xmlnsDeclarations?.default) {
			return element.xmlnsDeclarations.default;
		}

		// Walk up the tree to find default namespace declaration
		let current = element.parent;
		while (current) {
			if (current.xmlnsDeclarations?.default) {
				return current.xmlnsDeclarations.default;
			}
			current = current.parent;
		}

		return undefined;
	}

	/**
	 * Get all namespace prefixes defined in current context
	 */
	getNamespacePrefixes(): string[] {
		if (this.elements.length === 0) return [];

		const prefixes = new Set<string>();
		const element = this.elements[0];

		// Collect from current element
		if (element.xmlnsDeclarations) {
			for (const prefix of Object.keys(element.xmlnsDeclarations)) {
				if (prefix !== "default") {
					prefixes.add(prefix);
				}
			}
		}

		// Walk up the tree
		let current = element.parent;
		while (current) {
			if (current.xmlnsDeclarations) {
				for (const prefix of Object.keys(current.xmlnsDeclarations)) {
					if (prefix !== "default") {
						prefixes.add(prefix);
					}
				}
			}
			current = current.parent;
		}

		return Array.from(prefixes);
	}

	/**
	 * Get all namespace mappings (prefix -> URI) in current context
	 */
	getNamespaceMappings(): Record<string, string> {
		if (this.elements.length === 0) return {};

		const mappings: Record<string, string> = {};
		const element = this.elements[0];

		// Walk up the tree first (so child declarations override parent)
		const ancestors: DynamicElement[] = [];
		let current: DynamicElement | undefined = element;
		while (current) {
			ancestors.unshift(current);
			current = current.parent;
		}

		// Collect mappings from root to current element
		for (const ancestor of ancestors) {
			if (ancestor.xmlnsDeclarations) {
				for (const [prefix, uri] of Object.entries(ancestor.xmlnsDeclarations)) {
					if (prefix === "default") {
						mappings[""] = uri; // Empty string represents default namespace
					} else {
						mappings[prefix] = uri;
					}
				}
			}
		}

		return mappings;
	}

	/**
	 * Find prefix for a given namespace URI in current context
	 */
	getPrefixForNamespace(uri: string): string | undefined {
		const mappings = this.getNamespaceMappings();
		for (const [prefix, nsUri] of Object.entries(mappings)) {
			if (nsUri === uri) {
				return prefix === "" ? undefined : prefix; // undefined for default namespace
			}
		}
		return undefined;
	}

	/**
	 * Query elements by namespace URI and local name (namespace-aware query)
	 */
	inNamespace(uri: string, localName: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.findRecursive(el, e => e.namespaceUri === uri && e.localName === localName, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Create a namespace context for easier querying with aliases
	 * Returns an object with methods bound to specific namespace URIs
	 */
	withNamespaces(aliases: Record<string, string>): NamespaceContext {
		return new NamespaceContext(this, aliases);
	}

	// =====================================================
	// XPATH SUPPORT
	// =====================================================

	/**
	 * Query using XPath expression
	 * Supports common XPath 1.0 features:
	 * - Basic paths: /root/child, root/child, child
	 * - Descendant-or-self: //child, /root//child
	 * - Wildcards: *, ns:*
	 * - Predicates: [1], [last()], [@attr], [@attr='value']
	 * - Attributes: @attr (in predicates)
	 * - Functions: text(), name(), local-name(), position(), count()
	 * - Operators: =, !=, <, >, <=, >=
	 * - Axes: . (self), .. (parent)
	 *
	 * @example
	 * query.xpath("/root/child")
	 * query.xpath("//item[@id='123']")
	 * query.xpath("book[price<30]")
	 * query.xpath("//chapter[count(section)>5]")
	 */
	xpath(expression: string): XmlQuery {
		// Lazy load to avoid circular dependency
		const { XPathEvaluator } = require("./xml-xpath");
		const evaluator = new XPathEvaluator();
		const results = evaluator.evaluate(expression, this.elements);
		return new XmlQuery(results);
	}

	/**
	 * Query using XPath expression and return first match
	 * Same as xpath().first() but more convenient
	 *
	 * @example
	 * const book = query.xpathFirst("//book[@id='123']")
	 * const title = query.xpathFirst("/catalog/book[1]/title")
	 */
	xpathFirst(expression: string): DynamicElement | undefined {
		return this.xpath(expression).first();
	}

	// =====================================================
	// HIERARCHICAL SELECTION
	// =====================================================

	/**
	 * Select all direct children
	 */
	children(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			results.push(...el.children);
		}
		return new XmlQuery(results);
	}

	/**
	 * Select children by name
	 */
	childrenNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			results.push(...el.children.filter(c => c.name === name));
		}
		return new XmlQuery(results);
	}

	/**
	 * Select first child
	 */
	firstChild(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			if (el.children.length > 0) {
				results.push(el.children[0]);
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select last child
	 */
	lastChild(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			if (el.children.length > 0) {
				results.push(el.children[el.children.length - 1]);
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select child at index
	 */
	childAt(index: number): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			if (el.children[index]) {
				results.push(el.children[index]);
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select parent elements
	 */
	parent(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			if (el.parent && !seen.has(el.parent)) {
				results.push(el.parent);
				seen.add(el.parent);
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select all ancestors (parents up to root)
	 */
	ancestors(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (!seen.has(current)) {
					results.push(current);
					seen.add(current);
				}
				current = current.parent;
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select ancestors by name
	 */
	ancestorsNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (current.name === name && !seen.has(current)) {
					results.push(current);
					seen.add(current);
				}
				current = current.parent;
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Find the closest ancestor matching a name (nearest parent with given name)
	 */
	closest(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (current.name === name) {
					results.push(current);
					break;
				}
				current = current.parent;
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Find the closest ancestor matching a predicate
	 */
	closestWhere(predicate: (el: DynamicElement) => boolean): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (predicate(current)) {
					results.push(current);
					break;
				}
				current = current.parent;
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select all descendants (all children recursively)
	 */
	descendants(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			this.collectDescendants(el, results);
		}
		return new XmlQuery(results);
	}

	/**
	 * Select siblings (elements with same parent, excluding self)
	 */
	siblings(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			if (el.parent) {
				for (const sibling of el.parent.children) {
					if (sibling !== el && !seen.has(sibling)) {
						results.push(sibling);
						seen.add(sibling);
					}
				}
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select siblings by name
	 */
	siblingsNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			if (el.parent) {
				for (const sibling of el.parent.children) {
					if (sibling !== el && sibling.name === name && !seen.has(sibling)) {
						results.push(sibling);
						seen.add(sibling);
					}
				}
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select all siblings including self
	 */
	siblingsIncludingSelf(): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			if (el.parent) {
				for (const sibling of el.parent.children) {
					if (!seen.has(sibling)) {
						results.push(sibling);
						seen.add(sibling);
					}
				}
			} else {
				// If no parent, return self
				if (!seen.has(el)) {
					results.push(el);
					seen.add(el);
				}
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select next sibling
	 */
	nextSibling(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			if (el.parent) {
				const siblings = el.parent.children;
				const index = siblings.indexOf(el);
				if (index >= 0 && index < siblings.length - 1) {
					results.push(siblings[index + 1]);
				}
			}
		}
		return new XmlQuery(results);
	}

	/**
	 * Select previous sibling
	 */
	previousSibling(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			if (el.parent) {
				const siblings = el.parent.children;
				const index = siblings.indexOf(el);
				if (index > 0) {
					results.push(siblings[index - 1]);
				}
			}
		}
		return new XmlQuery(results);
	}

	// =====================================================
	// FILTER BY ATTRIBUTES
	// =====================================================

	/**
	 * Filter by attribute existence
	 */
	hasAttribute(name: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => name in el.attributes));
	}

	/**
	 * Filter by multiple attributes existence
	 */
	hasAttributes(...names: string[]): XmlQuery {
		return new XmlQuery(this.elements.filter(el => names.every(name => name in el.attributes)));
	}

	/**
	 * Filter by attribute value (exact match)
	 */
	whereAttribute(name: string, value: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.attributes[name] === value));
	}

	/**
	 * Filter by attribute pattern
	 */
	whereAttributeMatches(name: string, pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? this.patternToRegex(pattern) : pattern;
		return new XmlQuery(this.elements.filter(el => el.attributes[name] && regex.test(el.attributes[name])));
	}

	/**
	 * Filter by attribute predicate
	 */
	whereAttributePredicate(name: string, predicate: (value: string) => boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.attributes[name] && predicate(el.attributes[name])));
	}

	/**
	 * Filter elements with any attributes
	 */
	hasAnyAttribute(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => Object.keys(el.attributes).length > 0));
	}

	/**
	 * Filter elements without any attributes
	 */
	noAttributes(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => Object.keys(el.attributes).length === 0));
	}

	// =====================================================
	// FILTER BY TEXT CONTENT
	// =====================================================

	/**
	 * Filter by exact text
	 */
	whereText(text: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text === text));
	}

	/**
	 * Filter by text pattern
	 */
	whereTextMatches(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? this.patternToRegex(pattern) : pattern;
		return new XmlQuery(this.elements.filter(el => el.text && regex.test(el.text)));
	}

	/**
	 * Filter by text predicate
	 */
	whereTextPredicate(predicate: (text: string) => boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text && predicate(el.text)));
	}

	/**
	 * Filter by text contains
	 */
	whereTextContains(substring: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text?.includes(substring)));
	}

	/**
	 * Filter by text starts with
	 */
	whereTextStartsWith(prefix: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text?.startsWith(prefix)));
	}

	/**
	 * Filter by text ends with
	 */
	whereTextEndsWith(suffix: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text?.endsWith(suffix)));
	}

	/**
	 * Filter elements with text
	 */
	hasText(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.text !== undefined && el.text !== ""));
	}

	/**
	 * Filter elements without text
	 */
	noText(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => !el.text || el.text === ""));
	}

	// =====================================================
	// FILTER BY NUMERIC VALUE
	// =====================================================

	/**
	 * Filter by numeric value
	 */
	whereValue(predicate: (value: number) => boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.numericValue !== undefined && predicate(el.numericValue)));
	}

	/**
	 * Filter by value equals
	 */
	whereValueEquals(value: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.numericValue === value));
	}

	/**
	 * Filter by value greater than
	 */
	whereValueGreaterThan(value: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.numericValue !== undefined && el.numericValue > value));
	}

	/**
	 * Filter by value less than
	 */
	whereValueLessThan(value: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.numericValue !== undefined && el.numericValue < value));
	}

	/**
	 * Filter by value in range
	 */
	whereValueBetween(min: number, max: number): XmlQuery {
		return new XmlQuery(
			this.elements.filter(el => el.numericValue !== undefined && el.numericValue >= min && el.numericValue <= max)
		);
	}

	/**
	 * Filter elements with numeric values
	 */
	hasNumericValue(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.numericValue !== undefined));
	}

	// =====================================================
	// FILTER BY BOOLEAN VALUE
	// =====================================================

	/**
	 * Filter by boolean value
	 */
	whereBooleanEquals(value: boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.booleanValue === value));
	}

	/**
	 * Filter elements with boolean values
	 */
	hasBooleanValue(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.booleanValue !== undefined));
	}

	// =====================================================
	// FILTER BY STRUCTURE
	// =====================================================

	/**
	 * Filter elements with children
	 */
	hasChildren(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.hasChildren));
	}

	/**
	 * Filter elements without children (leaf nodes)
	 */
	isLeaf(): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.isLeaf));
	}

	/**
	 * Filter by number of children
	 */
	whereChildCount(predicate: (count: number) => boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(el => predicate(el.children.length)));
	}

	/**
	 * Filter by depth in tree
	 */
	atDepth(depth: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.depth === depth));
	}

	/**
	 * Filter by minimum depth
	 */
	minDepth(depth: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.depth >= depth));
	}

	/**
	 * Filter by maximum depth
	 */
	maxDepth(depth: number): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.depth <= depth));
	}

	/**
	 * Filter by path
	 */
	wherePath(path: string): XmlQuery {
		return new XmlQuery(this.elements.filter(el => el.path === path));
	}

	/**
	 * Filter by path pattern
	 */
	wherePathMatches(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? this.patternToRegex(pattern) : pattern;
		return new XmlQuery(this.elements.filter(el => regex.test(el.path)));
	}

	// =====================================================
	// ADVANCED FILTERS
	// =====================================================

	/**
	 * Filter by custom predicate
	 */
	where(predicate: (element: DynamicElement, index: number) => boolean): XmlQuery {
		return new XmlQuery(this.elements.filter(predicate));
	}

	/**
	 * Filter by multiple conditions (AND logic)
	 */
	whereAll(...predicates: Array<(element: DynamicElement) => boolean>): XmlQuery {
		return new XmlQuery(this.elements.filter(el => predicates.every(pred => pred(el))));
	}

	/**
	 * Filter by any condition (OR logic)
	 */
	whereAny(...predicates: Array<(element: DynamicElement) => boolean>): XmlQuery {
		return new XmlQuery(this.elements.filter(el => predicates.some(pred => pred(el))));
	}

	/**
	 * Filter by complex query object
	 */
	whereMatches(query: Partial<DynamicElement> | Record<string, any>): XmlQuery {
		return new XmlQuery(
			this.elements.filter(el => {
				return Object.entries(query).every(([key, value]) => {
					const actualValue = this.getNestedProperty(el, key);

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
		return new XmlQuery(sorted);
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
		return new XmlQuery(sorted);
	}

	/**
	 * Sort by text content
	 */
	sortByText(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			const compare = (a.text || "").localeCompare(b.text || "");
			return ascending ? compare : -compare;
		});
		return new XmlQuery(sorted);
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
		return new XmlQuery(sorted);
	}

	/**
	 * Sort by depth
	 */
	sortByDepth(ascending = true): XmlQuery {
		const sorted = [...this.elements].sort((a, b) => {
			return ascending ? a.depth - b.depth : b.depth - a.depth;
		});
		return new XmlQuery(sorted);
	}

	/**
	 * Sort by custom comparator
	 */
	sortBy(comparator: (a: DynamicElement, b: DynamicElement) => number): XmlQuery {
		const sorted = [...this.elements].sort(comparator);
		return new XmlQuery(sorted);
	}

	/**
	 * Reverse current order
	 */
	reverse(): XmlQuery {
		return new XmlQuery([...this.elements].reverse());
	}

	// =====================================================
	// SLICING AND PAGINATION
	// =====================================================

	/**
	 * Take first n elements
	 */
	take(count: number): XmlQuery {
		return new XmlQuery(this.elements.slice(0, count));
	}

	/**
	 * Skip first n elements
	 */
	skip(count: number): XmlQuery {
		return new XmlQuery(this.elements.slice(count));
	}

	/**
	 * Slice elements
	 */
	slice(start: number, end?: number): XmlQuery {
		return new XmlQuery(this.elements.slice(start, end));
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

		return new XmlQuery(results);
	}

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
		return this.elements.map(el => el.text || "").filter(t => t);
	}

	/**
	 * Get all numeric values
	 */
	values(): number[] {
		return this.elements.map(el => el.numericValue).filter(v => v !== undefined) as number[];
	}

	/**
	 * Get all attribute values
	 */
	attributes(name: string): string[] {
		return this.elements.map(el => el.attributes[name]).filter(v => v !== undefined);
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
		return this.elements.reduce((sum, el) => sum + (el.numericValue || 0), 0);
	}

	/**
	 * Average of numeric values
	 */
	average(): number {
		const values = this.values();
		return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
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
		return this.elements.map(el => this.getAllTextRecursive(el));
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
		for (const desc of descendants.elements) {
			if (desc.textNodes !== undefined && desc.textNodes.length > 0) {
				result.push(desc);
			}
		}
		return new XmlQuery(result);
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
		for (const desc of descendants.elements) {
			if (desc.comments !== undefined && desc.comments.length > 0) {
				result.push(desc);
			}
		}
		return new XmlQuery(result);
	}

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
		return this;
	}

	/**
	 * Reduce elements to single value
	 */
	reduce<T>(fn: (acc: T, element: DynamicElement, index: number) => T, initial: T): T {
		return this.elements.reduce(fn, initial);
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
		return this.groupBy(el => el.namespace || "(no-namespace)");
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
					qualifiedName: el.qualifiedName,
					namespace: el.namespace,
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
			let line = `${"  ".repeat(el.depth)}${el.qualifiedName}`;

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
			namespaces: new Set(this.elements.map(el => el.namespace).filter(ns => ns !== undefined)),
			depths: new Set(this.elements.map(el => el.depth)),
		};
	}

	// =====================================================
	// MUTATION METHODS (BI-DIRECTIONAL SUPPORT)
	// =====================================================

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
		return this;
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
		return this;
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
		return this;
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
		return this;
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
		return this;
	}

	/**
	 * Clear children from all matched elements
	 * @returns This query for chaining
	 */
	clearChildren(): XmlQuery {
		for (const el of this.elements) {
			el.clearChildren();
		}
		return this;
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

	// =====================================================
	// HELPER METHODS
	// =====================================================

	private findRecursive(
		element: DynamicElement,
		predicate: (el: DynamicElement) => boolean,
		results: DynamicElement[]
	): void {
		if (predicate(element)) {
			results.push(element);
		}
		for (const child of element.children) {
			this.findRecursive(child, predicate, results);
		}
	}

	private collectDescendants(element: DynamicElement, results: DynamicElement[]): void {
		for (const child of element.children) {
			results.push(child);
			this.collectDescendants(child, results);
		}
	}

	private patternToRegex(pattern: string): RegExp {
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
		return new RegExp(`^${escaped}$`, "i");
	}

	private getNestedProperty(obj: any, path: string): any {
		const parts = path.split(".");
		let current = obj;

		for (const part of parts) {
			if (current === null || current === undefined) {
				return undefined;
			}
			current = current[part];
		}

		return current;
	}

	private getAllTextRecursive(element: DynamicElement): string {
		let text = element.text || "";

		// Add text from all text nodes if available
		if (element.textNodes && element.textNodes.length > 0) {
			text = element.textNodes.join("");
		}

		// Recursively get text from children
		for (const child of element.children) {
			const childText = this.getAllTextRecursive(child);
			if (childText) {
				text += childText;
			}
		}

		return text;
	}
}

/**
 * Namespace context for easier querying with namespace aliases
 * Allows defining short aliases for namespace URIs and querying with them
 */
export class NamespaceContext {
	private query: XmlQuery;
	private aliases: Record<string, string>;

	/** @internal */
	constructor(query: XmlQuery, aliases: Record<string, string>) {
		this.query = query;
		this.aliases = aliases;
	}

	/**
	 * Find elements by alias:localName notation
	 * Example: find("soap:Envelope") where soap is an alias
	 */
	find(qualifiedName: string): XmlQuery {
		const [alias, localName] = this.parseQualifiedName(qualifiedName);

		if (!alias) {
			// No prefix, search by local name only
			return this.query.localName(localName);
		}

		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}. Available aliases: ${Object.keys(this.aliases).join(", ")}`);
		}

		return this.query.inNamespace(uri, localName);
	}

	/**
	 * Find first element by alias:localName notation
	 */
	findFirst(qualifiedName: string): XmlQuery {
		const [alias, localName] = this.parseQualifiedName(qualifiedName);

		if (!alias) {
			return this.query.localName(localName).take(1);
		}

		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}`);
		}

		return this.query.inNamespace(uri, localName).take(1);
	}

	/**
	 * Query by alias (all elements in that namespace)
	 */
	namespace(alias: string): XmlQuery {
		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}`);
		}
		return this.query.namespaceUri(uri);
	}

	/**
	 * Get namespace URI for an alias
	 */
	resolve(alias: string): string | undefined {
		return this.aliases[alias];
	}

	/**
	 * Get all defined aliases
	 */
	getAliases(): string[] {
		return Object.keys(this.aliases);
	}

	/**
	 * Get the underlying query
	 */
	getQuery(): XmlQuery {
		return this.query;
	}

	/**
	 * Add or update namespace aliases
	 */
	withAlias(alias: string, uri: string): NamespaceContext {
		return new NamespaceContext(this.query, { ...this.aliases, [alias]: uri });
	}

	/**
	 * Remove a namespace alias
	 */
	withoutAlias(alias: string): NamespaceContext {
		const newAliases = { ...this.aliases };
		delete newAliases[alias];
		return new NamespaceContext(this.query, newAliases);
	}

	private parseQualifiedName(qualifiedName: string): [string | undefined, string] {
		const parts = qualifiedName.split(":");
		if (parts.length === 1) {
			return [undefined, parts[0]];
		}
		if (parts.length === 2) {
			return [parts[0], parts[1]];
		}
		throw new Error(`Invalid qualified name: ${qualifiedName}`);
	}
}
