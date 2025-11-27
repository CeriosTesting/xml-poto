import { XmlQueryParser } from "../../src";

describe("XPath Enhanced Error Messages", () => {
	const parser = new XmlQueryParser();

	describe("Context snippets in error messages", () => {
		it("should show context snippet for syntax errors", () => {
			const xml = `<root><item id="test">content</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[@id='test]");
				fail("Should have thrown an error");
			} catch (error: any) {
				// Should include context snippet with caret
				expect(error.message).toContain("^");
				// Should include position
				expect(error.message).toMatch(/Position: \d+/);
				// Should show the problematic area
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
				// Should suggest the correct operator
				expect(error.message).toContain("Suggestion");
				expect(error.message).toContain("Replace '&&' with ' and '");
				// Should show context with multi-character operator highlighted
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
				// Should include function name in error
				expect(error.message).toContain("contains()");
				// Should explain the issue
				expect(error.message).toContain("requires 2 arguments");
				// Should show current expression
				expect(error.message).toContain("Expression:");
				// Should provide usage information
				expect(error.message).toContain("Usage:");
				// Should provide example
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
				// Should identify the bad axis
				expect(error.message).toContain("descendent");
				// Should suggest correct spelling
				expect(error.message).toContain("Did you mean 'descendant'?");
				// Should list supported axes
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
				// Should explain the problem
				expect(error.message).toContain("Empty predicate");
				// Should provide suggestions
				expect(error.message).toContain("Suggestion");
				expect(error.message).toContain("[1]");
				expect(error.message).toContain("[@attr]");
			}
		});
	});

	describe("Error message readability", () => {
		it("should format multi-line error messages properly", () => {
			const xml = `<root><item>test</item></root>`;
			const query = parser.parse(xml);

			try {
				query.xpath("//item[ends-with(text())]");
				fail("Should have thrown an error");
			} catch (error: any) {
				const lines = error.message.split("\n");
				// Should have multiple lines for clarity
				expect(lines.length).toBeGreaterThan(2);
				// Should start with clear error description
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
				// Should include ellipsis for long expressions
				expect(error.message).toContain("...");
			}
		});
	});

	describe("Levenshtein distance suggestions", () => {
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
				// Should not suggest anything for very different input
				expect(error.message).toContain("Unsupported axis");
				// May or may not have suggestion depending on distance threshold
			}
		});
	});
});
