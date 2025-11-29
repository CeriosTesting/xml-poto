import { describe, expect, it } from "vitest";
import { XmlElement, XmlRoot } from "../../src/decorators";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("XmlElement transform option", () => {
	it("should serialize Date using transform.serialize", () => {
		@XmlRoot({ name: "Event" })
		class Event {
			@XmlElement({
				name: "created",
				transform: {
					serialize: (date: Date) => date.toISOString(),
				},
			})
			createdAt: Date = new Date("2024-01-15T10:30:00Z");
		}

		const serializer = new XmlDecoratorSerializer();
		const event = new Event();
		const xml = serializer.toXml(event);

		expect(xml).toContain("<created>2024-01-15T10:30:00.000Z</created>");
	});

	it("should deserialize Date using transform.deserialize", () => {
		@XmlRoot({ name: "Event" })
		class Event {
			@XmlElement({
				name: "created",
				transform: {
					deserialize: (str: string) => new Date(str),
				},
			})
			createdAt!: Date;
		}

		const serializer = new XmlDecoratorSerializer();
		const xml = `<Event><created>2024-01-15T10:30:00.000Z</created></Event>`;
		const event = serializer.fromXml(xml, Event);

		expect(event.createdAt).toBeInstanceOf(Date);
		expect(event.createdAt.toISOString()).toBe("2024-01-15T10:30:00.000Z");
	});

	it("should use both serialize and deserialize for round-trip", () => {
		@XmlRoot({ name: "Event" })
		class Event {
			@XmlElement({
				name: "created",
				transform: {
					serialize: (date: Date) => date.toISOString(),
					deserialize: (str: string) => new Date(str),
				},
			})
			createdAt: Date = new Date("2024-01-15T10:30:00Z");
		}

		const serializer = new XmlDecoratorSerializer();
		const event = new Event();

		// Serialize
		const xml = serializer.toXml(event);
		expect(xml).toContain("<created>2024-01-15T10:30:00.000Z</created>");

		// Deserialize
		const deserialized = serializer.fromXml(xml, Event);
		expect(deserialized.createdAt).toBeInstanceOf(Date);
		expect(deserialized.createdAt.getTime()).toBe(event.createdAt.getTime());
	});

	it("should work with serialize only (custom output)", () => {
		@XmlRoot({ name: "Product" })
		class Product {
			@XmlElement({
				name: "price",
				transform: {
					serialize: (price: number) => price.toFixed(2),
				},
			})
			price: number = 19.99;
		}

		const serializer = new XmlDecoratorSerializer();
		const product = new Product();
		const xml = serializer.toXml(product);

		expect(xml).toContain("<price>19.99</price>");
	});

	it("should work with deserialize only (parse custom format)", () => {
		@XmlRoot({ name: "Config" })
		class Config {
			@XmlElement({
				name: "enabled",
				transform: {
					deserialize: (str: string) => str.toLowerCase() === "yes",
				},
			})
			enabled!: boolean;
		}

		const serializer = new XmlDecoratorSerializer();
		const xml = `<Config><enabled>yes</enabled></Config>`;
		const config = serializer.fromXml(xml, Config);

		expect(config.enabled).toBe(true);
	});

	it("should handle complex transformations", () => {
		@XmlRoot({ name: "Document" })
		class Document {
			@XmlElement({
				name: "tags",
				transform: {
					serialize: (tags: string[]) => tags.join(","),
					deserialize: (str: string) => str.split(",").map(s => s.trim()),
				},
			})
			tags: string[] = ["typescript", "xml", "decorators"];
		}

		const serializer = new XmlDecoratorSerializer();
		const doc = new Document();

		// Serialize
		const xml = serializer.toXml(doc);
		expect(xml).toContain("<tags>typescript,xml,decorators</tags>");

		// Deserialize
		const deserialized = serializer.fromXml(xml, Document);
		expect(deserialized.tags).toEqual(["typescript", "xml", "decorators"]);
	});

	it("should not apply transform to complex objects", () => {
		@XmlElement({ name: "Address" })
		class Address {
			@XmlElement() city: string = "Boston";
		}

		@XmlRoot({ name: "Person" })
		class Person {
			@XmlElement({
				transform: {
					serialize: () => "should-not-be-called",
				},
			})
			address: Address = new Address();
		}

		const serializer = new XmlDecoratorSerializer();
		const person = new Person();
		const xml = serializer.toXml(person);

		// Should serialize the address object normally, not using the transform
		expect(xml).toContain("<city>Boston</city>");
		expect(xml).not.toContain("should-not-be-called");
	});

	it("should apply transform before type conversion", () => {
		@XmlRoot({ name: "Measurement" })
		class Measurement {
			@XmlElement({
				name: "value",
				transform: {
					deserialize: (str: string) => {
						// Parse "42.5 kg" to just the number
						return Number.parseFloat(str.split(" ")[0]);
					},
				},
			})
			value!: number;
		}

		const serializer = new XmlDecoratorSerializer();
		const xml = `<Measurement><value>42.5 kg</value></Measurement>`;
		const measurement = serializer.fromXml(xml, Measurement);

		expect(measurement.value).toBe(42.5);
		expect(typeof measurement.value).toBe("number");
	});

	it("should handle empty strings with transform", () => {
		@XmlRoot({ name: "Optional" })
		class Optional {
			@XmlElement({
				name: "value",
				transform: {
					serialize: (val: any) => (val === "" ? "EMPTY" : String(val)),
					deserialize: (str: string) => (str === "EMPTY" ? "" : str),
				},
			})
			value: string = "";
		}

		const serializer = new XmlDecoratorSerializer();
		const obj = new Optional();

		// Serialize empty string
		const xml = serializer.toXml(obj);
		expect(xml).toContain("<value>EMPTY</value>");

		// Deserialize back to empty string
		const deserialized = serializer.fromXml(xml, Optional);
		expect(deserialized.value).toBe("");
	});

	it("should work with timestamp to Date conversion", () => {
		@XmlRoot({ name: "Log" })
		class Log {
			@XmlElement({
				name: "timestamp",
				transform: {
					serialize: (date: Date) => date.getTime().toString(),
					deserialize: (str: string) => new Date(Number.parseInt(str, 10)),
				},
			})
			timestamp: Date = new Date("2024-01-15T10:30:00Z");
		}

		const serializer = new XmlDecoratorSerializer();
		const log = new Log();

		// Serialize to timestamp
		const xml = serializer.toXml(log);
		expect(xml).toContain(`<timestamp>${log.timestamp.getTime()}</timestamp>`);

		// Deserialize from timestamp
		const deserialized = serializer.fromXml(xml, Log);
		expect(deserialized.timestamp).toBeInstanceOf(Date);
		expect(deserialized.timestamp.getTime()).toBe(log.timestamp.getTime());
	});

	it("should work with custom enum serialization", () => {
		enum Status {
			Active = "ACTIVE",
			Inactive = "INACTIVE",
			Pending = "PENDING",
		}

		@XmlRoot({ name: "User" })
		class User {
			@XmlElement({
				name: "status",
				transform: {
					serialize: (status: Status) => status.toLowerCase(),
					deserialize: (str: string) => str.toUpperCase() as Status,
				},
			})
			status: Status = Status.Active;
		}

		const serializer = new XmlDecoratorSerializer();
		const user = new User();

		// Serialize to lowercase
		const xml = serializer.toXml(user);
		expect(xml).toContain("<status>active</status>");

		// Deserialize from lowercase
		const deserialized = serializer.fromXml(xml, User);
		expect(deserialized.status).toBe(Status.Active);
	});

	it("should only deserialize string values", () => {
		@XmlRoot({ name: "Test" })
		class Test {
			@XmlElement({
				name: "value",
				transform: {
					deserialize: (str: string) => `transformed-${str}`,
				},
			})
			value!: string;
		}

		const serializer = new XmlDecoratorSerializer();

		// Should apply transform to string value
		const xml1 = `<Test><value>hello</value></Test>`;
		const result1 = serializer.fromXml(xml1, Test);
		expect(result1.value).toBe("transformed-hello");

		// Should not apply transform to empty element (becomes empty string)
		const xml2 = `<Test><value></value></Test>`;
		const result2 = serializer.fromXml(xml2, Test);
		expect(result2.value).toBe("transformed-");
	});
});
