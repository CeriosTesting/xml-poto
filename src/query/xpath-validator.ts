/**
 * Validates XPath expression syntax
 */
export class XPathValidator {
	/**
	 * Create a context snippet showing the error location
	 */
	private createContextSnippet(xpath: string, position: number, length = 1): string {
		const start = Math.max(0, position - 20);
		const end = Math.min(xpath.length, position + 20);
		const snippet = xpath.substring(start, end);
		const caretPos = position - start;
		const caret = " ".repeat(caretPos) + "^".repeat(length);

		const prefix = start > 0 ? "..." : "";
		const suffix = end < xpath.length ? "..." : "";

		return `${prefix}${snippet}${suffix}\n${" ".repeat(prefix.length)}${caret}`;
	}

	/**
	 * Validate XPath expression syntax
	 * @throws {Error} If XPath is malformed with specific error message
	 */
	validate(xpath: string): void {
		// Check for balanced quotes first (most specific)
		const quoteCheck = this.checkBalancedQuotes(xpath);
		if (!quoteCheck.valid) {
			const context = this.createContextSnippet(xpath, quoteCheck.position);
			throw new Error(`Invalid XPath: ${quoteCheck.message}\n${context}\nPosition: ${quoteCheck.position}`);
		}

		// Check for balanced parentheses
		const parenCheck = this.checkBalancedParentheses(xpath);
		if (!parenCheck.valid) {
			const context = this.createContextSnippet(xpath, parenCheck.position);
			throw new Error(`Invalid XPath: ${parenCheck.message}\n${context}\nPosition: ${parenCheck.position}`);
		}

		// Check for balanced brackets
		const bracketCheck = this.checkBalancedBrackets(xpath);
		if (!bracketCheck.valid) {
			const context = this.createContextSnippet(xpath, bracketCheck.position);
			throw new Error(`Invalid XPath: ${bracketCheck.message}\n${context}\nPosition: ${bracketCheck.position}`);
		}

		// Check for invalid operators
		if (/&&/.test(xpath)) {
			const pos = xpath.search(/&&/);
			const context = this.createContextSnippet(xpath, pos, 2);
			throw new Error(
				`Invalid XPath: Use 'and' instead of '&&'\n${context}\nPosition: ${pos}\nSuggestion: Replace '&&' with ' and '`
			);
		}
		if (/\|\|/.test(xpath)) {
			const pos = xpath.search(/\|\|/);
			const context = this.createContextSnippet(xpath, pos, 2);
			throw new Error(
				`Invalid XPath: Use 'or' instead of '||'\n${context}\nPosition: ${pos}\nSuggestion: Replace '||' with ' or '`
			);
		}

		// Check for empty predicates
		if (/\[\s*\]/.test(xpath)) {
			const match = xpath.match(/\[\s*\]/);
			if (match && match.index !== undefined) {
				const pos = match.index;
				const context = this.createContextSnippet(xpath, pos, 2);
				throw new Error(
					`Invalid XPath: Empty predicate '[]' is not allowed\n${context}\nPosition: ${pos}\nSuggestion: Remove the empty predicate or add a condition like [1] or [@attr]`
				);
			}
		}
	}

	/**
	 * Check for balanced brackets in XPath expression
	 */
	private checkBalancedBrackets(xpath: string): { valid: boolean; position: number; message: string } {
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < xpath.length; i++) {
			const char = xpath[i];

			if ((char === '"' || char === "'") && (i === 0 || xpath[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			} else if (!inString) {
				if (char === "[") {
					depth++;
				} else if (char === "]") {
					depth--;
					if (depth < 0) {
						return {
							valid: false,
							position: i,
							message: "Unexpected closing bracket ']'",
						};
					}
				}
			}
		}

		if (depth > 0) {
			return {
				valid: false,
				position: xpath.length,
				message: `Missing closing bracket ']', expected ${depth} more`,
			};
		}

		return { valid: true, position: -1, message: "" };
	}

	/**
	 * Check for balanced parentheses in XPath expression
	 */
	private checkBalancedParentheses(xpath: string): { valid: boolean; position: number; message: string } {
		let depth = 0;
		let inString = false;
		let stringChar = "";

		for (let i = 0; i < xpath.length; i++) {
			const char = xpath[i];

			if ((char === '"' || char === "'") && (i === 0 || xpath[i - 1] !== "\\")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar) {
					inString = false;
				}
			} else if (!inString) {
				if (char === "(") {
					depth++;
				} else if (char === ")") {
					depth--;
					if (depth < 0) {
						return {
							valid: false,
							position: i,
							message: "Unexpected closing parenthesis ')'",
						};
					}
				}
			}
		}

		if (depth > 0) {
			return {
				valid: false,
				position: xpath.length,
				message: `Missing closing parenthesis ')', expected ${depth} more`,
			};
		}

		return { valid: true, position: -1, message: "" };
	}

	/**
	 * Check for balanced quotes in XPath expression
	 */
	private checkBalancedQuotes(xpath: string): { valid: boolean; position: number; message: string } {
		let inDoubleQuote = false;
		let inSingleQuote = false;
		let doubleQuoteStart = -1;
		let singleQuoteStart = -1;

		for (let i = 0; i < xpath.length; i++) {
			const char = xpath[i];

			if (char === '"' && (i === 0 || xpath[i - 1] !== "\\")) {
				if (!inSingleQuote) {
					if (inDoubleQuote) {
						inDoubleQuote = false;
					} else {
						inDoubleQuote = true;
						doubleQuoteStart = i;
					}
				}
			} else if (char === "'" && (i === 0 || xpath[i - 1] !== "\\")) {
				if (!inDoubleQuote) {
					if (inSingleQuote) {
						inSingleQuote = false;
					} else {
						inSingleQuote = true;
						singleQuoteStart = i;
					}
				}
			}
		}

		if (inDoubleQuote) {
			return {
				valid: false,
				position: doubleQuoteStart,
				message: 'Missing closing double quote "',
			};
		}

		if (inSingleQuote) {
			return {
				valid: false,
				position: singleQuoteStart,
				message: "Missing closing single quote '",
			};
		}

		return { valid: true, position: -1, message: "" };
	}
}
