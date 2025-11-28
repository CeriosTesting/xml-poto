import { beforeEach, describe, expect, test as fail, it } from "vitest";
import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("XPath Error Handling", () => {
	let parser: XmlQueryParser;

	beforeEach(() => {
		parser = new XmlQueryParser();
	});

	describe("Unbalanced Delimiters", () => {
		it("should detect unbalanced opening brackets", () => {
			const xml = `<root><item id="1">test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id");
			}).toThrow(/Invalid XPath: Missing closing bracket/);
		});

		it("should detect unbalanced closing brackets", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item]");
			}).toThrow(/Invalid XPath: Unexpected closing bracket/);
		});

		it("should detect unbalanced opening parentheses", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[position(]");
			}).toThrow(/Invalid XPath: Missing closing parenthesis/);
		});

		it("should detect unbalanced closing parentheses", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[position())]");
			}).toThrow(/Invalid XPath: Unexpected closing parenthesis/);
		});

		it("should detect unbalanced double quotes", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath('//item[@id="test]');
			}).toThrow(/Invalid XPath: Missing closing double quote/);
		});

		it("should detect unbalanced single quotes", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='test]");
			}).toThrow(/Invalid XPath: Missing closing single quote/);
		});

		it("should allow valid nested predicates", () => {
			const xml = `
				<root>
					<item id="1">
						<child>test</child>
					</item>
				</root>
			`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='1'][child]");
			}).not.toThrow();
		});

		it("should handle quotes inside predicates correctly", () => {
			const xml = `<root><item name="test">value</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath('//item[@name="test"]');
			}).not.toThrow();
		});
	});

	describe("Invalid Operators", () => {
		it("should detect invalid boolean OR operator", () => {
			const xml = `<root><item id="1" name="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='1' || @name='test']");
			}).toThrow(/Invalid XPath: Use 'or' instead of '\|\|'/);
		});

		it("should detect invalid AND operator", () => {
			const xml = `<root><item id="1" name="test">content</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[@id='1' && @name='test']");
			}).toThrow(/Invalid XPath: Use 'and' instead of '&&'/);
		});
	});

	describe("Empty or Invalid Predicates", () => {
		it("should detect empty predicates", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[]");
			}).toThrow(/Invalid XPath: Empty predicate/);
		});
	});

	describe("Function Argument Errors", () => {
		it("should throw error for ends-with() with insufficient arguments", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//item[ends-with(text())]");
			}).toThrow(/Invalid ends-with\(\) function: requires 2 arguments/);
		});

		it("should throw error for lang() with insufficient arguments", () => {
			const xml = `<root><para xml:lang="en">Test</para></root>`;
			const query = parser.parse(xml);

			expect(() => {
				query.xpath("//para[lang()]");
			}).toThrow(/Invalid lang\(\) function: requires 1 argument/);
		});
	});

	describe("Enhanced Error Messages", () => {
		it("should show context snippet for syntax errors", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[@id='test]");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("^");
				expect(error.message).toMatch(/Position: \d+/);
				expect(error.message).toContain("[@id='test]");
			}
		});

		it("should show helpful suggestions for operator mistakes", () => {
			const xml = `<root><item id="1" name="test">content</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[@id='1' && @name='test']");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("Suggestion");
				expect(error.message).toContain("Replace '&&' with ' and '");
				expect(error.message).toContain("^^");
			}
		});

		it("should provide detailed function usage for missing arguments", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[contains(text())]");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("contains()");
				expect(error.message).toContain("requires 2 arguments");
				expect(error.message).toContain("Expression:");
				expect(error.message).toContain("Usage:");
				expect(error.message).toContain("Example:");
			}
		});

		it("should suggest closest match for typos in axis names", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item/descendent::*");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("descendent");
				expect(error.message).toContain("Did you mean 'descendant'?");
				expect(error.message).toContain("Supported axes:");
			}
		});

		it("should handle empty predicate with helpful suggestion", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[]");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("Empty predicate");
				expect(error.message).toContain("Suggestion");
				expect(error.message).toContain("[1]");
				expect(error.message).toContain("[@attr]");
			}
		});

		it("should format multi-line error messages properly", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[ends-with(text())]");
				fail("Should have thrown an error");
			} catch (error: any) {
				const lines = error.message.split("\n");
				expect(lines.length).toBeGreaterThan(2);
				expect(lines[0]).toContain("Invalid");
			}
		});

		it("should truncate long expressions with ellipsis", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);
			const longPath = "//item[" + "@attr='value' and ".repeat(20) + "@last='test'";

			try {
				query.xpath(longPath);
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("...");
			}
		});
	});

	describe("Levenshtein Distance Suggestions", () => {
		it("should suggest close matches for axis typos", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item/ancester::*");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("Did you mean 'ancestor'?");
			}
		});

		it("should not suggest distant matches", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item/xyz::*");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toContain("Unsupported axis");
			}
		});
	});

	describe("Position Information", () => {
		it("should provide position information in error messages", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[@id='test]");
				fail("Should have thrown an error");
			} catch (error: any) {
				expect(error.message).toMatch(/Position: \d+/);
			}
		});
	});
});
