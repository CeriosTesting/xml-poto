import { XmlElement, XmlRoot } from "../../src/decorators";
import { XmlDynamic } from "../../src/decorators/xml-queryable";
import type { DynamicElement } from "../../src/query/xml-query";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("XmlDynamic Options", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("required option", () => {
		it("should not throw when required queryable element exists", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ required: true })
				query?: DynamicElement;

				@XmlElement({ name: "Title" })
				title: string = "";
			}

			const xml = `<Document><Title>Test</Title></Document>`;
			expect(() => serializer.fromXml(xml, Document)).not.toThrow();
		});

		it("should throw error when required queryable element is missing from XML", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ targetProperty: "items", required: true })
				itemsQuery?: DynamicElement;

				@XmlElement({ name: "Title" })
				title: string = "";
			}

			const xml = `<Document><Title>Test</Title></Document>`;
			expect(() => serializer.fromXml(xml, Document)).toThrow("Required queryable element 'items' is missing");
		});

		it("should not throw when optional queryable element is missing", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ targetProperty: "items", required: false })
				itemsQuery?: DynamicElement;

				@XmlElement({ name: "Title" })
				title: string = "";
			}

			const xml = `<Document><Title>Test</Title></Document>`;
			expect(() => serializer.fromXml(xml, Document)).not.toThrow();
		});
	});

	describe("trimValues option", () => {
		it("should trim text values by default (trimValues: true)", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `<Document>  \n  Hello World  \n  </Document>`;
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query?.text).toBe("Hello World");
		});

		it("should preserve whitespace when trimValues is false", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ trimValues: false })
				query?: DynamicElement;
			}

			const xml = `<Document>  \n  Hello World  \n  </Document>`;
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query?.text).toBe("  \n  Hello World  \n  ");
		});

		it("should trim child element text when trimValues is true", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ trimValues: true })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Child>  Text with spaces  </Child>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);
			const child = root.query?.children.find(c => c.name === "Child");

			expect(child?.text).toBe("Text with spaces");
		});

		it("should not trim child element text when trimValues is false", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ trimValues: false })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Child>  Text with spaces  </Child>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);
			const child = root.query?.children.find(c => c.name === "Child");

			expect(child?.text).toBe("  Text with spaces  ");
		});
	});

	describe("preserveRawText option", () => {
		it("should not include rawText by default (preserveRawText: false)", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `<Document>  Test  </Document>`;
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query?.rawText).toBeUndefined();
			expect(doc.query?.text).toBe("Test"); // trimmed
		});

		it("should include rawText when preserveRawText is true", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ preserveRawText: true })
				query?: DynamicElement;
			}

			const xml = `<Document>  Test  </Document>`;
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query?.rawText).toBe("  Test  ");
			expect(doc.query?.text).toBe("Test"); // still trimmed
		});

		it("should preserve rawText in child elements when preserveRawText is true", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ preserveRawText: true })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Child>  Content  </Child>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);
			const child = root.query?.children.find(c => c.name === "Child");

			expect(child?.rawText).toBe("  Content  ");
			expect(child?.text).toBe("Content");
		});

		it("should combine trimValues: false with preserveRawText: true", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({ trimValues: false, preserveRawText: true })
				query?: DynamicElement;
			}

			const xml = `<Document>  Test  </Document>`;
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query?.rawText).toBe("  Test  ");
			expect(doc.query?.text).toBe("  Test  "); // not trimmed
		});
	});

	describe("maxDepth option", () => {
		it("should parse all levels when maxDepth is undefined", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Level1>
						<Level2>
							<Level3>Deep</Level3>
						</Level2>
					</Level1>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toHaveLength(1);
			const level1 = root.query?.children[0];
			expect(level1?.children).toHaveLength(1);
			const level2 = level1?.children[0];
			expect(level2?.children).toHaveLength(1);
			const level3 = level2?.children[0];
			expect(level3?.text).toBe("Deep");
		});

		it("should stop parsing at maxDepth level", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ maxDepth: 2 })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Level1>
						<Level2>
							<Level3>Deep</Level3>
						</Level2>
					</Level1>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);

			// Root is depth 0
			expect(root.query?.depth).toBe(0);
			expect(root.query?.children).toHaveLength(1);

			// Level1 is depth 1
			const level1 = root.query?.children[0];
			expect(level1?.depth).toBe(1);
			expect(level1?.children).toHaveLength(1);

			// Level2 is depth 2 (maxDepth reached, shouldn't parse children)
			const level2 = level1?.children[0];
			expect(level2?.depth).toBe(2);
			expect(level2?.children).toHaveLength(0); // No children parsed
		});

		it("should respect maxDepth of 0 (only root, no children)", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ maxDepth: 0 })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Child>Text</Child>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toHaveLength(0);
		});

		it("should respect maxDepth of 1", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ maxDepth: 1 })
				query?: DynamicElement;
			}

			const xml = `
				<Root>
					<Child>
						<GrandChild>Text</GrandChild>
					</Child>
				</Root>
			`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toHaveLength(1);
			const child = root.query?.children[0];
			expect(child?.name).toBe("Child");
			expect(child?.children).toHaveLength(0); // GrandChild not parsed
		});
	});

	describe("parseNumeric option", () => {
		it("should parse numeric values by default", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `<Data><Count>42</Count></Data>`;
			const data = serializer.fromXml(xml, Data);
			const count = data.query?.children.find(c => c.name === "Count");

			expect(count?.numericValue).toBe(42);
			expect(count?.text).toBe("42");
		});

		it("should not parse numeric values when parseNumeric is false", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlDynamic({ parseNumeric: false })
				query?: DynamicElement;
			}

			const xml = `<Data><Count>42</Count></Data>`;
			const data = serializer.fromXml(xml, Data);
			const count = data.query?.children.find(c => c.name === "Count");

			expect(count?.numericValue).toBeUndefined();
			expect(count?.text).toBe("42");
		});
	});

	describe("parseBoolean option", () => {
		it("should parse boolean values by default", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `<Data><Flag>true</Flag></Data>`;
			const data = serializer.fromXml(xml, Data);
			const flag = data.query?.children.find(c => c.name === "Flag");

			expect(flag?.booleanValue).toBe(true);
			expect(flag?.text).toBe("true");
		});

		it("should not parse boolean values when parseBoolean is false", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlDynamic({ parseBoolean: false })
				query?: DynamicElement;
			}

			const xml = `<Data><Flag>true</Flag></Data>`;
			const data = serializer.fromXml(xml, Data);
			const flag = data.query?.children.find(c => c.name === "Flag");

			expect(flag?.booleanValue).toBeUndefined();
			expect(flag?.text).toBe("true");
		});
	});

	describe("parseChildren option", () => {
		it("should parse children by default", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic()
				query?: DynamicElement;
			}

			const xml = `<Root><Child>Text</Child></Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toHaveLength(1);
			expect(root.query?.children[0]?.name).toBe("Child");
		});

		it("should not parse children when parseChildren is false", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ parseChildren: false })
				query?: DynamicElement;
			}

			const xml = `<Root><Child>Text</Child></Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toHaveLength(0);
		});
	});

	describe("Combined options", () => {
		it("should work with multiple options combined", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({
					required: true,
					trimValues: false,
					preserveRawText: true,
					maxDepth: 2,
					parseNumeric: false,
					parseBoolean: false,
					cache: true,
				})
				query?: DynamicElement;
			}

			const xml = `
				<Document>
					<Level1>
						<Number>  42  </Number>
						<Flag>  true  </Flag>
						<Level2>
							<Deep>Should not parse</Deep>
						</Level2>
					</Level1>
				</Document>
			`;
			const doc = serializer.fromXml(xml, Document);

			// Required: element exists, no error
			expect(doc.query).toBeDefined();

			// maxDepth: 2 - Level1 and its children parsed, but not grandchildren
			const level1 = doc.query?.children.find(c => c.name === "Level1");
			expect(level1?.children.length).toBeGreaterThan(0);
			const level2 = level1?.children.find(c => c.name === "Level2");
			expect(level2?.children).toHaveLength(0); // Deep not parsed

			// trimValues: false - whitespace preserved
			const number = level1?.children.find(c => c.name === "Number");
			expect(number?.text).toBe("  42  ");

			// preserveRawText: true - rawText included
			expect(number?.rawText).toBe("  42  ");

			// parseNumeric: false - numericValue not parsed
			expect(number?.numericValue).toBeUndefined();
			expect(number?.text).toBe("  42  ");

			// parseBoolean: false - booleanValue not parsed
			const flag = level1?.children.find(c => c.name === "Flag");
			expect(flag?.booleanValue).toBeUndefined();
			expect(flag?.text).toBe("  true  ");
		});

		it("should allow selective option override", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlDynamic({
					trimValues: true, // Trim
					preserveRawText: true, // But keep original
					parseNumeric: true, // Parse numbers
					parseBoolean: false, // But not booleans
				})
				query?: DynamicElement;
			}

			const xml = `
				<Document>
					<Number>  100  </Number>
					<Flag>  false  </Flag>
				</Document>
			`;
			const doc = serializer.fromXml(xml, Document);

			const number = doc.query?.children.find(c => c.name === "Number");
			expect(number?.text).toBe("100"); // Trimmed
			expect(number?.rawText).toBe("  100  "); // Raw preserved
			expect(number?.numericValue).toBe(100); // Parsed as number

			const flag = doc.query?.children.find(c => c.name === "Flag");
			expect(flag?.text).toBe("false"); // Trimmed
			expect(flag?.rawText).toBe("  false  "); // Raw preserved
			expect(flag?.booleanValue).toBeUndefined(); // Not parsed
			expect(flag?.text).toBe("false"); // Stays as text
		});
	});

	describe("Edge cases", () => {
		it("should handle empty elements with all options", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({
					trimValues: false,
					preserveRawText: true,
					maxDepth: 5,
					parseNumeric: true,
					parseBoolean: true,
				})
				query?: DynamicElement;
			}

			const xml = `<Root></Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query).toBeDefined();
			expect(root.query?.children).toHaveLength(0);
			expect(root.query?.text).toBeUndefined();
		});

		it("should handle whitespace-only content with trimValues: false", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ trimValues: false })
				query?: DynamicElement;
			}

			const xml = `<Root>   \n\t   </Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.text).toBe("   \n\t   ");
		});

		it("should handle whitespace-only content with trimValues: true", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlDynamic({ trimValues: true })
				query?: DynamicElement;
			}

			const xml = `<Root>   \n\t   </Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.text).toBe("");
		});
	});
});
