import type { DynamicElement } from "./dynamic-element";

/**
 * Evaluates XPath functions (string, numeric, and boolean functions)
 */
export class XPathFunctionEvaluator {
	/**
	 * Parse function arguments, respecting nested functions and string literals
	 */
	parseFunctionArgs(argsStr: string): string[] {
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
	 * Evaluate substring() function
	 */
	evaluateSubstring(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): string {
		const argsStr = expr.substring(10, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const start = parseInt(evaluateExpressionFn(args[1], element, position, candidates), 10);

		// XPath substring is 1-indexed
		if (args.length === 2) {
			return str.substring(start - 1);
		}

		const length = parseInt(evaluateExpressionFn(args[2], element, position, candidates), 10);
		return str.substring(start - 1, start - 1 + length);
	}

	/**
	 * Evaluate concat() function
	 */
	evaluateConcat(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): string {
		const argsStr = expr.substring(7, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		return args.map(arg => evaluateExpressionFn(arg, element, position, candidates)).join("");
	}

	/**
	 * Evaluate translate() function
	 */
	evaluateTranslate(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): string {
		const argsStr = expr.substring(10, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 3) {
			return "";
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const fromChars = evaluateExpressionFn(args[1], element, position, candidates);
		const toChars = evaluateExpressionFn(args[2], element, position, candidates);

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
	evaluateSubstringBefore(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): string {
		const argsStr = expr.substring(17, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const delimiter = evaluateExpressionFn(args[1], element, position, candidates);

		const index = str.indexOf(delimiter);
		if (index === -1) {
			return "";
		}
		return str.substring(0, index);
	}

	/**
	 * Evaluate substring-after() function
	 */
	evaluateSubstringAfter(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): string {
		const argsStr = expr.substring(16, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			return "";
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const delimiter = evaluateExpressionFn(args[1], element, position, candidates);

		const index = str.indexOf(delimiter);
		if (index === -1) {
			return "";
		}
		return str.substring(index + delimiter.length);
	}

	/**
	 * Evaluate contains() function
	 */
	evaluateContains(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): boolean {
		const argsStr = expr.substring(9, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			throw new Error(
				`Invalid contains() function: requires 2 arguments but got ${args.length}\n` +
					`Expression: ${expr}\n` +
					`Usage: contains(string, substring)\n` +
					`Example: contains(text(), 'hello')`
			);
		}

		const haystack = evaluateExpressionFn(args[0], element, position, candidates);
		const needle = evaluateExpressionFn(args[1], element, position, candidates);

		return haystack.includes(needle);
	}

	/**
	 * Evaluate starts-with() function
	 */
	evaluateStartsWith(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): boolean {
		const argsStr = expr.substring(12, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			throw new Error(
				`Invalid starts-with() function: requires 2 arguments but got ${args.length}\n` +
					`Expression: ${expr}\n` +
					`Usage: starts-with(string, prefix)\n` +
					`Example: starts-with(@name, 'user')`
			);
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const prefix = evaluateExpressionFn(args[1], element, position, candidates);

		return str.startsWith(prefix);
	}

	/**
	 * Evaluate ends-with() function
	 */
	evaluateEndsWith(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): boolean {
		const argsStr = expr.substring(10, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 2) {
			throw new Error(
				`Invalid ends-with() function: requires 2 arguments but got ${args.length}\n` +
					`Expression: ${expr}\n` +
					`Usage: ends-with(string, suffix)\n` +
					`Example: ends-with(@file, '.xml')`
			);
		}

		const str = evaluateExpressionFn(args[0], element, position, candidates);
		const suffix = evaluateExpressionFn(args[1], element, position, candidates);

		return str.endsWith(suffix);
	}

	/**
	 * Evaluate lang() function - checks xml:lang attribute
	 */
	evaluateLang(
		expr: string,
		element: DynamicElement,
		position: number,
		candidates: DynamicElement[],
		evaluateExpressionFn: (expr: string, el: DynamicElement, pos: number, cands: DynamicElement[]) => string
	): boolean {
		const argsStr = expr.substring(5, expr.length - 1);
		const args = this.parseFunctionArgs(argsStr);

		if (args.length < 1) {
			throw new Error(
				`Invalid lang() function: requires 1 argument but got ${args.length}\n` +
					`Expression: ${expr}\n` +
					`Usage: lang(language-code)\n` +
					`Example: lang('en') or lang('fr-CA')`
			);
		}

		const targetLang = evaluateExpressionFn(args[0], element, position, candidates).toLowerCase();

		// Walk up the tree to find xml:lang attribute
		let current: DynamicElement | undefined = element;
		while (current) {
			const xmlLang = current.attributes["xml:lang"];
			if (xmlLang) {
				const lang = xmlLang.toLowerCase();
				// Match exact or sublanguage (e.g., "en" matches "en-US")
				return lang === targetLang || lang.startsWith(`${targetLang}-`);
			}
			current = current.parent;
		}

		return false;
	}
}
