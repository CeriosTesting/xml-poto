import { beforeEach, describe, expect, it } from "vitest";
import { XmlAttribute, XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("Metadata Caching Performance", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("Repeated Serialization Performance", () => {
		@XmlRoot({ name: "Product" })
		class Product {
			@XmlAttribute() id: string = "";
			@XmlAttribute() sku: string = "";
			@XmlElement() name: string = "";
			@XmlElement() description: string = "";
			@XmlElement() price: number = 0;
			@XmlElement() category: string = "";
			@XmlElement() manufacturer: string = "";
			@XmlElement() inStock: boolean = true;
		}

		it("should handle repeated serializations efficiently", () => {
			const products = Array.from({ length: 100 }, (_, i) => {
				const product = new Product();
				product.id = `prod-${i}`;
				product.sku = `SKU-${i}`;
				product.name = `Product ${i}`;
				product.description = `Description for product ${i}`;
				product.price = 10 + i;
				product.category = "Electronics";
				product.manufacturer = "TestCorp";
				product.inStock = i % 2 === 0;
				return product;
			});

			const startTime = performance.now();

			// Serialize all products - metadata lookups should be cached
			const xmlResults = products.map(product => serializer.toXml(product));

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Verify correctness
			expect(xmlResults).toHaveLength(100);
			expect(xmlResults[0]).toContain('id="prod-0"');
			expect(xmlResults[99]).toContain('id="prod-99"');

			// Performance assertion - should complete quickly due to caching
			// Typical duration on modern hardware: 5-15ms with caching
			expect(duration).toBeLessThan(100); // Very generous threshold
		});

		it("should handle repeated deserializations efficiently", () => {
			const xmlStrings = Array.from(
				{ length: 100 },
				(_, i) => `
				<Product id="prod-${i}" sku="SKU-${i}">
					<name>Product ${i}</name>
					<description>Description for product ${i}</description>
					<price>${10 + i}</price>
					<category>Electronics</category>
					<manufacturer>TestCorp</manufacturer>
					<inStock>${i % 2 === 0}</inStock>
				</Product>
			`
			);

			const startTime = performance.now();

			// Deserialize all XML - metadata lookups should be cached
			const products = xmlStrings.map(xml => serializer.fromXml(xml, Product));

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Verify correctness
			expect(products).toHaveLength(100);
			expect(products[0].id).toBe("prod-0");
			expect(products[99].id).toBe("prod-99");

			// Performance assertion - should complete quickly due to caching
			// Typical duration on modern hardware: 10-30ms with caching
			expect(duration).toBeLessThan(150); // Very generous threshold
		});
	});

	describe("Namespace Caching", () => {
		const ns = { uri: "http://example.com/schema", prefix: "ex" };

		@XmlRoot({ name: "Document", namespace: ns })
		class Document {
			@XmlAttribute({ namespace: ns }) version: string = "1.0";
			@XmlElement({ namespace: ns }) title: string = "";
			@XmlElement({ namespace: ns }) content: string = "";
		}

		it("should cache namespace resolution for repeated serializations", () => {
			const documents = Array.from({ length: 50 }, (_, i) => {
				const doc = new Document();
				doc.version = `${i}.0`;
				doc.title = `Document ${i}`;
				doc.content = `Content for document ${i}`;
				return doc;
			});

			const startTime = performance.now();

			// Serialize all documents - namespace building should be cached
			const xmlResults = documents.map(doc => serializer.toXml(doc));

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Verify correctness
			expect(xmlResults).toHaveLength(50);
			expect(xmlResults[0]).toContain("ex:Document");
			expect(xmlResults[0]).toContain("ex:title");

			// Performance assertion
			expect(duration).toBeLessThan(75);
		});
	});

	describe("getAllMetadata Performance", () => {
		@XmlRoot({ name: "ComplexObject" })
		class ComplexObject {
			@XmlAttribute() attr1: string = "";
			@XmlAttribute() attr2: string = "";
			@XmlAttribute() attr3: string = "";
			@XmlElement() elem1: string = "";
			@XmlElement() elem2: string = "";
			@XmlElement() elem3: string = "";
			@XmlElement() elem4: string = "";
			@XmlElement() elem5: string = "";
		}

		it("should efficiently handle objects with many decorated properties", () => {
			const objects = Array.from({ length: 100 }, (_, i) => {
				const obj = new ComplexObject();
				obj.attr1 = `a1-${i}`;
				obj.attr2 = `a2-${i}`;
				obj.attr3 = `a3-${i}`;
				obj.elem1 = `e1-${i}`;
				obj.elem2 = `e2-${i}`;
				obj.elem3 = `e3-${i}`;
				obj.elem4 = `e4-${i}`;
				obj.elem5 = `e5-${i}`;
				return obj;
			});

			const startTime = performance.now();

			// Process all objects - getAllMetadata should prevent repeated lookups
			const xmlResults = objects.map(obj => serializer.toXml(obj));

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Verify correctness
			expect(xmlResults).toHaveLength(100);
			expect(xmlResults[0]).toContain('attr1="a1-0"');

			// With getAllMetadata optimization, this should be fast
			expect(duration).toBeLessThan(100);
		});
	});
});
