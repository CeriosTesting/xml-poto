import { beforeEach, describe, expect, it, vi } from "vitest";
import { getXmlAttributeMetadata } from "../../src/decorators/getters";
import { XmlAttribute } from "../../src/decorators/xml-attribute";

describe("XmlAttribute decorator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Basic functionality", () => {
		it("should store attribute metadata with default options", () => {
			class TestClass {
				@XmlAttribute()
				id: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.id).toBeDefined();
			expect(metadata.id.name).toBe("id");
			expect(metadata.id.required).toBe(false);
		});

		it("should use custom attribute name", () => {
			class TestClass {
				@XmlAttribute({ name: "customId" })
				id: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.id.name).toBe("customId");
		});

		it("should store namespace information", () => {
			class TestClass {
				@XmlAttribute({
					name: "version",
					namespace: { uri: "http://example.com", prefix: "v" },
				})
				version: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.version.namespace).toEqual({
				uri: "http://example.com",
				prefix: "v",
			});
		});

		it("should store required flag", () => {
			class TestClass {
				@XmlAttribute({ name: "required", required: true })
				requiredAttr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.requiredAttr.required).toBe(true);
		});

		it("should preserve initialValue", () => {
			class TestClass {
				@XmlAttribute()
				value: string = "default";
			}

			const instance = new TestClass();
			expect(instance.value).toBe("default");
		});
	});

	describe("Multiple attributes", () => {
		it("should handle multiple attributes on same class", () => {
			class TestClass {
				@XmlAttribute({ name: "id" })
				id: string = "";

				@XmlAttribute({ name: "name" })
				name: string = "";

				@XmlAttribute({ name: "version", required: true })
				version: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(Object.keys(metadata)).toHaveLength(3);
			expect(metadata.id.name).toBe("id");
			expect(metadata.name.name).toBe("name");
			expect(metadata.version.name).toBe("version");
			expect(metadata.version.required).toBe(true);
		});

		it("should handle attributes with different types", () => {
			class TestClass {
				@XmlAttribute({ name: "stringAttr" })
				strAttr: string = "";

				@XmlAttribute({ name: "numberAttr" })
				numAttr: number = 0;

				@XmlAttribute({ name: "boolAttr" })
				boolAttr: boolean = false;
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.strAttr).toBeDefined();
			expect(metadata.numAttr).toBeDefined();
			expect(metadata.boolAttr).toBeDefined();
		});
	});

	describe("Advanced options", () => {
		it("should store converter functions", () => {
			const converter = {
				serialize: (val: any) => val.toString().toUpperCase(),
				deserialize: (val: string) => val.toLowerCase(),
			};

			class TestClass {
				@XmlAttribute({ name: "converted", converter })
				value: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.value.converter).toBe(converter);
			if (metadata.value.converter?.serialize && metadata.value.converter?.deserialize) {
				expect(metadata.value.converter.serialize("test")).toBe("TEST");
				expect(metadata.value.converter.deserialize("TEST")).toBe("test");
			}
		});

		it("should store validation pattern", () => {
			const pattern = /^[0-9]+$/;

			class TestClass {
				@XmlAttribute({ name: "code", pattern })
				code: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.code.pattern).toBe(pattern);
		});

		it("should store enum values", () => {
			const enumValues = ["red", "green", "blue"] as const;

			class TestClass {
				@XmlAttribute({ name: "color", enumValues })
				color: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.color.enumValues).toEqual(enumValues);
		});

		it("should store dataType", () => {
			class TestClass {
				@XmlAttribute({ name: "amount", dataType: "xs:decimal" })
				amount: number = 0;
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.amount.dataType).toBe("xs:decimal");
		});

		it("should store form", () => {
			class TestClass {
				@XmlAttribute({ name: "qualified", form: "qualified" })
				qualifiedAttr: string = "";

				@XmlAttribute({ name: "unqualified", form: "unqualified" })
				unqualifiedAttr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.qualifiedAttr.form).toBe("qualified");
			expect(metadata.unqualifiedAttr.form).toBe("unqualified");
		});

		it("should store type information", () => {
			class CustomType {}

			class TestClass {
				@XmlAttribute({ name: "custom", type: CustomType })
				custom: any = undefined; // Explicit initialization needed for Stage 3 decorators
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.custom.type).toBe(CustomType);
		});
	});

	describe("Complete attribute configuration", () => {
		it("should store all options together", () => {
			const pattern = /^[A-Z]+$/;
			const enumValues = ["A", "B", "C"];
			const converter = {
				serialize: (val: any) => val.toString(),
				deserialize: (val: string) => val,
			};

			class TestClass {
				@XmlAttribute({
					name: "complexAttr",
					namespace: { uri: "http://test.com", prefix: "t" },
					required: true,
					converter,
					pattern,
					enumValues,
					dataType: "xs:string",
					form: "qualified",
					type: String,
				})
				attr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.attr).toEqual({
				name: "complexAttr",
				namespace: { uri: "http://test.com", prefix: "t" },
				required: true,
				converter,
				pattern,
				enumValues,
				dataType: "xs:string",
				form: "qualified",
				type: String,
			});
		});
	});

	describe("Storage mechanisms", () => {
		it("should allow retrieval via getter function", () => {
			class TestClass {
				@XmlAttribute({ name: "retrievable" })
				attr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.attr).toBeDefined();
			expect(metadata.attr.name).toBe("retrievable");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty options", () => {
			class TestClass {
				@XmlAttribute({})
				attr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.attr.name).toBe("attr");
			expect(metadata.attr.required).toBe(false);
		});

		it("should work with undefined initial value", () => {
			class TestClass {
				@XmlAttribute()
				attr: string | undefined;
			}

			const instance = new TestClass();
			expect(instance.attr).toBeUndefined();
		});

		it("should work with null initial value", () => {
			class TestClass {
				@XmlAttribute()
				attr: string | null = null;
			}

			const instance = new TestClass();
			expect(instance.attr).toBeNull();
		});
	});

	describe("Type safety", () => {
		it("should maintain correct metadata structure", () => {
			class TestClass {
				@XmlAttribute({ name: "test", required: false })
				attr: string = "";
			}

			void new TestClass();
			const metadata = getXmlAttributeMetadata(TestClass);

			expect(metadata.attr).toHaveProperty("name");
			expect(metadata.attr).toHaveProperty("required");
			expect(typeof metadata.attr.name).toBe("string");
			expect(typeof metadata.attr.required).toBe("boolean");
		});
	});
});
