import { describe, expect, it } from "vitest";

import { ClassGenerator } from "../../src/generator/class-generator";
import type { ResolvedEnum, ResolvedSchema, ResolvedType } from "../../src/xsd/xsd-resolver";

function makeSchema(types: ResolvedType[] = [], enums: ResolvedEnum[] = []): ResolvedSchema {
	return {
		types,
		enums,
		namespaces: new Map(),
		rootElements: types
			.filter((t) => t.isRootElement)
			.map((t) => ({
				name: t.xmlName,
				typeName: t.className,
			})),
	};
}

describe("ClassGenerator", () => {
	describe("generatePerType", () => {
		it("should emit optional TypeScript property for non-required fields", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [
						{
							propertyName: "email",
							xmlName: "Email",
							kind: "element",
							tsType: "string",
							initializer: "''",
							required: false,
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "person.ts")!;

			expect(classFile.content).toContain("email?: string;");
			expect(classFile.content).not.toContain("email?: string = '';");
		});

		it("should apply rootElements to referenced named complex types", () => {
			const schema: ResolvedSchema = {
				types: [
					{
						className: "OrderType",
						xmlName: "OrderType",
						isRootElement: false,
						properties: [],
					},
				],
				enums: [],
				namespaces: new Map(),
				rootElements: [{ name: "Order", typeName: "OrderType" }],
			};

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const classFile = files.find((f) => f.fileName === "order-type.ts");
			expect(classFile).toBeDefined();
			expect(classFile!.content).toContain("@XmlRoot({ name: 'Order' })");
		});

		it("should use first root alias when multiple root elements reference the same type", () => {
			const schema: ResolvedSchema = {
				types: [
					{
						className: "OrderType",
						xmlName: "OrderType",
						isRootElement: false,
						properties: [],
					},
				],
				enums: [],
				namespaces: new Map(),
				rootElements: [
					{ name: "Order", typeName: "OrderType" },
					{ name: "PurchaseOrder", typeName: "OrderType" },
				],
			};

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "order-type.ts")!;

			expect(classFile.content).toContain("@XmlRoot({ name: 'Order' })");
		});

		it("should apply nillable rootElements to referenced named complex types", () => {
			const schema: ResolvedSchema = {
				types: [
					{
						className: "OrderType",
						xmlName: "OrderType",
						isRootElement: false,
						properties: [],
					},
				],
				enums: [],
				namespaces: new Map(),
				rootElements: [{ name: "Order", typeName: "OrderType", nillable: true }],
			};

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const classFile = files.find((f) => f.fileName === "order-type.ts");
			expect(classFile).toBeDefined();
			expect(classFile!.content).toContain("isNullable: true");
		});

		it("should generate one file per type", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [
						{
							propertyName: "name",
							xmlName: "Name",
							kind: "element",
							tsType: "string",
							initializer: "''",
							order: 0,
						},
					],
				},
				{
					className: "AddressType",
					xmlName: "AddressType",
					isRootElement: false,
					properties: [
						{
							propertyName: "city",
							xmlName: "City",
							kind: "element",
							tsType: "string",
							initializer: "''",
							order: 0,
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			// Should generate a file for each type plus an index barrel
			const typeFiles = files.filter((f) => f.fileName !== "index.ts");
			expect(typeFiles.length).toBe(2);
			expect(typeFiles.some((f) => f.fileName === "person.ts")).toBe(true);
			expect(typeFiles.some((f) => f.fileName === "address-type.ts")).toBe(true);
		});

		it("should generate barrel index", () => {
			const schema = makeSchema([
				{
					className: "Simple",
					xmlName: "Simple",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const indexFile = files.find((f) => f.fileName === "index.ts");
			expect(indexFile).toBeDefined();
			expect(indexFile!.content).toContain("export");
		});

		it("should generate enum types", () => {
			const schema = makeSchema(
				[],
				[
					{
						name: "StatusType",
						xmlName: "StatusType",
						values: ["active", "inactive", "pending"],
						baseType: "xs:string",
					},
				],
			);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const enumFile = files.find((f) => f.content.includes("StatusType"));
			expect(enumFile).toBeDefined();
			expect(enumFile!.content).toContain("active");
			expect(enumFile!.content).toContain("inactive");
		});

		it("should include auto-generated header", () => {
			const schema = makeSchema([
				{
					className: "Test",
					xmlName: "Test",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const classFile = files.find((f) => f.fileName === "test.ts");
			expect(classFile).toBeDefined();
			expect(classFile!.content).toContain("AUTO-GENERATED");
		});

		it("should import from @cerios/xml-poto by default", () => {
			const schema = makeSchema([
				{
					className: "Test",
					xmlName: "Test",
					isRootElement: true,
					properties: [
						{
							propertyName: "value",
							xmlName: "Value",
							kind: "element",
							tsType: "string",
							initializer: "''",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const classFile = files.find((f) => f.fileName === "test.ts");
			expect(classFile!.content).toContain("@cerios/xml-poto");
		});

		it("should include order for array and dynamic decorators", () => {
			const schema = makeSchema([
				{
					className: "OrderLike",
					xmlName: "OrderLike",
					isRootElement: true,
					properties: [
						{
							propertyName: "items",
							xmlName: "Item",
							kind: "array",
							tsType: "string[]",
							initializer: "[]",
							arrayItemName: "Item",
							order: 2,
						},
						{
							propertyName: "anyContent",
							xmlName: "",
							kind: "dynamic",
							tsType: "DynamicElement",
							initializer: "undefined!",
							order: 3,
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const classFile = files.find((f) => f.fileName === "order-like.ts");
			expect(classFile).toBeDefined();
			expect(classFile!.content).toContain("@XmlArray({ itemName: 'Item', order: 2 })");
			expect(classFile!.content).toContain("@XmlDynamic({ order: 3 })");
		});
	});

	describe("generatePerXsd", () => {
		it("should apply rootElements in single-file mode", () => {
			const schema: ResolvedSchema = {
				types: [
					{
						className: "OrderType",
						xmlName: "OrderType",
						isRootElement: false,
						properties: [],
					},
				],
				enums: [],
				namespaces: new Map(),
				rootElements: [{ name: "Order", typeName: "OrderType" }],
			};

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema, "output");

			expect(files[0].content).toContain("@XmlRoot({ name: 'Order' })");
		});

		it("should apply nillable rootElements in single-file mode", () => {
			const schema: ResolvedSchema = {
				types: [
					{
						className: "OrderType",
						xmlName: "OrderType",
						isRootElement: false,
						properties: [],
					},
				],
				enums: [],
				namespaces: new Map(),
				rootElements: [{ name: "Order", typeName: "OrderType", nillable: true }],
			};

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema, "output");

			expect(files[0].content).toContain("isNullable: true");
		});

		it("should generate a single file", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [],
				},
				{
					className: "AddressType",
					xmlName: "AddressType",
					isRootElement: false,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema, "output");

			expect(files.length).toBe(1);
			expect(files[0].fileName).toBe("output.ts");
			expect(files[0].content).toContain("class Person");
			expect(files[0].content).toContain("class AddressType");
		});

		it("should handle inheritance with extends", () => {
			const schema = makeSchema([
				{
					className: "BaseEntity",
					xmlName: "BaseEntity",
					isRootElement: false,
					properties: [
						{
							propertyName: "id",
							xmlName: "id",
							kind: "attribute",
							tsType: "string",
							initializer: "''",
						},
					],
				},
				{
					className: "User",
					xmlName: "User",
					isRootElement: true,
					baseTypeName: "BaseEntity",
					properties: [
						{
							propertyName: "name",
							xmlName: "Name",
							kind: "element",
							tsType: "string",
							initializer: "''",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema, "output");

			expect(files[0].content).toContain("class User extends BaseEntity");
		});
	});

	describe("enumStyle", () => {
		const enumSchema = makeSchema(
			[],
			[
				{
					name: "StatusType",
					xmlName: "StatusType",
					values: ["active", "inactive", "pending"],
					baseType: "xs:string",
				},
			],
		);

		it("should generate union type by default", () => {
			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(enumSchema);

			const enumFile = files.find((f) => f.content.includes("StatusType"))!;
			expect(enumFile.content).toContain('export type StatusType = "active" | "inactive" | "pending";');
		});

		it("should generate union type when enumStyle is 'union'", () => {
			const gen = new ClassGenerator({ xsdPath: "test.xsd", enumStyle: "union" });
			const files = gen.generatePerType(enumSchema);

			const enumFile = files.find((f) => f.content.includes("StatusType"))!;
			expect(enumFile.content).toContain('export type StatusType = "active" | "inactive" | "pending";');
		});

		it("should generate TS enum when enumStyle is 'enum'", () => {
			const gen = new ClassGenerator({ xsdPath: "test.xsd", enumStyle: "enum" });
			const files = gen.generatePerType(enumSchema);

			const enumFile = files.find((f) => f.content.includes("StatusType"))!;
			expect(enumFile.content).toContain("export enum StatusType {");
			expect(enumFile.content).toContain('Active = "active"');
			expect(enumFile.content).toContain('Inactive = "inactive"');
		});

		it("should generate const object when enumStyle is 'const-object'", () => {
			const gen = new ClassGenerator({ xsdPath: "test.xsd", enumStyle: "const-object" });
			const files = gen.generatePerType(enumSchema);

			const enumFile = files.find((f) => f.content.includes("StatusType"))!;
			expect(enumFile.content).toContain("export const StatusType = {");
			expect(enumFile.content).toContain("} as const;");
			expect(enumFile.content).toContain("export type StatusType = (typeof StatusType)[keyof typeof StatusType];");
		});
	});

	describe("local imports", () => {
		it("should import base type in per-type mode", () => {
			const schema = makeSchema([
				{
					className: "BaseEntity",
					xmlName: "BaseEntity",
					isRootElement: false,
					properties: [],
				},
				{
					className: "User",
					xmlName: "User",
					isRootElement: true,
					baseTypeName: "BaseEntity",
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const userFile = files.find((f) => f.fileName === "user.ts")!;
			expect(userFile.content).toContain("import { BaseEntity }");
			expect(userFile.content).toContain("./base-entity");
		});

		it("should import complexTypeName references in per-type mode", () => {
			const schema = makeSchema([
				{
					className: "AddressType",
					xmlName: "AddressType",
					isRootElement: false,
					properties: [],
				},
				{
					className: "Order",
					xmlName: "Order",
					isRootElement: true,
					properties: [
						{
							propertyName: "address",
							xmlName: "Address",
							kind: "element",
							tsType: "AddressType",
							initializer: "new AddressType()",
							complexTypeName: "AddressType",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const orderFile = files.find((f) => f.fileName === "order.ts")!;
			expect(orderFile.content).toContain("import { AddressType }");
		});

		it("should import arrayItemType references in per-type mode", () => {
			const schema = makeSchema([
				{
					className: "ItemType",
					xmlName: "ItemType",
					isRootElement: false,
					properties: [],
				},
				{
					className: "Container",
					xmlName: "Container",
					isRootElement: true,
					properties: [
						{
							propertyName: "items",
							xmlName: "Item",
							kind: "array",
							tsType: "ItemType[]",
							initializer: "[]",
							arrayItemName: "Item",
							arrayItemType: "ItemType",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const containerFile = files.find((f) => f.fileName === "container.ts")!;
			expect(containerFile.content).toContain("import { ItemType }");
		});

		it("should import enumTypeName references in per-type mode", () => {
			const schema = makeSchema(
				[
					{
						className: "Task",
						xmlName: "Task",
						isRootElement: true,
						properties: [
							{
								propertyName: "status",
								xmlName: "status",
								kind: "attribute",
								tsType: "StatusType",
								initializer: "''",
								enumTypeName: "StatusType",
							},
						],
					},
				],
				[
					{
						name: "StatusType",
						xmlName: "StatusType",
						values: ["active", "inactive"],
						baseType: "string",
					},
				],
			);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const taskFile = files.find((f) => f.fileName === "task.ts")!;
			expect(taskFile.content).toContain("import { StatusType }");
		});

		it("should not import self-reference", () => {
			const schema = makeSchema([
				{
					className: "Node",
					xmlName: "Node",
					isRootElement: true,
					properties: [
						{
							propertyName: "child",
							xmlName: "Child",
							kind: "element",
							tsType: "Node",
							initializer: "new Node()",
							complexTypeName: "Node",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			const nodeFile = files.find((f) => f.fileName === "node.ts")!;
			// Should not have a local import for itself
			expect(nodeFile.content).not.toContain("import { Node } from");
		});
	});

	describe("DynamicElement import", () => {
		it("should import DynamicElement in per-type mode when dynamic properties exist", () => {
			const schema = makeSchema([
				{
					className: "Config",
					xmlName: "Config",
					isRootElement: true,
					properties: [
						{
							propertyName: "content",
							xmlName: "",
							kind: "dynamic",
							tsType: "DynamicElement",
							initializer: "undefined!",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "config.ts")!;

			expect(classFile.content).toContain('import { DynamicElement, XmlDynamic, XmlRoot } from "@cerios/xml-poto";');
		});

		it("should import DynamicElement in single-file mode when dynamic properties exist", () => {
			const schema = makeSchema([
				{
					className: "Config",
					xmlName: "Config",
					isRootElement: true,
					properties: [
						{
							propertyName: "content",
							xmlName: "",
							kind: "dynamic",
							tsType: "DynamicElement",
							initializer: "undefined!",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema, "output");

			expect(files[0].content).toContain("DynamicElement");
		});
	});

	describe("generatePerXsd default fileName", () => {
		it("should use 'generated' as default fileName", () => {
			const schema = makeSchema([
				{
					className: "Simple",
					xmlName: "Simple",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerXsd(schema);

			expect(files[0].fileName).toBe("generated.ts");
		});
	});
});
