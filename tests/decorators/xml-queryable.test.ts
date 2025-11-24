import { QueryableElement, XmlElement, XmlQueryable, XmlRoot, XmlSerializer } from "../../src";

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
	});
});
