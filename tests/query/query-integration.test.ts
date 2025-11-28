import { XmlQueryParser } from "../../src/query/xml-query-parser";

describe("Query Integration Tests", () => {
	describe("End-to-end XML parsing and querying", () => {
		it("should parse and query a complete document", () => {
			const xml = `
				<bookstore>
					<book id="1" category="fiction">
						<title>The Great Gatsby</title>
						<author>F. Scott Fitzgerald</author>
						<price>10.99</price>
						<year>1925</year>
					</book>
					<book id="2" category="fiction">
						<title>1984</title>
						<author>George Orwell</author>
						<price>8.99</price>
						<year>1949</year>
					</book>
					<book id="3" category="science">
						<title>A Brief History of Time</title>
						<author>Stephen Hawking</author>
						<price>15.99</price>
						<year>1988</year>
					</book>
				</bookstore>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Find all books
			const books = query.find("book");
			expect(books.count()).toBe(3);

			// Find fiction books
			const fiction = books.whereAttribute("category", "fiction");
			expect(fiction.count()).toBe(2);

			// Find books with price > 12
			const expensive = books.childrenNamed("price").whereValue(price => price > 12);
			expect(expensive.count()).toBe(1);
			expect(expensive.parent().first()?.attributes.id).toBe("3");

			// Get all titles
			const titles = query.find("title").texts();
			expect(titles).toHaveLength(3);
			expect(titles).toContain("1984");

			// Chain multiple operations
			const oldFictionBooks = books.whereAttribute("category", "fiction").where(book => {
				const year = book.children.find(c => c.name === "year");
				return year?.numericValue !== undefined && year.numericValue < 1950;
			});
			expect(oldFictionBooks.count()).toBe(2);
		});

		it("should handle nested hierarchical queries", () => {
			const xml = `
				<company>
					<department name="Engineering">
						<team name="Backend">
							<member role="lead">Alice</member>
							<member role="developer">Bob</member>
						</team>
						<team name="Frontend">
							<member role="lead">Carol</member>
							<member role="developer">Dave</member>
							<member role="developer">Eve</member>
						</team>
					</department>
					<department name="Sales">
						<team name="Enterprise">
							<member role="manager">Frank</member>
						</team>
					</department>
				</company>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Navigate down the hierarchy
			const engineering = query.find("department").whereAttribute("name", "Engineering");
			expect(engineering.count()).toBe(1);

			// Get all teams in engineering
			const teams = engineering.find("team");
			expect(teams.count()).toBe(2);

			// Get all members in all teams
			const allMembers = teams.find("member");
			expect(allMembers.count()).toBe(5);

			// Find all leads
			const leads = query.find("member").whereAttribute("role", "lead");
			expect(leads.count()).toBe(2);
			expect(leads.texts()).toEqual(["Alice", "Carol"]);

			// Navigate up the hierarchy
			const backendTeam = query.find("member").whereText("Bob").parent();
			expect(backendTeam.first()?.attributes.name).toBe("Backend");

			// Get department from member
			const department = query.find("member").whereText("Alice").ancestors().find("department").first();
			expect(department?.attributes.name).toBe("Engineering");
		});

		it("should handle namespace-aware parsing and querying", () => {
			const xml = `
				<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
					<soap:Header>
						<auth:Authentication xmlns:auth="http://example.com/auth">
							<auth:Token>abc123</auth:Token>
						</auth:Authentication>
					</soap:Header>
					<soap:Body>
						<ns:GetUserRequest xmlns:ns="http://example.com/api">
							<ns:UserId>42</ns:UserId>
						</ns:GetUserRequest>
					</soap:Body>
				</soap:Envelope>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Find by qualified name
			const envelope = query.find("soap:Envelope");
			expect(envelope.count()).toBe(1);

			// Find by namespace
			const soapElements = query.namespace("soap");
			expect(soapElements.count()).toBe(3); // Envelope, Header, Body

			// Navigate with namespaces
			const token = query.find("auth:Token");
			expect(token.first()?.text).toBe("abc123");

			const userId = query.find("ns:UserId");
			expect(userId.first()?.numericValue).toBe(42);
		});

		it("should combine parser options with query operations", () => {
			const xml = `
				<data>
					<item>  10  </item>
					<item>  20  </item>
					<item>  true  </item>
					<item>  false  </item>
				</data>
			`;

			// Parse with trimming
			const parser = new XmlQueryParser({ trimValues: true });
			const query = parser.parse(xml);

			const items = query.find("item");
			expect(items.texts()).toEqual(["10", "20", "true", "false"]);

			// Check numeric parsing
			const numericItems = items.hasNumericValue();
			expect(numericItems.count()).toBe(2);
			expect(numericItems.sum()).toBe(30);

			// Check boolean parsing
			const booleanItems = items.hasBooleanValue();
			expect(booleanItems.count()).toBe(2);
			expect(booleanItems.whereBooleanEquals(true).count()).toBe(1);

			// Parse without trimming
			const parserNoTrim = new XmlQueryParser({ trimValues: false });
			const queryNoTrim = parserNoTrim.parse(xml);
			const itemsNoTrim = queryNoTrim.find("item");
			expect(itemsNoTrim.first()?.text).toBe("  10  ");
		});

		it("should handle complex filtering and aggregation scenarios", () => {
			const xml = `
				<sales>
					<transaction region="North" amount="150" date="2024-01-15"/>
					<transaction region="South" amount="200" date="2024-01-16"/>
					<transaction region="North" amount="175" date="2024-01-17"/>
					<transaction region="East" amount="225" date="2024-01-18"/>
					<transaction region="South" amount="190" date="2024-01-19"/>
					<transaction region="North" amount="165" date="2024-01-20"/>
				</sales>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Group by region
			const transactions = query.find("transaction");
			const byRegion = transactions.groupByAttribute("region");

			expect(byRegion.get("North")?.length).toBe(3);
			expect(byRegion.get("South")?.length).toBe(2);
			expect(byRegion.get("East")?.length).toBe(1);

			// Get total sales by region
			const northSales = transactions
				.whereAttribute("region", "North")
				.attributes("amount")
				.map(a => parseFloat(a))
				.reduce((sum, val) => sum + val, 0);
			expect(northSales).toBe(490);

			// Find high-value transactions
			const highValue = transactions.whereAttributePredicate("amount", val => parseFloat(val) > 200);
			expect(highValue.count()).toBe(1);
			expect(highValue.first()?.attributes.region).toBe("East");

			// Sort by amount
			const sorted = transactions.sortByAttribute("amount");
			const amounts = sorted.attributes("amount");
			expect(amounts[0]).toBe("150");
			expect(amounts[amounts.length - 1]).toBe("225");
		});

		it("should handle mixed content and CDATA scenarios", () => {
			const xml = `
				<documentation>
					<section title="Introduction">
						<paragraph>This is <emphasis>important</emphasis> information.</paragraph>
						<code><![CDATA[function test() { return x > 5 && y < 10; }]]></code>
					</section>
					<section title="Examples">
						<paragraph>See below for details.</paragraph>
					</section>
				</documentation>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Find sections
			const sections = query.find("section");
			expect(sections.count()).toBe(2);

			// Check CDATA content
			const code = query.find("code");
			expect(code.first()?.text).toContain("function test()");
			expect(code.first()?.text).toContain("x > 5 && y < 10");

			// Mixed content handling
			const firstSection = sections.first();
			expect(firstSection?.children).toHaveLength(2);
		});

		it("should efficiently handle large result sets", () => {
			// Generate a large XML document
			const items = Array.from({ length: 1000 }, (_, i) => {
				const category = i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C";
				return `<item id="${i}" category="${category}">${i * 10}</item>`;
			}).join("\n");

			const xml = `<root>${items}</root>`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Query all items
			const allItems = query.find("item");
			expect(allItems.count()).toBe(1000);

			// Filter by category
			const categoryA = allItems.whereAttribute("category", "A");
			expect(categoryA.count()).toBe(334); // Every 3rd item starting at 0

			// Pagination
			const page1 = allItems.take(50);
			expect(page1.count()).toBe(50);

			const page2 = allItems.skip(50).take(50);
			expect(page2.count()).toBe(50);
			expect(page2.first()?.attributes.id).toBe("50");

			// Aggregation on large set
			const categoryBValues = allItems.whereAttribute("category", "B").hasNumericValue().values();
			expect(categoryBValues.length).toBe(333);

			// Sorting large set
			const sorted = categoryA.take(10).sortByValue(false);
			expect(sorted.count()).toBe(10);
		});

		it("should handle error cases gracefully", () => {
			const parser = new XmlQueryParser();

			// Empty results
			const xml = "<root><item>test</item></root>";
			const query = parser.parse(xml);

			const missing = query.find("nonexistent");
			expect(missing.exists()).toBe(false);
			expect(missing.count()).toBe(0);
			expect(missing.first()).toBeUndefined();
			expect(missing.texts()).toEqual([]);
			expect(missing.sum()).toBe(0);
			expect(missing.average()).toBe(0);

			// Operations on empty results
			const chained = missing.find("nested").whereText("test");
			expect(chained.exists()).toBe(false);
		});

		it("should support complex JSON conversion scenarios", () => {
			const xml = `
				<config>
					<database host="localhost" port="5432">
						<name>mydb</name>
						<user>admin</user>
					</database>
					<features>
						<feature name="auth" enabled="true"/>
						<feature name="cache" enabled="false"/>
					</features>
					<limits>
						<maxConnections>100</maxConnections>
						<timeout>30</timeout>
					</limits>
				</config>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Convert to JSON with different options
			const jsonDefault = query.toJSON();
			expect(jsonDefault.database).toBeDefined();
			expect(jsonDefault.features).toBeDefined();

			const jsonWithMetadata = query.toJSON({
				includeMetadata: true,
				simplifyLeaves: false,
			});
			expect(jsonWithMetadata["@metadata"]).toBeDefined();

			// Convert specific subtree
			const databaseJson = query.find("database").toJSON();
			expect(databaseJson.name).toBe("mydb");
			expect(databaseJson.user).toBe("admin");

			// Convert with attributes
			const featuresJson = query.find("features").toJSON({
				includeAttributes: true,
			});
			expect(featuresJson.feature).toHaveLength(2);
		});

		it("should integrate with real-world XML patterns", () => {
			// RSS feed pattern
			const rssXml = `
				<rss version="2.0">
					<channel>
						<title>Tech Blog</title>
						<item>
							<title>Article 1</title>
							<pubDate>2024-01-15</pubDate>
							<category>Technology</category>
						</item>
						<item>
							<title>Article 2</title>
							<pubDate>2024-01-16</pubDate>
							<category>Programming</category>
						</item>
					</channel>
				</rss>
			`;

			const parser = new XmlQueryParser();
			const rss = parser.parse(rssXml);

			const items = rss.find("item");
			expect(items.count()).toBe(2);

			const titles = items.childrenNamed("title").texts();
			expect(titles).toEqual(["Article 1", "Article 2"]);

			// Config file pattern
			const configXml = `
				<configuration>
					<appSettings>
						<add key="Environment" value="Production"/>
						<add key="LogLevel" value="Info"/>
						<add key="MaxRetries" value="3"/>
					</appSettings>
				</configuration>
			`;

			const config = parser.parse(configXml);
			const settings = config.find("add").toMap(
				el => el.attributes.key,
				el => el.attributes.value
			);

			expect(settings.Environment).toBe("Production");
			expect(settings.MaxRetries).toBe("3");
		});

		it("should handle path-based queries", () => {
			const xml = `
				<root>
					<level1>
						<level2>
							<level3>Deep Value 1</level3>
						</level2>
					</level1>
					<level1>
						<level2>
							<level3>Deep Value 2</level3>
						</level2>
					</level1>
				</root>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			// Find by path pattern
			const deepElements = query.descendants().wherePathMatches("*/level3");
			expect(deepElements.count()).toBe(2);

			// Find by exact path
			const exactPath = query.descendants().wherePath("root/level1/level2/level3");
			expect(exactPath.count()).toBe(2);

			// Filter by depth
			const depth3 = query.descendants().atDepth(3);
			expect(depth3.count()).toBe(2);
			expect(depth3.all(el => el.name === "level3")).toBe(true);
		});

		it("should support statistics and analysis", () => {
			const xml = `
				<metrics>
					<server name="web1" cpu="45" memory="78" disk="60"/>
					<server name="web2" cpu="67" memory="82" disk="55"/>
					<server name="db1" cpu="89" memory="95" disk="70"/>
					<server name="db2" cpu="45" memory="88" disk="65"/>
				</metrics>
			`;

			const parser = new XmlQueryParser();
			const query = parser.parse(xml);

			const servers = query.find("server");

			// Get statistics
			const stats = servers.stats();
			expect(stats.count).toBe(4);
			expect(stats.withAttributes).toBe(4);
			expect(stats.leafNodes).toBe(4);

			// Analyze by prefix
			const webServers = servers.whereAttributePredicate("name", name => name.startsWith("web"));
			expect(webServers.count()).toBe(2);

			const dbServers = servers.whereAttributePredicate("name", name => name.startsWith("db"));
			expect(dbServers.count()).toBe(2);

			// Group by category
			const grouped = servers.groupBy(el => (el.attributes.name.startsWith("web") ? "web" : "database"));
			expect(grouped.get("web")?.length).toBe(2);
			expect(grouped.get("database")?.length).toBe(2);
		});
	});
});
