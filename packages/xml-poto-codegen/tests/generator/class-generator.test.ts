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

		it("should merge extends-cycle classes into one file and emit thunks for the back-reference", () => {
			const schema = makeSchema([
				{
					className: "PersonType",
					xmlName: "PersonType",
					isRootElement: false,
					properties: [
						{
							propertyName: "manager",
							xmlName: "Manager",
							kind: "element",
							tsType: "ManagerType",
							initializer: "new ManagerType()",
							complexTypeName: "ManagerType",
						},
					],
				},
				{
					className: "ManagerType",
					xmlName: "ManagerType",
					isRootElement: false,
					baseTypeName: "PersonType",
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);

			// Base and derived share a cycle through an extends edge, so they must
			// live in the same module (named after the base class).
			expect(files.some((f) => f.fileName === "manager-type.ts")).toBe(false);
			const personFile = files.find((f) => f.fileName === "person-type.ts")!;
			expect(personFile.exports).toEqual(["PersonType", "ManagerType"]);
			expect(personFile.content.indexOf("class PersonType")).toBeLessThan(
				personFile.content.indexOf("class ManagerType extends PersonType"),
			);
			// The cyclic decorator reference is a thunk; no self-file import is emitted.
			expect(personFile.content).toContain("type: () => ManagerType");
			expect(personFile.content).not.toContain('from "./manager-type"');

			const indexFile = files.find((f) => f.fileName === "index.ts")!;
			expect(indexFile.content).toContain('export { PersonType, ManagerType } from "./person-type";');
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

		it("should declare classes dependency-first when the XSD declares them out of order", () => {
			// Derived and referencing types come first, as in alphabetically-ordered XSDs.
			const schema = makeSchema([
				{
					className: "AdminType",
					xmlName: "AdminType",
					isRootElement: false,
					baseTypeName: "UserType",
					properties: [],
				},
				{
					className: "CompanyType",
					xmlName: "CompanyType",
					isRootElement: false,
					properties: [
						{
							propertyName: "owner",
							xmlName: "Owner",
							kind: "element",
							tsType: "UserType",
							initializer: "new UserType()",
							complexTypeName: "UserType",
						},
						{
							propertyName: "admins",
							xmlName: "Admin",
							kind: "array",
							tsType: "AdminType[]",
							initializer: "[]",
							arrayItemType: "AdminType",
						},
					],
				},
				{
					className: "UserType",
					xmlName: "UserType",
					isRootElement: false,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const content = gen.generatePerXsd(schema, "output")[0].content;

			const userAt = content.indexOf("class UserType");
			const adminAt = content.indexOf("class AdminType");
			const companyAt = content.indexOf("class CompanyType");
			expect(userAt).toBeGreaterThanOrEqual(0);
			expect(userAt).toBeLessThan(adminAt);
			expect(adminAt).toBeLessThan(companyAt);
			// References stay direct identifiers — no thunks needed for acyclic types
			expect(content).toContain("type: UserType");
			expect(content).toContain("type: AdminType");
			expect(content).not.toContain("() =>");
		});

		it("should emit () => thunks for circular and self references", () => {
			const schema = makeSchema([
				{
					className: "PersonType",
					xmlName: "PersonType",
					isRootElement: false,
					properties: [
						{
							propertyName: "manager",
							xmlName: "Manager",
							kind: "element",
							tsType: "ManagerType",
							initializer: "new ManagerType()",
							complexTypeName: "ManagerType",
						},
					],
				},
				{
					className: "ManagerType",
					xmlName: "ManagerType",
					isRootElement: false,
					baseTypeName: "PersonType",
					properties: [],
				},
				{
					className: "SectionType",
					xmlName: "SectionType",
					isRootElement: false,
					properties: [
						{
							propertyName: "sections",
							xmlName: "Section",
							kind: "array",
							tsType: "SectionType[]",
							initializer: "[]",
							arrayItemType: "SectionType",
						},
					],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const content = gen.generatePerXsd(schema, "output")[0].content;

			// The extends edge is satisfied by ordering; the soft back-edge becomes a thunk.
			expect(content.indexOf("class PersonType")).toBeLessThan(content.indexOf("class ManagerType"));
			expect(content).toContain("class ManagerType extends PersonType");
			expect(content).toContain("type: () => ManagerType");
			// Self-recursion always needs a thunk.
			expect(content).toContain("type: () => SectionType");
		});

		it("should emit a definite-assignment assertion for required enum-typed properties", () => {
			const schema = makeSchema(
				[
					{
						className: "Order",
						xmlName: "Order",
						isRootElement: true,
						properties: [
							{
								propertyName: "status",
								xmlName: "Status",
								kind: "element",
								tsType: "StatusType",
								// The resolver carries the base type's initializer, which is not
								// assignable to the enum type.
								initializer: "''",
								required: true,
								enumTypeName: "StatusType",
							},
							{
								propertyName: "priority",
								xmlName: "Priority",
								kind: "element",
								tsType: "StatusType",
								initializer: "''",
								required: false,
								enumTypeName: "StatusType",
							},
						],
					},
				],
				[{ name: "StatusType", xmlName: "StatusType", values: ["open", "closed"], baseType: "string" }],
			);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const content = gen.generatePerXsd(schema, "output")[0].content;

			expect(content).toContain("status!: StatusType;");
			expect(content).not.toContain("status!: StatusType = ");
			expect(content).toContain("priority?: StatusType;");
		});

		// A required member whose facets no default value can satisfy gets the same
		// treatment: `= ''` under pattern="[A-Z]{2}" only defers the problem to a
		// runtime facet error at serialization time, so let tsc catch it instead.
		it("should emit a definite-assignment assertion for required properties whose facets reject the default", () => {
			const schema = makeSchema([
				{
					className: "Payment",
					xmlName: "Payment",
					isRootElement: true,
					properties: [
						{
							propertyName: "country",
							xmlName: "Country",
							kind: "element",
							tsType: "string",
							initializer: "''",
							required: true,
							pattern: "[A-Z]{2}",
						},
						{
							propertyName: "beneficiary",
							xmlName: "Beneficiary",
							kind: "element",
							tsType: "string",
							initializer: "''",
							required: true,
							minLength: 2,
						},
						{
							propertyName: "quantity",
							xmlName: "Quantity",
							kind: "element",
							tsType: "number",
							initializer: "0",
							required: true,
							minInclusive: 1,
						},
					],
				},
			]);

			const content = new ClassGenerator({ xsdPath: "test.xsd" }).generatePerXsd(schema, "output")[0].content;

			expect(content).toContain("country!: string;");
			expect(content).toContain("beneficiary!: string;");
			expect(content).toContain("quantity!: number;");
			expect(content).not.toContain("country: string = ''");
		});

		it("should keep the initializer for required properties their facets accept", () => {
			const schema = makeSchema([
				{
					className: "Payment",
					xmlName: "Payment",
					isRootElement: true,
					properties: [
						{
							propertyName: "note",
							xmlName: "Note",
							kind: "element",
							tsType: "string",
							initializer: "''",
							required: true,
							maxLength: 20,
						},
						{
							// minInclusive 0 accepts the generated default of 0.
							propertyName: "total",
							xmlName: "Total",
							kind: "element",
							tsType: "number",
							initializer: "0",
							required: true,
							minInclusive: 0,
						},
						{
							propertyName: "plain",
							xmlName: "Plain",
							kind: "element",
							tsType: "string",
							initializer: "''",
							required: true,
						},
					],
				},
			]);

			const content = new ClassGenerator({ xsdPath: "test.xsd" }).generatePerXsd(schema, "output")[0].content;

			expect(content).toContain("note: string = '';");
			expect(content).toContain("total: number = 0;");
			expect(content).toContain("plain: string = '';");
		});

		it("should keep the initializer when the schema supplies a default or fixed value", () => {
			const schema = makeSchema([
				{
					className: "Doc",
					xmlName: "Doc",
					isRootElement: true,
					properties: [
						{
							// The schema chose this value, so it is expected to be valid
							// even though the pattern would reject an empty string.
							propertyName: "country",
							xmlName: "Country",
							kind: "element",
							tsType: "string",
							initializer: "'NL'",
							required: true,
							pattern: "[A-Z]{2}",
							defaultValue: "NL",
						},
					],
				},
			]);

			const content = new ClassGenerator({ xsdPath: "test.xsd" }).generatePerXsd(schema, "output")[0].content;

			expect(content).toContain("country: string = 'NL';");
			expect(content).not.toContain("country!:");
		});

		describe("requiredPropertyStyle", () => {
			// A mix the default style splits: `country` fails its pattern, `plain` passes,
			// `status` has no assignable initializer, `addr` is an abstract complex type.
			const mixedSchema = (): ResolvedSchema =>
				makeSchema(
					[
						{
							className: "Payment",
							xmlName: "Payment",
							isRootElement: true,
							properties: [
								{
									propertyName: "country",
									xmlName: "Country",
									kind: "element",
									tsType: "string",
									initializer: "''",
									required: true,
									pattern: "[A-Z]{2}",
								},
								{
									propertyName: "quantity",
									xmlName: "Quantity",
									kind: "element",
									tsType: "number",
									initializer: "0",
									required: true,
									minInclusive: 1,
								},
								{
									propertyName: "plain",
									xmlName: "Plain",
									kind: "element",
									tsType: "string",
									initializer: "''",
									required: true,
								},
								{
									propertyName: "status",
									xmlName: "Status",
									kind: "element",
									tsType: "StatusType",
									initializer: "''",
									required: true,
									enumTypeName: "StatusType",
								},
								{
									propertyName: "addr",
									xmlName: "Addr",
									kind: "element",
									tsType: "AddressType",
									initializer: "new AddressType()",
									required: true,
									complexTypeName: "AddressType",
									isAbstractType: true,
								},
								{
									propertyName: "note",
									xmlName: "Note",
									kind: "element",
									tsType: "string",
									initializer: "''",
									required: false,
								},
							],
						},
					],
					[{ name: "StatusType", xmlName: "StatusType", values: ["open", "closed"], baseType: "string" }],
				);

			const generate = (style?: "schema" | "definite" | "initialized"): string =>
				new ClassGenerator({ xsdPath: "test.xsd", requiredPropertyStyle: style }).generatePerXsd(
					mixedSchema(),
					"output",
				)[0].content;

			it("should default to the schema-aware style when the option is omitted", () => {
				expect(generate()).toBe(generate("schema"));
			});

			it("should split on facets under 'schema'", () => {
				const content = generate("schema");

				expect(content).toContain("country!: string;");
				expect(content).toContain("quantity!: number;");
				expect(content).toContain("plain: string = '';");
			});

			it("should drop every initializer under 'definite'", () => {
				const content = generate("definite");

				expect(content).toContain("country!: string;");
				expect(content).toContain("quantity!: number;");
				expect(content).toContain("plain!: string;");
				expect(content).toContain("addr!: AddressType;");
				expect(content).not.toContain(" = '';");
			});

			it("should emit `!` under 'definite' even when the schema supplies a default", () => {
				const schema = makeSchema([
					{
						className: "Doc",
						xmlName: "Doc",
						isRootElement: true,
						properties: [
							{
								propertyName: "country",
								xmlName: "Country",
								kind: "element",
								tsType: "string",
								initializer: "'NL'",
								required: true,
								pattern: "[A-Z]{2}",
								defaultValue: "NL",
							},
						],
					},
				]);

				const content = new ClassGenerator({
					xsdPath: "test.xsd",
					requiredPropertyStyle: "definite",
				}).generatePerXsd(schema, "output")[0].content;

				expect(content).toContain("country!: string;");
				expect(content).not.toContain("= 'NL'");
			});

			it("should keep every initializer under 'initialized', facets notwithstanding", () => {
				const content = generate("initialized");

				expect(content).toContain("country: string = '';");
				expect(content).toContain("quantity: number = 0;");
				expect(content).toContain("plain: string = '';");
			});

			// Neither has an assignable value, so 'initialized' cannot honour the request.
			it("should still emit `!` for enum- and abstract-typed members under 'initialized'", () => {
				const content = generate("initialized");

				expect(content).toContain("status!: StatusType;");
				expect(content).toContain("addr!: AddressType;");
			});

			it("should leave optional properties untouched under every style", () => {
				for (const style of ["schema", "definite", "initialized"] as const) {
					expect(generate(style)).toContain("note?: string;");
				}
			});
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

	describe("useXmlRoot", () => {
		it("should emit @XmlElement instead of @XmlRoot when useXmlRoot is false (per-type)", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "person.ts")!;

			expect(classFile.content).toContain("@XmlElement({ name: 'Person' })");
			expect(classFile.content).not.toContain("@XmlRoot");
		});

		it("should emit @XmlElement instead of @XmlRoot when useXmlRoot is false (per-xsd)", () => {
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

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false });
			const files = gen.generatePerXsd(schema, "output");

			expect(files[0].content).not.toContain("@XmlRoot");
			expect(files[0].content).toContain("@XmlElement");
		});

		it("should skip rootElement promotion when useXmlRoot is false", () => {
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

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "order-type.ts")!;

			expect(classFile.content).toContain("@XmlElement({ name: 'OrderType' })");
			expect(classFile.content).not.toContain("@XmlRoot");
		});

		it("should default to true (emit @XmlRoot)", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd" });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "person.ts")!;

			expect(classFile.content).toContain("@XmlRoot({ name: 'Person' })");
		});

		it("should propagate elementFormDefault as form when useXmlRoot is false", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false, elementFormDefault: "qualified" });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "person.ts")!;

			expect(classFile.content).toContain("@XmlElement");
			expect(classFile.content).toContain("form: 'qualified'");
			expect(classFile.content).not.toContain("@XmlRoot");
		});

		it("should emit isNullable on @XmlElement when useXmlRoot is false and root is nillable", () => {
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

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "order-type.ts")!;

			expect(classFile.content).toContain("@XmlElement");
			expect(classFile.content).not.toContain("@XmlRoot");
			// rootElements promotion is skipped when useXmlRoot is false,
			// so nillable is not applied
			expect(classFile.content).not.toContain("isNullable");
		});

		it("should not add form when elementFormDefault is not set", () => {
			const schema = makeSchema([
				{
					className: "Person",
					xmlName: "Person",
					isRootElement: true,
					properties: [],
				},
			]);

			const gen = new ClassGenerator({ xsdPath: "test.xsd", useXmlRoot: false });
			const files = gen.generatePerType(schema);
			const classFile = files.find((f) => f.fileName === "person.ts")!;

			expect(classFile.content).toContain("@XmlElement({ name: 'Person' })");
			expect(classFile.content).not.toContain("form:");
		});
	});
});
