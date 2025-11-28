import { describe, expect, it } from "vitest";
import { XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("DOCTYPE Support", () => {
	@XmlRoot({ name: "document" })
	class SimpleDoc {
		@XmlElement()
		content: string = "test";
	}

	describe("DOCTYPE with SYSTEM identifier", () => {
		it("should add DOCTYPE with SYSTEM identifier", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					systemId: "document.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<!DOCTYPE document SYSTEM "document.dtd">');
		});

		it("should place DOCTYPE after XML declaration", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					systemId: "document.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			const declIndex = xml.indexOf('<?xml version="1.0"?>');
			const docTypeIndex = xml.indexOf("<!DOCTYPE");
			const docIndex = xml.indexOf("<document>");

			expect(declIndex).toBeLessThan(docTypeIndex);
			expect(docTypeIndex).toBeLessThan(docIndex);
		});
	});

	describe("DOCTYPE with PUBLIC identifier", () => {
		it("should add DOCTYPE with PUBLIC and SYSTEM identifiers", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					publicId: "-//W3C//DTD XHTML 1.0 Strict//EN",
					systemId: "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<!DOCTYPE document PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"');
			expect(xml).toContain('"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">');
		});

		it("should support HTML5-like DOCTYPE declarations", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "html",
					publicId: "-//W3C//DTD HTML 4.01//EN",
					systemId: "http://www.w3.org/TR/html4/strict.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN"');
		});
	});

	describe("DOCTYPE with internal subset", () => {
		it("should add DOCTYPE with internal subset", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					systemId: "document.dtd",
					internalSubset: '<!ENTITY company "Acme Inc.">',
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<!DOCTYPE document SYSTEM "document.dtd" [<!ENTITY company "Acme Inc.">]>');
		});

		it("should support complex internal subset with multiple declarations", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					internalSubset: "\n<!ELEMENT title (#PCDATA)>\n<!ELEMENT author (#PCDATA)>\n",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!DOCTYPE document [");
			expect(xml).toContain("<!ELEMENT title (#PCDATA)>");
			expect(xml).toContain("<!ELEMENT author (#PCDATA)>");
			expect(xml).toContain("]>");
		});
	});

	describe("DOCTYPE without SYSTEM or PUBLIC", () => {
		it("should support DOCTYPE with only root element and internal subset", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "document",
					internalSubset: '<!ENTITY version "1.0">',
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain('<!DOCTYPE document [<!ENTITY version "1.0">]>');
		});
	});

	describe("DOCTYPE with processing instructions", () => {
		it("should place DOCTYPE after processing instructions", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				processingInstructions: [{ target: "xml-stylesheet", data: 'href="style.xsl"' }],
				docType: {
					rootElement: "document",
					systemId: "document.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			const piIndex = xml.indexOf("<?xml-stylesheet");
			const docTypeIndex = xml.indexOf("<!DOCTYPE");
			const docIndex = xml.indexOf("<document>");

			expect(piIndex).toBeLessThan(docTypeIndex);
			expect(docTypeIndex).toBeLessThan(docIndex);
		});
	});

	describe("DOCTYPE without XML declaration", () => {
		it("should support DOCTYPE when XML declaration is omitted", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				omitXmlDeclaration: true,
				docType: {
					rootElement: "document",
					systemId: "document.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain('<?xml version="1.0"?>');
			expect(xml).toContain('<!DOCTYPE document SYSTEM "document.dtd">');
			expect(xml).toContain("<document>");
		});
	});

	describe("Real-world DOCTYPE examples", () => {
		it("should support XHTML 1.0 Strict DOCTYPE", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "html",
					publicId: "-//W3C//DTD XHTML 1.0 Strict//EN",
					systemId: "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain(
				'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">'
			);
		});

		it("should support SVG DOCTYPE", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({
				docType: {
					rootElement: "svg",
					publicId: "-//W3C//DTD SVG 1.1//EN",
					systemId: "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd",
				},
			});

			const xml = serializer.toXml(doc);

			expect(xml).toContain(
				'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
			);
		});
	});

	describe("No DOCTYPE", () => {
		it("should not include DOCTYPE when not specified", () => {
			const doc = new SimpleDoc();
			const serializer = new XmlDecoratorSerializer({});

			const xml = serializer.toXml(doc);

			expect(xml).not.toContain("<!DOCTYPE");
		});
	});
});
