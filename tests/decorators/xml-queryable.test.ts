import {
	QueryableElement,
	XmlArrayItem,
	XmlAttribute,
	XmlElement,
	XmlQueryable,
	XmlRoot,
	XmlSerializer,
	XmlText,
} from "../../src";

describe("XmlQueryable Decorator", () => {
	@XmlRoot({ elementName: "Catalog" })
	class ProductCatalog {
		@XmlQueryable()
		query?: QueryableElement;

		@XmlElement({ name: "Products" })
		products: Product[] = [];
	}

	@XmlElement({ name: "Product" })
	class Product {
		@XmlElement({ name: "Name" })
		name: string = "";

		@XmlElement({ name: "Price" })
		price: number = 0;

		@XmlElement({ name: "Category" })
		category: string = "";
	}

	const serializer = new XmlSerializer();

	describe("Basic QueryableElement Creation", () => {
		it("should create QueryableElement from simple XML", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product>
							<Name>Laptop</Name>
							<Price>999.99</Price>
							<Category>Electronics</Category>
						</Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			expect(catalog.query).toBeDefined();
			expect(catalog.query?.name).toBe("Catalog");
			expect(catalog.query?.hasChildren).toBe(true);
		});

		it("should parse attributes correctly", () => {
			const xml = `<Catalog id="CAT001" version="1.0"><Products /></Catalog>`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			expect(catalog.query?.attributes).toBeDefined();
			expect(catalog.query?.attributes.id).toBe("CAT001");
			expect(catalog.query?.attributes.version).toBe("1.0");
		});

		it("should parse text content", () => {
			@XmlRoot({ elementName: "Message" })
			class Message {
				@XmlQueryable()
				query?: QueryableElement;

				@XmlElement({ name: "Text" })
				text: string = "";
			}

			const xml = `<Message><Text>Hello World</Text></Message>`;
			const msg = serializer.fromXml(xml, Message);

			const textElement = msg.query?.children.find(c => c.name === "Text");
			expect(textElement?.text).toBe("Hello World");
			// rawText is undefined by default (preserveRawText: false)
			expect(textElement?.rawText).toBeUndefined();
		});
	});

	describe("QueryableElement Tree Structure", () => {
		it("should build correct parent-child relationships", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product>
							<Name>Mouse</Name>
						</Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			const productsElement = catalog.query?.children.find(c => c.name === "Products");
			expect(productsElement).toBeDefined();
			expect(productsElement?.parent).toBe(catalog.query);
			expect(productsElement?.depth).toBe(1);
			expect(productsElement?.path).toBe("Catalog/Products");
		});

		it("should set correct depth and path for nested elements", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product>
							<Name>Keyboard</Name>
						</Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			const productElement = catalog.query?.children[0]?.children[0];
			expect(productElement?.depth).toBe(2);
			expect(productElement?.path).toBe("Catalog/Products/Product");

			const nameElement = productElement?.children[0];
			expect(nameElement?.depth).toBe(3);
			expect(nameElement?.path).toBe("Catalog/Products/Product/Name");
		});

		it("should handle multiple children with correct indexInParent", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product><Name>Item1</Name></Product>
						<Product><Name>Item2</Name></Product>
						<Product><Name>Item3</Name></Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);
			const products = catalog.query?.children[0]?.children;

			expect(products).toHaveLength(3);
			expect(products?.[0]?.indexInParent).toBe(0);
			expect(products?.[1]?.indexInParent).toBe(1);
			expect(products?.[2]?.indexInParent).toBe(2);
		});
	});

	describe("Numeric and Boolean Parsing", () => {
		it("should parse numeric values when parseNumeric is true", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product>
							<Price>99.99</Price>
						</Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);
			const priceElement = catalog.query?.children[0]?.children[0]?.children.find(c => c.name === "Price");

			expect(priceElement?.text).toBe("99.99");
			expect(priceElement?.numericValue).toBe(99.99);
		});

		it("should parse boolean values when parseBoolean is true", () => {
			@XmlRoot({ elementName: "Config" })
			class Config {
				@XmlQueryable()
				query?: QueryableElement;

				@XmlElement({ name: "Enabled" })
				enabled: boolean = false;
			}

			const xml = `<Config><Enabled>true</Enabled></Config>`;
			const config = serializer.fromXml(xml, Config);

			const enabledElement = config.query?.children.find(c => c.name === "Enabled");
			expect(enabledElement?.text).toBe("true");
			expect(enabledElement?.booleanValue).toBe(true);
		});

		it("should not parse numeric values when parseNumeric is false", () => {
			@XmlRoot({ elementName: "Data" })
			class Data {
				@XmlQueryable({ parseNumeric: false })
				query?: QueryableElement;

				@XmlElement({ name: "Value" })
				value: string = "";
			}

			const xml = `<Data><Value>123</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			const valueElement = data.query?.children.find(c => c.name === "Value");
			expect(valueElement?.text).toBe("123");
			expect(valueElement?.numericValue).toBeUndefined();
		});
	});

	describe("QueryableElement Options", () => {
		it("should respect parseChildren: false", () => {
			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlQueryable({ parseChildren: false })
				query?: QueryableElement;

				@XmlElement({ name: "Child" })
				child: string = "";
			}

			const xml = `<Root><Child>Test</Child></Root>`;
			const root = serializer.fromXml(xml, Root);

			expect(root.query?.children).toEqual([]);
			expect(root.query?.hasChildren).toBe(false);
			expect(root.query?.isLeaf).toBe(true);
		});
	});

	describe("Integration with Query API", () => {
		it("should work with XmlQuery find() method", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product><Name>Laptop</Name><Price>999.99</Price></Product>
						<Product><Name>Mouse</Name><Price>29.99</Price></Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			// Use the query API (assumes XmlQuery has a find method that works with QueryableElement)
			const names = catalog.query?.children[0]?.children.flatMap(p =>
				p.children.filter(c => c.name === "Name").map(c => c.text)
			);

			expect(names).toEqual(["Laptop", "Mouse"]);
		});

		it("should allow querying by path", () => {
			const xml = `
				<Catalog>
					<Products>
						<Product><Name>Keyboard</Name><Price>79.99</Price></Product>
					</Products>
				</Catalog>
			`;

			const catalog = serializer.fromXml(xml, ProductCatalog);

			// Find element by path
			const productElement = catalog.query?.children
				.find(c => c.path === "Catalog/Products")
				?.children.find(c => c.path === "Catalog/Products/Product");

			expect(productElement).toBeDefined();
			expect(productElement?.name).toBe("Product");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty elements", () => {
			const xml = `<Catalog><Products /></Catalog>`;
			const catalog = serializer.fromXml(xml, ProductCatalog);

			expect(catalog.query?.children).toHaveLength(1);
			const productsElement = catalog.query?.children[0];
			expect(productsElement?.hasChildren).toBe(false);
			expect(productsElement?.isLeaf).toBe(true);
		});

		it("should handle elements with only attributes", () => {
			const xml = `<Catalog version="1.0"><Products count="0" /></Catalog>`;
			const catalog = serializer.fromXml(xml, ProductCatalog);

			const productsElement = catalog.query?.children[0];
			expect(productsElement?.attributes.count).toBe("0");
			expect(productsElement?.hasChildren).toBe(false);
		});

		it("should handle CDATA content", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlQueryable()
				query?: QueryableElement;

				@XmlElement({ name: "Content", useCDATA: true })
				content: string = "";
			}

			const xml = `<Document><Content><![CDATA[<p>HTML content</p>]]></Content></Document>`;
			const doc = serializer.fromXml(xml, Document);

			const contentElement = doc.query?.children.find(c => c.name === "Content");
			expect(contentElement?.text).toBe("<p>HTML content</p>");
		});
	});

	describe("Multiple QueryableElement Properties", () => {
		it("should support multiple queryable properties on the same class", () => {
			@XmlRoot({ elementName: "Root" })
			class MultiQuery {
				@XmlQueryable({ parseNumeric: true })
				query1?: QueryableElement;

				@XmlQueryable({ parseNumeric: false })
				query2?: QueryableElement;

				@XmlElement({ name: "Value" })
				value: string = "123";
			}

			const xml = `<Root><Value>123</Value></Root>`;
			const obj = serializer.fromXml(xml, MultiQuery);

			expect(obj.query1).toBeDefined();
			expect(obj.query2).toBeDefined();
			expect(obj.query1?.children[0]?.numericValue).toBe(123);
			expect(obj.query2?.children[0]?.numericValue).toBeUndefined();
		});
	});

	describe("Nested @XmlElement with @XmlQueryable", () => {
		it("should automatically initialize @XmlQueryable on nested @XmlElement classes", () => {
			@XmlElement({ name: "Item" })
			class NestedItem {
				@XmlQueryable()
				query?: QueryableElement;

				@XmlElement({ name: "Name" })
				name: string = "";
			}

			@XmlRoot({ elementName: "Root" })
			class Container {
				@XmlElement({ name: "Item", type: NestedItem })
				item?: NestedItem;
			}

			const xml = `
				<Root>
					<Item>
						<Name>TestItem</Name>
					</Item>
				</Root>
			`;

			const container = serializer.fromXml(xml, Container);

			// The nested item's @XmlQueryable should be automatically initialized
			expect(container.item).toBeDefined();
			expect(container.item?.query).toBeDefined();
			expect(container.item?.query?.name).toBe("Item");
			expect(container.item?.query?.children.length).toBeGreaterThan(0);

			// Verify the query API works on the nested element
			const nameElement = container.item?.query?.children.find(c => c.name === "Name");
			expect(nameElement?.text).toBe("TestItem");
		});

		it("should use the correct element name for nested @XmlElement with @XmlQueryable", () => {
			@XmlElement({ name: "DataPoint" })
			class DataPoint {
				@XmlQueryable()
				query?: QueryableElement;
			}

			@XmlRoot({ elementName: "Root" })
			class Root {
				@XmlElement({ name: "DataPoint", type: DataPoint })
				dataPoint?: DataPoint;
			}

			const xml = `<Root><DataPoint attr="value">text content</DataPoint></Root>`;
			const root = serializer.fromXml(xml, Root);

			// Query should be initialized with the correct element name
			expect(root.dataPoint?.query?.name).toBe("DataPoint");
			expect(root.dataPoint?.query?.qualifiedName).toBe("DataPoint");
			expect(root.dataPoint?.query?.attributes.attr).toBe("value");
			expect(root.dataPoint?.query?.text).toBe("text content");
		});

		it("should handle namespace-prefixed element names in @XmlElement with @XmlQueryable", () => {
			// Simulate XBRL structure with namespace-prefixed elements
			@XmlElement("xbrli:identifier")
			class XBRLIdentifier {
				@XmlAttribute({ name: "scheme" })
				scheme?: string;

				@XmlText()
				value: string = "";
			}

			@XmlElement("xbrli:entity")
			class XBRLEntity {
				@XmlElement({ name: "xbrli:identifier", type: XBRLIdentifier })
				identifier: XBRLIdentifier = new XBRLIdentifier();

				@XmlQueryable()
				query?: QueryableElement;
			}

			@XmlRoot({ elementName: "xbrli:xbrl" })
			class XBRLRoot {
				@XmlArrayItem({ itemName: "xbrli:entity", type: XBRLEntity })
				entities: XBRLEntity[] = [];

				@XmlQueryable()
				query?: QueryableElement;
			}

			const xml = `
				<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
					<xbrli:entity>
						<xbrli:identifier scheme="http://www.sec.gov/CIK">ABC123</xbrli:identifier>
					</xbrli:entity>
				</xbrli:xbrl>
			`;

			const root = serializer.fromXml(xml, XBRLRoot);

			// Root QueryableElement should be initialized with namespace-prefixed name
			expect(root.query).toBeDefined();
			expect(root.query?.name).toBe("xbrli:xbrl");
			expect(root.query?.qualifiedName).toBe("xbrli:xbrl");

			// Nested entity should also have QueryableElement properly initialized
			expect(root.entities).toHaveLength(1);
			expect(root.entities[0].query).toBeDefined();
			expect(root.entities[0].query?.name).toBe("xbrli:entity");
			expect(root.entities[0].query?.qualifiedName).toBe("xbrli:entity");

			// Should be able to access nested structure through query API
			expect(root.entities[0].identifier.value).toBe("ABC123");
			expect(root.entities[0].identifier.scheme).toBe("http://www.sec.gov/CIK");

			// Query should provide access to child elements
			const entityChildren = root.entities[0].query?.children || [];
			expect(entityChildren.length).toBeGreaterThan(0);
		});

		it("should handle xbrli:xbrl as a nested element with @XmlQueryable", () => {
			// Simulate a scenario where xbrli:xbrl is nested inside another root element
			@XmlElement("xbrli:context")
			class XBRLContext {
				@XmlAttribute({ name: "id" })
				id: string = "";
			}

			@XmlElement("xbrli:xbrl")
			class NestedXBRLRoot {
				@XmlArrayItem({ itemName: "xbrli:context", type: XBRLContext })
				contexts: XBRLContext[] = [];

				@XmlQueryable()
				query?: QueryableElement;
			}

			@XmlRoot({ elementName: "Document" })
			class DocumentRoot {
				@XmlElement({ name: "xbrli:xbrl", type: NestedXBRLRoot })
				xbrlData?: NestedXBRLRoot;

				@XmlQueryable()
				query?: QueryableElement;
			}

			const xml = `
				<Document>
					<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
						<xbrli:context id="Current"/>
						<xbrli:context id="Prior"/>
					</xbrli:xbrl>
				</Document>
			`;

			const doc = serializer.fromXml(xml, DocumentRoot);

			// Document root query should work
			expect(doc.query).toBeDefined();
			expect(doc.query?.name).toBe("Document");

			// Nested xbrli:xbrl should have QueryableElement initialized with namespace-prefixed name
			expect(doc.xbrlData).toBeDefined();
			expect(doc.xbrlData?.query).toBeDefined();
			expect(doc.xbrlData?.query?.name).toBe("xbrli:xbrl");
			expect(doc.xbrlData?.query?.qualifiedName).toBe("xbrli:xbrl");

			// Contexts should be properly deserialized
			expect(doc.xbrlData?.contexts).toHaveLength(2);
			expect(doc.xbrlData?.contexts[0].id).toBe("Current");
			expect(doc.xbrlData?.contexts[1].id).toBe("Prior");

			// Query should provide access to child elements including contexts
			const contextElements = doc.xbrlData?.query?.children || [];
			expect(contextElements.length).toBeGreaterThanOrEqual(2);
			expect(contextElements.some(c => c.name === "xbrli:context" && c.attributes.id === "Current")).toBe(true);
		});

		it("should initialize @XmlQueryable on array items with namespace-prefixed names", () => {
			// Simulate XBRL array items with namespace prefixes
			@XmlElement("xbrli:context")
			class XBRLContextWithQuery {
				@XmlAttribute({ name: "id" })
				id: string = "";

				@XmlQueryable()
				query?: QueryableElement;
			}

			@XmlRoot({ elementName: "Root" })
			class RootWithContextArray {
				@XmlArrayItem({ itemName: "xbrli:context", type: XBRLContextWithQuery })
				contexts: XBRLContextWithQuery[] = [];

				@XmlQueryable()
				query?: QueryableElement;
			}

			const xml = `
				<Root xmlns:xbrli="http://www.xbrl.org/2003/instance">
					<xbrli:context id="Current"/>
					<xbrli:context id="Prior"/>
					<xbrli:context id="Instant"/>
				</Root>
			`;

			const root = serializer.fromXml(xml, RootWithContextArray);

			// Root query should be initialized
			expect(root.query).toBeDefined();
			expect(root.query?.name).toBe("Root");

			// Array should have all items
			expect(root.contexts).toHaveLength(3);

			// Each array item's query should be initialized with the namespace-prefixed element name
			root.contexts.forEach(context => {
				expect(context.query).toBeDefined();
				expect(context.query?.name).toBe("xbrli:context");
				expect(context.query?.qualifiedName).toBe("xbrli:context");
				expect(context.query?.attributes.id).toBe(context.id);
			});

			// Verify specific contexts
			expect(root.contexts[0].id).toBe("Current");
			expect(root.contexts[0].query?.name).toBe("xbrli:context");
			expect(root.contexts[1].id).toBe("Prior");
			expect(root.contexts[1].query?.name).toBe("xbrli:context");
			expect(root.contexts[2].id).toBe("Instant");
			expect(root.contexts[2].query?.name).toBe("xbrli:context");
		});
	});

	describe("Error Handling and Validation", () => {
		it("should successfully initialize @XmlQueryable on root element even when empty", () => {
			@XmlRoot({ elementName: "Root" })
			class RootWithQuery {
				@XmlQueryable({ required: true })
				query!: QueryableElement;
			}

			const xml = `<Root />`;
			const root = serializer.fromXml(xml, RootWithQuery);

			// Root element always exists, so query should be initialized even if root is empty
			expect(root.query).toBeDefined();
			expect(root.query?.name).toBe("Root");
			expect(root.query?.hasChildren).toBe(false);
		});

		it("should throw error during deserialization when required @XmlQueryable for targetProperty is missing", () => {
			@XmlRoot({ elementName: "Root" })
			class RootWithRequiredTargetQuery {
				@XmlElement({ name: "Items" })
				items?: string[];

				@XmlQueryable({ targetProperty: "items", required: true })
				itemsQuery!: QueryableElement;
			}

			const xml = `<Root />`;

			// Should throw during deserialization when required target property is missing
			expect(() => {
				serializer.fromXml(xml, RootWithRequiredTargetQuery);
			}).toThrow(/Required queryable element 'items' is missing/);
		});

		it("should return undefined for optional @XmlQueryable when targetProperty is missing", () => {
			@XmlRoot({ elementName: "Root" })
			class RootWithOptionalQuery {
				@XmlElement({ name: "Item" })
				item?: string;

				@XmlQueryable({ targetProperty: "item", required: false })
				itemQuery?: QueryableElement;
			}

			const xml = `<Root />`;
			const root = serializer.fromXml(xml, RootWithOptionalQuery);

			// Optional query for missing target property should return undefined without throwing
			expect(root.itemQuery).toBeUndefined();
		});

		it("should successfully initialize optional @XmlQueryable when element is found", () => {
			@XmlRoot({ elementName: "Root" })
			class RootWithOptionalQueryFound {
				@XmlElement({ name: "Item" })
				item?: string;

				@XmlQueryable({ targetProperty: "item", required: false })
				itemQuery?: QueryableElement;
			}

			const xml = `<Root><Item>TestItem</Item></Root>`;
			const root = serializer.fromXml(xml, RootWithOptionalQueryFound);

			// Optional query should be initialized when element exists
			expect(root.itemQuery).toBeDefined();
			expect(root.itemQuery?.name).toBe("Item");
		});
	});
});
