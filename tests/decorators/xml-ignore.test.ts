import { describe, expect, it } from "@jest/globals";
import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlIgnore, XmlRoot } from "../../src";

describe("@XmlIgnore", () => {
	describe("Basic Ignore Functionality", () => {
		it("should ignore property during serialization", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement()
				username: string = "john_doe";

				@XmlIgnore()
				password: string = "secret123";

				@XmlElement()
				email: string = "john@example.com";
			}

			const user = new User();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(user);

			expect(xml).toContain("<username>john_doe</username>");
			expect(xml).toContain("<email>john@example.com</email>");
			expect(xml).not.toContain("password");
			expect(xml).not.toContain("secret123");
		});

		it("should ignore property during deserialization", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement()
				username: string = "";

				@XmlIgnore()
				password: string = "default_password";

				@XmlElement()
				email: string = "";
			}

			const xml = `
				<User>
					<username>john_doe</username>
					<password>hacker_attempt</password>
					<email>john@example.com</email>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer();
			const user = serializer.fromXml(xml, User);

			expect(user.username).toBe("john_doe");
			expect(user.email).toBe("john@example.com");
			// Password should remain at default value, ignoring XML value
			expect(user.password).toBe("default_password");
		});
	});

	describe("Ignore with Attributes", () => {
		it("should ignore attributes during serialization", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlAttribute({ name: "id" })
				id: string = "123";

				@XmlAttribute({ name: "category" })
				@XmlIgnore()
				internalCategory: string = "internal";

				@XmlElement()
				name: string = "Widget";
			}

			const product = new Product();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(product);

			expect(xml).toContain('id="123"');
			expect(xml).toContain("<name>Widget</name>");
			expect(xml).not.toContain("category");
			expect(xml).not.toContain("internalCategory");
			expect(xml).not.toContain("internal");
		});

		it("should ignore attributes during deserialization", () => {
			@XmlRoot({ name: "Product" })
			class Product {
				@XmlAttribute({ name: "id" })
				id: string = "";

				@XmlAttribute({ name: "secret" })
				@XmlIgnore()
				secretKey: string = "default_secret";

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Product id="123" secret="hacker_secret">
					<name>Widget</name>
				</Product>
			`;

			const serializer = new XmlDecoratorSerializer();
			const product = serializer.fromXml(xml, Product);

			expect(product.id).toBe("123");
			expect(product.name).toBe("Widget");
			// secretKey should remain at default, ignoring XML
			expect(product.secretKey).toBe("default_secret");
		});
	});

	describe("Complex Scenarios", () => {
		it("should handle multiple ignored properties", () => {
			@XmlRoot({ name: "Account" })
			class Account {
				@XmlElement()
				username: string = "user";

				@XmlIgnore()
				password: string = "pass";

				@XmlIgnore()
				sessionToken: string = "token";

				@XmlIgnore()
				lastLoginIp: string = "127.0.0.1";

				@XmlElement()
				email: string = "user@example.com";
			}

			const account = new Account();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(account);

			expect(xml).toContain("<username>user</username>");
			expect(xml).toContain("<email>user@example.com</email>");
			expect(xml).not.toContain("password");
			expect(xml).not.toContain("sessionToken");
			expect(xml).not.toContain("lastLoginIp");
		});

		it("should work with nested objects", () => {
			@XmlElement({ name: "Address" })
			class Address {
				@XmlElement()
				street: string = "123 Main St";

				@XmlIgnore()
				internalCode: string = "INTERNAL_001";

				@XmlElement()
				city: string = "Springfield";
			}

			@XmlRoot({ name: "Person" })
			class Person {
				@XmlElement()
				name: string = "John";

				@XmlElement()
				address: Address = new Address();

				@XmlIgnore()
				ssn: string = "123-45-6789";
			}

			const person = new Person();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<name>John</name>");
			expect(xml).toContain("<street>123 Main St</street>");
			expect(xml).toContain("<city>Springfield</city>");
			expect(xml).not.toContain("ssn");
			expect(xml).not.toContain("123-45-6789");
			expect(xml).not.toContain("internalCode");
			expect(xml).not.toContain("INTERNAL_001");
		});

		it("should ignore computed or transient properties", () => {
			@XmlRoot({ name: "Order" })
			class Order {
				@XmlElement()
				itemCount: number = 5;

				@XmlElement()
				pricePerItem: number = 10;

				@XmlIgnore()
				get totalPrice(): number {
					return this.itemCount * this.pricePerItem;
				}
			}

			const order = new Order();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(order);

			expect(xml).toContain("<itemCount>5</itemCount>");
			expect(xml).toContain("<pricePerItem>10</pricePerItem>");
			expect(xml).not.toContain("totalPrice");
			expect(xml).not.toContain("50");
		});
	});

	describe("Edge Cases", () => {
		it("should handle ignored property with null value", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement()
				value: string = "test";

				@XmlIgnore()
				ignored: string | null = null;
			}

			const data = new Data();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(data);

			expect(xml).toContain("<value>test</value>");
			expect(xml).not.toContain("ignored");
		});

		it("should handle ignored property with undefined value", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement()
				value: string = "test";

				@XmlIgnore()
				ignored?: string;
			}

			const data = new Data();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(data);

			expect(xml).toContain("<value>test</value>");
			expect(xml).not.toContain("ignored");
		});

		it("should ignore properties with complex types", () => {
			interface ComplexType {
				nested: string;
			}

			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement()
				name: string = "test";

				@XmlIgnore()
				complexData: ComplexType = { nested: "value" };
			}

			const container = new Container();
			const serializer = new XmlDecoratorSerializer();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<name>test</name>");
			expect(xml).not.toContain("complexData");
			expect(xml).not.toContain("nested");
		});
	});
});
