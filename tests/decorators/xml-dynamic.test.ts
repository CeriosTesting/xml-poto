import { describe, expect, test } from "@jest/globals";
import {
	DynamicElement,
	XmlArrayItem,
	XmlAttribute,
	XmlDecoratorSerializer,
	XmlDynamic,
	XmlElement,
	XmlRoot,
} from "../../src";
import { getXmlDynamicMetadata } from "../../src/decorators/getters/metadata-getters";

describe("@XmlDynamic", () => {
	describe("Metadata registration resilience", () => {
		test("should register dynamic metadata for @XmlRoot classes without instantiation", () => {
			@XmlRoot({ elementName: "data" })
			class RootDynamicClass {
				@XmlDynamic()
				entries: Map<string, DynamicElement> = new Map();
			}

			const metadata = getXmlDynamicMetadata(RootDynamicClass);
			expect(metadata).toBeDefined();
			expect(metadata?.propertyKey).toBe("entries");
		});

		test("should register dynamic metadata for @XmlElement classes without instantiation", () => {
			@XmlElement("wrapper")
			class ElementDynamicClass {
				@XmlDynamic()
				entries: Map<string, DynamicElement> = new Map();
			}

			const metadata = getXmlDynamicMetadata(ElementDynamicClass);
			expect(metadata).toBeDefined();
			expect(metadata?.propertyKey).toBe("entries");
		});
	});

	describe("Basic functionality", () => {
		test("should serialize dynamic elements with Map", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlElement()
				name: string = "test";

				@XmlDynamic()
				dynamicElements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();
			obj.dynamicElements.set("custom:Element1", {
				value: "value1",
				attributes: { id: "1", type: "string" },
			});
			obj.dynamicElements.set("custom:Element2", {
				value: "value2",
			});

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("<name>test</name>");
			expect(xml).toContain('<custom:Element1 id="1" type="string">value1</custom:Element1>');
			expect(xml).toContain("<custom:Element2>value2</custom:Element2>");
		});

		test("should serialize dynamic elements with Record", () => {
			@XmlRoot({ elementName: "config" })
			class ConfigClass {
				@XmlElement()
				version: string = "1.0";

				@XmlDynamic()
				settings: Record<string, DynamicElement> = {};
			}

			const config = new ConfigClass();
			config.settings["option1"] = { value: "enabled" };
			config.settings["option2"] = {
				value: "true",
				attributes: { type: "boolean" },
			};

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(config);

			expect(xml).toContain("<version>1.0</version>");
			expect(xml).toContain("<option1>enabled</option1>");
			expect(xml).toContain('<option2 type="boolean">true</option2>');
		});

		test("should handle empty dynamic elements container", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlElement()
				name: string = "test";

				@XmlDynamic()
				dynamicElements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("<name>test</name>");
			expect(xml).not.toContain("dynamicElements");
		});

		test("should handle undefined dynamic elements", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlElement()
				name: string = "test";

				@XmlDynamic()
				dynamicElements?: Map<string, DynamicElement>;
			}

			const obj = new TestClass();

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("<name>test</name>");
			expect(xml).not.toContain("dynamicElements");
		});
	});

	describe("XBRL use case", () => {
		@XmlElement("xbrli:context")
		class XBRLContext {
			@XmlAttribute()
			id: string = "";
		}

		@XmlElement("xbrli:unit")
		class XBRLUnit {
			@XmlAttribute()
			id: string = "";

			@XmlElement({ name: "xbrli:measure" })
			measure: string = "";
		}

		@XmlElement("xbrli:xbrl")
		class XBRLRoot {
			@XmlArrayItem({ itemName: "xbrli:context", type: XBRLContext })
			contexts: XBRLContext[] = [];

			@XmlArrayItem({ itemName: "xbrli:unit", type: XBRLUnit })
			units: XBRLUnit[] = [];

			@XmlDynamic()
			datapoints: Map<string, DynamicElement> = new Map();
		}

		@XmlRoot({ elementName: "envelope" })
		class Envelope {
			@XmlElement({ name: "xbrli:xbrl", type: XBRLRoot })
			xbrl: XBRLRoot = new XBRLRoot();
		}

		test("should serialize XBRL datapoints with dynamic element names", () => {
			const envelope = new Envelope();

			// Add context
			const context = new XBRLContext();
			context.id = "ctx1";
			envelope.xbrl.contexts.push(context);

			// Add unit
			const unit = new XBRLUnit();
			unit.id = "EUR";
			unit.measure = "iso4217:EUR";
			envelope.xbrl.units.push(unit);

			// Add dynamic datapoints
			envelope.xbrl.datapoints.set("nl-cd:TransferPrice", {
				value: "150000",
				attributes: {
					contextRef: "ctx1",
					unitRef: "EUR",
					decimals: "0",
				},
			});

			envelope.xbrl.datapoints.set("nl-cd:PropertyValue", {
				value: "500000",
				attributes: {
					contextRef: "ctx1",
					unitRef: "EUR",
					decimals: "0",
				},
			});

			envelope.xbrl.datapoints.set("nl-cd:YearOfConstruction", {
				value: "2020",
				attributes: {
					contextRef: "ctx1",
				},
			});

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(envelope);

			// Verify structure
			expect(xml).toContain('<xbrli:context id="ctx1"/>');
			expect(xml).toContain('<xbrli:unit id="EUR">');
			expect(xml).toContain("<xbrli:measure>iso4217:EUR</xbrli:measure>");

			// Verify dynamic datapoints
			expect(xml).toContain(
				'<nl-cd:TransferPrice contextRef="ctx1" unitRef="EUR" decimals="0">150000</nl-cd:TransferPrice>'
			);
			expect(xml).toContain(
				'<nl-cd:PropertyValue contextRef="ctx1" unitRef="EUR" decimals="0">500000</nl-cd:PropertyValue>'
			);
			expect(xml).toContain('<nl-cd:YearOfConstruction contextRef="ctx1">2020</nl-cd:YearOfConstruction>');
		});
	});

	describe("Edge cases", () => {
		test("should handle dynamic elements with special characters in values", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlDynamic()
				elements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();
			obj.elements.set("element", {
				value: "<tag> & \"quote\" 'apostrophe'",
			});

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("&lt;tag&gt;");
			expect(xml).toContain("&amp;");
			expect(xml).toContain("&quot;");
			expect(xml).toContain("&apos;");
		});

		test("should handle dynamic elements with empty values", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlDynamic()
				elements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();
			obj.elements.set("empty", { value: "" });

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("<empty></empty>");
		});

		test("should handle dynamic elements with multiple attributes", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlDynamic()
				elements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();
			obj.elements.set("element", {
				value: "content",
				attributes: {
					attr1: "value1",
					attr2: "value2",
					attr3: "value3",
				},
			});

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain('attr1="value1"');
			expect(xml).toContain('attr2="value2"');
			expect(xml).toContain('attr3="value3"');
			expect(xml).toContain(">content</element>");
		});

		test("should work alongside other decorators", () => {
			@XmlRoot({ elementName: "document" })
			class Document {
				@XmlAttribute()
				version: string = "1.0";

				@XmlElement()
				title: string = "Test Document";

				@XmlArrayItem({ itemName: "item" })
				items: string[] = ["item1", "item2"];

				@XmlDynamic()
				customFields: Map<string, DynamicElement> = new Map();
			}

			const doc = new Document();
			doc.customFields.set("custom:Field1", {
				value: "custom value",
				attributes: { type: "text" },
			});

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(doc);

			expect(xml).toContain('version="1.0"');
			expect(xml).toContain("<title>Test Document</title>");
			expect(xml).toContain("<item>item1</item>");
			expect(xml).toContain("<item>item2</item>");
			expect(xml).toContain('<custom:Field1 type="text">custom value</custom:Field1>');
		});

		test("should handle element names with namespaces", () => {
			@XmlRoot({ elementName: "root" })
			class TestClass {
				@XmlDynamic()
				elements: Map<string, DynamicElement> = new Map();
			}

			const obj = new TestClass();
			obj.elements.set("ns1:Element1", { value: "value1" });
			obj.elements.set("ns2:Element2", { value: "value2" });
			obj.elements.set("ns3:deeply:nested:Element", { value: "value3" });

			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(obj);

			expect(xml).toContain("<ns1:Element1>value1</ns1:Element1>");
			expect(xml).toContain("<ns2:Element2>value2</ns2:Element2>");
			expect(xml).toContain("<ns3:deeply:nested:Element>value3</ns3:deeply:nested:Element>");
		});
	});
});
