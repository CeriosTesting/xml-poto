import { DynamicElement, XmlDynamic, XmlRoot, XmlSerializer } from "../../src";

describe("Circular Reference Handling", () => {
	const serializer = new XmlSerializer();

	describe("XmlBuilder with DynamicElement", () => {
		it("should not cause stack overflow with parent references", () => {
			const xml = `
				<Root>
					<Parent>
						<Child>Value</Child>
					</Parent>
				</Root>
			`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);

			// This should not throw "Maximum call stack size exceeded"
			expect(() => {
				serializer.toXml(root);
			}).not.toThrow();
		});

		it("should serialize modified DynamicElement correctly", () => {
			const xml = `<Root><Item>Original</Item></Root>`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);

			// Modify the element
			root.dynamic.createChild({ name: "NewItem", text: "Added" });

			// Should serialize without stack overflow
			const result = serializer.toXml(root);

			expect(result).toContain("<Root>");
			expect(result).toContain("<Item>Original</Item>");
			expect(result).toContain("<NewItem>Added</NewItem>");
			expect(result).toContain("</Root>");
		});

		it("should handle deeply nested structures", () => {
			const xml = `
				<Root>
					<Level1>
						<Level2>
							<Level3>
								<Level4>Deep Value</Level4>
							</Level3>
						</Level2>
					</Level1>
				</Root>
			`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);

			// Should serialize deep nesting without issues
			expect(() => {
				const result = serializer.toXml(root);
				expect(result).toContain("Deep Value");
			}).not.toThrow();
		});

		it("should not include DynamicElement metadata in serialized XML", () => {
			const xml = `<Root><Item id="1">Test</Item></Root>`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);
			const result = serializer.toXml(root);

			// Should not contain DynamicElement internal properties
			expect(result).not.toContain("parent");
			expect(result).not.toContain("siblings");
			expect(result).not.toContain("depth");
			expect(result).not.toContain("path");
			expect(result).not.toContain("indexInParent");
			expect(result).not.toContain("hasChildren");
			expect(result).not.toContain("isLeaf");

			// Should contain actual content
			expect(result).toContain('<Item id="1">Test</Item>');
		});

		it("should handle sibling references without stack overflow", () => {
			const xml = `
				<Root>
					<Item>First</Item>
					<Item>Second</Item>
					<Item>Third</Item>
				</Root>
			`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);

			// Siblings array contains references to other elements
			expect(root.dynamic.children[0].siblings).toBeDefined();
			expect(root.dynamic.children[0].siblings.length).toBeGreaterThan(0);

			// Should serialize without stack overflow
			expect(() => {
				serializer.toXml(root);
			}).not.toThrow();
		});

		it("should handle modified elements with parent references", () => {
			const xml = `<Root><Container></Container></Root>`;

			@XmlRoot({ elementName: "Root" })
			class RootElement {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootElement);
			const container = root.dynamic.children[0];

			// Add children which will have parent references
			container.createChild({ name: "Child1", text: "A" });
			container.createChild({ name: "Child2", text: "B" });

			// Verify parent references are set
			expect(container.children[0].parent).toBe(container);
			expect(container.children[1].parent).toBe(container);

			// Should serialize without stack overflow
			const result = serializer.toXml(root);

			expect(result).toContain("<Child1>A</Child1>");
			expect(result).toContain("<Child2>B</Child2>");
		});
	});

	describe("XmlBuilder with regular objects", () => {
		it("should still work with regular objects", () => {
			@XmlRoot({ elementName: "Person" })
			class Person {
				name: string = "John";
				age: number = 30;
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<name>John</name>");
			expect(xml).toContain("<age>30</age>");
			expect(xml).toContain("</Person>");
		});
	});

	describe("Serializing DynamicElement content inline", () => {
		it("should serialize DynamicElement children as part of parent structure", () => {
			const xml = `
				<Data>
					<Item id="1">First</Item>
					<Item id="2">Second</Item>
				</Data>
			`;

			@XmlRoot({ elementName: "Data" })
			class DataClass {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const data = serializer.fromXml(xml, DataClass);

			// Add a new item dynamically
			data.dynamic.createChild({
				name: "Item",
				attributes: { id: "3" },
				text: "Third",
			});

			// Serialize using serializer.toXml()
			const result = serializer.toXml(data);

			// Should contain all items
			expect(result).toContain('<Item id="1">First</Item>');
			expect(result).toContain('<Item id="2">Second</Item>');
			expect(result).toContain('<Item id="3">Third</Item>');

			// Should NOT contain the dynamic wrapper
			expect(result).not.toContain("<dynamic>");
		});

		it("should work with namespaced elements", () => {
			const xml = `<Root xmlns:ns="http://example.com"><ns:Item>Test</ns:Item></Root>`;

			@XmlRoot({ elementName: "Root" })
			class RootClass {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const root = serializer.fromXml(xml, RootClass);

			// Add namespaced element
			root.dynamic.createChild({
				name: "Element",
				namespace: "ns",
				attributes: { attr: "value" },
				text: "Content",
			});

			const result = serializer.toXml(root);

			expect(result).toContain("ns:Item");
			expect(result).toContain("ns:Element");
			expect(result).toContain('attr="value"');
		});

		it("should handle mixed content with both regular and dynamic properties", () => {
			const { XmlElement } = require("../../src");

			@XmlRoot({ elementName: "Document" })
			class DocumentClass {
				@XmlElement({ name: "Title" })
				title: string = "My Document";

				@XmlDynamic()
				dynamic!: DynamicElement;

				@XmlElement({ name: "Footer" })
				footer: string = "End";
			}

			const xml = `<Document><Title>My Document</Title><Content>Dynamic</Content><Footer>End</Footer></Document>`;
			const doc = serializer.fromXml(xml, DocumentClass);

			// The dynamic element should have parsed the content
			const content = doc.dynamic.children.find(c => c.name === "Content");
			expect(content).toBeDefined();

			const result = serializer.toXml(doc);

			// Should contain both typed properties and dynamic content
			expect(result).toContain("<Title>My Document</Title>");
			expect(result).toContain("<Content>Dynamic</Content>");
			expect(result).toContain("<Footer>End</Footer>");
		});

		it("should handle XBRL-like structures", () => {
			const xbrlXml = `
				<data>
					<frc-vt-i:AdditionDefinitionValuation contextRef="UUID-1">Bedrijfsruimte</frc-vt-i:AdditionDefinitionValuation>
					<frc-vt-i:LandRegisterSection contextRef="UUID-2" judgementType="reviewed">Sectie C</frc-vt-i:LandRegisterSection>
				</data>
			`;

			@XmlRoot({ elementName: "data" })
			class XbrlData {
				@XmlDynamic()
				dynamic!: DynamicElement;
			}

			const data = serializer.fromXml(xbrlXml, XbrlData);

			// Serialize back
			const result = serializer.toXml(data);

			// Should contain the XBRL elements
			expect(result).toContain("frc-vt-i:AdditionDefinitionValuation");
			expect(result).toContain('contextRef="UUID-1"');
			expect(result).toContain("Bedrijfsruimte");
			expect(result).toContain("frc-vt-i:LandRegisterSection");
			expect(result).toContain('judgementType="reviewed"');
			expect(result).toContain("Sectie C");
		});
	});
});
