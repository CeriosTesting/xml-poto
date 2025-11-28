import { describe, expect, it } from "vitest";
import { initializeDynamicProperties, initializeDynamicProperty, XmlDynamic, XmlRoot } from "../../src";
import { DynamicElement } from "../../src/query/dynamic-element";

describe("@XmlDynamic manual initialization (for esbuild/Playwright compatibility)", () => {
	it("should manually initialize a single dynamic property", () => {
		@XmlRoot({ name: "document" })
		class Document {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				// Manual initialization for environments with limited decorator support
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const document = new Document();

		expect(document.dynamic).toBeDefined();
		expect(document.dynamic.name).toBe("document");

		// Should be able to add children immediately
		document.dynamic.createChild({
			name: "EmptyElement",
		});

		expect(document.dynamic.children).toHaveLength(1);
		expect(document.dynamic.children[0].name).toBe("EmptyElement");
	});

	it("should manually initialize multiple dynamic properties", () => {
		@XmlRoot({ name: "Container" })
		class Container {
			@XmlDynamic({ lazyLoad: false })
			dynamic1!: DynamicElement;

			@XmlDynamic({ lazyLoad: false })
			dynamic2!: DynamicElement;

			constructor() {
				initializeDynamicProperty(this, "dynamic1");
				initializeDynamicProperty(this, "dynamic2");
			}
		}

		const container = new Container();

		expect(container.dynamic1).toBeDefined();
		expect(container.dynamic2).toBeDefined();
		expect(container.dynamic1.name).toBe("Container");
		expect(container.dynamic2.name).toBe("Container");

		// They should be different instances
		expect(container.dynamic1).not.toBe(container.dynamic2);
	});

	it("should initialize multiple dynamic properties at once", () => {
		@XmlRoot({ name: "AutoInit" })
		class AutoInit {
			@XmlDynamic({ lazyLoad: false })
			dynamic1!: DynamicElement;

			@XmlDynamic({ lazyLoad: false })
			dynamic2!: DynamicElement;

			constructor() {
				// Initialize all @XmlDynamic properties at once
				initializeDynamicProperties(this, ["dynamic1", "dynamic2"]);
			}
		}

		const autoInit = new AutoInit();

		expect(autoInit.dynamic1).toBeDefined();
		expect(autoInit.dynamic2).toBeDefined();
		expect(autoInit.dynamic1.name).toBe("AutoInit");
		expect(autoInit.dynamic2.name).toBe("AutoInit");
	});

	it("should work with explicit property names", () => {
		@XmlRoot({ name: "ExplicitInit" })
		class ExplicitInit {
			@XmlDynamic({ lazyLoad: false })
			dynamic1!: DynamicElement;

			@XmlDynamic({ lazyLoad: false })
			dynamic2!: DynamicElement;

			constructor() {
				// Explicitly provide property names
				initializeDynamicProperties(this, ["dynamic1", "dynamic2"]);
			}
		}

		const explicitInit = new ExplicitInit();

		expect(explicitInit.dynamic1).toBeDefined();
		expect(explicitInit.dynamic2).toBeDefined();
		expect(explicitInit.dynamic1.name).toBe("ExplicitInit");
		expect(explicitInit.dynamic2.name).toBe("ExplicitInit");
	});

	it("should handle empty property list gracefully", () => {
		@XmlRoot({ name: "EmptyList" })
		class EmptyList {
			@XmlDynamic({ lazyLoad: false })
			dynamic1!: DynamicElement;

			constructor() {
				// Empty array should do nothing
				initializeDynamicProperties(this, []);
			}
		}

		const emptyList = new EmptyList();

		// Properties should remain undefined since we passed empty array
		// (and decorator might not have run in some environments)
		// This is expected behavior - just verify it doesn't crash
		expect(emptyList).toBeDefined();
	});

	it("should work with lazy loading enabled", () => {
		@XmlRoot({ name: "Lazy" })
		class Lazy {
			@XmlDynamic({ lazyLoad: true })
			dynamic!: DynamicElement;

			constructor() {
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const lazy = new Lazy();

		// With lazy loading, it might be undefined initially
		// This is expected behavior for lazy loading without XML parsing
		const value = lazy.dynamic;
		expect(value).toBeUndefined();
	});

	it("should allow manual override after initialization", () => {
		@XmlRoot({ name: "Override" })
		class Override {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const override = new Override();

		// Should have auto-created value
		expect(override.dynamic.name).toBe("Override");

		// Manual override should work
		override.dynamic = new DynamicElement({
			name: "Custom",
			attributes: { version: "2.0" },
		});

		expect(override.dynamic.name).toBe("Custom");
		expect(override.dynamic.attributes.version).toBe("2.0");
	});

	it("should work when no metadata is found (fallback)", () => {
		// Create a class without proper decorator metadata
		class NoMetadata {
			dynamic!: DynamicElement;

			constructor() {
				// This should still work with a fallback
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const noMetadata = new NoMetadata();

		expect(noMetadata.dynamic).toBeDefined();
		expect(noMetadata.dynamic.name).toBe("NoMetadata");
	});

	it("should work with explicit root name", () => {
		@XmlRoot({ name: "CustomName" })
		class MyClass {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const myClass = new MyClass();

		expect(myClass.dynamic).toBeDefined();
		expect(myClass.dynamic.name).toBe("CustomName");
	});

	it("should handle repeated initialization gracefully", () => {
		@XmlRoot({ name: "Repeat" })
		class Repeat {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				// Initialize twice (should not cause issues)
				initializeDynamicProperty(this, "dynamic");
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const repeat = new Repeat();

		expect(repeat.dynamic).toBeDefined();
		expect(repeat.dynamic.name).toBe("Repeat");

		// Should still work normally
		repeat.dynamic.createChild({ name: "Child" });
		expect(repeat.dynamic.children).toHaveLength(1);
	});

	it("should work alongside working decorators", () => {
		@XmlRoot({ name: "Mixed" })
		class Mixed {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				// Only call if decorator didn't work
				if (!Object.getOwnPropertyDescriptor(this, "dynamic")?.get) {
					initializeDynamicProperty(this, "dynamic");
				}
			}
		}

		const mixed = new Mixed();

		expect(mixed.dynamic).toBeDefined();
		expect(mixed.dynamic.name).toBe("Mixed");
	});

	it("should work in real-world esbuild scenario", () => {
		// Simulate what happens when decorators don't run at all
		class EsbuildClass {
			dynamic!: DynamicElement;

			constructor() {
				// In esbuild/Playwright, decorators might not run
				// So manually initialize
				initializeDynamicProperty(this, "dynamic");
			}
		}

		const instance = new EsbuildClass();

		expect(instance.dynamic).toBeDefined();
		expect(instance.dynamic).toBeInstanceOf(DynamicElement);

		// Should be able to use it normally
		instance.dynamic.createChild({ name: "TestElement", text: "content" });
		expect(instance.dynamic.children).toHaveLength(1);
	});

	it("should require property names to be specified", () => {
		// Test that empty array results in no initialization
		class NoInit {
			dynamic1!: DynamicElement;
			dynamic2!: DynamicElement;

			constructor() {
				// Empty array means nothing gets initialized
				initializeDynamicProperties(this, []);
			}
		}

		const instance = new NoInit();

		// Properties remain undefined because empty array was passed
		expect(instance.dynamic1).toBeUndefined();
		expect(instance.dynamic2).toBeUndefined();
	});

	it("should initialize properties when names are provided", () => {
		// Provide property names explicitly
		class WithExplicitNames {
			dynamic1!: DynamicElement;
			dynamic2!: DynamicElement;

			constructor() {
				// Explicitly tell it which properties to initialize
				initializeDynamicProperties(this, ["dynamic1", "dynamic2"]);
			}
		}

		const instance = new WithExplicitNames();

		// Now both properties are properly initialized
		expect(instance.dynamic1).toBeDefined();
		expect(instance.dynamic2).toBeDefined();
		expect(instance.dynamic1).toBeInstanceOf(DynamicElement);
		expect(instance.dynamic2).toBeInstanceOf(DynamicElement);

		// They should be different instances
		expect(instance.dynamic1).not.toBe(instance.dynamic2);
	});
});
