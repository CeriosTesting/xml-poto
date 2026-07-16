import { describe, expect, it } from "vitest";

import { XmlArray, XmlElement, XmlRoot, XmlSerializer } from "../../src";
import { findConstructorByName } from "../../src/decorators/storage/metadata-storage";
import { isTypeThunk, resolveMetadataType, resolveTypeRef } from "../../src/decorators/storage/type-ref";

describe("TypeRef (lazy type references)", () => {
	describe("isTypeThunk / resolveTypeRef", () => {
		class Plain {}
		abstract class AbstractPlain {}
		function LegacyCtor(this: unknown): void {
			// ES5-style constructor function
		}

		it("detects classes and function declarations as constructors", () => {
			expect(isTypeThunk(Plain)).toBe(false);
			expect(isTypeThunk(AbstractPlain)).toBe(false);
			expect(isTypeThunk(LegacyCtor as unknown as new () => object)).toBe(false);
		});

		it("detects arrow functions as thunks", () => {
			expect(isTypeThunk(() => Plain)).toBe(true);
		});

		it("resolves constructors and thunks alike", () => {
			expect(resolveTypeRef(Plain)).toBe(Plain);
			expect(resolveTypeRef(() => Plain)).toBe(Plain);
			expect(resolveTypeRef(undefined)).toBeUndefined();
		});

		it("resolveMetadataType caches the resolved constructor back into the metadata", () => {
			const meta: { type?: unknown } = { type: () => Plain };
			expect(resolveMetadataType(meta as { type?: never })).toBe(Plain);
			expect(meta.type).toBe(Plain);
			expect(resolveMetadataType(undefined)).toBeUndefined();
			expect(resolveMetadataType({})).toBeUndefined();
		});
	});

	describe("self-recursive types", () => {
		@XmlRoot({ name: "Section" })
		@XmlElement({ name: "Section" })
		class Section {
			@XmlElement({ name: "Title" })
			title?: string;

			@XmlArray({ containerName: "Children", itemName: "Section", type: () => Section })
			children?: Section[];
		}

		it("round-trips a nested tree of the same class", () => {
			const serializer = new XmlSerializer();

			const leaf = new Section();
			leaf.title = "Leaf";

			const mid = new Section();
			mid.title = "Middle";
			mid.children = [leaf];

			const root = new Section();
			root.title = "Root";
			root.children = [mid];

			const xml = serializer.toXml(root);
			const parsed = serializer.fromXml(xml, Section);

			expect(parsed.title).toBe("Root");
			expect(parsed.children?.[0]).toBeInstanceOf(Section);
			expect(parsed.children?.[0].title).toBe("Middle");
			expect(parsed.children?.[0].children?.[0]).toBeInstanceOf(Section);
			expect(parsed.children?.[0].children?.[0].title).toBe("Leaf");
		});
	});

	describe("mutually recursive types (genuine forward reference)", () => {
		// `type: () => LazyEmployee` references a class declared LATER in this file —
		// a direct reference here would be a TS error and a runtime TDZ ReferenceError.
		@XmlRoot({ name: "Department" })
		class LazyDepartment {
			@XmlElement({ name: "Name" })
			name?: string;

			@XmlElement({ name: "Head", type: () => LazyEmployee })
			head?: LazyEmployee;
		}

		@XmlElement({ name: "Employee" })
		class LazyEmployee {
			@XmlElement({ name: "FullName" })
			fullName?: string;

			@XmlElement({ name: "Dept", type: () => LazyDepartment })
			dept?: LazyDepartment;
		}

		it("round-trips both directions of the cycle", () => {
			const serializer = new XmlSerializer();

			const homeBase = new LazyDepartment();
			homeBase.name = "Engineering";

			const head = new LazyEmployee();
			head.fullName = "Alex";
			head.dept = homeBase;

			const department = new LazyDepartment();
			department.name = "Research";
			department.head = head;

			const xml = serializer.toXml(department);
			const parsed = serializer.fromXml(xml, LazyDepartment);

			expect(parsed.name).toBe("Research");
			expect(parsed.head).toBeInstanceOf(LazyEmployee);
			expect(parsed.head?.fullName).toBe("Alex");
			expect(parsed.head?.dept).toBeInstanceOf(LazyDepartment);
			expect(parsed.head?.dept?.name).toBe("Engineering");
		});

		it("registers thunk-referenced classes for auto-discovery on first lookup", () => {
			// The decorator could not register LazyEmployee eagerly (it was in TDZ);
			// the pending registration must flush on the first registry read.
			expect(findConstructorByName("LazyEmployee")).toBe(LazyEmployee);
			expect(findConstructorByName("LazyDepartment")).toBe(LazyDepartment);
		});
	});

	describe("xsi:type with thunk-declared types", () => {
		@XmlElement({ name: "BaseShape" })
		class BaseShape {
			@XmlElement({ name: "Id" })
			id?: string;
		}

		@XmlElement({ name: "Circle" })
		class Circle extends BaseShape {
			@XmlElement({ name: "Radius" })
			radius?: number;
		}

		@XmlRoot({ name: "Drawing" })
		class Drawing {
			@XmlElement({ name: "Shape", type: () => BaseShape })
			shape?: BaseShape;
		}

		it("emits xsi:type when the runtime type differs from the thunk-declared type", () => {
			const serializer = new XmlSerializer({ useXsiType: true });

			const drawing = new Drawing();
			const circle = new Circle();
			circle.id = "c1";
			circle.radius = 4;
			drawing.shape = circle;

			const xml = serializer.toXml(drawing);
			expect(xml).toContain('xsi:type="Circle"');
		});

		it("omits xsi:type when the runtime type matches the thunk-declared type", () => {
			const serializer = new XmlSerializer({ useXsiType: true });

			const drawing = new Drawing();
			const shape = new BaseShape();
			shape.id = "s1";
			drawing.shape = shape;

			const xml = serializer.toXml(drawing);
			expect(xml).not.toContain("xsi:type");
		});
	});

	describe("backward compatibility with direct constructors", () => {
		@XmlElement({ name: "Address" })
		class PlainAddress {
			@XmlElement({ name: "City" })
			city?: string;
		}

		@XmlRoot({ name: "Company" })
		class PlainCompany {
			@XmlElement({ name: "Address", type: PlainAddress })
			address?: PlainAddress;
		}

		it("still round-trips with a non-thunk type option", () => {
			const serializer = new XmlSerializer();

			const company = new PlainCompany();
			company.address = new PlainAddress();
			company.address.city = "Utrecht";

			const xml = serializer.toXml(company);
			const parsed = serializer.fromXml(xml, PlainCompany);

			expect(parsed.address).toBeInstanceOf(PlainAddress);
			expect(parsed.address?.city).toBe("Utrecht");
		});
	});
});
