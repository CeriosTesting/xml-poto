import { describe, expect, it } from "vitest";

import { collectImports, mapClassDecorator, mapPropertyDecorator } from "../../src/generator/decorator-mapper";
import type { ResolvedProperty, ResolvedType } from "../../src/xsd/xsd-resolver";

describe("DecoratorMapper", () => {
	describe("mapClassDecorator", () => {
		it("should generate @XmlRoot for root elements", () => {
			const type: ResolvedType = {
				className: "Person",
				xmlName: "Person",
				properties: [],
				isRootElement: true,
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("@XmlRoot");
			expect(result).toContain("name: 'Person'");
		});

		it("should generate @XmlElement for non-root types", () => {
			const type: ResolvedType = {
				className: "AddressType",
				xmlName: "AddressType",
				properties: [],
				isRootElement: false,
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("@XmlElement");
			expect(result).toContain("name: 'AddressType'");
		});

		it("should include namespace in non-root @XmlElement class decorator", () => {
			const type: ResolvedType = {
				className: "AddressType",
				xmlName: "AddressType",
				properties: [],
				isRootElement: false,
				namespace: { uri: "http://example.com/ns", prefix: "tns" },
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("@XmlElement");
			expect(result).toContain("namespace:");
			expect(result).toContain("http://example.com/ns");
		});

		it("should include namespace in @XmlRoot", () => {
			const type: ResolvedType = {
				className: "Order",
				xmlName: "Order",
				properties: [],
				isRootElement: true,
				namespace: { uri: "http://example.com/orders", prefix: "tns" },
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("namespace:");
			expect(result).toContain("http://example.com/orders");
			expect(result).toContain("tns");
		});

		it("should include isNullable in @XmlRoot when root is nillable", () => {
			const type: ResolvedType = {
				className: "Order",
				xmlName: "Order",
				properties: [],
				isRootElement: true,
				rootNillable: true,
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("@XmlRoot");
			expect(result).toContain("isNullable: true");
		});
	});

	describe("mapPropertyDecorator", () => {
		it("should generate @XmlElement for element properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "firstName",
				xmlName: "FirstName",
				kind: "element",
				tsType: "string",
				initializer: "''",
				required: true,
				order: 0,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlElement");
			expect(result).toContain("name: 'FirstName'");
			expect(result).toContain("required: true");
			expect(result).toContain("order: 0");
		});

		it("should generate @XmlAttribute for attribute properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "id",
				xmlName: "id",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				required: true,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlAttribute");
			expect(result).toContain("name: 'id'");
			expect(result).toContain("required: true");
		});

		it("should generate @XmlAttribute with enumValues", () => {
			const prop: ResolvedProperty = {
				propertyName: "status",
				xmlName: "status",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				enumValues: ["active", "inactive", "pending"],
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlAttribute");
			expect(result).toContain("enumValues:");
			expect(result).toContain("'active'");
		});

		it("should generate @XmlAttribute with pattern", () => {
			const prop: ResolvedProperty = {
				propertyName: "email",
				xmlName: "email",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				pattern: "[a-z]+@[a-z]+",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain('pattern: new RegExp("[a-z]+@[a-z]+")');
		});

		it("should escape attribute pattern values safely", () => {
			const prop: ResolvedProperty = {
				propertyName: "path",
				xmlName: "path",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				pattern: "^[A-Za-z]+/[A-Za-z]+$",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain('pattern: new RegExp("^[A-Za-z]+/[A-Za-z]+$")');
		});

		it("should generate @XmlText for text properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "value",
				xmlName: "",
				kind: "text",
				tsType: "number",
				initializer: "0",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlText");
		});

		it("should generate @XmlArray for array properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "book",
				xmlName: "Book",
				kind: "array",
				tsType: "BookType[]",
				initializer: "[]",
				arrayItemName: "Book",
				arrayItemType: "BookType",
				order: 3,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlArray");
			expect(result).toContain("itemName: 'Book'");
			expect(result).toContain("type: BookType");
			expect(result).toContain("order: 3");
		});

		it("should generate @XmlDynamic for dynamic properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "dynamic",
				xmlName: "",
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				order: 7,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlDynamic");
			expect(result).toContain("order: 7");
		});

		it("should include required on dynamic properties", () => {
			const prop: ResolvedProperty = {
				propertyName: "dynamic",
				xmlName: "",
				kind: "dynamic",
				tsType: "DynamicElement",
				initializer: "undefined!",
				required: true,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlDynamic");
			expect(result).toContain("required: true");
		});

		it("should include isNullable when set", () => {
			const prop: ResolvedProperty = {
				propertyName: "value",
				xmlName: "Value",
				kind: "element",
				tsType: "string",
				initializer: "''",
				isNullable: true,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("isNullable: true");
		});

		it("should include namespace on element", () => {
			const prop: ResolvedProperty = {
				propertyName: "title",
				xmlName: "Title",
				kind: "element",
				tsType: "string",
				initializer: "''",
				namespace: { uri: "http://example.com/ns", prefix: "tns" },
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlElement");
			expect(result).toContain("namespace:");
			expect(result).toContain("http://example.com/ns");
		});

		it("should include form when set", () => {
			const prop: ResolvedProperty = {
				propertyName: "name",
				xmlName: "Name",
				kind: "element",
				tsType: "string",
				initializer: "''",
				form: "qualified",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("form: 'qualified'");
		});
	});

	describe("collectImports", () => {
		it("should collect XmlRoot for root elements", () => {
			const type: ResolvedType = {
				className: "Test",
				xmlName: "Test",
				properties: [],
				isRootElement: true,
			};

			const imports = collectImports(type);
			expect(imports.has("XmlRoot")).toBe(true);
		});

		it("should collect all needed decorators", () => {
			const type: ResolvedType = {
				className: "Test",
				xmlName: "Test",
				properties: [
					{
						propertyName: "a",
						xmlName: "a",
						kind: "element",
						tsType: "string",
						initializer: "''",
					},
					{
						propertyName: "b",
						xmlName: "b",
						kind: "attribute",
						tsType: "string",
						initializer: "''",
					},
					{
						propertyName: "c",
						xmlName: "",
						kind: "text",
						tsType: "string",
						initializer: "''",
					},
					{
						propertyName: "d",
						xmlName: "d",
						kind: "array",
						tsType: "string[]",
						initializer: "[]",
					},
					{
						propertyName: "e",
						xmlName: "",
						kind: "dynamic",
						tsType: "DynamicElement",
						initializer: "undefined!",
					},
				],
				isRootElement: true,
			};

			const imports = collectImports(type);
			expect(imports.has("XmlRoot")).toBe(true);
			expect(imports.has("XmlElement")).toBe(true);
			expect(imports.has("XmlAttribute")).toBe(true);
			expect(imports.has("XmlText")).toBe(true);
			expect(imports.has("XmlArray")).toBe(true);
			expect(imports.has("XmlDynamic")).toBe(true);
			expect(imports.has("DynamicElement")).toBe(true);
		});

		it("should collect XmlElement for non-root types", () => {
			const type: ResolvedType = {
				className: "Address",
				xmlName: "Address",
				properties: [],
				isRootElement: false,
			};

			const imports = collectImports(type);
			expect(imports.has("XmlElement")).toBe(true);
			expect(imports.has("XmlRoot")).toBe(false);
		});
	});

	describe("mapPropertyDecorator - additional options", () => {
		it("should include defaultValue on element", () => {
			const prop: ResolvedProperty = {
				propertyName: "count",
				xmlName: "Count",
				kind: "element",
				tsType: "number",
				initializer: "0",
				defaultValue: "5",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("defaultValue: 5");
		});

		it("should include complexTypeName as type on element", () => {
			const prop: ResolvedProperty = {
				propertyName: "address",
				xmlName: "Address",
				kind: "element",
				tsType: "AddressType",
				initializer: "new AddressType()",
				complexTypeName: "AddressType",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("type: AddressType");
		});

		it("should include dataType on element", () => {
			const prop: ResolvedProperty = {
				propertyName: "created",
				xmlName: "Created",
				kind: "element",
				tsType: "string",
				initializer: "''",
				dataType: "xs:dateTime",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("dataType: 'xs:dateTime'");
		});

		it("should include form on attribute", () => {
			const prop: ResolvedProperty = {
				propertyName: "id",
				xmlName: "id",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				form: "qualified",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("form: 'qualified'");
		});

		it("should include defaultValue on attribute (string)", () => {
			const prop: ResolvedProperty = {
				propertyName: "lang",
				xmlName: "lang",
				kind: "attribute",
				tsType: "string",
				initializer: "'en'",
				defaultValue: "en",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("defaultValue: 'en'");
		});

		it("should escape defaultValue on attribute (string)", () => {
			const prop: ResolvedProperty = {
				propertyName: "label",
				xmlName: "label",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				defaultValue: "O'Reilly\\docs",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("defaultValue: 'O\\'Reilly\\\\docs'");
		});

		it("should include defaultValue on attribute (boolean)", () => {
			const prop: ResolvedProperty = {
				propertyName: "active",
				xmlName: "active",
				kind: "attribute",
				tsType: "boolean",
				initializer: "true",
				defaultValue: "true",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("defaultValue: true");
		});

		it("should include dataType on attribute", () => {
			const prop: ResolvedProperty = {
				propertyName: "date",
				xmlName: "date",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				dataType: "xs:date",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("dataType: 'xs:date'");
		});

		it("should include namespace on attribute", () => {
			const prop: ResolvedProperty = {
				propertyName: "lang",
				xmlName: "lang",
				kind: "attribute",
				tsType: "string",
				initializer: "''",
				namespace: { uri: "http://www.w3.org/XML/1998/namespace", prefix: "xml" },
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("namespace:");
			expect(result).toContain("http://www.w3.org/XML/1998/namespace");
		});

		it("should include required and dataType on text", () => {
			const prop: ResolvedProperty = {
				propertyName: "value",
				xmlName: "",
				kind: "text",
				tsType: "string",
				initializer: "''",
				required: true,
				dataType: "xs:dateTime",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlText");
			expect(result).toContain("required: true");
			expect(result).toContain("dataType: 'xs:dateTime'");
		});

		it("should include containerName and isNullable on array", () => {
			const prop: ResolvedProperty = {
				propertyName: "items",
				xmlName: "Item",
				kind: "array",
				tsType: "string[]",
				initializer: "[]",
				arrayItemName: "Item",
				arrayContainerName: "Items",
				isNullable: true,
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("containerName: 'Items'");
			expect(result).toContain("isNullable: true");
		});

		it("should include namespace on array", () => {
			const prop: ResolvedProperty = {
				propertyName: "items",
				xmlName: "Item",
				kind: "array",
				tsType: "string[]",
				initializer: "[]",
				arrayItemName: "Item",
				namespace: { uri: "http://example.com/ns", prefix: "tns" },
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlArray");
			expect(result).toContain("namespace:");
			expect(result).toContain("http://example.com/ns");
		});

		it("should handle namespace without prefix", () => {
			const type: ResolvedType = {
				className: "Order",
				xmlName: "Order",
				properties: [],
				isRootElement: true,
				namespace: { uri: "http://example.com/orders" },
			};

			const result = mapClassDecorator(type);
			expect(result).toContain("namespace:");
			expect(result).toContain("uri: 'http://example.com/orders'");
			expect(result).not.toContain("prefix:");
		});

		it("should fallback to @XmlElement for unknown kind", () => {
			const prop: ResolvedProperty = {
				propertyName: "unknown",
				xmlName: "Unknown",
				kind: "something-else" as unknown as ResolvedProperty["kind"],
				tsType: "string",
				initializer: "''",
			};

			const result = mapPropertyDecorator(prop);
			expect(result).toContain("@XmlElement");
			expect(result).toContain("name: 'Unknown'");
		});
	});
});
