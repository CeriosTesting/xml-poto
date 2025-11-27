import type { DynamicElement } from "./dynamic-element";
import { XPathExpressionEvaluator } from "./xpath-expression-evaluator";
import { XPathFunctionEvaluator } from "./xpath-function-evaluator";

/**
 * Evaluates XPath predicates (filters in square brackets)
 */
export class XPathPredicateEvaluator {
	private functionEvaluator = new XPathFunctionEvaluator();
	private expressionEvaluator: XPathExpressionEvaluator;

	constructor(
		private matchesNodeTestFn: (element: DynamicElement, nodeTest: string) => boolean,
		private evaluatePathFn?: (
			path: string,
			contextElements: DynamicElement[],
			matchSelfFirst?: boolean
		) => DynamicElement[]
	) {
		this.expressionEvaluator = new XPathExpressionEvaluator(matchesNodeTestFn);
	}

	/**
	 * Apply predicate filter
	 */
	applyPredicate(predicate: string, candidates: DynamicElement[]): DynamicElement[] {
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

		// Attribute existence - CRITICAL BUG FIX: Must exclude all comparison operators
		// Check for comparison operators (=, !=, <, >, <=, >=)
		if (inner.startsWith("@") && !inner.includes("=") && !inner.includes("!") && !inner.match(/[<>]/)) {
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
			return el.children.some(child => this.matchesNodeTestFn(child, inner));
		});
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
	evaluateBooleanCondition(
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

			const leftValue = this.expressionEvaluator.evaluateExpression(
				leftExpr,
				element,
				position,
				candidates,
				this.evaluatePathFn
			);
			const rightValue = this.expressionEvaluator.evaluateExpression(
				rightExpr,
				element,
				position,
				candidates,
				this.evaluatePathFn
			);

			return this.expressionEvaluator.compareValues(leftValue, rightValue, operator);
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
			const value = this.expressionEvaluator.evaluateExpression(
				innerExpr,
				element,
				position,
				candidates,
				this.evaluatePathFn
			);
			// XPath boolean conversion: empty string is false, non-empty string is true (even "0")
			// NaN is also false in XPath
			return value !== "" && value !== "NaN";
		}

		// starts-with() function
		if (expr.startsWith("starts-with(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateStartsWith(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
			);
		}

		// ends-with() function
		if (expr.startsWith("ends-with(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateEndsWith(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
			);
		}

		// lang() function
		if (expr.startsWith("lang(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateLang(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
			);
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
		return element.children.some(child => this.matchesNodeTestFn(child, expr));
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
			const leftValue = this.expressionEvaluator.evaluateExpression(
				leftExpr,
				el,
				index + 1,
				candidates,
				this.evaluatePathFn
			);
			const rightValue = this.expressionEvaluator.evaluateExpression(
				rightExpr,
				el,
				index + 1,
				candidates,
				this.evaluatePathFn
			);

			return this.expressionEvaluator.compareValues(leftValue, rightValue, operator);
		});
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
				// This requires evaluatePath which we don't have here
				// We'll leave this for the main evaluator to handle
				return candidates;
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
				return this.functionEvaluator.evaluateContains(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
				);
			});
		}

		// starts-with() function
		if (expr.startsWith("starts-with(")) {
			return candidates.filter(el => {
				return this.functionEvaluator.evaluateStartsWith(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
				);
			});
		}

		// ends-with() function
		if (expr.startsWith("ends-with(")) {
			return candidates.filter(el => {
				return this.functionEvaluator.evaluateEndsWith(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
				);
			});
		}

		// lang() function
		if (expr.startsWith("lang(")) {
			return candidates.filter(el => {
				return this.functionEvaluator.evaluateLang(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator)
				);
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
}
