import { QueryableElement, XmlElement, XmlQueryable, XmlRoot, XmlSerializer } from "../../src";

describe("XmlQueryable Lazy Loading and Caching", () => {
	const serializer = new XmlSerializer();

	describe("Lazy Loading", () => {
		it("should not build QueryableElement until first access", () => {
			@XmlRoot({ elementName: "Product" })
			class Product {
				@XmlElement() id!: string;
				@XmlElement() name!: string;

				@XmlQueryable()
				query!: QueryableElement;
			}

			const xml = `<Product><id>123</id><name>Test Product</name></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Check that the builder function was set up
			const builderKey = `__queryable_builder_query`;
			expect((product as any)[builderKey]).toBeDefined();
			expect(typeof (product as any)[builderKey]).toBe("function");

			// Access the query property - this should trigger lazy loading
			const query = product.query;
			expect(query).toBeDefined();
			expect(query.name).toBe("Product");
			expect(query.children).toHaveLength(2);
		});

		it("should rebuild QueryableElement on each access when cache is false", () => {
			@XmlRoot({ elementName: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlQueryable({ cache: false })
				query!: QueryableElement;
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
			@XmlRoot({ elementName: "Library" })
			class Library {
				@XmlElement() books!: any;
				@XmlElement() magazines!: any;

				@XmlQueryable({ targetProperty: "books" })
				booksQuery!: QueryableElement;

				@XmlQueryable({ targetProperty: "magazines" })
				magazinesQuery!: QueryableElement;
			}

			const xml = `
				<Library>
					<books><book>Book1</book></books>
					<magazines><magazine>Mag1</magazine></magazines>
				</Library>
			`;

			const library = serializer.fromXml(xml, Library);

			// Check that both builders exist
			expect((library as any).__queryable_builder_booksQuery).toBeDefined();
			expect((library as any).__queryable_builder_magazinesQuery).toBeDefined();

			// Access only books query
			const booksQuery = library.booksQuery;
			expect(booksQuery).toBeDefined();
			expect(booksQuery.name).toBe("books");

			// Magazines query should still be lazy (not built yet unless cache is enabled)
			const magazinesQuery = library.magazinesQuery;
			expect(magazinesQuery).toBeDefined();
			expect(magazinesQuery.name).toBe("magazines");
		});
	});

	describe("Caching", () => {
		it("should cache QueryableElement when cache option is true", () => {
			@XmlRoot({ elementName: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlQueryable({ cache: true })
				query!: QueryableElement;
			}

			const xml = `<Product><id>123</id></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Access multiple times
			const query1 = product.query;
			const query2 = product.query;

			// Should be the same instance (cached)
			expect(query1).toBe(query2);
		});

		it("should cache independently for different properties", () => {
			@XmlRoot({ elementName: "Store" })
			class Store {
				@XmlElement() products!: any;
				@XmlElement() customers!: any;

				@XmlQueryable({ targetProperty: "products", cache: true })
				productsQuery!: QueryableElement;

				@XmlQueryable({ targetProperty: "customers", cache: true })
				customersQuery!: QueryableElement;
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
			@XmlRoot({ elementName: "Product" })
			class Product {
				@XmlElement() id!: string;

				@XmlQueryable({ cache: true })
				query!: QueryableElement;
			}

			const xml = `<Product><id>123</id></Product>`;
			const product = serializer.fromXml(xml, Product);

			// Get cached query
			const query1 = product.query;
			expect(query1).toBeDefined();

			// Manually set a new value
			const newQuery = new QueryableElement({
				name: "Custom",
				qualifiedName: "Custom",
				attributes: {},
				children: [],
			});

			product.query = newQuery;

			// Should return the manually set value
			expect(product.query).toBe(newQuery);
			expect(product.query.name).toBe("Custom");
		});

		it("should respect cache setting in metadata", () => {
			@XmlRoot({ elementName: "Container" })
			class Container {
				@XmlQueryable({ cache: true })
				cachedQuery!: QueryableElement;

				@XmlQueryable({ cache: false })
				uncachedQuery!: QueryableElement;
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

	describe("Performance Benefits", () => {
		it("should delay parsing of large XML structures until needed", () => {
			@XmlRoot({ elementName: "LargeDocument" })
			class LargeDocument {
				@XmlElement() metadata!: any;

				// Large section that might not be needed
				@XmlQueryable({ targetProperty: "largeSection" })
				largeQuery!: QueryableElement;
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
			expect((doc as any).__queryable_builder_largeQuery).toBeDefined();

			// Now access the large section (triggers parsing)
			const largeQuery = doc.largeQuery;

			expect(largeQuery).toBeDefined();
			expect(largeQuery.children.length).toBeGreaterThan(0);

			// Subsequent accesses should return the same result
			const largeQuery2 = doc.largeQuery;

			expect(largeQuery2).toBeDefined();
		});

		it("should allow selective querying without parsing entire document", () => {
			@XmlRoot({ elementName: "Document" })
			class Document {
				@XmlElement() header!: any;
				@XmlElement() body!: any;
				@XmlElement() footer!: any;

				@XmlQueryable({ targetProperty: "header", cache: true })
				headerQuery!: QueryableElement;

				@XmlQueryable({ targetProperty: "body", cache: true })
				bodyQuery!: QueryableElement;

				@XmlQueryable({ targetProperty: "footer", cache: true })
				footerQuery!: QueryableElement;
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
			expect((doc as any).__queryable_builder_bodyQuery).toBeDefined();
			expect((doc as any).__queryable_builder_footerQuery).toBeDefined();

			// Accessing body now triggers its parsing
			const bodyQuery = doc.bodyQuery;
			expect(bodyQuery).toBeDefined();
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty elements with lazy loading", () => {
			@XmlRoot({ elementName: "Container" })
			class Container {
				@XmlQueryable()
				query!: QueryableElement;
			}

			const xml = `<Container></Container>`;
			const container = serializer.fromXml(xml, Container);

			const query = container.query;
			expect(query).toBeDefined();
			expect(query.name).toBe("Container");
			expect(query.children).toHaveLength(0);
		});

		it("should handle undefined queryable elements gracefully", () => {
			@XmlRoot({ elementName: "Container" })
			class Container {
				@XmlElement() data!: string;

				@XmlQueryable({ targetProperty: "nonExistent" })
				missingQuery?: QueryableElement;
			}

			const xml = `<Container><data>test</data></Container>`;
			const container = serializer.fromXml(xml, Container);

			// Should still create a queryable element, even if target doesn't exist
			const query = container.missingQuery;
			expect(query).toBeDefined();
		});

		it("should work with maxDepth option and lazy loading", () => {
			@XmlRoot({ elementName: "Deep" })
			class Deep {
				@XmlQueryable({ maxDepth: 2, cache: true })
				query!: QueryableElement;
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
