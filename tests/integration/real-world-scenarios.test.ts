import { XmlArrayItem } from "../../src/decorators/xml-array-item";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlText } from "../../src/decorators/xml-text";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Integration Tests - Real-world XML Scenarios", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("E-commerce Order System", () => {
		@XmlElement("Address")
		class Address {
			@XmlElement("Street")
			street: string = "";

			@XmlElement("City")
			city: string = "";

			@XmlElement("ZipCode")
			zipCode: string = "";

			@XmlElement("Country")
			country: string = "";
		}

		@XmlElement("Product")
		class Product {
			@XmlAttribute({ name: "id" })
			id: string = "";

			@XmlElement("Name")
			name: string = "";

			@XmlElement("Price")
			price: number = 0;

			@XmlElement("Quantity")
			quantity: number = 0;
		}

		@XmlRoot({ elementName: "Order" })
		class Order {
			@XmlAttribute({ name: "orderId" })
			orderId: string = "";

			@XmlAttribute({ name: "date" })
			date: string = "";

			@XmlElement("CustomerName")
			customerName: string = "";

			@XmlElement("ShippingAddress")
			shippingAddress: Address = new Address();

			@XmlArrayItem({ containerName: "Products", itemName: "Product", type: Product })
			products: Product[] = [];

			@XmlElement("TotalAmount")
			totalAmount: number = 0;
		}

		it("should serialize complete order", () => {
			const order = new Order();
			order.orderId = "ORD-001";
			order.date = "2024-01-15";
			order.customerName = "John Doe";

			order.shippingAddress.street = "123 Main St";
			order.shippingAddress.city = "Springfield";
			order.shippingAddress.zipCode = "12345";
			order.shippingAddress.country = "USA";

			const product1 = new Product();
			product1.id = "P001";
			product1.name = "Widget";
			product1.price = 29.99;
			product1.quantity = 2;

			const product2 = new Product();
			product2.id = "P002";
			product2.name = "Gadget";
			product2.price = 49.99;
			product2.quantity = 1;

			order.products = [product1, product2];
			order.totalAmount = 109.97;

			const xml = serializer.toXml(order);

			expect(xml).toContain('orderId="ORD-001"');
			expect(xml).toContain('date="2024-01-15"');
			expect(xml).toContain("<CustomerName>John Doe</CustomerName>");
			expect(xml).toContain("<Street>123 Main St</Street>");
			expect(xml).toContain("<City>Springfield</City>");
			expect(xml).toContain('id="P001"');
			expect(xml).toContain("<Name>Widget</Name>");
			expect(xml).toContain("<Price>29.99</Price>");
			expect(xml).toContain("<TotalAmount>109.97</TotalAmount>");
		});

		it("should deserialize complete order", () => {
			const xml = `
				<Order orderId="ORD-002" date="2024-01-16">
					<CustomerName>Jane Smith</CustomerName>
					<ShippingAddress>
						<Street>456 Oak Ave</Street>
						<City>Portland</City>
						<ZipCode>54321</ZipCode>
						<Country>USA</Country>
					</ShippingAddress>
					<Products>
						<Product id="P003">
							<Name>Doohickey</Name>
							<Price>19.99</Price>
							<Quantity>3</Quantity>
						</Product>
					</Products>
					<TotalAmount>59.97</TotalAmount>
				</Order>
			`;

			const order = serializer.fromXml(xml, Order);

			expect(order.orderId).toBe("ORD-002");
			expect(order.customerName).toBe("Jane Smith");
			expect(order.shippingAddress.street).toBe("456 Oak Ave");
			expect(order.shippingAddress.city).toBe("Portland");
			expect(order.products).toHaveLength(1);
			expect(order.totalAmount).toBe(59.97);
		});

		it("should handle round-trip for order", () => {
			const original = new Order();
			original.orderId = "ORD-003";
			original.date = "2024-01-17";
			original.customerName = "Bob Wilson";
			original.shippingAddress.street = "789 Pine Rd";
			original.shippingAddress.city = "Seattle";
			original.shippingAddress.zipCode = "98101";
			original.shippingAddress.country = "USA";

			const product = new Product();
			product.id = "P004";
			product.name = "Thingamajig";
			product.price = 99.99;
			product.quantity = 1;
			original.products = [product];
			original.totalAmount = 99.99;

			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Order);

			expect(deserialized.orderId).toBe(original.orderId);
			expect(deserialized.customerName).toBe(original.customerName);
			expect(deserialized.shippingAddress.city).toBe(original.shippingAddress.city);
			expect(deserialized.products).toHaveLength(1);
			expect(deserialized.totalAmount).toBe(original.totalAmount);
		});
	});

	describe("RSS Feed System", () => {
		@XmlElement("Item")
		class RssItem {
			@XmlElement("Title")
			title: string = "";

			@XmlElement("Link")
			link: string = "";

			@XmlElement("Description")
			description: string = "";

			@XmlElement("PubDate")
			pubDate: string = "";

			@XmlElement("Author")
			author: string = "";
		}

		@XmlRoot({ elementName: "Channel" })
		class RssChannel {
			@XmlElement("Title")
			title: string = "";

			@XmlElement("Description")
			description: string = "";

			@XmlElement("Link")
			link: string = "";

			@XmlArrayItem({ itemName: "Item", type: RssItem })
			items: RssItem[] = [];
		}

		it("should serialize RSS feed", () => {
			const channel = new RssChannel();
			channel.title = "Tech Blog";
			channel.description = "Latest technology news";
			channel.link = "https://example.com";

			const item1 = new RssItem();
			item1.title = "Breaking News";
			item1.link = "https://example.com/news1";
			item1.description = "Big announcement today";
			item1.pubDate = "2024-01-15";
			item1.author = "John Doe";

			const item2 = new RssItem();
			item2.title = "Tutorial Released";
			item2.link = "https://example.com/tutorial";
			item2.description = "New tutorial available";
			item2.pubDate = "2024-01-16";
			item2.author = "Jane Smith";

			channel.items = [item1, item2];

			const xml = serializer.toXml(channel);

			expect(xml).toContain("<Title>Tech Blog</Title>");
			expect(xml).toContain("<Title>Breaking News</Title>");
			expect(xml).toContain("<Author>John Doe</Author>");
			expect(xml).toContain("<Title>Tutorial Released</Title>");
		});

		it("should deserialize RSS feed", () => {
			const xml = `
				<Channel>
					<Title>News Feed</Title>
					<Description>Daily news updates</Description>
					<Link>https://news.example.com</Link>
					<Item>
						<Title>Article 1</Title>
						<Link>https://news.example.com/1</Link>
						<Description>First article</Description>
						<PubDate>2024-01-15</PubDate>
						<Author>Reporter A</Author>
					</Item>
					<Item>
						<Title>Article 2</Title>
						<Link>https://news.example.com/2</Link>
						<Description>Second article</Description>
						<PubDate>2024-01-16</PubDate>
						<Author>Reporter B</Author>
					</Item>
				</Channel>
			`;

			const channel = serializer.fromXml(xml, RssChannel);

			expect(channel.title).toBe("News Feed");
			expect(channel.items).toHaveLength(2);
			expect(channel.items[0].title).toBe("Article 1");
			expect(channel.items[1].author).toBe("Reporter B");
		});
	});

	describe("Configuration File System", () => {
		@XmlElement("DatabaseConfig")
		class DatabaseConfig {
			@XmlAttribute({ name: "type" })
			type: string = "";

			@XmlElement("Host")
			host: string = "";

			@XmlElement("Port")
			port: number = 0;

			@XmlElement("Database")
			database: string = "";

			@XmlElement("Username")
			username: string = "";

			@XmlElement("Password")
			password: string = "";

			@XmlElement("MaxConnections")
			maxConnections: number = 0;
		}

		@XmlElement("ApiConfig")
		class ApiConfig {
			@XmlElement("BaseUrl")
			baseUrl: string = "";

			@XmlElement("Timeout")
			timeout: number = 0;

			@XmlElement("RetryCount")
			retryCount: number = 0;
		}

		@XmlRoot({ elementName: "ApplicationConfig" })
		class ApplicationConfig {
			@XmlAttribute({ name: "version" })
			version: string = "";

			@XmlAttribute({ name: "environment" })
			environment: string = "";

			@XmlElement("AppName")
			appName: string = "";

			@XmlElement("DatabaseConfig")
			database: DatabaseConfig = new DatabaseConfig();

			@XmlElement("ApiConfig")
			api: ApiConfig = new ApiConfig();

			@XmlArrayItem({ itemName: "Feature" })
			enabledFeatures: string[] = [];
		}

		it("should serialize application configuration", () => {
			const config = new ApplicationConfig();
			config.version = "1.0.0";
			config.environment = "production";
			config.appName = "MyApp";

			config.database.type = "postgresql";
			config.database.host = "db.example.com";
			config.database.port = 5432;
			config.database.database = "myapp_db";
			config.database.username = "admin";
			config.database.password = "secret";
			config.database.maxConnections = 20;

			config.api.baseUrl = "https://api.example.com";
			config.api.timeout = 30000;
			config.api.retryCount = 3;

			config.enabledFeatures = ["authentication", "logging", "caching"];

			const xml = serializer.toXml(config);

			expect(xml).toContain('version="1.0.0"');
			expect(xml).toContain('environment="production"');
			expect(xml).toContain('type="postgresql"');
			expect(xml).toContain("<Host>db.example.com</Host>");
			expect(xml).toContain("<Port>5432</Port>");
			expect(xml).toContain("<BaseUrl>https://api.example.com</BaseUrl>");
			expect(xml).toContain("<Feature>authentication</Feature>");
			expect(xml).toContain("<Feature>logging</Feature>");
		});

		it("should deserialize application configuration", () => {
			const xml = `
				<ApplicationConfig version="2.0.0" environment="staging">
					<AppName>TestApp</AppName>
					<DatabaseConfig type="mysql">
						<Host>localhost</Host>
						<Port>3306</Port>
						<Database>test_db</Database>
						<Username>root</Username>
						<Password>pass123</Password>
						<MaxConnections>10</MaxConnections>
					</DatabaseConfig>
					<ApiConfig>
						<BaseUrl>https://staging-api.example.com</BaseUrl>
						<Timeout>60000</Timeout>
						<RetryCount>5</RetryCount>
					</ApiConfig>
					<Feature>debug</Feature>
					<Feature>monitoring</Feature>
				</ApplicationConfig>
			`;

			const config = serializer.fromXml(xml, ApplicationConfig);

			expect(config.version).toBe("2.0.0");
			expect(config.environment).toBe("staging");
			expect(config.database.type).toBe("mysql");
			expect(config.database.port).toBe(3306);
			expect(config.api.timeout).toBe(60000);
			expect(config.enabledFeatures).toHaveLength(2);
			expect(config.enabledFeatures).toContain("debug");
		});
	});

	describe("Document with Mixed Content", () => {
		@XmlElement("Paragraph")
		class Paragraph {
			@XmlAttribute({ name: "style" })
			style: string = "";

			@XmlText()
			content: string = "";
		}

		@XmlElement("Section")
		class Section {
			@XmlAttribute({ name: "id" })
			id: string = "";

			@XmlElement("Title")
			title: string = "";

			@XmlArrayItem({ itemName: "Paragraph", type: Paragraph })
			paragraphs: Paragraph[] = [];
		}

		@XmlRoot({ elementName: "Document" })
		class Document {
			@XmlAttribute({ name: "lang" })
			language: string = "";

			@XmlElement("Title")
			title: string = "";

			@XmlElement("Author")
			author: string = "";

			@XmlArrayItem({ itemName: "Section", type: Section })
			sections: Section[] = [];
		}

		it("should serialize document with mixed content", () => {
			const doc = new Document();
			doc.language = "en";
			doc.title = "Technical Guide";
			doc.author = "Expert Author";

			const section1 = new Section();
			section1.id = "intro";
			section1.title = "Introduction";

			const para1 = new Paragraph();
			para1.style = "normal";
			para1.content = "This is the introduction.";

			const para2 = new Paragraph();
			para2.style = "emphasis";
			para2.content = "This is important.";

			section1.paragraphs = [para1, para2];

			const section2 = new Section();
			section2.id = "conclusion";
			section2.title = "Conclusion";

			const para3 = new Paragraph();
			para3.style = "normal";
			para3.content = "Final thoughts.";

			section2.paragraphs = [para3];

			doc.sections = [section1, section2];

			const xml = serializer.toXml(doc);

			expect(xml).toContain('lang="en"');
			expect(xml).toContain("<Title>Technical Guide</Title>");
			expect(xml).toContain('id="intro"');
			expect(xml).toContain('style="normal"');
			expect(xml).toContain("This is the introduction.");
			expect(xml).toContain('style="emphasis"');
		});

		it("should handle round-trip for document", () => {
			const original = new Document();
			original.language = "fr";
			original.title = "Guide Technique";
			original.author = "Auteur Expert";

			const section = new Section();
			section.id = "main";
			section.title = "Contenu Principal";

			const para = new Paragraph();
			para.style = "header";
			para.content = "Bienvenue";

			section.paragraphs = [para];
			original.sections = [section];

			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Document);

			expect(deserialized.language).toBe(original.language);
			expect(deserialized.title).toBe(original.title);
			expect(deserialized.sections).toHaveLength(1);
			expect(deserialized.sections[0].id).toBe("main");
		});
	});

	describe("Namespace Integration", () => {
		@XmlRoot({
			elementName: "Invoice",
			namespace: { uri: "http://example.com/invoice", prefix: "inv" },
		})
		class Invoice {
			@XmlAttribute({
				name: "id",
				namespace: { uri: "http://example.com/id", prefix: "id" },
			})
			id: string = "";

			@XmlElement({
				name: "Amount",
				namespace: { uri: "http://example.com/financial", prefix: "fin" },
			})
			amount: number = 0;

			@XmlElement("Description")
			description: string = "";
		}

		it("should serialize with namespaces", () => {
			const invoice = new Invoice();
			invoice.id = "INV-001";
			invoice.amount = 1000.0;
			invoice.description = "Services rendered";

			const xml = serializer.toXml(invoice);

			expect(xml).toContain("inv:Invoice");
			expect(xml).toContain('xmlns:inv="http://example.com/invoice"');
			expect(xml).toContain('xmlns:id="http://example.com/id"');
			expect(xml).toContain('xmlns:fin="http://example.com/financial"');
			expect(xml).toContain("id:id");
			expect(xml).toContain("fin:Amount");
		});

		it("should handle default namespace", () => {
			@XmlRoot({
				elementName: "Document",
				namespace: { uri: "http://example.com/default", isDefault: true },
			})
			class DefaultNsDocument {
				@XmlElement("Content")
				content: string = "";
			}

			const doc = new DefaultNsDocument();
			doc.content = "Test content";

			const xml = serializer.toXml(doc);

			expect(xml).toContain('xmlns="http://example.com/default"');
			expect(xml).toContain("<Document");
			expect(xml).not.toContain("doc:");
			expect(xml).not.toContain(":Document");
		});
	});

	describe("Rich Text Content with Inline Formatting (Custom Parser)", () => {
		@XmlRoot({ elementName: "BlogPost" })
		class BlogPost {
			@XmlAttribute({ name: "id" })
			id: string = "";

			@XmlElement("Title")
			title: string = "";

			@XmlElement("Author")
			author: string = "";

			@XmlElement("PublishedDate")
			publishedDate: string = "";

			@XmlElement({ name: "Content", mixedContent: true })
			content: Array<{ text?: string; element?: string; content?: string; attributes?: Record<string, string> }> = [];
		}

		it("should serialize blog post with inline formatting", () => {
			const post = new BlogPost();
			post.id = "post-123";
			post.title = "Understanding XML Serialization";
			post.author = "Tech Writer";
			post.publishedDate = "2024-01-15";
			post.content = [
				{ text: "Welcome to this tutorial on " },
				{ element: "strong", content: "XML serialization" },
				{ text: ". In this post, we'll explore how to work with " },
				{ element: "em", content: "mixed content" },
				{ text: " that includes both text and inline elements. For more information, visit " },
				{
					element: "a",
					content: "our documentation",
					attributes: { href: "https://docs.example.com", target: "_blank" },
				},
				{ text: " or check out the " },
				{ element: "code", content: "XmlSerializer" },
				{ text: " class." },
			];

			const xml = serializer.toXml(post);

			expect(xml).toContain('id="post-123"');
			expect(xml).toContain("<Title>Understanding XML Serialization</Title>");
			expect(xml).toContain("<Author>Tech Writer</Author>");
			expect(xml).toContain("Welcome to this tutorial on");
			expect(xml).toContain("<strong>XML serialization</strong>");
			expect(xml).toContain("<em>mixed content</em>");
			expect(xml).toContain('<a href="https://docs.example.com" target="_blank">our documentation</a>');
			expect(xml).toContain("<code>XmlSerializer</code>");
		});

		it("should deserialize blog post with inline formatting", () => {
			const xml = `
				<BlogPost id="post-456">
					<Title>Advanced Techniques</Title>
					<Author>Expert Developer</Author>
					<PublishedDate>2024-02-20</PublishedDate>
					<Content>Learn about <strong>advanced patterns</strong> in XML processing. These techniques allow you to handle <em>complex scenarios</em> with ease. Visit <a href="https://github.com/example" class="link">our GitHub</a> for examples.</Content>
				</BlogPost>
			`;

			const post = serializer.fromXml(xml, BlogPost);

			expect(post.id).toBe("post-456");
			expect(post.title).toBe("Advanced Techniques");
			expect(post.author).toBe("Expert Developer");
			expect(post.content).toHaveLength(7);

			// Verify mixed content structure
			expect(post.content[0].text).toBe("Learn about ");
			expect(post.content[1].element).toBe("strong");
			expect(post.content[1].content).toBe("advanced patterns");
			expect(post.content[2].text).toContain("in XML processing");
			expect(post.content[3].element).toBe("em");
			expect(post.content[3].content).toBe("complex scenarios");
			expect(post.content[5].element).toBe("a");
			expect(post.content[5].content).toBe("our GitHub");
			expect(post.content[5].attributes?.href).toBe("https://github.com/example");
			expect(post.content[5].attributes?.class).toBe("link");
		});

		it("should handle round-trip for blog post with formatting", () => {
			const original = new BlogPost();
			original.id = "post-789";
			original.title = "Best Practices";
			original.author = "Senior Engineer";
			original.publishedDate = "2024-03-10";
			original.content = [
				{ text: "Always use " },
				{ element: "code", content: "type-safe" },
				{ text: " decorators when working with " },
				{ element: "strong", content: "TypeScript" },
				{ text: ". See the " },
				{
					element: "a",
					content: "official guide",
					attributes: { href: "https://www.typescriptlang.org" },
				},
				{ text: " for details." },
			];

			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, BlogPost);

			expect(deserialized.id).toBe(original.id);
			expect(deserialized.title).toBe(original.title);
			expect(deserialized.content).toHaveLength(original.content.length);
			expect(deserialized.content[1].element).toBe("code");
			expect(deserialized.content[1].content).toBe("type-safe");
			expect(deserialized.content[3].element).toBe("strong");
			expect(deserialized.content[5].element).toBe("a");
			expect(deserialized.content[5].attributes?.href).toBe("https://www.typescriptlang.org");
		});

		it("should handle nested inline elements", () => {
			const xml = `
				<BlogPost id="post-999">
					<Title>Nested Example</Title>
					<Author>Test Author</Author>
					<PublishedDate>2024-04-01</PublishedDate>
					<Content>This is <strong>bold with <em>italic</em> inside</strong> text.</Content>
				</BlogPost>
			`;

			const post = serializer.fromXml(xml, BlogPost);

			expect(post.id).toBe("post-999");
			expect(post.content.length).toBeGreaterThan(0);
			expect(post.content[0].text).toBe("This is ");
			expect(post.content[1].element).toBe("strong");
			// Nested content is parsed as an array of mixed content (more accurate)
			expect(Array.isArray(post.content[1].content)).toBe(true);
			const nestedContent = post.content[1].content as unknown as any[];
			expect(nestedContent[0].text).toContain("bold with");
			expect(nestedContent[1].element).toBe("em");
			expect(nestedContent[1].content).toBe("italic");
		});

		it("should preserve whitespace in formatted content", () => {
			const original = new BlogPost();
			original.id = "post-ws";
			original.title = "Whitespace Test";
			original.author = "Tester";
			original.publishedDate = "2024-05-01";
			original.content = [
				{ text: "Text with  multiple  spaces and " },
				{ element: "code", content: "  indented code  " },
				{ text: " after." },
			];

			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, BlogPost);

			// Whitespace should be preserved in text nodes
			expect(deserialized.content[0].text).toContain("  multiple  spaces");
			expect(deserialized.content[1].content).toContain("  indented code  ");
		});
	});

	describe("Empty and Null Value Handling", () => {
		@XmlRoot({ elementName: "Data" })
		class Data {
			@XmlElement("RequiredField")
			requiredField: string = "present";

			@XmlElement("OptionalField")
			optionalField: string | null = null;

			@XmlElement("EmptyField")
			emptyField: string = "";

			@XmlArrayItem({ itemName: "Item" })
			items: string[] = [];
		}

		it("should handle empty and null values in serialization", () => {
			const data = new Data();
			const xml = serializer.toXml(data);

			expect(xml).toContain("<RequiredField>present</RequiredField>");
			expect(xml).toBeTruthy();
		});

		it("should omit null values when configured", () => {
			const serializer = new XmlDecoratorSerializer({ omitNullValues: true });
			const data = new Data();

			const xml = serializer.toXml(data);

			expect(xml).toContain("<RequiredField>present</RequiredField>");
			expect(xml).not.toContain("<OptionalField");
		});

		it("should handle empty arrays", () => {
			const data = new Data();
			data.items = [];

			const xml = serializer.toXml(data);

			expect(xml).toBeTruthy();
		});
	});
});
