import type { DynamicElement } from "../dynamic-element";
import { collectDescendants, findRecursive, patternToRegex } from "../utils/query-helpers";
import type { XmlQuery } from "../xml-query";
import { XPathEvaluator } from "../xml-xpath";

/**
 * Selection methods for XmlQuery
 * Handles name-based, namespace, and hierarchical selection
 * @internal
 */
export class SelectionMethods {
	protected elements!: DynamicElement[];
	protected createQuery!: (elements: DynamicElement[]) => XmlQuery;

	// =====================================================
	// SELECTION BY NAME
	// =====================================================

	/**
	 * Find all descendants (recursive search)
	 * Matches both qualified name (prefix:localName) and local name
	 */
	find(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.name === name || e.localName === name, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find all descendants by qualified name (prefix:localName) (recursive search)
	 */
	findQualified(qualifiedName: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.name === qualifiedName, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find by local name (name without prefix)
	 */
	findLocal(localName: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.localName === localName, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find by name pattern (supports wildcards)
	 */
	findPattern(pattern: string | RegExp): XmlQuery {
		const regex = typeof pattern === "string" ? patternToRegex(pattern) : pattern;
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => regex.test(e.name), results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find first occurrence by name
	 * Matches both qualified name (prefix:localName) and local name
	 */
	findFirst(name: string): XmlQuery {
		for (const el of this.elements) {
			const result: DynamicElement[] = [];
			findRecursive(el, e => e.name === name || e.localName === name, result);
			if (result.length > 0) {
				return this.createQuery([result[0]]);
			}
		}
		return this.createQuery([]);
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
			findRecursive(el, e => e.prefix === ns, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find elements with any namespace
	 */
	hasNamespace(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.prefix !== undefined, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find elements without namespace
	 */
	noNamespace(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.prefix === undefined, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find by namespace URI
	 */
	namespaceUri(uri: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.namespaceUri === uri, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find by local name (name without prefix)
	 */
	localName(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.localName === name, results);
		}
		return this.createQuery(results);
	}

	/**
	 * Find elements that have xmlns declarations
	 */
	hasXmlnsDeclarations(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			findRecursive(el, e => e.xmlnsDeclarations !== undefined && Object.keys(e.xmlnsDeclarations).length > 0, results);
		}
		return this.createQuery(results);
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
			findRecursive(
				el,
				e => {
					// Element is in default namespace if it has no prefix but has a namespaceUri
					return !e.prefix && e.namespaceUri !== undefined;
				},
				results
			);
		}
		return this.createQuery(results);
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
			findRecursive(el, e => e.namespaceUri === uri && e.localName === localName, results);
		}
		return this.createQuery(results);
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
		const evaluator = new XPathEvaluator();
		const results = evaluator.evaluate(expression, this.elements);
		return this.createQuery(results);
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
		return this.createQuery(results);
	}

	/**
	 * Select children by name
	 * Matches both qualified name (prefix:localName) and local name
	 */
	childrenNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			results.push(...el.children.filter(c => c.name === name || c.localName === name));
		}
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
	}

	/**
	 * Select ancestors by name
	 * Matches both qualified name (prefix:localName) and local name
	 */
	ancestorsNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if ((current.name === name || current.localName === name) && !seen.has(current)) {
					results.push(current);
					seen.add(current);
				}
				current = current.parent;
			}
		}
		return this.createQuery(results);
	}

	/**
	 * Find the closest ancestor matching a name (nearest parent with given name)
	 * Matches both qualified name (prefix:localName) and local name
	 */
	closest(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			let current = el.parent;
			while (current) {
				if (current.name === name || current.localName === name) {
					results.push(current);
					break;
				}
				current = current.parent;
			}
		}
		return this.createQuery(results);
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
		return this.createQuery(results);
	}

	/**
	 * Select all descendants (all children recursively)
	 */
	descendants(): XmlQuery {
		const results: DynamicElement[] = [];
		for (const el of this.elements) {
			collectDescendants(el, results);
		}
		return this.createQuery(results);
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
		return this.createQuery(results);
	}

	/**
	 * Select siblings by name
	 * Matches both qualified name (prefix:localName) and local name
	 */
	siblingsNamed(name: string): XmlQuery {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();
		for (const el of this.elements) {
			if (el.parent) {
				for (const sibling of el.parent.children) {
					if (sibling !== el && (sibling.name === name || sibling.localName === name) && !seen.has(sibling)) {
						results.push(sibling);
						seen.add(sibling);
					}
				}
			}
		}
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
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
		return this.createQuery(results);
	}
}
