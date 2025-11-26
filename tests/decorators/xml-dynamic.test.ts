import { DynamicElement, QueryableElement, XmlDynamic, XmlElement, XmlQuery, XmlRoot, XmlSerializer } from "../../src";

describe("XmlDynamic Decorator (Bi-directional)", () => {
	const serializer = new XmlSerializer();

	describe("DynamicElement Mutation Methods", () => {
		it("should add a child element", () => {
			const xml = `<Root><Child1>Value1</Child1></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			// Add a new child
			const newChild = new QueryableElement({
				name: "Child2",
				qualifiedName: "Child2",
				text: "Value2",
			});

			root.dynamic.addChild(newChild);

			expect(root.dynamic.children).toHaveLength(2);
			expect(root.dynamic.children[1].name).toBe("Child2");
			expect(root.dynamic.children[1].text).toBe("Value2");
			expect(root.dynamic.children[1].parent).toBe(root.dynamic);
		});

		it("should create a child element from data", () => {
			const xml = `<Root></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const child = root.dynamic.createChild({
				name: "NewElement",
				text: "Test",
				attributes: { id: "123" },
			});

			expect(child.name).toBe("NewElement");
			expect(child.text).toBe("Test");
			expect(child.attributes.id).toBe("123");
			expect(child.parent).toBe(root.dynamic);
			expect(root.dynamic.children).toHaveLength(1);
		});

		it("should remove a child element by reference", () => {
			const xml = `<Root><Child1>A</Child1><Child2>B</Child2><Child3>C</Child3></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const childToRemove = root.dynamic.children[1];
			const removed = root.dynamic.removeChild(childToRemove);

			expect(removed).toBe(true);
			expect(root.dynamic.children).toHaveLength(2);
			expect(root.dynamic.children[0].text).toBe("A");
			expect(root.dynamic.children[1].text).toBe("C");
			expect(childToRemove.parent).toBeUndefined();
		});

		it("should remove a child element by index", () => {
			const xml = `<Root><Child1>A</Child1><Child2>B</Child2><Child3>C</Child3></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const removed = root.dynamic.removeChild(0);

			expect(removed).toBe(true);
			expect(root.dynamic.children).toHaveLength(2);
			expect(root.dynamic.children[0].text).toBe("B");
			expect(root.dynamic.children[1].text).toBe("C");
		});

		it("should remove element from its parent", () => {
			const xml = `<Root><Child1>A</Child1><Child2>B</Child2></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const child = root.dynamic.children[0];
			const removed = child.remove();

			expect(removed).toBe(true);
			expect(root.dynamic.children).toHaveLength(1);
			expect(root.dynamic.children[0].text).toBe("B");
		});

		it("should update element properties", () => {
			const xml = `<Root><Child>Original</Child></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const child = root.dynamic.children[0];
			child.update({
				name: "UpdatedChild",
				text: "Updated Text",
				attributes: { newAttr: "value" },
			});

			expect(child.name).toBe("UpdatedChild");
			expect(child.text).toBe("Updated Text");
			expect(child.attributes.newAttr).toBe("value");
		});

		it("should set and remove attributes", () => {
			const xml = `<Root id="1"><Child>Text</Child></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			// Set new attribute
			root.dynamic.setAttribute("version", "2.0");
			expect(root.dynamic.attributes.version).toBe("2.0");

			// Remove attribute
			const removed = root.dynamic.removeAttribute("id");
			expect(removed).toBe(true);
			expect(root.dynamic.attributes.id).toBeUndefined();
		});

		it("should set text content", () => {
			const xml = `<Root><Child>Old Text</Child></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const child = root.dynamic.children[0];
			child.setText("New Text");

			expect(child.text).toBe("New Text");
		});

		it("should clear all children", () => {
			const xml = `<Root><Child1>A</Child1><Child2>B</Child2><Child3>C</Child3></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			root.dynamic.clearChildren();

			expect(root.dynamic.children).toHaveLength(0);
			expect(root.dynamic.hasChildren).toBe(false);
			expect(root.dynamic.isLeaf).toBe(true);
		});

		it("should replace a child element", () => {
			const xml = `<Root><Child1>A</Child1><Child2>B</Child2></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const oldChild = root.dynamic.children[0];
			const newChild = new QueryableElement({
				name: "NewChild",
				qualifiedName: "NewChild",
				text: "Replacement",
			});

			const replaced = root.dynamic.replaceChild(oldChild, newChild);

			expect(replaced).toBe(true);
			expect(root.dynamic.children[0]).toBe(newChild);
			expect(root.dynamic.children[0].text).toBe("Replacement");
			expect(oldChild.parent).toBeUndefined();
			expect(newChild.parent).toBe(root.dynamic);
		});

		it("should update paths when elements are modified", () => {
			const xml = `<Root><Parent><Child>Text</Child></Parent></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const parent = root.dynamic.children[0];
			const child = parent.children[0];

			expect(child.path).toBe("Root/Parent/Child");
			expect(child.depth).toBe(2);

			// Update parent name
			parent.update({ name: "UpdatedParent" });

			// Paths should be updated
			expect(parent.path).toBe("Root/UpdatedParent");
			expect(child.path).toBe("Root/UpdatedParent/Child");
		});

		it("should clone an element", () => {
			const xml = `<Root id="1"><Child attr="value">Text</Child></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			const cloned = root.dynamic.clone();

			expect(cloned).not.toBe(root.dynamic);
			expect(cloned.name).toBe(root.dynamic.name);
			expect(cloned.attributes.id).toBe("1");
			expect(cloned.children).toHaveLength(1);
			expect(cloned.children[0].name).toBe("Child");
			expect(cloned.children[0].text).toBe("Text");
		});

		it("should set namespace declarations", () => {
			const xml = `<Root></Root>`;
			const root = serializer.fromXml(xml, RootElement);

			root.dynamic.setNamespaceDeclaration("xs", "http://www.w3.org/2001/XMLSchema");
			root.dynamic.setNamespaceDeclaration("", "http://example.com/default");

			expect(root.dynamic.xmlnsDeclarations?.xs).toBe("http://www.w3.org/2001/XMLSchema");
			expect(root.dynamic.xmlnsDeclarations?.default).toBe("http://example.com/default");
		});
	});

	describe("XML Serialization (toXml)", () => {
		it("should serialize simple element to XML", () => {
			const element = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
				text: "Hello World",
			});

			const xml = element.toXml();

			expect(xml).toBe("<Root>Hello World</Root>");
		});

		it("should serialize element with attributes", () => {
			const element = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
				attributes: { id: "123", version: "1.0" },
				text: "Content",
			});

			const xml = element.toXml();

			expect(xml).toContain('id="123"');
			expect(xml).toContain('version="1.0"');
			expect(xml).toContain(">Content</Root>");
		});

		it("should serialize empty element with self-closing tag", () => {
			const element = new QueryableElement({
				name: "Empty",
				qualifiedName: "Empty",
			});

			const xml = element.toXml({ selfClosing: true });

			expect(xml).toBe("<Empty/>");
		});

		it("should serialize empty element with explicit closing tag", () => {
			const element = new QueryableElement({
				name: "Empty",
				qualifiedName: "Empty",
			});

			const xml = element.toXml({ selfClosing: false });

			expect(xml).toBe("<Empty></Empty>");
		});

		it("should serialize nested elements", () => {
			const root = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
			});

			root.createChild({ name: "Child1", text: "Value1" });
			root.createChild({ name: "Child2", text: "Value2" });

			const xml = root.toXml();

			expect(xml).toContain("<Child1>Value1</Child1>");
			expect(xml).toContain("<Child2>Value2</Child2>");
		});

		it("should serialize with indentation", () => {
			const root = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
			});

			root.createChild({ name: "Child1", text: "Value1" });
			root.createChild({ name: "Child2", text: "Value2" });

			const xml = root.toXml({ indent: "  " });

			expect(xml).toContain("  <Child1>Value1</Child1>");
			expect(xml).toContain("  <Child2>Value2</Child2>");
		});

		it("should serialize with XML declaration", () => {
			const element = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
			});

			const xml = element.toXml({ includeDeclaration: true });

			expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
		});

		it("should serialize with namespace declarations", () => {
			const root = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
			});

			root.setNamespaceDeclaration("xs", "http://www.w3.org/2001/XMLSchema");
			root.setNamespaceDeclaration("", "http://example.com/default");

			const xml = root.toXml();

			expect(xml).toContain('xmlns="http://example.com/default"');
			expect(xml).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"');
		});

		it("should escape XML special characters", () => {
			const element = new QueryableElement({
				name: "Root",
				qualifiedName: "Root",
				text: '<tag>content & "quotes"</tag>',
				attributes: { attr: 'value with "quotes" & <brackets>' },
			});

			const xml = element.toXml();

			expect(xml).toContain("&lt;tag&gt;content &amp; &quot;quotes&quot;&lt;/tag&gt;");
			expect(xml).toContain('attr="value with &quot;quotes&quot; &amp; &lt;brackets&gt;"');
		});

		it("should serialize namespaced elements", () => {
			const element = new QueryableElement({
				name: "Element",
				namespace: "xs",
				qualifiedName: "xs:Element",
				namespaceUri: "http://www.w3.org/2001/XMLSchema",
			});

			const xml = element.toXml();

			expect(xml).toContain("<xs:Element");
			expect(xml).toContain("</xs:Element>");
		});
	});

	describe("XmlQuery Mutation Methods", () => {
		it("should set attributes on multiple elements", () => {
			const xml = `
				<Root>
					<Item>A</Item>
					<Item>B</Item>
					<Item>C</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Item").setAttr("processed", "true");

			const items = root.dynamic.children;
			expect(items[0].attributes.processed).toBe("true");
			expect(items[1].attributes.processed).toBe("true");
			expect(items[2].attributes.processed).toBe("true");
		});

		it("should set attributes with function", () => {
			const xml = `
				<Root>
					<Item>A</Item>
					<Item>B</Item>
					<Item>C</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Item").setAttr("index", el => String(el.indexInParent));

			const items = root.dynamic.children;
			expect(items[0].attributes.index).toBe("0");
			expect(items[1].attributes.index).toBe("1");
			expect(items[2].attributes.index).toBe("2");
		});

		it("should remove attributes from multiple elements", () => {
			const xml = `
				<Root>
					<Item id="1">A</Item>
					<Item id="2">B</Item>
					<Item id="3">C</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Item").removeAttr("id");

			const items = root.dynamic.children;
			expect(items[0].attributes.id).toBeUndefined();
			expect(items[1].attributes.id).toBeUndefined();
			expect(items[2].attributes.id).toBeUndefined();
		});

		it("should set text on multiple elements", () => {
			const xml = `
				<Root>
					<Item>A</Item>
					<Item>B</Item>
					<Item>C</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Item").setText("Updated");

			const items = root.dynamic.children;
			expect(items[0].text).toBe("Updated");
			expect(items[1].text).toBe("Updated");
			expect(items[2].text).toBe("Updated");
		});

		it("should update elements with batch operation", () => {
			const xml = `
				<Root>
					<Item>A</Item>
					<Item>B</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Item").updateElements({
				name: "UpdatedItem",
				attributes: { updated: "true" },
			});

			const items = root.dynamic.children;
			expect(items[0].name).toBe("UpdatedItem");
			expect(items[0].attributes.updated).toBe("true");
			expect(items[1].name).toBe("UpdatedItem");
			expect(items[1].attributes.updated).toBe("true");
		});

		it("should remove multiple elements", () => {
			const xml = `
				<Root>
					<Item status="active">A</Item>
					<Item status="inactive">B</Item>
					<Item status="active">C</Item>
					<Item status="inactive">D</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			const count = query.find("Item").whereAttribute("status", "inactive").removeElements();

			expect(count).toBe(2);
			expect(root.dynamic.children).toHaveLength(2);
			expect(root.dynamic.children[0].text).toBe("A");
			expect(root.dynamic.children[1].text).toBe("C");
		});

		it("should append children to multiple elements", () => {
			const xml = `
				<Root>
					<Parent1></Parent1>
					<Parent2></Parent2>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Parent1").appendChild(parent => {
				return new QueryableElement({
					name: "Child",
					qualifiedName: "Child",
					text: `Child of ${parent.name}`,
				});
			});

			const parent1 = root.dynamic.children[0];
			expect(parent1.children).toHaveLength(1);
			expect(parent1.children[0].text).toBe("Child of Parent1");
		});

		it("should clear children from multiple elements", () => {
			const xml = `
				<Root>
					<Parent1><Child>A</Child></Parent1>
					<Parent2><Child>B</Child></Parent2>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			query.find("Parent1").clearChildren();
			query.find("Parent2").clearChildren();

			expect(root.dynamic.children[0].children).toHaveLength(0);
			expect(root.dynamic.children[1].children).toHaveLength(0);
		});

		it("should serialize query results to XML", () => {
			const xml = `
				<Root>
					<Item id="1">A</Item>
					<Item id="2">B</Item>
				</Root>
			`;
			const root = serializer.fromXml(xml, RootElement);

			const query = new XmlQuery([root.dynamic]);
			const xmlStrings = query.find("Item").toXmlStrings();

			expect(xmlStrings).toHaveLength(2);
			expect(xmlStrings[0]).toContain('id="1"');
			expect(xmlStrings[1]).toContain('id="2"');
		});
	});

	describe("End-to-End Bi-directional Workflow", () => {
		it("should parse, modify, and serialize back", () => {
			const originalXml = `
				<Catalog>
					<Product id="1">
						<Name>Laptop</Name>
						<Price>999.99</Price>
					</Product>
					<Product id="2">
						<Name>Mouse</Name>
						<Price>29.99</Price>
					</Product>
				</Catalog>
			`;

			// Parse
			const catalog = serializer.fromXml(originalXml, RootElement);

			// Modify: update prices
			const query = new XmlQuery([catalog.dynamic]);
			const products = query.find("Product");

			products.children().whereText("999.99").setText("899.99");
			products.children().whereText("29.99").setText("24.99");

			// Add new product
			const newProduct = catalog.dynamic.createChild({
				name: "Product",
				attributes: { id: "3" },
			});
			newProduct.createChild({ name: "Name", text: "Keyboard" });
			newProduct.createChild({ name: "Price", text: "79.99" });

			// Serialize back
			const modifiedXml = catalog.dynamic.toXml({ indent: "  " });

			expect(modifiedXml).toContain("899.99");
			expect(modifiedXml).toContain("24.99");
			expect(modifiedXml).toContain("Keyboard");
			expect(modifiedXml).toContain("79.99");
			expect(modifiedXml).toContain('id="3"');
		});

		it("should create XML from scratch", () => {
			// Create root element
			const config = new QueryableElement({
				name: "Config",
				qualifiedName: "Config",
				attributes: { version: "1.0" },
			});

			// Build structure
			const database = config.createChild({ name: "Database" });
			database.createChild({ name: "Host", text: "localhost" });
			database.createChild({ name: "Port", text: "5432" });
			database.createChild({ name: "Name", text: "mydb" });

			const logging = config.createChild({ name: "Logging" });
			logging.createChild({ name: "Level", text: "INFO" });
			logging.createChild({ name: "File", text: "/var/log/app.log" });

			// Serialize
			const xml = config.toXml({ indent: "  ", includeDeclaration: true });

			expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(xml).toContain('<Config version="1.0">');
			expect(xml).toContain("<Database>");
			expect(xml).toContain("<Host>localhost</Host>");
			expect(xml).toContain("<Logging>");
			expect(xml).toContain("<Level>INFO</Level>");
		});

		it("should support complex transformations", () => {
			const xml = `
				<Orders>
					<Order id="1" status="pending">
						<Item price="100">Widget</Item>
						<Item price="50">Gadget</Item>
					</Order>
					<Order id="2" status="pending">
						<Item price="200">Tool</Item>
					</Order>
				</Orders>
			`;

			const orders = serializer.fromXml(xml, RootElement);
			const query = new XmlQuery([orders.dynamic]);

			// Find all orders and update their status
			query.find("Order").setAttr("status", "processed");

			// Add processing timestamp to all orders
			query.find("Order").appendChild(() => {
				return new QueryableElement({
					name: "ProcessedAt",
					qualifiedName: "ProcessedAt",
					text: new Date().toISOString(),
				});
			});

			// Calculate and add total to each order
			const orderElements = query.find("Order").toArray();
			for (const order of orderElements) {
				const items = order.children.filter(c => c.name === "Item");
				const total = items.reduce((sum, item) => {
					const price = parseFloat(item.attributes.price || "0");
					return sum + price;
				}, 0);

				order.createChild({ name: "Total", text: String(total) });
			}

			const result = orders.dynamic.toXml({ indent: "  " });

			expect(result).toContain('status="processed"');
			expect(result).toContain("<ProcessedAt>");
			expect(result).toContain("<Total>150</Total>"); // Order 1: 100 + 50
			expect(result).toContain("<Total>200</Total>"); // Order 2: 200
		});
	});

	describe("XmlDynamic vs XmlQueryable", () => {
		it("should work identically to XmlQueryable", () => {
			@XmlRoot({ elementName: "TestRoot" })
			class WithDynamic {
				@XmlDynamic()
				dynamic?: DynamicElement;
			}

			const xml = `<TestRoot><Child>Test</Child></TestRoot>`;
			const obj = serializer.fromXml(xml, WithDynamic);

			expect(obj.dynamic).toBeDefined();
			expect(obj.dynamic?.name).toBe("TestRoot");
			expect(obj.dynamic?.children).toHaveLength(1);
		});
	});
});

// Test helper class
@XmlRoot({ elementName: "Root" })
class RootElement {
	@XmlDynamic()
	dynamic!: DynamicElement;

	@XmlElement({ name: "Title" })
	title?: string;
}
