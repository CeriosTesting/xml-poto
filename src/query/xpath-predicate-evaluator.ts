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
			matchSelfFirst?: boolean,
		) => DynamicElement[],
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

		// Attribute existence - exclude all comparison operators
		if (this.isAttributeExistence(inner)) {
			const attrName = inner.substring(1);
			return candidates.filter((el) => el.attributes[attrName] !== undefined);
		}

		// Comparison predicates
		if (this.hasComparisonOperator(inner)) {
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
		return candidates.filter((el) => {
			return el.children.some((child) => this.matchesNodeTestFn(child, inner));
		});
	}

	/**
	 * Check if expression is a pure attribute existence test (no comparison operators).
	 */
	private isAttributeExistence(expr: string): boolean {
		return expr.startsWith("@") && !expr.includes("=") && !expr.includes("!") && !/[<>]/.test(expr);
	}

	/**
	 * Check if expression contains comparison operators.
	 */
	private hasComparisonOperator(expr: string): boolean {
		return expr.includes("=") || expr.includes("!=") || expr.includes("<") || expr.includes(">");
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
		candidates: DynamicElement[],
	): boolean {
		// Handle 'or' operator (lower precedence)
		const orParts = this.splitByOperator(expr, "or");
		if (orParts.length > 1) {
			return orParts.some((part) => this.evaluateBooleanCondition(part.trim(), element, position, candidates));
		}

		// Handle 'and' operator (higher precedence)
		const andParts = this.splitByOperator(expr, "and");
		if (andParts.length > 1) {
			return andParts.every((part) => this.evaluateBooleanCondition(part.trim(), element, position, candidates));
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

			const stringState = this.updateStringState(char, i === 0 ? "" : expr[i - 1], inString, stringChar);
			inString = stringState.inString;
			stringChar = stringState.stringChar;

			if (char === "(" && !inString) {
				depth++;
			} else if (char === ")" && !inString) {
				depth--;
			}

			if (depth === 0 && !inString && this.matchesWordOperator(expr, i, operator)) {
				parts.push(current);
				current = "";
				i += operator.length - 1;
				while (i + 1 < expr.length && expr[i + 1] === " ") {
					i++;
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
	 * Update string-tracking state for a character.
	 */
	private updateStringState(
		char: string,
		prevChar: string,
		inString: boolean,
		stringChar: string,
	): { inString: boolean; stringChar: string } {
		if ((char === '"' || char === "'") && prevChar !== "\\") {
			if (!inString) {
				return { inString: true, stringChar: char };
			}
			if (char === stringChar) {
				return { inString: false, stringChar: "" };
			}
		}
		return { inString, stringChar };
	}

	/**
	 * Check if a word-boundary operator matches at the given position.
	 */
	private matchesWordOperator(expr: string, index: number, operator: string): boolean {
		const remaining = expr.substring(index);
		const operatorPattern = new RegExp(`^\\b${operator}\\b`);
		return operatorPattern.test(remaining);
	}

	/**
	 * Parse a comparison expression into its operator, left, and right parts.
	 * Returns null if no comparison operator is found.
	 */
	private parseComparison(expr: string): { operator: string; leftExpr: string; rightExpr: string } | null {
		// Order matters: check multi-char operators first
		const operators = ["!=", "<=", ">=", "=", "<", ">"];
		for (const op of operators) {
			if (expr.includes(op)) {
				const parts = expr.split(op);
				return { operator: op, leftExpr: parts[0].trim(), rightExpr: parts[1].trim() };
			}
		}
		return null;
	}

	/**
	 * Evaluate a base condition (comparison, function, etc.)
	 */
	private evaluateBaseCondition(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): boolean {
		// Comparison operators
		const comparison = this.parseComparison(expr);
		if (comparison) {
			const leftValue = this.expressionEvaluator.evaluateExpression(
				comparison.leftExpr,
				element,
				position,
				candidates,
				this.evaluatePathFn,
			);
			const rightValue = this.expressionEvaluator.evaluateExpression(
				comparison.rightExpr,
				element,
				position,
				candidates,
				this.evaluatePathFn,
			);
			return this.expressionEvaluator.compareValues(leftValue, rightValue, comparison.operator);
		}

		// Boolean literals
		if (expr === "true()") return true;
		if (expr === "false()") return false;

		// boolean() function
		if (expr.startsWith("boolean(") && expr.endsWith(")")) {
			return this.evaluateBooleanFunction(expr, element, position, candidates);
		}

		// Delegated function evaluations
		if (expr.startsWith("starts-with(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateStartsWith(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
			);
		}
		if (expr.startsWith("ends-with(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateEndsWith(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
			);
		}
		if (expr.startsWith("lang(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateLang(
				expr,
				element,
				position,
				candidates,
				this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
			);
		}

		// Function calls
		if (expr.includes("(")) {
			return this.evaluateFunction(expr, [element]).length > 0;
		}

		// Attribute existence
		if (expr.startsWith("@")) {
			return element.attributes[expr.substring(1)] !== undefined;
		}

		// Child element existence
		return element.children.some((child) => this.matchesNodeTestFn(child, expr));
	}

	/**
	 * Evaluate the boolean() XPath function.
	 */
	private evaluateBooleanFunction(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): boolean {
		const innerExpr = expr.substring(8, expr.length - 1).trim();
		if (!innerExpr) return false;
		const value = this.expressionEvaluator.evaluateExpression(
			innerExpr,
			element,
			position,
			candidates,
			this.evaluatePathFn,
		);
		return value !== "" && value !== "NaN";
	}

	/**
	 * Evaluate comparison expression
	 */
	private evaluateComparison(expr: string, candidates: DynamicElement[]): DynamicElement[] {
		const comparison = this.parseComparison(expr);
		if (!comparison) return candidates;

		const { operator, leftExpr, rightExpr } = comparison;

		return candidates.filter((el, index) => {
			const leftValue = this.expressionEvaluator.evaluateExpression(
				leftExpr,
				el,
				index + 1,
				candidates,
				this.evaluatePathFn,
			);
			const rightValue = this.expressionEvaluator.evaluateExpression(
				rightExpr,
				el,
				index + 1,
				candidates,
				this.evaluatePathFn,
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
				return candidates.filter((el) => el.text === value);
			}
		}

		// contains() function
		if (expr.startsWith("contains(")) {
			return candidates.filter((el) => {
				return this.functionEvaluator.evaluateContains(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
				);
			});
		}

		// starts-with() function
		if (expr.startsWith("starts-with(")) {
			return candidates.filter((el) => {
				return this.functionEvaluator.evaluateStartsWith(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
				);
			});
		}

		// ends-with() function
		if (expr.startsWith("ends-with(")) {
			return candidates.filter((el) => {
				return this.functionEvaluator.evaluateEndsWith(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
				);
			});
		}

		// lang() function
		if (expr.startsWith("lang(")) {
			return candidates.filter((el) => {
				return this.functionEvaluator.evaluateLang(
					expr,
					el,
					1,
					candidates,
					this.expressionEvaluator.evaluateExpression.bind(this.expressionEvaluator),
				);
			});
		}

		// string-length() comparison
		if (expr.startsWith("string-length(")) {
			return candidates.filter((el) => {
				const result = this.evaluateComparison(expr, [el]);
				return result.length > 0;
			});
		}

		// normalize-space() comparison
		if (expr.startsWith("normalize-space(")) {
			return candidates.filter((el) => {
				const result = this.evaluateComparison(expr, [el]);
				return result.length > 0;
			});
		}

		return candidates;
	}
}
