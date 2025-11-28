import type { DynamicElement } from "./dynamic-element";
import { XPathFunctionEvaluator } from "./xpath-function-evaluator";

/**
 * Evaluates XPath expressions (values, functions, arithmetic operations)
 */
export class XPathExpressionEvaluator {
	private functionEvaluator = new XPathFunctionEvaluator();

	constructor(private matchesNodeTestFn: (element: DynamicElement, nodeTest: string) => boolean) {}

	/**
	 * Evaluate an expression in context of an element
	 */
	evaluateExpression(
		expr: string,
		element: DynamicElement,
		position = 1,
		candidates: DynamicElement[] = [],
		evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[]
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
			return element.name;
		}

		// local-name() function
		if (expr === "local-name()") {
			return element.localName || element.name;
		}

		// count(path) function
		if (expr.startsWith("count(") && expr.endsWith(")")) {
			const path = expr.substring(6, expr.length - 1);
			if (!evaluatePathFn) {
				throw new Error(
					`Internal error: count() function requires path evaluation capability\n` +
						`Expression: ${expr}\n` +
						`This is likely a bug in the XPath evaluator configuration.`
				);
			}
			const matches = evaluatePathFn(path, [element], false);
			return matches.length.toString();
		}

		// sum(path) function
		if (expr.startsWith("sum(") && expr.endsWith(")")) {
			return this.evaluateSum(expr, element, evaluatePathFn);
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
			return this.functionEvaluator.evaluateSubstring(
				expr,
				element,
				position,
				candidates,
				this.evaluateExpression.bind(this)
			);
		}

		// concat() function
		if (expr.startsWith("concat(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateConcat(
				expr,
				element,
				position,
				candidates,
				this.evaluateExpression.bind(this)
			);
		}

		// translate() function
		if (expr.startsWith("translate(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateTranslate(
				expr,
				element,
				position,
				candidates,
				this.evaluateExpression.bind(this)
			);
		}

		// substring-before() function
		if (expr.startsWith("substring-before(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateSubstringBefore(
				expr,
				element,
				position,
				candidates,
				this.evaluateExpression.bind(this)
			);
		}

		// substring-after() function
		if (expr.startsWith("substring-after(") && expr.endsWith(")")) {
			return this.functionEvaluator.evaluateSubstringAfter(
				expr,
				element,
				position,
				candidates,
				this.evaluateExpression.bind(this)
			);
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
		const child = element.children.find(c => this.matchesNodeTestFn(c, expr));
		if (child) {
			return child.text || "";
		}

		// Literal value
		return expr;
	}

	/**
	 * Evaluate sum(path) function
	 */
	private evaluateSum(
		expr: string,
		element: DynamicElement,
		evaluatePathFn?: (path: string, contextElements: DynamicElement[], matchSelfFirst?: boolean) => DynamicElement[]
	): string {
		const innerPath = expr.substring(4, expr.length - 1).trim();
		let sum = 0;

		if (!evaluatePathFn) {
			throw new Error(
				`Internal error: sum() function requires path evaluation capability\n` +
					`Expression: ${expr}\n` +
					`This is likely a bug in the XPath evaluator configuration.`
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
				const value = parseFloat(match.text || "0");
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
