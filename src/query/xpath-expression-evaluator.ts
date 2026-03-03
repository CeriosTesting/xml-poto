/* eslint-disable typescript/explicit-function-return-type -- Handler arrow functions in functionHandlers array have return types inferred from the typed array */
import type { DynamicElement } from "./dynamic-element";
import { XPathFunctionEvaluator } from "./xpath-function-evaluator";

/**
 * Evaluates XPath expressions (values, functions, arithmetic operations)
 */
export class XPathExpressionEvaluator {
	private functionEvaluator = new XPathFunctionEvaluator();

	/**
	 * Map of function-name prefixes to their evaluation handlers.
	 * Each handler receives (expr, element, position, candidates, evaluatePathFn)
	 * and returns a string result.
	 */
	private readonly functionHandlers: Array<{
		prefix: string;
		handler: (
			expr: string,
			element: DynamicElement,
			position: number,
			candidates: DynamicElement[],
			evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[],
		) => string;
	}>;

	constructor(private matchesNodeTestFn: (element: DynamicElement, nodeTest: string) => boolean) {
		this.functionHandlers = [
			{ prefix: "count(", handler: (expr, el, _p, _c, evalPath) => this.evaluateCount(expr, el, evalPath) },
			{ prefix: "sum(", handler: (expr, el, _p, _c, evalPath) => this.evaluateSum(expr, el, evalPath) },
			{
				prefix: "string-length(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(14, expr.length - 1);
					const value = innerExpr ? this.evaluateExpression(innerExpr, el, pos, cands) : (el.text ?? "");
					return value.length.toString();
				},
			},
			{
				prefix: "normalize-space(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(16, expr.length - 1);
					const value = innerExpr ? this.evaluateExpression(innerExpr, el, pos, cands) : (el.text ?? "");
					return value.trim().replace(/\s+/g, " ");
				},
			},
			{
				prefix: "substring(",
				handler: (expr, el, pos, cands) =>
					this.functionEvaluator.evaluateSubstring(expr, el, pos, cands, this.evaluateExpression.bind(this)),
			},
			{
				prefix: "concat(",
				handler: (expr, el, pos, cands) =>
					this.functionEvaluator.evaluateConcat(expr, el, pos, cands, this.evaluateExpression.bind(this)),
			},
			{
				prefix: "translate(",
				handler: (expr, el, pos, cands) =>
					this.functionEvaluator.evaluateTranslate(expr, el, pos, cands, this.evaluateExpression.bind(this)),
			},
			{
				prefix: "substring-before(",
				handler: (expr, el, pos, cands) =>
					this.functionEvaluator.evaluateSubstringBefore(expr, el, pos, cands, this.evaluateExpression.bind(this)),
			},
			{
				prefix: "substring-after(",
				handler: (expr, el, pos, cands) =>
					this.functionEvaluator.evaluateSubstringAfter(expr, el, pos, cands, this.evaluateExpression.bind(this)),
			},
			{
				prefix: "number(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(7, expr.length - 1);
					const value = innerExpr ? this.evaluateExpression(innerExpr, el, pos, cands) : (el.text ?? "0");
					return parseFloat(value).toString();
				},
			},
			{
				prefix: "round(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(6, expr.length - 1);
					return Math.round(parseFloat(this.evaluateExpression(innerExpr, el, pos, cands))).toString();
				},
			},
			{
				prefix: "floor(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(6, expr.length - 1);
					return Math.floor(parseFloat(this.evaluateExpression(innerExpr, el, pos, cands))).toString();
				},
			},
			{
				prefix: "ceiling(",
				handler: (expr, el, pos, cands) => {
					const innerExpr = expr.substring(8, expr.length - 1);
					return Math.ceil(parseFloat(this.evaluateExpression(innerExpr, el, pos, cands))).toString();
				},
			},
		];
	}

	/**
	 * Evaluate an expression in context of an element
	 */
	evaluateExpression(
		expr: string,
		element: DynamicElement,
		position = 1,
		candidates: DynamicElement[] = [],
		evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[],
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

		// Simple built-in expressions
		const simpleResult = this.evaluateSimpleExpression(expr, element, position, candidates);
		if (simpleResult !== null) {
			return simpleResult;
		}

		// Function-based expressions
		if (expr.endsWith(")")) {
			for (const { prefix, handler } of this.functionHandlers) {
				if (expr.startsWith(prefix)) {
					return handler(expr, element, position, candidates, evaluatePathFn);
				}
			}
		}

		// Child element text
		const child = element.children.find((c) => this.matchesNodeTestFn(c, expr));
		if (child) {
			return child.text ?? "";
		}

		// Literal value
		return expr;
	}

	/**
	 * Evaluate simple non-function expressions (position, last, attribute, text, name).
	 */
	private evaluateSimpleExpression(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): string | null {
		if (expr === "position()") return position.toString();
		if (expr === "last()") return candidates.length.toString();
		if (expr.startsWith("@")) return element.attributes[expr.substring(1)] || "";
		if (expr === "text()") return element.text ?? "";
		if (expr === "name()") return element.name;
		if (expr === "local-name()") return element.localName || element.name;
		return null;
	}

	/**
	 * Evaluate count(path) function
	 */
	private evaluateCount(
		expr: string,
		element: DynamicElement,
		evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[],
	): string {
		const path = expr.substring(6, expr.length - 1);
		if (!evaluatePathFn) {
			throw new Error(
				`Internal error: count() function requires path evaluation capability\n` +
					`Expression: ${expr}\n` +
					`This is likely a bug in the XPath evaluator configuration.`,
			);
		}
		return evaluatePathFn(path, [element], false).length.toString();
	}

	/**
	 * Evaluate sum(path) function
	 */
	private evaluateSum(
		expr: string,
		element: DynamicElement,
		evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[],
	): string {
		const innerPath = expr.substring(4, expr.length - 1).trim();
		let sum = 0;

		if (!evaluatePathFn) {
			throw new Error(
				`Internal error: sum() function requires path evaluation capability\n` +
					`Expression: ${expr}\n` +
					`This is likely a bug in the XPath evaluator configuration.`,
			);
		}

		// Check if path ends with attribute selector
		const attrMatch = innerPath.match(/(.*)\/@([^/]+)$/);
		if (attrMatch) {
			// It's an attribute path like "item/@price"
			const elementPath = attrMatch[1] || ".";
			const attrName = attrMatch[2];
			const matches = evaluatePathFn(elementPath, [element], false);
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
			const matches = evaluatePathFn(innerPath, [element], false);
			for (const match of matches) {
				const value = parseFloat(match.text ?? "0");
				if (!Number.isNaN(value)) {
					sum += value;
				}
			}
		}
		return sum.toString();
	}

	/**
	 * Evaluate arithmetic expressions (+, -, *, div, mod)
	 */
	evaluateArithmetic(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): string | null {
		// Don't apply arithmetic to string literals
		if (this.isStringLiteral(expr)) {
			return null;
		}

		// Don't apply arithmetic to standalone function calls
		if (this.isStandaloneFunctionCall(expr)) {
			return null;
		}

		// Try lower precedence operators first (+ and -)
		const result = this.evaluateLowPrecedenceOps(expr, element, position, candidates);
		if (result !== null) return result;

		// Try higher precedence operators (* div mod)
		return this.evaluateHighPrecedenceOps(expr, element, position, candidates);
	}

	/**
	 * Check if expression is a string literal
	 */
	private isStringLiteral(expr: string): boolean {
		return (expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"));
	}

	/**
	 * Check if expression is a standalone function call
	 */
	private isStandaloneFunctionCall(expr: string): boolean {
		if (!expr.match(/^[a-z-]+\(/i) || !expr.endsWith(")")) {
			return false;
		}

		let depth = 0;
		for (let i = 0; i < expr.length; i++) {
			if (expr[i] === "(") depth++;
			else if (expr[i] === ")") {
				depth--;
				if (depth === 0 && i < expr.length - 1) {
					return false;
				}
			}
		}
		return depth === 0;
	}

	/**
	 * Evaluate lower precedence operators (+ and -)
	 */
	private evaluateLowPrecedenceOps(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): string | null {
		const operators = [
			{ op: "+", fn: (a: number, b: number): number => a + b },
			{ op: "-", fn: (a: number, b: number): number => a - b },
		];

		for (const { op, fn } of operators) {
			const parts = this.splitByArithmeticOperator(expr, op);
			if (parts.length > 1) {
				return this.combineOperandResults(parts, fn, element, position, candidates);
			}
		}

		return null;
	}

	/**
	 * Evaluate higher precedence operators (* div mod)
	 */
	private evaluateHighPrecedenceOps(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): string | null {
		const highPrecOps = [
			{ pattern: /\*/, op: "*", fn: (a: number, b: number): number => a * b },
			{ pattern: /\bdiv\b/, op: "div", fn: (a: number, b: number): number => a / b },
			{ pattern: /\bmod\b/, op: "mod", fn: (a: number, b: number): number => a % b },
		];

		for (const { pattern, op, fn } of highPrecOps) {
			if (!pattern.test(expr)) continue;

			const parts = this.splitByArithmeticOperator(expr, op);
			if (parts.length > 1) {
				return this.combineOperandResults(parts, fn, element, position, candidates);
			}
		}

		return null;
	}

	/**
	 * Combine operand results using operator function
	 */
	private combineOperandResults(
		parts: string[],
		fn: (a: number, b: number) => number,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
	): string {
		let result = parseFloat(this.evaluateExpression(parts[0], element, position, candidates));
		for (let i = 1; i < parts.length; i++) {
			const value = parseFloat(this.evaluateExpression(parts[i], element, position, candidates));
			result = fn(result, value);
		}
		return result.toString();
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
			const prevChar = i > 0 ? expr[i - 1] : "";

			const result = this.processSplitChar(char, prevChar, current, i, expr, operator, depth, inString, stringChar);
			current = result.current;
			depth = result.depth;
			inString = result.inString;
			stringChar = result.stringChar;

			if (result.shouldSplit) {
				parts.push(current.trim());
				current = "";
				if (result.skipChars > 0) {
					i += result.skipChars;
				}
			}
		}

		if (current.trim()) {
			parts.push(current.trim());
		}

		return parts.length > 1 ? parts : [expr];
	}

	/**
	 * Process a single character when splitting by operator
	 */
	private processSplitChar(
		char: string,
		prevChar: string,
		current: string,
		index: number,
		expr: string,
		operator: string,
		depth: number,
		inString: boolean,
		stringChar: string,
	): {
		current: string;
		depth: number;
		inString: boolean;
		stringChar: string;
		shouldSplit: boolean;
		skipChars: number;
	} {
		// Handle string delimiters
		if ((char === '"' || char === "'") && prevChar !== "\\") {
			if (!inString) {
				return { current: current + char, depth, inString: true, stringChar: char, shouldSplit: false, skipChars: 0 };
			}
			if (char === stringChar) {
				return { current: current + char, depth, inString: false, stringChar: "", shouldSplit: false, skipChars: 0 };
			}
		}

		// Handle parentheses (only outside strings)
		if (!inString) {
			if (char === "(") {
				return { current: current + char, depth: depth + 1, inString, stringChar, shouldSplit: false, skipChars: 0 };
			}
			if (char === ")") {
				return { current: current + char, depth: depth - 1, inString, stringChar, shouldSplit: false, skipChars: 0 };
			}

			// Check for operator at depth 0
			if (depth === 0 && this.matchesOperatorAtPosition(expr, index, operator)) {
				return {
					current,
					depth,
					inString,
					stringChar,
					shouldSplit: true,
					skipChars: operator.length - 1,
				};
			}
		}

		return { current: current + char, depth, inString, stringChar, shouldSplit: false, skipChars: 0 };
	}

	/**
	 * Check if operator matches at the given position
	 */
	private matchesOperatorAtPosition(expr: string, index: number, operator: string): boolean {
		if (operator === "div" || operator === "mod") {
			// Word operators need word boundaries
			const operatorPattern = new RegExp(`^\\b${operator}\\b`);
			return operatorPattern.test(expr.substring(index));
		}
		// Single character operators
		return expr[index] === operator;
	}

	/**
	 * Compare two values with operator
	 */
	compareValues(left: string, right: string, operator: string): boolean {
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
}
