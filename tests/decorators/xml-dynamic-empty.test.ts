import { XmlDynamic, XmlRoot } from "../../src";
import { DynamicElement } from "../../src/query/dynamic-element";

describe("@XmlDynamic with empty elements", () => {
	it("should auto-create DynamicElement when building from scratch", () => {
		@XmlRoot({ name: "document" })
		class Document {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;
		}

		const document = new Document();

		// Should be automatically created on first access
		expect(document.dynamic).toBeDefined();
		expect(document.dynamic.name).toBe("document");

		// Should be able to add children immediately
		document.dynamic.createChild({
			name: "EmptyElement",
		});

		expect(document.dynamic.children).toHaveLength(1);
		expect(document.dynamic.children[0].name).toBe("EmptyElement");
	});

	it("should create DynamicElement with correct root name", () => {
		@XmlRoot({ name: "Config" })
		class Config {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;
		}

		const config = new Config();

		// Should be automatically created
		expect(config.dynamic).toBeDefined();
		expect(config.dynamic.name).toBe("Config");

		// Should be able to add children
		config.dynamic.createChild({ name: "Setting", text: "value" });
		expect(config.dynamic.children).toHaveLength(1);
		expect(config.dynamic.children[0].text).toBe("value");
	});

	it("should use class name when no root name is specified", () => {
		@XmlRoot()
		class MyDocument {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;
		}

		const doc = new MyDocument();

		expect(doc.dynamic).toBeDefined();
		expect(doc.dynamic.name).toBe("MyDocument");
	});

	it("should allow manual assignment to override auto-created element", () => {
		@XmlRoot({ name: "Root" })
		class Root {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;
		}

		const root = new Root();

		// First access creates default
		const autoCreated = root.dynamic;
		expect(autoCreated.name).toBe("Root");

		// Manual assignment should override
		root.dynamic = new DynamicElement({
			name: "Custom",
			attributes: { version: "2.0" },
		});

		expect(root.dynamic.name).toBe("Custom");
		expect(root.dynamic.attributes.version).toBe("2.0");
	});

	it("should work with multiple @XmlDynamic properties", () => {
		@XmlRoot({ name: "Container" })
		class Container {
			@XmlDynamic({ lazyLoad: false })
			dynamic1!: DynamicElement;

			@XmlDynamic({ lazyLoad: false })
			dynamic2!: DynamicElement;
		}

		const container = new Container();

		expect(container.dynamic1).toBeDefined();
		expect(container.dynamic2).toBeDefined();
		expect(container.dynamic1.name).toBe("Container");
		expect(container.dynamic2.name).toBe("Container");

		// They should be different instances
		expect(container.dynamic1).not.toBe(container.dynamic2);
	});
});
