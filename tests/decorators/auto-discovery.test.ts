import { describe, expect, it } from "vitest";
import { XmlAttribute, XmlElement, XmlRoot, XmlText } from "../../src/decorators";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Auto-discovery", () => {
	describe("Basic auto-discovery without type parameters", () => {
		it("should auto-discover nested class with @XmlElement decorator", () => {
			@XmlElement({ name: "address" })
			class Address {
				street!: string;
				city!: string;
			}

			@XmlRoot({ name: "person" })
			class Person {
				name!: string;
				@XmlElement({ name: "address" })
				address!: Address;
			}

			const xml = `
				<person>
					<name>John Doe</name>
					<address>
						<street>123 Main St</street>
						<city>Springfield</city>
					</address>
				</person>
			`;

			const serializer = new XmlDecoratorSerializer();
			const person = serializer.fromXml(xml, Person);

			expect(person.name).toBe("John Doe");
			expect(person.address).toBeDefined();
			expect(person.address instanceof Address).toBe(true);
			expect(person.address.street).toBe("123 Main St");
			expect(person.address.city).toBe("Springfield");
		});

		it("should auto-discover deeply nested classes", () => {
			@XmlElement({ name: "contact" })
			class Contact {
				email!: string;
				phone!: string;
			}

			@XmlElement({ name: "profile" })
			class Profile {
				bio!: string;
				// No type parameter needed - auto-discovery works
				@XmlElement({ name: "contact" })
				contact!: Contact;
			}

			@XmlRoot({ name: "user" })
			class User {
				username!: string;
				// No type parameter needed - auto-discovery works
				@XmlElement({ name: "profile" })
				profile!: Profile;
			}

			const xml = `
				<user>
					<username>alice123</username>
					<profile>
						<bio>Software developer</bio>
						<contact>
							<email>alice@example.com</email>
							<phone>555-0100</phone>
						</contact>
					</profile>
				</user>
			`;

			const serializer = new XmlDecoratorSerializer();
			const user = serializer.fromXml(xml, User);

			expect(user.username).toBe("alice123");
			expect(user.profile instanceof Profile).toBe(true);
			expect(user.profile.bio).toBe("Software developer");
			expect(user.profile.contact instanceof Contact).toBe(true);
			expect(user.profile.contact.email).toBe("alice@example.com");
			expect(user.profile.contact.phone).toBe("555-0100");
		});
	});

	describe("Auto-discovery with dotted XML element names", () => {
		it("should auto-discover class from last part of dotted element name", () => {
			@XmlElement({ name: "identifier" })
			class Identifier {
				@XmlText()
				value!: string;

				@XmlAttribute()
				scheme!: string;
			}

			@XmlRoot({ name: "document" })
			class Document {
				title!: string;

				// Dotted element name - auto-discovery extracts "identifier" and finds the class
				@XmlElement({ name: "sender.identifier" })
				senderIdentifier!: Identifier;

				@XmlElement({ name: "receiver.identifier" })
				receiverIdentifier!: Identifier;
			}

			const xml = `
				<document>
					<title>Test Document</title>
					<sender.identifier scheme="ISO">ABC123</sender.identifier>
					<receiver.identifier scheme="ISO">XYZ789</receiver.identifier>
				</document>
			`;

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml(xml, Document);

			expect(doc.title).toBe("Test Document");
			expect(doc.senderIdentifier).toBeDefined();
			expect(doc.senderIdentifier instanceof Identifier).toBe(true);
			expect(doc.senderIdentifier.value).toBe("ABC123");
			expect(doc.senderIdentifier.scheme).toBe("ISO");

			expect(doc.receiverIdentifier).toBeDefined();
			expect(doc.receiverIdentifier instanceof Identifier).toBe(true);
			expect(doc.receiverIdentifier.value).toBe("XYZ789");
			expect(doc.receiverIdentifier.scheme).toBe("ISO");
		});

		it("should handle complex dotted names with text content and attributes", () => {
			@XmlElement({ name: "code" })
			class Code {
				@XmlText()
				content!: string;

				@XmlAttribute()
				codeSystem!: string;
			}

			@XmlRoot({ name: "record" })
			class Record {
				@XmlElement({ name: "participant.role.code" })
				participantRoleCode!: Code;

				@XmlElement({ name: "organization.type.code" })
				organizationTypeCode!: Code;
			}

			const xml = `
				<record>
					<participant.role.code codeSystem="ALPHA">P01</participant.role.code>
					<organization.type.code codeSystem="BETA">O05</organization.type.code>
				</record>
			`;

			const serializer = new XmlDecoratorSerializer();
			const record = serializer.fromXml(xml, Record);

			expect(record.participantRoleCode).toBeDefined();
			expect(record.participantRoleCode instanceof Code).toBe(true);
			expect(record.participantRoleCode.content).toBe("P01");
			expect(record.participantRoleCode.codeSystem).toBe("ALPHA");

			expect(record.organizationTypeCode).toBeDefined();
			expect(record.organizationTypeCode instanceof Code).toBe(true);
			expect(record.organizationTypeCode.content).toBe("O05");
			expect(record.organizationTypeCode.codeSystem).toBe("BETA");
		});
	});

	describe("Auto-discovery with naming conventions", () => {
		it("should match properties using camelCase conversion", () => {
			@XmlElement({ name: "ContactInfo" })
			class ContactInfo {
				emailAddress!: string;
				phoneNumber!: string;
			}

			@XmlRoot({ name: "Profile" })
			class Profile {
				firstName!: string;
				// Property name is camelCase, auto-discovery handles conversion
				@XmlElement({ name: "ContactInfo" })
				contactInfo!: ContactInfo;
			}

			const xml = `
				<Profile>
					<FirstName>Bob</FirstName>
					<ContactInfo>
						<EmailAddress>bob@example.com</EmailAddress>
						<PhoneNumber>555-0200</PhoneNumber>
					</ContactInfo>
				</Profile>
			`;

			const serializer = new XmlDecoratorSerializer();
			const profile = serializer.fromXml(xml, Profile);

			expect(profile.firstName).toBe("Bob");
			expect(profile.contactInfo instanceof ContactInfo).toBe(true);
			expect(profile.contactInfo.emailAddress).toBe("bob@example.com");
			expect(profile.contactInfo.phoneNumber).toBe("555-0200");
		});
	});

	describe("Auto-discovery with namespaces", () => {
		it("should auto-discover classes with namespace prefixes", () => {
			const NS = { prefix: "app", uri: "http://example.com/app" };

			@XmlElement({ name: "metadata", namespace: NS })
			class Metadata {
				@XmlElement({ namespace: NS })
				id!: string;

				@XmlElement({ namespace: NS })
				timestamp!: string;
			}

			@XmlElement({ name: "data", namespace: NS })
			class Data {
				@XmlElement({ namespace: NS })
				value!: string;
			}

			@XmlRoot({ name: "message", namespace: NS })
			class Message {
				@XmlElement({ namespace: NS })
				metadata!: Metadata;

				@XmlElement({ namespace: NS })
				data!: Data;
			}

			const xml = `
				<app:message xmlns:app="http://example.com/app">
					<app:metadata>
						<app:id>MSG-001</app:id>
						<app:timestamp>2025-12-09T10:00:00Z</app:timestamp>
					</app:metadata>
					<app:data>
						<app:value>Test Value</app:value>
					</app:data>
				</app:message>
			`;

			const serializer = new XmlDecoratorSerializer();
			const message = serializer.fromXml(xml, Message);

			expect(message.metadata).toBeDefined();
			expect(message.metadata instanceof Metadata).toBe(true);
			expect(message.metadata.id).toBe("MSG-001");
			expect(message.metadata.timestamp).toBe("2025-12-09T10:00:00Z");

			expect(message.data).toBeDefined();
			expect(message.data instanceof Data).toBe(true);
			expect(message.data.value).toBe("Test Value");
		});
	});

	describe("Auto-discovery without property initialization", () => {
		it("should work without property initialization using definite assignment assertion", () => {
			@XmlElement({ name: "location" })
			class Location {
				latitude!: number;
				longitude!: number;
			}

			@XmlRoot({ name: "place" })
			class Place {
				name!: string;

				// No initialization, no type parameter - just definite assignment assertion
				@XmlElement({ name: "location" })
				location!: Location;
			}

			const xml = `
				<place>
					<name>Central Park</name>
					<location>
						<latitude>40.785091</latitude>
						<longitude>-73.968285</longitude>
					</location>
				</place>
			`;

			const serializer = new XmlDecoratorSerializer();
			const place = serializer.fromXml(xml, Place);

			expect(place.name).toBe("Central Park");
			expect(place.location).toBeDefined();
			expect(place.location instanceof Location).toBe(true);
			expect(place.location.latitude).toBe(40.785091);
			expect(place.location.longitude).toBe(-73.968285);
		});

		it("should handle multiple nested objects without initialization", () => {
			@XmlElement({ name: "dimensions" })
			class Dimensions {
				width!: number;
				height!: number;
				depth!: number;
			}

			@XmlElement({ name: "price" })
			class Price {
				@XmlText()
				amount!: number;

				@XmlAttribute()
				currency!: string;
			}

			@XmlRoot({ name: "product" })
			class Product {
				name!: string;
				sku!: string;

				@XmlElement({ name: "dimensions" })
				dimensions!: Dimensions;

				@XmlElement({ name: "price" })
				price!: Price;
			}

			const xml = `
				<product>
					<name>Widget</name>
					<sku>WDG-001</sku>
					<dimensions>
						<width>10</width>
						<height>20</height>
						<depth>5</depth>
					</dimensions>
					<price currency="USD">99.99</price>
				</product>
			`;

			const serializer = new XmlDecoratorSerializer();
			const product = serializer.fromXml(xml, Product);

			expect(product.name).toBe("Widget");
			expect(product.sku).toBe("WDG-001");

			expect(product.dimensions instanceof Dimensions).toBe(true);
			expect(product.dimensions.width).toBe(10);
			expect(product.dimensions.height).toBe(20);
			expect(product.dimensions.depth).toBe(5);

			expect(product.price instanceof Price).toBe(true);
			expect(product.price.amount).toBe(99.99);
			expect(product.price.currency).toBe("USD");
		});
	});

	describe("Auto-discovery edge cases", () => {
		it("should prioritize exact element name match over dotted extraction", () => {
			// Register both the full dotted name and the simple name
			@XmlElement({ name: "parent.child" })
			class ParentChild {
				fullName!: string;
			}

			@XmlElement({ name: "child" })
			class Child {
				simpleName!: string;
			}

			@XmlRoot({ name: "root" })
			class Root {
				@XmlElement({ name: "parent.child" })
				parentChild!: ParentChild;

				@XmlElement({ name: "child" })
				child!: Child;
			}

			const xml = `
				<root>
					<parent.child>
						<fullName>Full Name</fullName>
					</parent.child>
					<child>
						<simpleName>Simple Name</simpleName>
					</child>
				</root>
			`;

			const serializer = new XmlDecoratorSerializer();
			const root = serializer.fromXml(xml, Root);

			expect(root.parentChild instanceof ParentChild).toBe(true);
			expect(root.parentChild.fullName).toBe("Full Name");

			expect(root.child instanceof Child).toBe(true);
			expect(root.child.simpleName).toBe("Simple Name");
		});
	});

	describe("Auto-discovery with strict validation", () => {
		it("should pass strict validation when using class-level @XmlElement decorator", () => {
			@XmlElement()
			class Author {
				@XmlElement()
				name!: string;

				@XmlElement()
				email!: string;
			}

			@XmlRoot()
			class Book {
				@XmlElement()
				title!: string;

				@XmlElement()
				Author!: Author;
			}

			const xml = `<Book><title>Test Book</title><Author><name>John Doe</name><email>john@example.com</email></Author></Book>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Book);
			}).not.toThrow();

			const result = serializer.fromXml(xml, Book);
			expect(result.Author).toBeDefined();
			expect(result.Author.name).toBe("John Doe");
			expect(result.Author.email).toBe("john@example.com");
		});

		it("should pass strict validation with type parameters", () => {
			class Product {
				@XmlElement()
				name!: string;

				@XmlElement()
				price!: number;
			}

			@XmlRoot()
			class Catalog {
				@XmlElement({ type: Product })
				Product!: Product;
			}

			const xml = `<Catalog><Product><name>Widget</name><price>99.99</price></Product></Catalog>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Catalog);
			}).not.toThrow();

			const result = serializer.fromXml(xml, Catalog);
			expect(result.Product.name).toBe("Widget");
			expect(result.Product.price).toBe(99.99);
		});

		it("should pass strict validation with deeply nested auto-discovered classes", () => {
			@XmlElement()
			class Address {
				@XmlElement()
				street!: string;

				@XmlElement()
				city!: string;
			}

			@XmlElement()
			class Person {
				@XmlElement()
				name!: string;

				@XmlElement()
				Address!: Address;
			}

			@XmlRoot()
			class Company {
				@XmlElement()
				companyName!: string;

				@XmlElement()
				Person!: Person;
			}

			const xml = `<Company><companyName>Acme Corp</companyName><Person><name>Alice</name><Address><street>123 Main St</street><city>Boston</city></Address></Person></Company>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Company);
			}).not.toThrow();

			const result = serializer.fromXml(xml, Company);
			expect(result.Person.Address.city).toBe("Boston");
		});

		it("should fail strict validation when nested class has unexpected elements", () => {
			@XmlElement()
			class Config {
				@XmlElement()
				timeout!: number;
			}

			@XmlRoot()
			class Settings {
				@XmlElement()
				Config!: Config;
			}

			const xml = `<Settings><Config><timeout>5000</timeout><retries>3</retries></Config></Settings>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Settings);
			}).toThrow(/retries/);
		});

		it("should pass strict validation with namespace-prefixed auto-discovered elements", () => {
			const NS = "http://example.com/ns";

			@XmlElement({ namespaces: [{ prefix: "ns", uri: NS }] })
			class Item {
				@XmlElement({ namespaces: [{ prefix: "ns", uri: NS }] })
				code!: string;

				@XmlElement({ namespaces: [{ prefix: "ns", uri: NS }] })
				quantity!: number;
			}

			@XmlRoot({ namespaces: [{ prefix: "ns", uri: NS }] })
			class Order {
				@XmlElement({ namespaces: [{ prefix: "ns", uri: NS }] })
				orderId!: string;

				@XmlElement({ namespaces: [{ prefix: "ns", uri: NS }] })
				Item!: Item;
			}

			const xml = `<ns:Order xmlns:ns="${NS}"><ns:orderId>ORD-001</ns:orderId><ns:Item><ns:code>ITEM-A</ns:code><ns:quantity>5</ns:quantity></ns:Item></ns:Order>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Order);
			}).not.toThrow();

			const result = serializer.fromXml(xml, Order);
			expect(result.Item.code).toBe("ITEM-A");
			expect(result.Item.quantity).toBe(5);
		});

		it("should pass strict validation with dotted element names and auto-discovery", () => {
			@XmlElement()
			class Identifier {
				@XmlText()
				value!: string;

				@XmlAttribute()
				scheme!: string;
			}

			@XmlRoot()
			class Document {
				@XmlElement()
				title!: string;

				@XmlElement({ name: "sender.id", type: Identifier })
				senderId!: Identifier;
			}

			const xml = `<Document><title>Doc 1</title><sender.id scheme="ISO">ABC123</sender.id></Document>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			expect(() => {
				serializer.fromXml(xml, Document);
			}).not.toThrow();

			const result = serializer.fromXml(xml, Document);
			expect(result.senderId.value).toBe("ABC123");
			expect(result.senderId.scheme).toBe("ISO");
		});

		it("should validate that all XML elements in auto-discovered classes have decorators", () => {
			@XmlElement()
			class User {
				@XmlElement()
				username!: string;
			}

			@XmlRoot()
			class System {
				@XmlElement()
				User!: User;
			}

			const xml = `<System><User><username>john</username><email>john@example.com</email></User></System>`;
			const serializer = new XmlDecoratorSerializer({ strictValidation: true });

			// Should throw because email doesn't have @XmlElement decorator in User class
			expect(() => {
				serializer.fromXml(xml, System);
			}).toThrow(/email/);
		});
	});
});
