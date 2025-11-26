import type { DynamicElement } from "./xml-query";

/**
 * XPath expression evaluator for DynamicElement trees
 * Supports common XPath 1.0 features
 */
export class XPathEvaluator {
	/**
	 * Evaluate XPath expression and return matching elements
	 */
	evaluate(xpath: string, contextElements: DynamicElement[]): DynamicElement[] {
		if (!xpath || xpath.trim() === "") {
			return [];
		}

		const trimmedPath = xpath.trim();

		// Handle union operator (|)
		if (this.containsUnionOperator(trimmedPath)) {
			return this.evaluateUnion(trimmedPath, contextElements);
		}

		// Handle descendant-or-self axis - check before single /
		if (trimmedPath.startsWith("//")) {
			// For absolute //, start from roots
			const roots = this.findRoots(contextElements);
			// Pass the full // path
			return this.evaluatePath(trimmedPath, roots);
		}

		// Handle absolute paths starting with /
		if (trimmedPath.startsWith("/")) {
			// Find root elements from any context element
			const roots = this.findRoots(contextElements);
			if (trimmedPath === "/") {
				return roots;
			}
			// Remove leading / and evaluate from root
			return this.evaluatePath(trimmedPath.substring(1), roots);
		}

		// Relative path - evaluate from context
		return this.evaluatePath(trimmedPath, contextElements);
	}

	/**
	 * Find root elements from context
	 */
	private findRoots(elements: DynamicElement[]): DynamicElement[] {
		const roots: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		for (const element of elements) {
			let current = element;
			while (current.parent) {
				current = current.parent;
			}
			if (!seen.has(current)) {
				roots.push(current);
				seen.add(current);
			}
		}

		return roots;
	}

	/**
	 * Evaluate a relative path from context elements
	 */
	private evaluatePath(path: string, contextElements: DynamicElement[], matchSelfFirst = false): DynamicElement[] {
		if (contextElements.length === 0) {
			return [];
		}

		// Handle descendant-or-self axis (//)
		if (path.startsWith("//")) {
			const remainingPath = path.substring(2);
			const descendants = this.getAllDescendants(contextElements);
			// After //, match against the descendants themselves
			return this.evaluatePath(remainingPath, descendants, true);
		}

		// Split by / but preserve predicates
		const steps = this.parseSteps(path);
		let currentElements = contextElements;
		let previousWasDescendantAxis = false;

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];

			// For the first step or after //, check if it matches the context elements themselves
			// This handles both absolute paths (/root/child where first step matches root)
			// and descendant-or-self paths (//item where we filter descendants)
			if (i === 0 || previousWasDescendantAxis) {
				const wasAfterDescendantAxis = previousWasDescendantAxis;
				previousWasDescendantAxis = false;

				// Extract node test from step (without predicates)
				const predicateMatch = step.match(/^([^[]+)(\[.+\])$/);
				const nodeTest = predicateMatch ? predicateMatch[1] : step;
				const predicate = predicateMatch ? predicateMatch[2] : null;

				// Check if any context elements match this step
				let matchingSelf: DynamicElement[] = [];
				for (const element of currentElements) {
					if (this.matchesNodeTest(element, nodeTest)) {
						matchingSelf.push(element);
					}
				}

				// If we have matches OR this is a descendant-or-self path, use filtered results
				if (matchingSelf.length > 0) {
					// Apply predicate if present
					if (predicate) {
						matchingSelf = this.applyPredicate(predicate, matchingSelf);
					}
					currentElements = matchingSelf;
					continue;
				} else if (matchSelfFirst || wasAfterDescendantAxis) {
					// For descendant-or-self with no matches, or after // with no matches, use empty result
					currentElements = matchingSelf; // empty array
					continue;
				}
			}

			// Check if this step is //
			if (step === "//") {
				currentElements = this.getAllDescendants(currentElements);
				previousWasDescendantAxis = true;
				continue;
			}

			// Normal step evaluation (look at children)
			currentElements = this.evaluateStep(step, currentElements);
			if (currentElements.length === 0) {
				break;
			}
		}

		return currentElements;
	}

	/**
	 * Parse XPath steps, handling predicates correctly
	 */
	private parseSteps(path: string): string[] {
		const steps: string[] = [];
		let current = "";
		let bracketDepth = 0;

		for (let i = 0; i < path.length; i++) {
			const char = path[i];

			if (char === "[") {
				bracketDepth++;
				current += char;
			} else if (char === "]") {
				bracketDepth--;
				current += char;
			} else if (char === "/" && bracketDepth === 0) {
				if (current) {
					steps.push(current);
					current = "";
				}
				// Check for // (descendant-or-self)
				if (i + 1 < path.length && path[i + 1] === "/") {
					steps.push("//");
					i++; // Skip next /
				}
			} else {
				current += char;
			}
		}

		if (current) {
			steps.push(current);
		}

		return steps;
	}

	/**
	 * Evaluate a single step in the path
	 */
	private evaluateStep(step: string, contextElements: DynamicElement[]): DynamicElement[] {
		// Handle descendant-or-self
		if (step === "//") {
			return this.getAllDescendants(contextElements);
		}

		// Check for predicates
		const predicateMatch = step.match(/^([^[]+)(\[.+\])$/);
		if (predicateMatch) {
			const nodeTest = predicateMatch[1];
			const predicate = predicateMatch[2];

			// First apply node test
			let candidates = this.applyNodeTest(nodeTest, contextElements);

			// Then apply predicate
			candidates = this.applyPredicate(predicate, candidates);

			return candidates;
		}

		// No predicate, just node test
		return this.applyNodeTest(step, contextElements);
	}

	/**
	 * Apply node test (element name, wildcard, etc.)
	 */
	private applyNodeTest(nodeTest: string, contextElements: DynamicElement[]): DynamicElement[] {
		// Handle axis syntax (axis::node-test)
		if (nodeTest.includes("::")) {
			return this.evaluateAxis(nodeTest, contextElements);
		}

		// Handle special axes
		if (nodeTest === ".") {
			// Current node
			return contextElements;
		}

		if (nodeTest === "..") {
			// Parent node
			const parents: DynamicElement[] = [];
			const seen = new Set<DynamicElement>();
			for (const element of contextElements) {
				if (element.parent && !seen.has(element.parent)) {
					parents.push(element.parent);
					seen.add(element.parent);
				}
			}
			return parents;
		}

		if (nodeTest === "*") {
			// Wildcard - all child elements
			const results: DynamicElement[] = [];
			for (const element of contextElements) {
				results.push(...element.children);
			}
			return results;
		}

		// Attribute access
		if (nodeTest.startsWith("@")) {
			// Attributes are not elements, return empty
			// In full XPath, this would return attribute nodes
			return [];
		}

		// Element name (possibly with namespace prefix)
		const results: DynamicElement[] = [];
		for (const element of contextElements) {
			for (const child of element.children) {
				if (this.matchesNodeTest(child, nodeTest)) {
					results.push(child);
				}
			}
		}

		return results;
	}

	/**
	 * Evaluate axis expressions (axis::node-test)
	 */
	private evaluateAxis(axisExpression: string, contextElements: DynamicElement[]): DynamicElement[] {
		const [axis, nodeTest] = axisExpression.split("::");
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		switch (axis) {
			case "child":
				for (const element of contextElements) {
					for (const child of element.children) {
						if (this.matchesAxisNodeTest(child, nodeTest) && !seen.has(child)) {
							results.push(child);
							seen.add(child);
						}
					}
				}
				break;

			case "descendant":
				for (const element of contextElements) {
					const descendants = this.getDescendants(element);
					for (const descendant of descendants) {
						if (this.matchesAxisNodeTest(descendant, nodeTest) && !seen.has(descendant)) {
							results.push(descendant);
							seen.add(descendant);
						}
					}
				}
				break;

			case "descendant-or-self":
				for (const element of contextElements) {
					if (this.matchesAxisNodeTest(element, nodeTest) && !seen.has(element)) {
						results.push(element);
						seen.add(element);
					}
					const descendants = this.getDescendants(element);
					for (const descendant of descendants) {
						if (this.matchesAxisNodeTest(descendant, nodeTest) && !seen.has(descendant)) {
							results.push(descendant);
							seen.add(descendant);
						}
					}
				}
				break;

			case "parent":
				for (const element of contextElements) {
					if (element.parent && !seen.has(element.parent)) {
						if (this.matchesAxisNodeTest(element.parent, nodeTest)) {
							results.push(element.parent);
							seen.add(element.parent);
						}
					}
				}
				break;

			case "ancestor":
				for (const element of contextElements) {
					const ancestors = this.getAncestors(element);
					for (const ancestor of ancestors) {
						if (this.matchesAxisNodeTest(ancestor, nodeTest) && !seen.has(ancestor)) {
							results.push(ancestor);
							seen.add(ancestor);
						}
					}
				}
				break;

			case "ancestor-or-self":
				for (const element of contextElements) {
					if (this.matchesAxisNodeTest(element, nodeTest) && !seen.has(element)) {
						results.push(element);
						seen.add(element);
					}
					const ancestors = this.getAncestors(element);
					for (const ancestor of ancestors) {
						if (this.matchesAxisNodeTest(ancestor, nodeTest) && !seen.has(ancestor)) {
							results.push(ancestor);
							seen.add(ancestor);
						}
					}
				}
				break;

			case "following-sibling":
				for (const element of contextElements) {
					const siblings = this.getFollowingSiblings(element);
					for (const sibling of siblings) {
						if (this.matchesAxisNodeTest(sibling, nodeTest) && !seen.has(sibling)) {
							results.push(sibling);
							seen.add(sibling);
						}
					}
				}
				break;

			case "preceding-sibling":
				for (const element of contextElements) {
					const siblings = this.getPrecedingSiblings(element);
					for (const sibling of siblings) {
						if (this.matchesAxisNodeTest(sibling, nodeTest) && !seen.has(sibling)) {
							results.push(sibling);
							seen.add(sibling);
						}
					}
				}
				break;

			case "following":
				for (const element of contextElements) {
					const following = this.getFollowing(element);
					for (const node of following) {
						if (this.matchesAxisNodeTest(node, nodeTest) && !seen.has(node)) {
							results.push(node);
							seen.add(node);
						}
					}
				}
				break;

			case "preceding":
				for (const element of contextElements) {
					const preceding = this.getPreceding(element);
					for (const node of preceding) {
						if (this.matchesAxisNodeTest(node, nodeTest) && !seen.has(node)) {
							results.push(node);
							seen.add(node);
						}
					}
				}
				break;

			case "attribute":
				// Attributes are not DynamicElements, return empty
				break;

			case "self":
				for (const element of contextElements) {
					if (this.matchesAxisNodeTest(element, nodeTest) && !seen.has(element)) {
						results.push(element);
						seen.add(element);
					}
				}
				break;

			default:
				throw new Error(`Unsupported axis: ${axis}`);
		}
		return results;
	}

	/**
	 * Get all following siblings of an element
	 */
	private getFollowingSiblings(element: DynamicElement): DynamicElement[] {
		if (!element.parent) {
			return [];
		}

		const siblings = element.parent.children;
		const elementIndex = siblings.indexOf(element);
		if (elementIndex === -1) {
			return [];
		}

		return siblings.slice(elementIndex + 1);
	}

	/**
	 * Get all preceding siblings of an element
	 */
	private getPrecedingSiblings(element: DynamicElement): DynamicElement[] {
		if (!element.parent) {
			return [];
		}

		const siblings = element.parent.children;
		const elementIndex = siblings.indexOf(element);
		if (elementIndex === -1) {
			return [];
		}

		return siblings.slice(0, elementIndex);
	}

	/**
	 * Get all descendants of an element (not including the element itself)
	 */
	private getDescendants(element: DynamicElement): DynamicElement[] {
		const results: DynamicElement[] = [];
		const collect = (el: DynamicElement) => {
			for (const child of el.children) {
				results.push(child);
				collect(child);
			}
		};
		collect(element);
		return results;
	}

	/**
	 * Get all ancestors of an element (not including the element itself)
	 */
	private getAncestors(element: DynamicElement): DynamicElement[] {
		const results: DynamicElement[] = [];
		let current = element.parent;
		while (current) {
			results.push(current);
			current = current.parent;
		}
		return results;
	}

	/**
	 * Get all following nodes (not just siblings, but all nodes after this one in document order)
	 */
	private getFollowing(element: DynamicElement): DynamicElement[] {
		// Get root to traverse from
		let root = element;
		while (root.parent) {
			root = root.parent;
		}

		// Collect all nodes in document order
		const allNodes: DynamicElement[] = [];
		const collect = (el: DynamicElement) => {
			allNodes.push(el);
			for (const child of el.children) {
				collect(child);
			}
		};
		collect(root);

		// Find current element and return everything after it
		const index = allNodes.indexOf(element);
		if (index !== -1) {
			return allNodes.slice(index + 1);
		}
		return [];
	}

	/**
	 * Get all preceding nodes (not just siblings, but all nodes before this one in document order)
	 */
	private getPreceding(element: DynamicElement): DynamicElement[] {
		// Get root to traverse from
		let root = element;
		while (root.parent) {
			root = root.parent;
		}

		// Collect all nodes in document order
		const allNodes: DynamicElement[] = [];
		const collect = (el: DynamicElement) => {
			allNodes.push(el);
			for (const child of el.children) {
				collect(child);
			}
		};
		collect(root);

		// Find current element and return everything before it (excluding ancestors)
		const index = allNodes.indexOf(element);
		if (index !== -1) {
			const preceding = allNodes.slice(0, index);
			// Exclude ancestors
			const ancestors = new Set(this.getAncestors(element));
			return preceding.filter(node => !ancestors.has(node));
		}
		return [];
	}

	/**
	 * Check if element matches axis node test
	 */
	private matchesAxisNodeTest(element: DynamicElement, nodeTest: string): boolean {
		if (nodeTest === "*") {
			return true;
		}
		return this.matchesNodeTest(element, nodeTest);
	}

	/**
	 * Check if element matches node test
	 */
	private matchesNodeTest(element: DynamicElement, nodeTest: string): boolean {
		// Handle namespace prefix
		if (nodeTest.includes(":")) {
			const [prefix, localName] = nodeTest.split(":");
			if (prefix === "*") {
				return element.localName === localName;
			}
			return element.namespace === prefix && element.localName === localName;
		}

		// Simple name match
		return element.name === nodeTest || element.localName === nodeTest;
	}

	/**
	 * Apply predicate filter
	 */
	private applyPredicate(predicate: string, candidates: DynamicElement[]): DynamicElement[] {
		// Remove outer brackets
		const inner = predicate.substring(1, predicate.length - 1).trim();

		// Position predicate (number)
		if (/^\d+$/.test(inner)) {
			const position = parseInt(inner, 10);
			// XPath is 1-indexed
			return position > 0 && position <= candidates.length ? [candidates[position - 1]] : [];
		}

		// last() function
		if (inner === "last()") {
			return candidates.length > 0 ? [candidates[candidates.length - 1]] : [];
		}

		// Boolean operators (and, or)
		if (this.containsBooleanOperator(inner)) {
			return this.evaluateBooleanExpression(inner, candidates);
		}

		// Attribute existence - CRITICAL BUG FIX: Include < and > operators
		if (
			inner.startsWith("@") &&
			!inner.includes("=") &&
			!inner.includes("!") &&
			!inner.includes("<") &&
			!inner.includes(">")
		) {
			const attrName = inner.substring(1);
			return candidates.filter(el => el.attributes[attrName] !== undefined);
		}

		// Comparison predicates
		if (inner.includes("=") || inner.includes("!=") || inner.includes("<") || inner.includes(">")) {
			return this.evaluateComparison(inner, candidates);
		}

		// Boolean function literals and boolean()
		if (inner === "true()" || inner === "false()" || inner.startsWith("boolean(")) {
			return this.evaluateBooleanExpression(inner, candidates);
		}

		// Function calls
		if (inner.includes("(")) {
			return this.evaluateFunction(inner, candidates);
		}

		// Child element existence
		return candidates.filter(el => {
			return el.children.some(child => this.matchesNodeTest(child, inner));
		});
	}

	/**
	 * Check if expression contains union operator
	 */
	private containsUnionOperator(expr: string): boolean {
		// Check for pipe outside of predicates and string literals
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < expr.length; i++) {
			const char = expr[i];

			if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			} else if (char === "[" && !inString) {
				depth++;
			} else if (char === "]" && !inString) {
				depth--;
			} else if (char === "|" && depth === 0 && !inString) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Evaluate union expression (path1 | path2 | ...)
	 */
	private evaluateUnion(expr: string, contextElements: DynamicElement[]): DynamicElement[] {
		const paths = this.splitByUnion(expr);
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		for (const path of paths) {
			const matches = this.evaluate(path.trim(), contextElements);
			for (const match of matches) {
				if (!seen.has(match)) {
					results.push(match);
					seen.add(match);
				}
			}
		}

		return results;
	}

	/**
	 * Split expression by union operator (|)
	 */
	private splitByUnion(expr: string): string[] {
		const parts: string[] = [];
		let current = "";
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < expr.length; i++) {
			const char = expr[i];

			if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
				current += char;
			} else if (char === "[" && !inString) {
				depth++;
				current += char;
			} else if (char === "]" && !inString) {
				depth--;
				current += char;
			} else if (char === "|" && depth === 0 && !inString) {
				parts.push(current);
				current = "";
			} else {
				current += char;
			}
		}

		if (current) {
			parts.push(current);
		}

		return parts;
	}

	/**
	 * Check if expression contains boolean operators
	 */
	private containsBooleanOperator(expr: string): boolean {
		// Check for 'and', 'or', or 'not(' as operators
		return /\band\b/.test(expr) || /\bor\b/.test(expr) || expr.includes("not(");
	}

	/**
	 * Evaluate boolean expression (and, or, not)
	 */
	private evaluateBooleanExpression(expr: string, candidates: DynamicElement[]): DynamicElement[] {
		return candidates.filter((el, index) => {
			return this.evaluateBooleanCondition(expr, el, index + 1, candidates);
		});
	}

	/**
	 * Evaluate a boolean condition
	 */
	private evaluateBooleanCondition(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): boolean {
		// Handle 'or' operator (lower precedence)
		const orParts = this.splitByOperator(expr, "or");
		if (orParts.length > 1) {
			return orParts.some(part => this.evaluateBooleanCondition(part.trim(), element, position, candidates));
		}

		// Handle 'and' operator (higher precedence)
		const andParts = this.splitByOperator(expr, "and");
		if (andParts.length > 1) {
			return andParts.every(part => this.evaluateBooleanCondition(part.trim(), element, position, candidates));
		}

		// Handle 'not()' function
		if (expr.startsWith("not(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(4, expr.length - 1).trim();
			return !this.evaluateBooleanCondition(innerExpr, element, position, candidates);
		}

		// Base conditions
		return this.evaluateBaseCondition(expr, element, position, candidates);
	}

	/**
	 * Split expression by operator, respecting parentheses and string literals
	 */
	private splitByOperator(expr: string, operator: string): string[] {
		const parts: string[] = [];
		let current = "";
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < expr.length; i++) {
			const char = expr[i];

			if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
				current += char;
			} else if (char === "(" && !inString) {
				depth++;
				current += char;
			} else if (char === ")" && !inString) {
				depth--;
				current += char;
			} else if (depth === 0 && !inString) {
				// Check if we're at the operator
				const remaining = expr.substring(i);
				const operatorPattern = new RegExp(`^\\b${operator}\\b`);
				if (operatorPattern.test(remaining)) {
					parts.push(current);
					current = "";
					i += operator.length - 1; // Skip operator
					// Skip whitespace after operator
					while (i + 1 < expr.length && expr[i + 1] === " ") {
						i++;
					}
				} else {
					current += char;
				}
			} else {
				current += char;
			}
		}

		if (current) {
			parts.push(current);
		}

		return parts.length > 1 ? parts : [expr];
	}

	/**
	 * Evaluate a base condition (comparison, function, etc.)
	 */
	private evaluateBaseCondition(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): boolean {
		// Comparison operators
		if (expr.includes("=") || expr.includes("!=") || expr.includes("<") || expr.includes(">")) {
			// Parse the comparison to evaluate it directly
			let operator: string;
			let leftExpr: string;
			let rightExpr: string;

			if (expr.includes("!=")) {
				const parts = expr.split("!=");
				operator = "!=";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else if (expr.includes("<=")) {
				const parts = expr.split("<=");
				operator = "<=";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else if (expr.includes(">=")) {
				const parts = expr.split(">=");
				operator = ">=";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else if (expr.includes("=")) {
				const parts = expr.split("=");
				operator = "=";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else if (expr.includes("<")) {
				const parts = expr.split("<");
				operator = "<";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else if (expr.includes(">")) {
				const parts = expr.split(">");
				operator = ">";
				leftExpr = parts[0].trim();
				rightExpr = parts[1].trim();
			} else {
				return false;
			}

			const leftValue = this.evaluateExpression(leftExpr, element, position, candidates);
			const rightValue = this.evaluateExpression(rightExpr, element, position, candidates);

			return this.compareValues(leftValue, rightValue, operator);
		}

		// Boolean literals
		if (expr === "true()") {
			return true;
		}
		if (expr === "false()") {
			return false;
		}

		// boolean() function
		if (expr.startsWith("boolean(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(8, expr.length - 1).trim();
			if (!innerExpr) return false;
			const value = this.evaluateExpression(innerExpr, element, position, candidates);
			// XPath boolean conversion: empty string is false, non-empty string is true (even "0")
			// NaN is also false in XPath
			return value !== "" && value !== "NaN";
		}

		// Function calls
		if (expr.includes("(")) {
			const result = this.evaluateFunction(expr, [element]);
			return result.length > 0;
		}

		// Attribute existence
		if (expr.startsWith("@")) {
			const attrName = expr.substring(1);
			return element.attributes[attrName] !== undefined;
		}

		// Child element existence
		return element.children.some(child => this.matchesNodeTest(child, expr));
	}

	/**
	 * Evaluate comparison expression
	 */
	private evaluateComparison(expr: string, candidates: DynamicElement[]): DynamicElement[] {
		// Find operator
		let operator: string;
		let leftExpr: string;
		let rightExpr: string;

		if (expr.includes("!=")) {
			const parts = expr.split("!=");
			operator = "!=";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else if (expr.includes("<=")) {
			const parts = expr.split("<=");
			operator = "<=";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else if (expr.includes(">=")) {
			const parts = expr.split(">=");
			operator = ">=";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else if (expr.includes("=")) {
			const parts = expr.split("=");
			operator = "=";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else if (expr.includes("<")) {
			const parts = expr.split("<");
			operator = "<";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else if (expr.includes(">")) {
			const parts = expr.split(">");
			operator = ">";
			leftExpr = parts[0].trim();
			rightExpr = parts[1].trim();
		} else {
			return candidates;
		}

		return candidates.filter((el, index) => {
			const leftValue = this.evaluateExpression(leftExpr, el, index + 1, candidates);
			const rightValue = this.evaluateExpression(rightExpr, el, index + 1, candidates);

			return this.compareValues(leftValue, rightValue, operator);
		});
	}

	/**
	 * Evaluate an expression in context of an element
	 */
	private evaluateExpression(
		expr: string,
		element: DynamicElement,
		position = 1,
		candidates: DynamicElement[] = []
	): string {
		// Handle arithmetic operations
		const arithmeticResult = this.evaluateArithmetic(expr, element, position, candidates);
		if (arithmeticResult !== null) {
			return arithmeticResult;
		}

		// String literal
		if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
			return expr.substring(1, expr.length - 1);
		}

		// position() function
		if (expr === "position()") {
			return position.toString();
		}

		// last() function
		if (expr === "last()") {
			return candidates.length.toString();
		}

		// Attribute value
		if (expr.startsWith("@")) {
			const attrName = expr.substring(1);
			return element.attributes[attrName] || "";
		}

		// text() function
		if (expr === "text()") {
			return element.text || "";
		}

		// name() function
		if (expr === "name()") {
			return element.qualifiedName || element.name;
		}

		// local-name() function
		if (expr === "local-name()") {
			return element.localName || element.name;
		}

		// count(path) function
		if (expr.startsWith("count(") && expr.endsWith(")")) {
			const path = expr.substring(6, expr.length - 1);
			const matches = this.evaluatePath(path, [element], false);
			return matches.length.toString();
		}

		// sum(path) function
		if (expr.startsWith("sum(") && expr.endsWith(")")) {
			const innerPath = expr.substring(4, expr.length - 1).trim();
			let sum = 0;

			// Check if path ends with attribute selector
			const attrMatch = innerPath.match(/(.*)\/@([^/]+)$/);
			if (attrMatch) {
				// It's an attribute path like "item/@price"
				const elementPath = attrMatch[1] || ".";
				const attrName = attrMatch[2];
				const matches = this.evaluatePath(elementPath, [element], false);
				for (const match of matches) {
					const attrValue = match.attributes[attrName];
					if (attrValue !== undefined) {
						const value = parseFloat(attrValue);
						if (!Number.isNaN(value)) {
							sum += value;
						}
					}
				}
			} else {
				// Regular element path
				const matches = this.evaluatePath(innerPath, [element], false);
				for (const match of matches) {
					const value = parseFloat(match.text || "0");
					if (!Number.isNaN(value)) {
						sum += value;
					}
				}
			}
			return sum.toString();
		}

		// string-length() function
		if (expr.startsWith("string-length(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(14, expr.length - 1);
			const value = innerExpr ? this.evaluateExpression(innerExpr, element, position, candidates) : element.text || "";
			return value.length.toString();
		}

		// normalize-space() function
		if (expr.startsWith("normalize-space(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(16, expr.length - 1);
			const value = innerExpr ? this.evaluateExpression(innerExpr, element, position, candidates) : element.text || "";
			return value.trim().replace(/\s+/g, " ");
		}

		// substring() function
		if (expr.startsWith("substring(") && expr.endsWith(")")) {
			return this.evaluateSubstring(expr, element, position, candidates);
		}

		// concat() function
		if (expr.startsWith("concat(") && expr.endsWith(")")) {
			return this.evaluateConcat(expr, element, position, candidates);
		}

		// translate() function
		if (expr.startsWith("translate(") && expr.endsWith(")")) {
			return this.evaluateTranslate(expr, element, position, candidates);
		}

		// substring-before() function
		if (expr.startsWith("substring-before(") && expr.endsWith(")")) {
			return this.evaluateSubstringBefore(expr, element, position, candidates);
		}

		// substring-after() function
		if (expr.startsWith("substring-after(") && expr.endsWith(")")) {
			return this.evaluateSubstringAfter(expr, element, position, candidates);
		}

		// number() function
		if (expr.startsWith("number(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(7, expr.length - 1);
			const value = innerExpr ? this.evaluateExpression(innerExpr, element, position, candidates) : element.text || "0";
			return parseFloat(value).toString();
		}

		// round() function
		if (expr.startsWith("round(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(6, expr.length - 1);
			const value = parseFloat(this.evaluateExpression(innerExpr, element, position, candidates));
			return Math.round(value).toString();
		}

		// floor() function
		if (expr.startsWith("floor(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(6, expr.length - 1);
			const value = parseFloat(this.evaluateExpression(innerExpr, element, position, candidates));
			return Math.floor(value).toString();
		}

		// ceiling() function
		if (expr.startsWith("ceiling(") && expr.endsWith(")")) {
			const innerExpr = expr.substring(8, expr.length - 1);
			const value = parseFloat(this.evaluateExpression(innerExpr, element, position, candidates));
			return Math.ceil(value).toString();
		}

		// Child element text
		const child = element.children.find(c => this.matchesNodeTest(c, expr));
		if (child) {
			return child.text || "";
		}

		// Literal value
		return expr;
	}

	/**
	 * Evaluate arithmetic expressions (+, -, *, div, mod)
	 */
	private evaluateArithmetic(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string | null {
		// Don't apply arithmetic to string literals
		if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
			return null;
		}

		// Don't apply arithmetic to standalone function calls (but allow functions in arithmetic expressions)
		// Check if entire expression is just a function call with balanced parens
		if (expr.match(/^[a-z-]+\(/i) && expr.endsWith(")")) {
			// Count parentheses to see if it's a complete function call
			let depth = 0;
			let hasOtherContent = false;
			for (let i = 0; i < expr.length; i++) {
				if (expr[i] === "(") depth++;
				else if (expr[i] === ")") {
					depth--;
					if (depth === 0 && i < expr.length - 1) {
						hasOtherContent = true;
						break;
					}
				}
			}
			if (!hasOtherContent && depth === 0) {
				return null; // It's a standalone function call
			}
		}

		// Check for arithmetic operators (lowest to highest precedence)
		const operators = [
			{ op: "+", fn: (a: number, b: number) => a + b },
			{ op: "-", fn: (a: number, b: number) => a - b },
		];

		// Handle addition and subtraction (left to right)
		for (const { op, fn } of operators) {
			const parts = this.splitByArithmeticOperator(expr, op);
			if (parts.length > 1) {
				let result = parseFloat(this.evaluateExpression(parts[0], element, position, candidates));
				for (let i = 1; i < parts.length; i++) {
					const value = parseFloat(this.evaluateExpression(parts[i], element, position, candidates));
					result = fn(result, value);
				}
				return result.toString();
			}
		}

		// Handle multiplication, division, and modulo (higher precedence)
		const highPrecOps = [
			{ pattern: /\*/, op: "*", fn: (a: number, b: number) => a * b },
			{ pattern: /\bdiv\b/, op: "div", fn: (a: number, b: number) => a / b },
			{ pattern: /\bmod\b/, op: "mod", fn: (a: number, b: number) => a % b },
		];

		for (const { pattern, op, fn } of highPrecOps) {
			if (pattern.test(expr)) {
				const parts = this.splitByArithmeticOperator(expr, op);
				if (parts.length > 1) {
					let result = parseFloat(this.evaluateExpression(parts[0], element, position, candidates));
					for (let i = 1; i < parts.length; i++) {
						const value = parseFloat(this.evaluateExpression(parts[i], element, position, candidates));
						result = fn(result, value);
					}
					return result.toString();
				}
			}
		}

		return null; // Not an arithmetic expression
	}

	/**
	 * Split expression by arithmetic operator, respecting parentheses and string literals
	 */
	private splitByArithmeticOperator(expr: string, operator: string): string[] {
		const parts: string[] = [];
		let current = "";
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < expr.length; i++) {
			const char = expr[i];

			if ((char === '"' || char === "'") && (i === 0 || expr[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
				current += char;
			} else if (char === "(" && !inString) {
				depth++;
				current += char;
			} else if (char === ")" && !inString) {
				depth--;
				current += char;
			} else if (depth === 0 && !inString) {
				// Check if we're at the operator
				const remaining = expr.substring(i);
				if (operator === "div" || operator === "mod") {
					// Word operators need word boundaries
					const operatorPattern = new RegExp(`^\\b${operator}\\b`);
					if (operatorPattern.test(remaining)) {
						parts.push(current.trim());
						current = "";
						i += operator.length - 1;
						continue;
					}
				} else if (char === operator) {
					// Single character operators
					parts.push(current.trim());
					current = "";
					continue;
				}
				current += char;
			} else {
				current += char;
			}
		}

		if (current.trim()) {
			parts.push(current.trim());
		}

		return parts.length > 1 ? parts : [expr];
	}

	/**
	 * Compare two values with operator
	 */
	private compareValues(left: string, right: string, operator: string): boolean {
		// Try numeric comparison if both are numbers
		const leftNum = parseFloat(left);
		const rightNum = parseFloat(right);
		const bothNumeric = !Number.isNaN(leftNum) && !Number.isNaN(rightNum);

		switch (operator) {
			case "=":
				return left === right;
			case "!=":
				return left !== right;
			case "<":
				return bothNumeric ? leftNum < rightNum : left < right;
			case ">":
				return bothNumeric ? leftNum > rightNum : left > right;
			case "<=":
				return bothNumeric ? leftNum <= rightNum : left <= right;
			case ">=":
				return bothNumeric ? leftNum >= rightNum : left >= right;
			default:
				return false;
		}
	}

	/**
	 * Evaluate function call
	 */
	private evaluateFunction(expr: string, candidates: DynamicElement[]): DynamicElement[] {
		// position() = N
		if (expr.startsWith("position()")) {
			const match = expr.match(/position\(\)\s*=\s*(\d+)/);
			if (match) {
				const position = parseInt(match[1], 10);
				return position > 0 && position <= candidates.length ? [candidates[position - 1]] : [];
			}
		}

		// count(path) = N
		if (expr.startsWith("count(")) {
			const match = expr.match(/count\(([^)]+)\)\s*=\s*(\d+)/);
			if (match) {
				const path = match[1];
				const expectedCount = parseInt(match[2], 10);

				return candidates.filter(el => {
					const matches = this.evaluatePath(path, [el]);
					return matches.length === expectedCount;
				});
			}
		}

		// text() = 'value'
		if (expr.startsWith("text()")) {
			const match = expr.match(/text\(\)\s*=\s*['"]([^'"]+)['"]/);
			if (match) {
				const value = match[1];
				return candidates.filter(el => el.text === value);
			}
		}

		// contains() function
		if (expr.startsWith("contains(")) {
			return candidates.filter(el => {
				return this.evaluateContains(expr, el, 1, candidates);
			});
		}

		// starts-with() function
		if (expr.startsWith("starts-with(")) {
			return candidates.filter(el => {
				return this.evaluateStartsWith(expr, el, 1, candidates);
			});
		}

		// string-length() comparison
		if (expr.startsWith("string-length(")) {
			return candidates.filter(el => {
				const result = this.evaluateComparison(expr, [el]);
				return result.length > 0;
			});
		}

		// normalize-space() comparison
		if (expr.startsWith("normalize-space(")) {
			return candidates.filter(el => {
				const result = this.evaluateComparison(expr, [el]);
				return result.length > 0;
			});
		}

		return candidates;
	}

	/**
	 * Evaluate substring() function
	 */
	private evaluateSubstring(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string {
		const argsStr = expr.substring(10, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = this.evaluateExpression(args[0], element, position, candidates);
		const start = parseInt(this.evaluateExpression(args[1], element, position, candidates), 10);

		// XPath substring is 1-indexed
		if (args.length === 2) {
			return str.substring(start - 1);
		}

		const length = parseInt(this.evaluateExpression(args[2], element, position, candidates), 10);
		return str.substring(start - 1, start - 1 + length);
	}

	/**
	 * Evaluate concat() function
	 */
	private evaluateConcat(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string {
		const argsStr = expr.substring(7, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		return args.map(arg => this.evaluateExpression(arg, element, position, candidates)).join("");
	}

	/**
	 * Evaluate translate() function
	 */
	private evaluateTranslate(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string {
		const argsStr = expr.substring(10, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 3) {
			return "";
		}

		const str = this.evaluateExpression(args[0], element, position, candidates);
		const fromChars = this.evaluateExpression(args[1], element, position, candidates);
		const toChars = this.evaluateExpression(args[2], element, position, candidates);

		let result = str;
		for (let i = 0; i < fromChars.length; i++) {
			const fromChar = fromChars[i];
			const toChar = i < toChars.length ? toChars[i] : "";
			result = result.split(fromChar).join(toChar);
		}

		return result;
	}

	/**
	 * Evaluate substring-before() function
	 */
	private evaluateSubstringBefore(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string {
		const argsStr = expr.substring(17, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = this.evaluateExpression(args[0], element, position, candidates);
		const delimiter = this.evaluateExpression(args[1], element, position, candidates);

		const index = str.indexOf(delimiter);
		if (index === -1) {
			return "";
		}
		return str.substring(0, index);
	}

	/**
	 * Evaluate substring-after() function
	 */
	private evaluateSubstringAfter(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): string {
		const argsStr = expr.substring(16, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = this.evaluateExpression(args[0], element, position, candidates);
		const delimiter = this.evaluateExpression(args[1], element, position, candidates);

		const index = str.indexOf(delimiter);
		if (index === -1) {
			return "";
		}
		return str.substring(index + delimiter.length);
	}

	/**
	 * Evaluate contains() function
	 */
	private evaluateContains(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): boolean {
		const argsStr = expr.substring(9, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return false;
		}

		const haystack = this.evaluateExpression(args[0], element, position, candidates);
		const needle = this.evaluateExpression(args[1], element, position, candidates);

		return haystack.includes(needle);
	}

	/**
	 * Evaluate starts-with() function
	 */
	private evaluateStartsWith(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[]
	): boolean {
		const argsStr = expr.substring(12, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return false;
		}

		const str = this.evaluateExpression(args[0], element, position, candidates);
		const prefix = this.evaluateExpression(args[1], element, position, candidates);

		return str.startsWith(prefix);
	}

	/**
	 * Parse function arguments, respecting nested functions and string literals
	 */
	private parseFunctionArgs(argsStr: string): string[] {
		const args: string[] = [];
		let current = "";
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < argsStr.length; i++) {
			const char = argsStr[i];

			if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
				current += char;
			} else if (char === "(" && !inString) {
				depth++;
				current += char;
			} else if (char === ")" && !inString) {
				depth--;
				current += char;
			} else if (char === "," && depth === 0 && !inString) {
				args.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}

		if (current.trim()) {
			args.push(current.trim());
		}

		return args;
	}

	/**
	 * Get all descendants of context elements
	 */
	private getAllDescendants(elements: DynamicElement[]): DynamicElement[] {
		const results: DynamicElement[] = [];
		const seen = new Set<DynamicElement>();

		const collectDescendants = (element: DynamicElement) => {
			if (seen.has(element)) return;
			seen.add(element);
			results.push(element);

			for (const child of element.children) {
				collectDescendants(child);
			}
		};

		for (const element of elements) {
			// Include context element itself for //
			if (!seen.has(element)) {
				seen.add(element);
				results.push(element);
			}
			// Then collect all descendants
			for (const child of element.children) {
				collectDescendants(child);
			}
		}

		return results;
	}
}
