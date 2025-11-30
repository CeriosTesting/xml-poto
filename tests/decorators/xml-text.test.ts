import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMetadata } from "../../src/decorators/storage/metadata-storage";
import { XmlText } from "../../src/decorators/xml-text";

describe("XmlText decorator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Basic functionality", () => {
		it("should store text metadata with default options", () => {
			class TestClass {
				@XmlText()
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;
			const propertyKey = getMetadata(TestClass).textProperty;

			expect(metadata).toBeDefined();
			expect(propertyKey).toBe("content");
			expect(metadata?.required).toBe(false);
		});

		it("should preserve initial value", () => {
			class TestClass {
				@XmlText()
				content: string = "default text";
			}

			const instance = new TestClass();
			expect(instance.content).toBe("default text");
		});

		it("should store required flag", () => {
			class TestClass {
				@XmlText({ required: true })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			expect(metadata?.required).toBe(true);
		});

		it("should store dataType", () => {
			class TestClass {
				@XmlText({ dataType: "xs:string" })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			expect(metadata?.dataType).toBe("xs:string");
		});
	});

	describe("Converter functionality", () => {
		it("should store converter functions", () => {
			const converter = {
				serialize: (val: any) => val.toString().toUpperCase(),
				deserialize: (val: string) => val.toLowerCase(),
			};

			class TestClass {
				@XmlText({ converter })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			expect(metadata?.converter).toBe(converter);
			if (metadata?.converter?.serialize && metadata?.converter?.deserialize) {
				expect(metadata.converter.serialize("test")).toBe("TEST");
				expect(metadata.converter.deserialize("TEST")).toBe("test");
			}
		});

		it("should handle serialize-only converter", () => {
			const converter = {
				serialize: (val: any) => `[${val}]`,
			};

			class TestClass {
				@XmlText({ converter })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			if (metadata?.converter?.serialize) {
				expect(metadata.converter.serialize("test")).toBe("[test]");
			}
			expect(metadata?.converter?.deserialize).toBeUndefined();
		});

		it("should handle deserialize-only converter", () => {
			const converter = {
				deserialize: (val: string) => val.trim(),
			};

			class TestClass {
				@XmlText({ converter })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			if (metadata?.converter?.deserialize) {
				expect(metadata.converter.deserialize("  test  ")).toBe("test");
			}
			expect(metadata?.converter?.serialize).toBeUndefined();
		});
	});

	describe("Complete configuration", () => {
		it("should store all options together", () => {
			const converter = {
				serialize: (val: any) => val.toString(),
				deserialize: (val: string) => val,
			};

			class TestClass {
				@XmlText({
					converter,
					required: true,
					dataType: "xs:string",
					xmlName: "TextContent",
				})
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;

			expect(metadata).toEqual({
				converter,
				required: true,
				dataType: "xs:string",
			});
		});
	});

	describe("Storage mechanisms", () => {
		it("should allow retrieval via getter function", () => {
			class TestClass {
				@XmlText({ required: true })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass).textMetadata;
			const propertyKey = getMetadata(TestClass).textProperty;

			expect(metadata).toBeDefined();
			expect(propertyKey).toBe("content");
		});

		it("should only store metadata once", () => {
			class TestClass {
				@XmlText()
				content: string = "";
			}

			void new TestClass();
			void new TestClass();

			const metadata1 = getMetadata(TestClass).textMetadata;
			const metadata2 = getMetadata(TestClass).textMetadata;

			expect(metadata1).toEqual(metadata2);
		});
	});

	describe("Single text property constraint", () => {
		it("should only track the last declared text property (initialized first due to decorator order)", () => {
			class TestClass {
				@XmlText()
				content1: string = "";

				@XmlText()
				content2: string = "";
			}

			void new TestClass();
			const propertyKey = getMetadata(TestClass).textProperty;

			// Decorators execute in reverse order, so content2 initializes first and is stored
			expect(propertyKey).toBe("content2");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty options", () => {
			class TestClass {
				@XmlText({})
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass);

			expect(metadata.textProperty).toBe("content");
			expect(metadata.textMetadata?.required).toBe(false);
		});

		it("should work with undefined initial value", () => {
			class TestClass {
				@XmlText()
				content: string | undefined;
			}

			const instance = new TestClass();
			expect(instance.content).toBeUndefined();
		});

		it("should work with null initial value", () => {
			class TestClass {
				@XmlText()
				content: string | null = null;
			}

			const instance = new TestClass();
			expect(instance.content).toBeNull();
		});

		it("should work with different property types", () => {
			class TestClass {
				@XmlText()
				numericContent: number = 0;
			}

			void new TestClass();
			const propertyKey = getMetadata(TestClass).textProperty;

			expect(propertyKey).toBe("numericContent");
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata structure", () => {
			class TestClass {
				@XmlText({ required: true, dataType: "xs:string" })
				content: string = "";
			}

			void new TestClass();
			const metadata = getMetadata(TestClass);

			expect(metadata.textProperty).toBeDefined();
			expect(typeof metadata.textProperty).toBe("string");
			expect(metadata.textMetadata).toBeDefined();
			expect(typeof metadata.textMetadata).toBe("object");
			expect(metadata.textMetadata).toHaveProperty("required");
			expect(metadata.textMetadata).toHaveProperty("dataType");
		});
	});
});
