import { describe, expect, it } from "vitest";
import { XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("Processing Instructions", () => {
	@XmlRoot({ name: "document" })
	class SimpleDoc {
		@XmlElement()
		content: string = "test";
	}

	describe("Single Processing Instruction", () => {
		it("should add a single processing instruction", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [{ target: "xml-stylesheet", data: 'type="text/xsl" href="style.xsl"' }],
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<?xml version="1.0"');
			expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="style.xsl"?>');
			expect(xml).toContain("<document>");
		});

		it("should place processing instruction after XML declaration", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [{ target: "custom-pi", data: "value" }],
			});

			const xml = serializer.toXml(doc);

			const piIndex = xml.indexOf("<?custom-pi value?>");
			const declIndex = xml.indexOf('<?xml version="1.0"');
			const docIndex = xml.indexOf("<document>");

			expect(declIndex).toBeLessThan(piIndex);
			expect(piIndex).toBeLessThan(docIndex);
		});
	});

	describe("Multiple Processing Instructions", () => {
		it("should add multiple processing instructions in order", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [
					{ target: "xml-stylesheet", data: 'type="text/xsl" href="style.xsl"' },
					{ target: "custom-app", data: "processing-data" },
					{ target: "another-pi", data: "more-data" },
				],
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<?xml-stylesheet");
			expect(xml).toContain("<?custom-app");
			expect(xml).toContain("<?another-pi");

			const pi1Index = xml.indexOf("<?xml-stylesheet");
			const pi2Index = xml.indexOf("<?custom-app");
			const pi3Index = xml.indexOf("<?another-pi");

			expect(pi1Index).toBeLessThan(pi2Index);
			expect(pi2Index).toBeLessThan(pi3Index);
		});
	});

	describe("Common Processing Instructions", () => {
		it("should support xml-stylesheet processing instruction", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [{ target: "xml-stylesheet", data: 'type="text/css" href="styles.css"' }],
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<?xml-stylesheet type="text/css" href="styles.css"?>');
		});

		it("should support custom application processing instructions", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [
					{ target: "myapp", data: "action=process" },
					{ target: "editor", data: "readonly=true" },
				],
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<?myapp action=process?>");
			expect(xml).toContain("<?editor readonly=true?>");
		});
	});

	describe("Empty Processing Instructions", () => {
		it("should handle empty processingInstructions array", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [],
			});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<?xml-stylesheet");
			expect(xml).toContain('<?xml version="1.0"');
			expect(xml).toContain("<document>");
		});

		it("should handle undefined processingInstructions", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<?xml-stylesheet");
			expect(xml).toContain('<?xml version="1.0"');
		});
	});

	describe("Processing Instructions with DOCTYPE", () => {
		it("should place processing instructions before DOCTYPE", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [{ target: "xml-stylesheet", data: 'href="style.xsl"' }],
				docType: { rootElement: "document", systemId: "doc.dtd" },
			});

			const xml = serializer.toXml(doc);

			const piIndex = xml.indexOf("<?xml-stylesheet");
			const docTypeIndex = xml.indexOf("<!DOCTYPE");

			expect(piIndex).toBeLessThan(docTypeIndex);
		});
	});

	describe("Processing Instructions without XML Declaration", () => {
		it("should support processing instructions when XML declaration is omitted", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				omitXmlDeclaration: true,
				processingInstructions: [{ target: "custom", data: "value" }],
			});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain('<?xml version="1.0"?>');
			expect(xml).toContain("<?custom value?>");
			expect(xml).toContain("<document>");
		});
	});
});
