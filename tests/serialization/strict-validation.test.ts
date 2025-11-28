import { describe, expect, it } from "vitest";
import { XmlDynamic, XmlElement, XmlRoot } from "../../src/decorators";
import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Strict Validation (strictValidation option)", () => {
	describe("Default behavior (strictValidation = false)", () => {
		it("should NOT throw error by default when type parameter is missing", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Missing type parameter - plain Object will be created
				@XmlElement({ name: "extractionResult" })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<data>Test</data>
					</extractionResult>
				</envelope>
			`;

			// Default mode (strictValidation = false by default)
			const serializer = new XmlDecoratorSerializer();

			// Should NOT throw error
			expect(() => {
				const envelope = serializer.fromXml(xml, Envelope);

				// But query will be undefined (the symptom users experience)
				expect(envelope.extractionResult).toBeDefined();
				expect(envelope.extractionResult?.constructor.name).toBe("Object");
				expect(envelope.extractionResult instanceof ExtractionResult).toBe(false);
				expect(envelope.extractionResult?.query).toBeUndefined();
			}).not.toThrow();
		});

		it("should work correctly when type parameter is specified", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Correct: type parameter is specified
				@XmlElement({ name: "extractionResult", type: ExtractionResult })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<data>Test</data>
					</extractionResult>
				</envelope>
			`;

			const serializer = new XmlDecoratorSerializer();
			const envelope = serializer.fromXml(xml, Envelope);

			expect(envelope.extractionResult?.query).toBeDefined();
			expect(envelope.extractionResult?.constructor.name).toBe("ExtractionResult");
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
		});

		it("should work with @XmlDynamic on root classes", () => {
			@XmlRoot({ name: "document" })
			class Document {
				@XmlDynamic()
				query?: DynamicElement;

				@XmlElement({ name: "title" })
				title?: string;
			}

			const xml = `
				<document>
					<title>Test Document</title>
				</document>
			`;

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml(xml, Document);

			expect(doc.query).toBeDefined();
			expect(doc.constructor.name).toBe("Document");
		});

		it("should work with targetProperty workaround (no type parameter needed)", () => {
			@XmlRoot({ name: "envelope" })
			class Envelope {
				@XmlElement({ name: "extractionResult" })
				extractionResult?: any;

				// Workaround: query from root instead of nested class
				@XmlDynamic({ targetProperty: "extractionResult" })
				xbrlQuery?: DynamicElement;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<data>Test</data>
					</extractionResult>
				</envelope>
			`;

			const serializer = new XmlDecoratorSerializer();
			const envelope = serializer.fromXml(xml, Envelope);

			expect(envelope.xbrlQuery).toBeDefined();
		});
	});

	describe("@XmlRoot as alternative to @XmlElement", () => {
		it("should work with @XmlRoot decorator on nested class (when type is specified)", () => {
			@XmlRoot({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// @XmlRoot works the same as @XmlElement - type parameter is still required
				@XmlElement({ name: "extractionResult", type: ExtractionResult })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<data>Test</data>
					</extractionResult>
				</envelope>
			`;

			const serializer = new XmlDecoratorSerializer();
			const envelope = serializer.fromXml(xml, Envelope);

			expect(envelope.extractionResult).toBeDefined();
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
			expect(envelope.extractionResult?.query).toBeDefined();
		});
	});

	describe("Strict mode (strictValidation = true)", () => {
		it("should THROW error when strict validation is enabled and type parameter is missing", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Missing type parameter - will throw in strict mode
				@XmlElement({ name: "extractionResult" })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<data>Test</data>
					</extractionResult>
				</envelope>
			`;

			// Enable strict validation
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw error during deserialization
			expect(() => {
				strictSerializer.fromXml(xml, Envelope);
			}).toThrow(/\[Strict Validation Error\] Property 'extractionResult' is not properly instantiated/);
		});

		it("should NOT throw in strict mode when type parameter is specified correctly", () => {
			@XmlElement({ name: "result" })
			class Result {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "wrapper" })
			class Wrapper {
				// Type parameter specified - will be properly instantiated
				@XmlElement({ name: "result", type: Result })
				result?: Result;
			}

			const xml = `
				<wrapper>
					<result>
						<data>Test</data>
					</result>
				</wrapper>
			`;

			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw because object is properly instantiated
			const wrapper = strictSerializer.fromXml(xml, Wrapper);
			expect(wrapper.result instanceof Result).toBe(true);
			expect(wrapper.result?.query).toBeDefined();
		});

		it("should NOT throw in strict mode for simple text values", () => {
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({ name: "setting" })
				setting?: string;
			}

			const xml = `
				<config>
					<setting>SimpleValue</setting>
				</config>
			`;

			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should not throw for simple values (not nested objects)
			const config = strictSerializer.fromXml(xml, Config);
			expect(config.setting).toBe("SimpleValue");
		});
	});

	describe("XBRL real-world scenario", () => {
		it("should demonstrate the problem: missing type parameter throws error in strict mode", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Common mistake: forgetting type parameter
				@XmlElement({ name: "extractionResult" })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
							<xbrli:context id="UUID-1">
								<xbrli:entity>
									<xbrli:identifier scheme="" />
								</xbrli:entity>
							</xbrli:context>
						</xbrli:xbrl>
					</extractionResult>
				</envelope>
			`;

			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw error during deserialization
			expect(() => {
				serializer.fromXml(xml, Envelope);
			}).toThrow(/\[Strict Validation Error\] Property 'extractionResult' is not properly instantiated/);
		});

		it("should demonstrate the solution: adding type parameter fixes the issue", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Solution: add type parameter
				@XmlElement({ name: "extractionResult", type: ExtractionResult })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
							<xbrli:context id="UUID-1">
								<xbrli:entity>
									<xbrli:identifier scheme="" />
								</xbrli:entity>
							</xbrli:context>
						</xbrli:xbrl>
					</extractionResult>
				</envelope>
			`;

			// Use default (lenient) mode since we're not defining types for all XBRL elements
			const serializer = new XmlDecoratorSerializer();
			const envelope = serializer.fromXml(xml, Envelope);

			// Now properly instantiated
			expect(envelope.extractionResult).toBeDefined();
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
			expect(envelope.extractionResult?.query).toBeDefined();

			// Can now query XBRL elements (search by local name, not qualified name)
			const xbrlElement = envelope.extractionResult?.query?.children.find((c: any) => c.localName === "xbrl");
			expect(xbrlElement).toBeDefined();
			expect(xbrlElement?.children.length).toBeGreaterThan(0);
		});

		it("should demonstrate default mode: missing type parameter results in undefined query", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Missing type parameter
				@XmlElement({ name: "extractionResult" })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
							<xbrli:context id="UUID-1" />
						</xbrli:xbrl>
					</extractionResult>
				</envelope>
			`;

			// Use default (lenient) mode
			const lenientSerializer = new XmlDecoratorSerializer();
			const envelope = lenientSerializer.fromXml(xml, Envelope);

			// The extractionResult exists as plain object (not ExtractionResult instance)
			expect(envelope.extractionResult).toBeDefined();
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(false);

			// The query is undefined - this is the symptom users report!
			expect(envelope.extractionResult?.query).toBeUndefined();
		});
	});
});
