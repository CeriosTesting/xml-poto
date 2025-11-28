import { describe, expect, it } from "vitest";
import { XmlAttribute, XmlDecoratorSerializer, XmlElement, XmlRoot } from "../../src";

describe("Default Values", () => {
	describe("Element Default Values", () => {
		it("should use default value when element is missing", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ defaultValue: "localhost" })
				host: string = "";

				@XmlElement({ defaultValue: 8080 })
				port: number = 0;

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Config>
					<name>MyApp</name>
				</Config>
			`;

			const serializer = new XmlDecoratorSerializer();
			const config = serializer.fromXml(xml, Config);

			expect(config.name).toBe("MyApp");
			expect(config.host).toBe("localhost");
			expect(config.port).toBe(8080);
		});

		it("should override default value when element is present", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ defaultValue: "localhost" })
				host: string = "";

				@XmlElement({ defaultValue: 8080 })
				port: number = 0;
			}

			const xml = `
				<Config>
					<host>production.example.com</host>
					<port>443</port>
				</Config>
			`;

			const serializer = new XmlDecoratorSerializer();
			const config = serializer.fromXml(xml, Config);

			expect(config.host).toBe("production.example.com");
			expect(config.port).toBe(443);
		});

		it("should handle boolean default values", () => {
			@XmlRoot({ name: "Settings" })
			class Settings {
				@XmlElement({ defaultValue: true })
				enabled: boolean = false;

				@XmlElement({ defaultValue: false })
				debug: boolean = true;

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Settings>
					<name>MySettings</name>
				</Settings>
			`;

			const serializer = new XmlDecoratorSerializer();
			const settings = serializer.fromXml(xml, Settings);

			expect(settings.name).toBe("MySettings");
			expect(settings.enabled).toBe(true);
			expect(settings.debug).toBe(false);
		});

		it("should handle string default values", () => {
			@XmlRoot({ name: "User" })
			class User {
				@XmlElement()
				username: string = "";

				@XmlElement({ defaultValue: "user@example.com" })
				email: string = "";

				@XmlElement({ defaultValue: "Unknown" })
				displayName: string = "";
			}

			const xml = `
				<User>
					<username>john</username>
				</User>
			`;

			const serializer = new XmlDecoratorSerializer();
			const user = serializer.fromXml(xml, User);

			expect(user.username).toBe("john");
			expect(user.email).toBe("user@example.com");
			expect(user.displayName).toBe("Unknown");
		});

		it("should handle array default values", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement()
				name: string = "";

				@XmlElement({ defaultValue: [] })
				tags: string[] = [];
			}

			const xml = `
				<Data>
					<name>Test</name>
				</Data>
			`;

			const serializer = new XmlDecoratorSerializer();
			const data = serializer.fromXml(xml, Data);

			expect(data.name).toBe("Test");
			expect(data.tags).toEqual([]);
			expect(Array.isArray(data.tags)).toBe(true);
		});

		it("should handle object default values", () => {
			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement()
				name: string = "";

				@XmlElement({ defaultValue: { key: "value" } })
				metadata: any = {};
			}

			const xml = `
				<Container>
					<name>Test</name>
				</Container>
			`;

			const serializer = new XmlDecoratorSerializer();
			const container = serializer.fromXml(xml, Container);

			expect(container.name).toBe("Test");
			expect(container.metadata).toEqual({ key: "value" });
		});
	});

	describe("Attribute Default Values", () => {
		it("should use default value when attribute is missing", () => {
			@XmlRoot({ name: "Server" })
			class Server {
				@XmlAttribute({ name: "host", defaultValue: "localhost" })
				host: string = "";

				@XmlAttribute({ name: "port", defaultValue: 8080 })
				port: number = 0;

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Server>
					<name>MyServer</name>
				</Server>
			`;

			const serializer = new XmlDecoratorSerializer();
			const server = serializer.fromXml(xml, Server);

			expect(server.name).toBe("MyServer");
			expect(server.host).toBe("localhost");
			expect(server.port).toBe(8080);
		});

		it("should override default value when attribute is present", () => {
			@XmlRoot({ name: "Server" })
			class Server {
				@XmlAttribute({ name: "host", defaultValue: "localhost" })
				host: string = "";

				@XmlAttribute({ name: "port", defaultValue: 8080 })
				port: number = 0;
			}

			const xml = `<Server host="production.com" port="443" />`;

			const serializer = new XmlDecoratorSerializer();
			const server = serializer.fromXml(xml, Server);

			expect(server.host).toBe("production.com");
			expect(server.port).toBe(443);
		});

		it("should handle boolean attribute defaults", () => {
			@XmlRoot({ name: "Feature" })
			class Feature {
				@XmlAttribute({ name: "enabled", defaultValue: true })
				enabled: boolean = false;

				@XmlAttribute({ name: "beta", defaultValue: false })
				beta: boolean = true;

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Feature>
					<name>MyFeature</name>
				</Feature>
			`;

			const serializer = new XmlDecoratorSerializer();
			const feature = serializer.fromXml(xml, Feature);

			expect(feature.name).toBe("MyFeature");
			expect(feature.enabled).toBe(true);
			expect(feature.beta).toBe(false);
		});

		it("should handle string attribute defaults", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlAttribute({ name: "version", defaultValue: "1.0" })
				version: string = "";

				@XmlAttribute({ name: "encoding", defaultValue: "UTF-8" })
				encoding: string = "";

				@XmlElement()
				content: string = "";
			}

			const xml = `
				<Document>
					<content>Hello</content>
				</Document>
			`;

			const serializer = new XmlDecoratorSerializer();
			const doc = serializer.fromXml(xml, Document);

			expect(doc.content).toBe("Hello");
			expect(doc.version).toBe("1.0");
			expect(doc.encoding).toBe("UTF-8");
		});
	});

	describe("Mixed Default Values", () => {
		it("should handle both element and attribute defaults", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlAttribute({ name: "version", defaultValue: "1.0" })
				version: string = "";

				@XmlElement({ defaultValue: "localhost" })
				host: string = "";

				@XmlElement({ defaultValue: 8080 })
				port: number = 0;

				@XmlAttribute({ name: "enabled", defaultValue: true })
				enabled: boolean = false;
			}

			const xml = `<Config />`;

			const serializer = new XmlDecoratorSerializer();
			const config = serializer.fromXml(xml, Config);

			expect(config.version).toBe("1.0");
			expect(config.host).toBe("localhost");
			expect(config.port).toBe(8080);
			expect(config.enabled).toBe(true);
		});

		it("should handle partial defaults with some values present", () => {
			@XmlRoot({ name: "Settings" })
			class Settings {
				@XmlAttribute({ name: "id", defaultValue: "default-id" })
				id: string = "";

				@XmlElement({ defaultValue: "Default Name" })
				name: string = "";

				@XmlElement({ defaultValue: 100 })
				value: number = 0;
			}

			const xml = `
				<Settings id="custom-id">
					<name>Custom Name</name>
				</Settings>
			`;

			const serializer = new XmlDecoratorSerializer();
			const settings = serializer.fromXml(xml, Settings);

			expect(settings.id).toBe("custom-id");
			expect(settings.name).toBe("Custom Name");
			expect(settings.value).toBe(100); // Uses default
		});
	});

	describe("Edge Cases", () => {
		it("should handle null as a default value", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement()
				name: string = "";

				@XmlElement({ defaultValue: null })
				optional: string | null = "initial";
			}

			const xml = `
				<Data>
					<name>Test</name>
				</Data>
			`;

			const serializer = new XmlDecoratorSerializer();
			const data = serializer.fromXml(xml, Data);

			expect(data.name).toBe("Test");
			expect(data.optional).toBe(null);
		});

		it("should handle empty string as default value", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement({ defaultValue: "" })
				value: string = "initial";
			}

			const xml = `<Data />`;

			const serializer = new XmlDecoratorSerializer();
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe("");
		});

		it("should handle zero as default value", () => {
			@XmlRoot({ name: "Counter" })
			class Counter {
				@XmlElement({ defaultValue: 0 })
				count: number = 100;
			}

			const xml = `<Counter />`;

			const serializer = new XmlDecoratorSerializer();
			const counter = serializer.fromXml(xml, Counter);

			expect(counter.count).toBe(0);
		});

		it("should not apply default when element explicitly has empty value", () => {
			@XmlRoot({ name: "Data" })
			class Data {
				@XmlElement({ defaultValue: "default" })
				value: string = "";
			}

			const xml = `
				<Data>
					<value></value>
				</Data>
			`;

			const serializer = new XmlDecoratorSerializer();
			const data = serializer.fromXml(xml, Data);

			// Empty element is present, so default should not be used
			expect(data.value).toBe("");
		});
	});

	describe("Required with Defaults", () => {
		it("should use default value even if marked as required", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlElement({ required: true, defaultValue: "localhost" })
				host: string = "";

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Config>
					<name>MyConfig</name>
				</Config>
			`;

			const serializer = new XmlDecoratorSerializer();
			const config = serializer.fromXml(xml, Config);

			// Should use default instead of throwing error
			expect(config.name).toBe("MyConfig");
			expect(config.host).toBe("localhost");
		});

		it("should use default for required attribute when missing", () => {
			@XmlRoot({ name: "Server" })
			class Server {
				@XmlAttribute({ name: "port", required: true, defaultValue: 8080 })
				port: number = 0;

				@XmlElement()
				name: string = "";
			}

			const xml = `
				<Server>
					<name>MyServer</name>
				</Server>
			`;

			const serializer = new XmlDecoratorSerializer();
			const server = serializer.fromXml(xml, Server);

			// Should use default instead of throwing error
			expect(server.name).toBe("MyServer");
			expect(server.port).toBe(8080);
		});
	});
});
