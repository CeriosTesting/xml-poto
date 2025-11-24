import { beforeEach, describe, expect, it } from "@jest/globals";
import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("Undecorated classes", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer({
			omitXmlDeclaration: true,
		});
	});

	describe("Top-level undecorated classes", () => {
		it("should serialize undecorated class using class name", () => {
			class Person {
				@XmlElement() name: string = "John";
				@XmlElement() age: number = 30;
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<name>John</name>");
			expect(xml).toContain("<age>30</age>");
			expect(xml).toContain("</Person>");
		});

		it("should deserialize to undecorated class", () => {
			class Person {
				@XmlElement() name: string = "";
				@XmlElement() age: number = 0;
			}

			const xml = `
				<Person>
					<name>Jane</name>
					<age>25</age>
				</Person>
			`;

			const person = serializer.fromXml(xml, Person);

			expect(person.name).toBe("Jane");
			expect(person.age).toBe(25);
		});

		it("should serialize undecorated class with attributes", () => {
			class Product {
				@XmlAttribute() id: string = "123";
				@XmlElement() name: string = "Widget";
				@XmlElement() price: number = 9.99;
			}

			const product = new Product();
			const xml = serializer.toXml(product);

			expect(xml).toContain('<Product id="123">');
			expect(xml).toContain("<name>Widget</name>");
			expect(xml).toContain("<price>9.99</price>");
		});

		it("should deserialize undecorated class with attributes", () => {
			class Product {
				@XmlAttribute() id: string = "";
				@XmlElement() name: string = "";
				@XmlElement() price: number = 0;
			}

			const xml = `<Product id="456"><name>Gadget</name><price>19.99</price></Product>`;
			const product = serializer.fromXml(xml, Product);

			expect(product.id).toBe("456");
			expect(product.name).toBe("Gadget");
			expect(product.price).toBe(19.99);
		});
	});

	describe("Nested undecorated classes", () => {
		it("should handle nested undecorated classes", () => {
			class Address {
				@XmlElement() street: string = "123 Main St";
				@XmlElement() city: string = "Springfield";
			}

			class Person {
				@XmlElement() name: string = "John";
				@XmlElement() address: Address = new Address();
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<address>");
			expect(xml).toContain("<street>123 Main St</street>");
			expect(xml).toContain("<city>Springfield</city>");
			expect(xml).toContain("</address>");
			expect(xml).toContain("</Person>");
		});
		it("should deserialize nested undecorated classes", () => {
			class Address {
				@XmlElement() street: string = "";
				@XmlElement() city: string = "";
			}

			class Person {
				@XmlElement() name: string = "";
				@XmlElement() address: Address = new Address();
			}

			const xml = `
				<Person>
					<name>Jane</name>
					<address>
						<street>456 Oak Ave</street>
						<city>Boston</city>
					</address>
				</Person>
			`;

			const person = serializer.fromXml(xml, Person);

			expect(person.name).toBe("Jane");
			expect(person.address).toBeDefined();
			expect(person.address.street).toBe("456 Oak Ave");
			expect(person.address.city).toBe("Boston");
		});

		it("should handle deeply nested undecorated classes", () => {
			class Country {
				@XmlElement() name: string = "USA";
			}

			class Address {
				@XmlElement() street: string = "123 Main St";
				@XmlElement() country: Country = new Country();
			}

			class Person {
				@XmlElement() name: string = "John";
				@XmlElement() address: Address = new Address();
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<address>");
			expect(xml).toContain("<country>");
			expect(xml).toContain("<name>USA</name>");
			expect(xml).toContain("</country>");
			expect(xml).toContain("</address>");
			expect(xml).toContain("</Person>");
		});
	});

	describe("Mixed decorated and undecorated classes", () => {
		it("should work with mix of decorated and undecorated classes", () => {
			@XmlElement({ name: "Address" })
			class Address {
				@XmlElement() street: string = "456 Oak Ave";
				@XmlElement() city: string = "Boston";
			}

			class Person {
				@XmlElement() name: string = "Alice";
				@XmlElement() address: Address = new Address();
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<address>");
			expect(xml).toContain("<street>456 Oak Ave</street>");
			expect(xml).toContain("</Person>");
		});

		it("should work with undecorated parent and decorated child", () => {
			@XmlRoot({ elementName: "CustomAddress" })
			class Address {
				@XmlElement() street: string = "789 Elm St";
			}

			class Person {
				@XmlElement() name: string = "Bob";
				@XmlElement() address: Address = new Address();
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<Person>");
			expect(xml).toContain("<CustomAddress>");
			expect(xml).toContain("<street>789 Elm St</street>");
		});

		it("should prefer explicit decorators over default behavior", () => {
			@XmlRoot({ elementName: "CustomPerson" })
			class Person {
				@XmlElement() name: string = "Bob";
			}

			const person = new Person();
			const xml = serializer.toXml(person);

			expect(xml).toContain("<CustomPerson>");
			expect(xml).not.toContain("<Person>");
		});

		it("should prefer @XmlElement over default class name", () => {
			@XmlElement({ name: "Employee" })
			class Person {
				@XmlElement() name: string = "Charlie";
			}

			class Company {
				@XmlElement() person: Person = new Person();
			}

			const company = new Company();
			const xml = serializer.toXml(company);

			expect(xml).toContain("<Company>");
			expect(xml).toContain("<Employee>");
			expect(xml).not.toContain("<Person>");
		});
	});

	describe("Element naming priority order", () => {
		it("Priority 1: Should use @XmlElement field decorator name over everything else", () => {
			@XmlElement({ name: "ClassLevelName" })
			class MyClass {
				@XmlElement() value: string = "test";
			}

			class Container {
				@XmlElement("CustomFieldName") // Priority 1: Explicit field name
				myProperty: MyClass = new MyClass();
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<CustomFieldName>"); // Field decorator name wins
			expect(xml).not.toContain("<ClassLevelName>");
			expect(xml).not.toContain("<myProperty>");
			expect(xml).not.toContain("<MyClass>");
		});

		it("Priority 2: Should use @XmlElement class decorator name when no field name specified", () => {
			@XmlElement({ name: "ClassLevelName" })
			class MyClass {
				@XmlElement() value: string = "test";
			}

			class Container {
				@XmlElement() // No custom name on field
				myProperty: MyClass = new MyClass();
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<Container>");
			expect(xml).toContain("<ClassLevelName>"); // Class decorator name wins
			expect(xml).not.toContain("<myProperty>");
			expect(xml).not.toContain("<MyClass>");
		});

		it("Priority 3: Should use property name when no decorators have custom names", () => {
			class MyClass {
				@XmlElement() value: string = "test";
			}

			class Container {
				@XmlElement() // No custom name
				myProperty: MyClass = new MyClass();
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<Container>");
			expect(xml).toContain("<myProperty>"); // Property name wins
			expect(xml).not.toContain("<MyClass>");
		});

		it("Priority 4: Should use class name as fallback for top-level classes", () => {
			class MyClass {
				@XmlElement() value: string = "test";
			}

			const myClass = new MyClass();
			const xml = serializer.toXml(myClass);

			expect(xml).toContain("<MyClass>"); // Class name as fallback
			expect(xml).toContain("<value>test</value>");
		});

		it("Should demonstrate all priority levels in one structure", () => {
			class Level4Class {
				@XmlElement() data: string = "level4";
			}

			@XmlElement({ name: "Level2Name" })
			class Level2Class {
				@XmlElement() data: string = "level2";
			}

			class Container {
				@XmlElement("Level1Name") // Priority 1
				level1: Level4Class = new Level4Class();

				@XmlElement() // Priority 2 (class has @XmlElement decorator)
				level2: Level2Class = new Level2Class();

				@XmlElement() // Priority 3 (no decorator on class, uses property name)
				level3: Level4Class = new Level4Class();
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<Container>");
			expect(xml).toContain("<Level1Name>"); // Priority 1: Field decorator name
			expect(xml).toContain("<Level2Name>"); // Priority 2: Class decorator name
			expect(xml).toContain("<level3>"); // Priority 3: Property name
		});

		it("Should use @XmlRoot elementName same as @XmlElement class decorator (Priority 2)", () => {
			@XmlRoot({ elementName: "RootLevelName" })
			class MyClass {
				@XmlElement() value: string = "test";
			}

			class Container {
				@XmlElement() // No custom name on field
				myProperty: MyClass = new MyClass();
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<RootLevelName>"); // @XmlRoot elementName treated same as @XmlElement name
			expect(xml).not.toContain("<myProperty>");
			expect(xml).not.toContain("<MyClass>");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty undecorated class", () => {
			class Empty {}

			const empty = new Empty();
			const xml = serializer.toXml(empty);

			expect(xml).toContain("<Empty");
			expect(xml).toContain("/>");
		});

		it("should handle class with only primitives", () => {
			class Simple {
				@XmlElement() text: string = "hello";
				@XmlElement() number: number = 42;
				@XmlElement() flag: boolean = true;
			}

			const simple = new Simple();
			const xml = serializer.toXml(simple);

			expect(xml).toContain("<Simple>");
			expect(xml).toContain("<text>hello</text>");
			expect(xml).toContain("<number>42</number>");
			expect(xml).toContain("<flag>true</flag>");
		});

		it("should handle undecorated class with array property", () => {
			class Container {
				@XmlElement() items: string[] = ["a", "b", "c"];
			}

			const container = new Container();
			const xml = serializer.toXml(container);

			expect(xml).toContain("<Container>");
			expect(xml).toContain("<items>");
		});
	});
});
