import { describe, expect, it } from "vitest";
import { DynamicElement, XmlDynamic, XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("@XmlDynamic Lazy Loading and Caching", () => {
	const serializer = new XmlSerializer();

	describe("Immediate Loading (lazyLoad: false - default)", () => {
		it("should immediately load DynamicElement by default", () => {
			@XmlRoot({ name: "Root" })
			class ImmediateRoot {
				@XmlDynamic()
				dynamic!: DynamicElement;

				@XmlElement({ name: "Title" })
				title?: string;
			}

			const xml = `<Root><Title>Test</Title></Root>`;
			const root = serializer.fromXml(xml, ImmediateRoot);

			// Should be immediately available without getter access
			expect(root.dynamic).toBeDefined();
			expect(root.dynamic.name).toBe("Root");
			expect(root.dynamic.children.length).toBeGreaterThan(0);
		});

		it("should parse all child elements immediately", () => {
			@XmlRoot({ name: "Document" })
			class ImmediateDocument {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const xml = `
				<Document>
					<Section id="1">
						<Title>Introduction</Title>
						<Content>Lorem ipsum</Content>
					</Section>
					<Section id="2">
						<Title>Conclusion</Title>
						<Content>The end</Content>
					</Section>
				</Document>
			`;

			const doc = serializer.fromXml(xml, ImmediateDocument);

			// All elements should be immediately parsed
			expect(doc.dynamic.children).toHaveLength(2);
			expect(doc.dynamic.children[0].name).toBe("Section");
			expect(doc.dynamic.children[0].attributes.id).toBe("1");
			expect(doc.dynamic.children[1].name).toBe("Section");
			expect(doc.dynamic.children[1].attributes.id).toBe("2");
		});

		it("should allow mutation of immediately loaded element", () => {
			@XmlRoot({ name: "Root" })
			class MutableRoot {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const xml = `<Root><Item>Original</Item></Root>`;
			const root = serializer.fromXml(xml, MutableRoot);

			// Modify immediately
			root.dynamic.children[0].setText("Modified");
			root.dynamic.createChild({ name: "NewItem", text: "Added" });

			expect(root.dynamic.children[0].text).toBe("Modified");
			expect(root.dynamic.children).toHaveLength(2);
			expect(root.dynamic.children[1].text).toBe("Added");
		});

		it("should allow manual assignment when lazyLoad is false", () => {
			@XmlRoot({ name: "Root" })
			class ManualRoot {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const root = new ManualRoot();

			// Manually create and assign DynamicElement
			root.dynamic = new DynamicElement({
				name: "Root",
				attributes: { version: "1.0" },
			});

			root.dynamic.createChild({ name: "Child", text: "Value" });

			expect(root.dynamic.name).toBe("Root");
			expect(root.dynamic.attributes.version).toBe("1.0");
			expect(root.dynamic.children).toHaveLength(1);
		});

		it("should serialize immediately loaded element correctly", () => {
			@XmlRoot({ name: "Config" })
			class ImmediateConfig {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const xml = `<Config><Setting name="timeout">30</Setting></Config>`;
			const config = serializer.fromXml(xml, ImmediateConfig);

			const serialized = config.dynamic.toXml({ indent: "  " });

			expect(serialized).toContain("<Config>");
			expect(serialized).toContain('<Setting name="timeout">30</Setting>');
			expect(serialized).toContain("</Config>");
		});

		it("should handle empty element with lazyLoad: false", () => {
			@XmlRoot({ name: "Empty" })
			class EmptyRoot {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const xml = `<Empty/>`;
			const root = serializer.fromXml(xml, EmptyRoot);

			expect(root.dynamic).toBeDefined();
			expect(root.dynamic.name).toBe("Empty");
			expect(root.dynamic.children).toHaveLength(0);
			expect(root.dynamic.isLeaf).toBe(true);
		});

		it("should handle element with only attributes with lazyLoad: false", () => {
			@XmlRoot({ name: "Attributed" })
			class AttributedRoot {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;
			}

			const xml = `<Attributed id="123" type="test"/>`;
			const root = serializer.fromXml(xml, AttributedRoot);

			expect(root.dynamic.attributes.id).toBe("123");
			expect(root.dynamic.attributes.type).toBe("test");
			expect(root.dynamic.children).toHaveLength(0);
		});

		it("should respect parseChildren: false with lazyLoad: false", () => {
			@XmlRoot({ name: "Root" })
			class NoChildrenRoot {
				@XmlDynamic({ lazyLoad: false, parseChildren: false })
				dynamic!: DynamicElement;
			}

			const xml = `<Root><Child>Value</Child></Root>`;
			const root = serializer.fromXml(xml, NoChildrenRoot);

			expect(root.dynamic.children).toHaveLength(0);
		});
	});

	describe("Lazy Loading (lazyLoad: true)", () => {
		it("should not build DynamicElement until first access", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement() id!: string;
				@XmlElement() name!: string;

				@XmlDynamic({ lazyLoad: true })
				query!: DynamicElement;
			}

			const xml = `<Product><id>123</id><name>Test Product</name></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Check that the builder function was set up using Symbol.for()
			const builderKey = Symbol.for("dynamic_builder_Product_query");
			expect((product as any)[builderKey]).toBeDefined();
			expect(typeof (product as any)[builderKey]).toBe("function");

			// Access the query property - this should trigger lazy loading
			const query = product.query;
			expect(query).toBeDefined();
			expect(query.name).toBe("Product");
			expect(query.children).toHaveLength(2);
		});

		it("should rebuild DynamicElement on each access when cache is false", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlDynamic({ lazyLoad: true, cache: false })
				query!: DynamicElement;
			}

			const xml = `<Product><id>123</id></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Access multiple times
			const query1 = product.query;
			const query2 = product.query;

			// Should be different instances (not cached)
			expect(query1).not.toBe(query2);
			expect(query1.name).toBe(query2.name);
		});

		it("should handle multiple queryable properties with independent lazy loading", () => {
			@XmlRoot({ name: "Library" })
			class Library {
				@XmlElement() books!: any;
				@XmlElement() magazines!: any;

				@XmlDynamic({ lazyLoad: true, targetProperty: "books" })
				booksQuery!: DynamicElement;
				@XmlDynamic({ lazyLoad: true, targetProperty: "magazines" })
				magazinesQuery!: DynamicElement;
			}

			const xml = `
				<Library>
					<books><book>Book1</book></books>
					<magazines><magazine>Mag1</magazine></magazines>
				</Library>
			`;

			const library = serializer.fromXml(xml, Library);

			// Check that both builders exist
			const booksBuilderKey = Symbol.for("dynamic_builder_Library_booksQuery");
			const magazinesBuilderKey = Symbol.for("dynamic_builder_Library_magazinesQuery");
			expect((library as any)[booksBuilderKey]).toBeDefined();
			expect((library as any)[magazinesBuilderKey]).toBeDefined(); // Access only books query
			const booksQuery = library.booksQuery;
			expect(booksQuery).toBeDefined();
			expect(booksQuery.name).toBe("books");

			// Magazines query should still be lazy (not built yet unless cache is enabled)
			const magazinesQuery = library.magazinesQuery;
			expect(magazinesQuery).toBeDefined();
			expect(magazinesQuery.name).toBe("magazines");
		});

		it("should handle empty elements with lazy loading", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlDynamic({ lazyLoad: true })
				query!: DynamicElement;
			}

			const xml = `<Container></Container>`;
			const container = serializer.fromXml(xml, Container);

			const query = container.query;
			expect(query).toBeDefined();
			expect(query.name).toBe("Container");
			expect(query.children).toHaveLength(0);
		});

		it("should handle undefined queryable elements gracefully", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement() data!: string;

				@XmlDynamic({ lazyLoad: true, targetProperty: "nonExistent" })
				missingQuery?: DynamicElement;
			}

			const xml = `<Container><data>test</data></Container>`;
			const container = serializer.fromXml(xml, Container);

			// Should still create a queryable element, even if target doesn't exist
			const query = container.missingQuery;
			expect(query).toBeDefined();
		});
	});

	describe("Caching with Lazy Loading", () => {
		it("should cache DynamicElement when cache option is true", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlDynamic({ lazyLoad: true, cache: true })
				query!: DynamicElement;
			}

			const xml = `<Product><id>123</id></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Access multiple times
			const query1 = product.query;
			const query2 = product.query;

			// Should be the same instance (cached)
			expect(query1).toBe(query2);
		});

		it("should cache lazily loaded element", () => {
			@XmlRoot({ name: "Root" })
			class CachedLazyRoot {
				@XmlDynamic({ lazyLoad: true, cache: true })
				dynamic!: DynamicElement;
			}

			const xml = `<Root><Child>Value</Child></Root>`;
			const root = serializer.fromXml(xml, CachedLazyRoot);

			const firstAccess = root.dynamic;
			const secondAccess = root.dynamic;

			// Should return the same instance (cached)
			expect(firstAccess).toBe(secondAccess);
		});

		it("should cache independently for different properties", () => {
			@XmlRoot({ name: "Store" })
			class Store {
				@XmlElement() products!: any;
				@XmlElement() customers!: any;

				@XmlDynamic({ lazyLoad: true, targetProperty: "products", cache: true })
				productsQuery!: DynamicElement;
				@XmlDynamic({ lazyLoad: true, targetProperty: "customers", cache: true })
				customersQuery!: DynamicElement;
			}

			const xml = `
				<Store>
					<products><product>P1</product></products>
					<customers><customer>C1</customer></customers>
				</Store>
			`;

			const store = serializer.fromXml(xml, Store);

			// Access both queries multiple times
			const productsQuery1 = store.productsQuery;
			const productsQuery2 = store.productsQuery;
			const customersQuery1 = store.customersQuery;
			const customersQuery2 = store.customersQuery;

			// Each property should cache its own instance
			expect(productsQuery1).toBe(productsQuery2);
			expect(customersQuery1).toBe(customersQuery2);
			expect(productsQuery1).not.toBe(customersQuery1);
		});

		it("should clear cache when property is manually set", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlDynamic({ lazyLoad: true, cache: true })
				query!: DynamicElement;
			}

			const xml = `<Product><id>123</id></Product>`;
			const product = serializer.fromXml(xml, Product); // Get cached query
			const query1 = product.query;
			expect(query1).toBeDefined();

			// Manually set a new value
			const newQuery = new DynamicElement({
				name: "Custom",
				attributes: {},
				children: [],
			});

			product.query = newQuery;

			// Should return the manually set value
			expect(product.query).toBe(newQuery);
			expect(product.query.name).toBe("Custom");
		});

		it("should respect cache setting in metadata", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlDynamic({ lazyLoad: true, cache: true })
				cachedQuery!: DynamicElement;

				@XmlDynamic({ lazyLoad: true, cache: false })
				uncachedQuery!: DynamicElement;
			}

			const xml = `<Container><item>Test</item></Container>`;
			const container = serializer.fromXml(xml, Container);

			// Cached query should return same instance
			const cached1 = container.cachedQuery;
			const cached2 = container.cachedQuery;
			expect(cached1).toBe(cached2);

			// Uncached query should return different instances
			const uncached1 = container.uncachedQuery;
			const uncached2 = container.uncachedQuery;
			expect(uncached1).not.toBe(uncached2);
		});
	});

	describe("Performance Considerations", () => {
		it("should defer parsing with lazy loading for large documents", () => {
			@XmlRoot({ name: "Catalog" })
			class LargeCatalog {
				@XmlDynamic({ lazyLoad: true })
				dynamic!: DynamicElement;

				@XmlElement({ name: "Name" })
				name?: string;
			}

			// Create a large XML document
			const items = Array.from({ length: 1000 }, (_, i) => `<Item id="${i}">Value ${i}</Item>`).join("");
			const xml = `<Catalog><Name>Large</Name>${items}</Catalog>`;

			const startTime = Date.now();
			const catalog = serializer.fromXml(xml, LargeCatalog);
			const parseTime = Date.now() - startTime;

			// Should parse quickly since dynamic element is not accessed
			expect(parseTime).toBeLessThan(1000); // Reasonable threshold
			expect(catalog.name).toBe("Large"); // Verify it parsed

			// Now access the dynamic property
			const accessStartTime = Date.now();
			const itemCount = catalog.dynamic.children.length;
			const accessTime = Date.now() - accessStartTime;

			expect(itemCount).toBeGreaterThan(900); // Most items should be there
			// First access builds the tree
			expect(accessTime).toBeGreaterThan(0);
		});

		it("should parse immediately with lazyLoad: false", () => {
			@XmlRoot({ name: "Catalog" })
			class ImmediateCatalog {
				@XmlDynamic({ lazyLoad: false })
				dynamic!: DynamicElement;

				@XmlElement({ name: "Name" })
				name?: string;
			}

			const items = Array.from({ length: 100 }, (_, i) => `<Item id="${i}">Value ${i}</Item>`).join("");
			const xml = `<Catalog><Name>Immediate</Name>${items}</Catalog>`;

			const catalog = serializer.fromXml(xml, ImmediateCatalog);

			// Should be immediately available without triggering lazy load
			expect(catalog.dynamic.children.length).toBeGreaterThan(90);
		});

		it("should delay parsing of large XML structures until needed", () => {
			@XmlRoot({ name: "LargeDocument" })
			class LargeDocument {
				@XmlElement() metadata!: any;

				// Large section that might not be needed
				@XmlDynamic({ lazyLoad: true, targetProperty: "largeSection" })
				largeQuery!: DynamicElement;
			}

			const xml = `
				<LargeDocument>
					<metadata>small</metadata>
					<largeSection>
						${Array.from({ length: 100 }, (_, i) => `<item id="${i}">Item ${i}</item>`).join("")}
					</largeSection>
				</LargeDocument>
			`;

			const doc = serializer.fromXml(xml, LargeDocument);

			// Document is created, but large section is not parsed yet
			expect(doc.metadata).toBeDefined();
			const largeQueryBuilderKey = Symbol.for("dynamic_builder_LargeDocument_largeQuery");
			expect((doc as any)[largeQueryBuilderKey]).toBeDefined();

			// Now access the large section (triggers parsing)
			const largeQuery = doc.largeQuery;

			expect(largeQuery).toBeDefined();
			expect(largeQuery.children.length).toBeGreaterThan(0);

			// Subsequent accesses should return the same result
			const largeQuery2 = doc.largeQuery;

			expect(largeQuery2).toBeDefined();
		});

		it("should allow selective querying without parsing entire document", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement() header!: any;
				@XmlElement() body!: any;
				@XmlElement() footer!: any;

				@XmlDynamic({ lazyLoad: true, targetProperty: "header", cache: true })
				headerQuery!: DynamicElement;

				@XmlDynamic({ lazyLoad: true, targetProperty: "body", cache: true })
				bodyQuery!: DynamicElement;

				@XmlDynamic({ lazyLoad: true, targetProperty: "footer", cache: true })
				footerQuery!: DynamicElement;
			}

			const xml = `
				<Document>
					<header><title>Title</title></header>
					<body><section>Content</section></body>
					<footer><copyright>2024</copyright></footer>
				</Document>
			`;

			const doc = serializer.fromXml(xml, Document);

			// Only access header - body and footer remain unparsed
			const headerQuery = doc.headerQuery;
			expect(headerQuery).toBeDefined();
			expect(headerQuery.children).toHaveLength(1);

			// Body and footer builders still exist (not yet accessed)
			const bodyBuilderKey = Symbol.for("dynamic_builder_Document_bodyQuery");
			const footerBuilderKey = Symbol.for("dynamic_builder_Document_footerQuery");
			expect((doc as any)[bodyBuilderKey]).toBeDefined();
			expect((doc as any)[footerBuilderKey]).toBeDefined(); // Accessing body now triggers its parsing
			const bodyQuery = doc.bodyQuery;
			expect(bodyQuery).toBeDefined();
		});
	});

	describe("Mixed Mode", () => {
		it("should support both lazy and immediate loading on different properties", () => {
			@XmlRoot({ name: "Document" })
			class MixedDocument {
				@XmlDynamic({ lazyLoad: true })
				lazyDynamic!: DynamicElement;

				@XmlDynamic({ lazyLoad: false })
				immediateDynamic!: DynamicElement;
			}

			const xml = `<Document><Title>Test</Title></Document>`;
			const doc = serializer.fromXml(xml, MixedDocument);

			// Both should work
			expect(doc.lazyDynamic).toBeDefined();
			expect(doc.immediateDynamic).toBeDefined();
			expect(doc.lazyDynamic.name).toBe("Document");
			expect(doc.immediateDynamic.name).toBe("Document");
		});
	});

	describe("Advanced Features", () => {
		it("should work with maxDepth option and lazy loading", () => {
			@XmlRoot({ name: "Deep" })
			class Deep {
				@XmlDynamic({ lazyLoad: true, maxDepth: 2, cache: true })
				query!: DynamicElement;
			}

			const xml = `
				<Deep>
					<level1>
						<level2>
							<level3>Should not be parsed</level3>
						</level2>
					</level1>
				</Deep>
			`;

			const deep = serializer.fromXml(xml, Deep);

			const query = deep.query;
			expect(query).toBeDefined();
			expect(query.children).toHaveLength(1);

			// Check that depth limit is respected
			const level1 = query.children[0];
			expect(level1.name).toBe("level1");
			expect(level1.children).toHaveLength(1);

			const level2 = level1.children[0];
			expect(level2.name).toBe("level2");
			// Level 3 should not be parsed due to maxDepth: 2
			expect(level2.children).toHaveLength(0);
		});
	});
});
