/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { XmlAttribute, XmlDynamic, XmlElement, XmlRoot } from "../../src/decorators";
import { DynamicElement } from "../../src/query/dynamic-element";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Strict Validation (strictValidation option)", () => {
	describe("Default behavior (strictValidation = false)", () => {
		it("should auto-discover and properly instantiate classes with @XmlElement decorator", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// No type parameter needed - auto-discovery works!
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
			const envelope = serializer.fromXml(xml, Envelope);

			// With auto-discovery, the class IS properly instantiated
			expect(envelope.extractionResult).toBeDefined();
			expect(envelope.extractionResult?.constructor.name).toBe("ExtractionResult");
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
			expect(envelope.extractionResult?.query).toBeDefined();
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
		it("should NOT throw error with auto-discovery even in strict mode", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// No type parameter needed - auto-discovery handles it
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

			// Should NOT throw because auto-discovery properly instantiates the class
			const envelope = strictSerializer.fromXml(xml, Envelope);
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
			expect(envelope.extractionResult?.query).toBeDefined();
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
		it("should demonstrate auto-discovery: no type parameter needed even with complex XBRL", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Auto-discovery works - no type parameter needed!
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

			// Use default mode for XBRL since nested elements aren't decorated
			const serializer = new XmlDecoratorSerializer();

			// Auto-discovery properly instantiates the ExtractionResult class
			const envelope = serializer.fromXml(xml, Envelope);
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
			expect(envelope.extractionResult?.query).toBeDefined();
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

		it("should demonstrate that query works with auto-discovery in default mode", () => {
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				// Auto-discovery works without type parameter
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

			// With auto-discovery, extractionResult is properly instantiated
			expect(envelope.extractionResult).toBeDefined();
			expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);

			// The query is now defined thanks to auto-discovery!
			expect(envelope.extractionResult?.query).toBeDefined();
		});
	});

	describe("@XmlDynamic with strict validation", () => {
		it("should NOT throw in strict mode for @XmlDynamic properties with plain objects", () => {
			// This test verifies the fix for XBRL-style dynamic content
			// @XmlDynamic properties intentionally contain plain objects and should be excluded from validation
			@XmlRoot({ name: "cerios-vt:HomeOwnersAssociationShare" })
			class HomeOwnersAssociationShareElement {
				@XmlDynamic()
				dynamic?: DynamicElement;
			}

			const xml = `
				<cerios-vt:HomeOwnersAssociationShare unitRef="€" chunkIds="0 1 5 4 2" decimals="INF" contextRef="{{UUID-1}}">N.V.T</cerios-vt:HomeOwnersAssociationShare>
			`;

			// Enable strict validation - should NOT throw
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw because @XmlDynamic properties are excluded from validation
			expect(() => {
				const element = strictSerializer.fromXml(xml, HomeOwnersAssociationShareElement);
				expect(element).toBeDefined();
				expect(element.dynamic).toBeDefined();
			}).not.toThrow();
		});

		it("should NOT throw in strict mode for classes with @XmlDynamic and dynamic XBRL content", () => {
			// Real-world XBRL scenario with dynamic elements
			@XmlElement({ name: "extractionResult" })
			class ExtractionResult {
				@XmlDynamic()
				query?: DynamicElement;
			}

			@XmlRoot({ name: "envelope" })
			class Envelope {
				@XmlElement({ name: "extractionResult", type: ExtractionResult })
				extractionResult?: ExtractionResult;
			}

			const xml = `
				<envelope>
					<extractionResult>
						<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:cerios-vt="http://example.com/cerios-vt">
							<cerios-vt:HomeOwnersAssociationShare unitRef="€" chunkIds="0 1 5 4 2" decimals="INF" contextRef="UUID-1">N.V.T</cerios-vt:HomeOwnersAssociationShare>
							<cerios-vt:AnotherElement unitRef="€" decimals="2" contextRef="UUID-2">123.45</cerios-vt:AnotherElement>
						</xbrli:xbrl>
					</extractionResult>
				</envelope>
			`;

			// Enable strict validation
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw because @XmlDynamic handles the dynamic content
			expect(() => {
				const envelope = strictSerializer.fromXml(xml, Envelope);
				expect(envelope.extractionResult).toBeDefined();
				expect(envelope.extractionResult instanceof ExtractionResult).toBe(true);
				expect(envelope.extractionResult?.query).toBeDefined();

				// Verify we can query the dynamic XBRL elements
				const xbrlElement = envelope.extractionResult?.query?.children.find((c: any) => c.localName === "xbrl");
				expect(xbrlElement).toBeDefined();
				expect(xbrlElement?.children.length).toBeGreaterThan(0);
			}).not.toThrow();
		});

		it("should NOT throw in strict mode when @XmlDynamic property contains nested plain objects", () => {
			@XmlRoot({ name: "document" })
			class Document {
				@XmlDynamic()
				content?: DynamicElement;

				@XmlElement({ name: "title" })
				title: string = "";
			}

			const xml = `
				<document>
					<title>Test Document</title>
					<section id="1">
						<paragraph>Some text</paragraph>
						<metadata>
							<author>John Doe</author>
							<date>2025-01-01</date>
						</metadata>
					</section>
				</document>
			`;

			// Enable strict validation
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should NOT throw - @XmlDynamic properties are intentionally plain objects
			expect(() => {
				const doc = strictSerializer.fromXml(xml, Document);
				expect(doc).toBeDefined();
				expect(doc.title).toBe("Test Document");
				expect(doc.content).toBeDefined();

				// Verify the dynamic content is accessible
				const section = doc.content?.query().find("section").first();
				expect(section).toBeDefined();
			}).not.toThrow();
		});

		it("should still throw in strict mode for regular properties without @XmlDynamic", () => {
			// This test ensures that regular properties are still validated
			@XmlRoot({ name: "config" })
			class Config {
				// This property does NOT have @XmlDynamic and no type parameter
				@XmlElement({ name: "settings" })
				settings?: any;
			}

			const xml = `
				<config>
					<settings>
						<option>value</option>
					</settings>
				</config>
			`;

			// Enable strict validation
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw because settings has nested data but no type parameter and no @XmlDynamic
			expect(() => {
				strictSerializer.fromXml(xml, Config);
			}).toThrow(/Strict Validation Error.*Property 'settings' is not properly instantiated/);
		});
	});

	describe("Required property instance-value validation (strictValidation = true)", () => {
		it("should throw when a required @XmlElement property resolves to undefined via a transform (strict mode only)", () => {
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({
					name: "host",
					required: true,
					transform: { deserialize: () => undefined as any },
				})
				host!: string;
			}

			// 'host' IS in the XML, but the transform returns undefined
			const xml = `<config><host>localhost</host></config>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				strictSerializer.fromXml(xml, Config);
			}).toThrow(/Strict Validation Error.*Required property 'host'/);
		});

		it("should throw when a required @XmlElement property resolves to null via a transform (strict mode only)", () => {
			@XmlRoot({ name: "document" })
			class Document {
				@XmlElement({
					name: "title",
					required: true,
					transform: { deserialize: () => null as any },
				})
				title!: string;
			}

			// 'title' IS in the XML, but the transform returns null
			const xml = `<document><title>Some Title</title></document>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				strictSerializer.fromXml(xml, Document);
			}).toThrow(/Strict Validation Error.*Required property 'title'/);
		});

		it("should NOT throw when all required @XmlElement properties have values", () => {
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({ name: "host", required: true })
				host: string = "";

				@XmlElement({ name: "port", required: true })
				port: number = 0;
			}

			const xml = `<config><host>localhost</host><port>8080</port></config>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				const result = strictSerializer.fromXml(xml, Config);
				expect(result.host).toBe("localhost");
				expect(result.port).toBe(8080);
			}).not.toThrow();
		});

		it("should NOT throw when an optional @XmlElement property is absent", () => {
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({ name: "host", required: true })
				host: string = "";

				@XmlElement({ name: "description" })
				description?: string;
			}

			// description is absent but it is not required
			const xml = `<config><host>localhost</host></config>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				const result = strictSerializer.fromXml(xml, Config);
				expect(result.host).toBe("localhost");
				expect(result.description).toBeUndefined();
			}).not.toThrow();
		});

		it("should NOT throw when a required property has a defaultValue set", () => {
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({ name: "host", required: true, defaultValue: "localhost" })
				host: string = "localhost";
			}

			// host absent from XML but defaultValue is applied
			const xml = `<config></config>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				const result = strictSerializer.fromXml(xml, Config);
				expect(result.host).toBe("localhost");
			}).not.toThrow();
		});

		it("should include the property name and [Strict Validation Error] prefix when transform returns null", () => {
			@XmlRoot({ name: "user" })
			class User {
				@XmlElement({
					name: "email",
					required: true,
					transform: { deserialize: () => null as any },
				})
				email!: string;
			}

			const xml = `<user><email>user@example.com</email></user>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			let error: Error | undefined;
			try {
				strictSerializer.fromXml(xml, User);
			} catch (e: any) {
				error = e;
			}

			expect(error).toBeDefined();
			expect(error?.message).toContain("[Strict Validation Error]");
			expect(error?.message).toContain("email");
		});

		it("should NOT throw with the same null-returning transform when strictValidation is false", () => {
			// Without strictValidation, validateRequiredElementValues is not called so null is accepted
			@XmlRoot({ name: "user" })
			class User {
				@XmlElement({
					name: "email",
					required: true,
					transform: { deserialize: () => null as any },
				})
				email!: string;
			}

			const xml = `<user><email>user@example.com</email></user>`;
			const lenientSerializer = new XmlDecoratorSerializer();

			expect(() => {
				lenientSerializer.fromXml(xml, User);
			}).not.toThrow();
		});

		it("should still throw 'Required element is missing' (non-strict check) when element is absent from XML", () => {
			// This confirms checkRequiredElements still fires in both strict and non-strict mode
			@XmlRoot({ name: "config" })
			class Config {
				@XmlElement({ name: "host", required: true })
				host!: string;
			}

			const xml = `<config></config>`;

			for (const serializer of [new XmlDecoratorSerializer({ strictValidation: true }), new XmlDecoratorSerializer()]) {
				expect(() => {
					serializer.fromXml(xml, Config);
				}).toThrow(/Required element 'host' is missing/);
			}
		});

		it("should validate required attributes in strict mode", () => {
			@XmlRoot({ name: "element" })
			class Element {
				@XmlAttribute({ name: "id", required: true })
				id!: string;

				@XmlElement({ name: "value" })
				value: string = "";
			}

			// Attribute is missing
			const xml = `<element><value>test</value></element>`;
			const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				strictSerializer.fromXml(xml, Element);
			}).toThrow(/Required attribute 'id' is missing/);
		});
	});
});
