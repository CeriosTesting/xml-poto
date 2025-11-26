import { XmlDynamic, XmlRoot } from "../../src";
import { DynamicElement } from "../../src/query/dynamic-element";

describe("@XmlDynamic with useDefineForClassFields behavior", () => {
	it("should auto-create DynamicElement even with definite assignment assertion", () => {
		@XmlRoot({ name: "document" })
		class Document {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;
		}

		const document = new Document();

		// Check what's actually on the instance
		const descriptor = Object.getOwnPropertyDescriptor(document, "dynamic");

		// Should have getter/setter
		expect(descriptor?.get).toBeDefined();
		expect(descriptor?.set).toBeDefined();

		// Should auto-create the DynamicElement
		expect(document.dynamic).toBeDefined();
		expect(document.dynamic.name).toBe("document");
	});

	it("should work with both ! and ? syntax", () => {
		@XmlRoot({ name: "WithExclamation" })
		class WithExclamation {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement; // Definite assignment assertion
		}

		@XmlRoot({ name: "WithQuestion" })
		class WithQuestion {
			@XmlDynamic({ lazyLoad: false })
			dynamic?: DynamicElement; // Optional property
		}

		const withExclamation = new WithExclamation();
		const withQuestion = new WithQuestion();

		const desc1 = Object.getOwnPropertyDescriptor(withExclamation, "dynamic");
		const desc2 = Object.getOwnPropertyDescriptor(withQuestion, "dynamic");

		// Both should have getters
		expect(desc1?.get).toBeDefined();
		expect(desc2?.get).toBeDefined();

		// Both should auto-create
		expect(withExclamation.dynamic).toBeDefined();
		expect(withExclamation.dynamic.name).toBe("WithExclamation");
		expect(withQuestion.dynamic).toBeDefined();
		expect(withQuestion.dynamic?.name).toBe("WithQuestion");
	});

	it("should survive explicit field initialization (what useDefineForClassFields does)", () => {
		@XmlRoot({ name: "Explicit" })
		class Explicit {
			@XmlDynamic({ lazyLoad: false })
			dynamic: DynamicElement = undefined as any; // Explicit undefined assignment
		}

		const explicit = new Explicit();

		// With the Symbol-based storage fix, this should now work even with explicit = undefined
		// The setter intercepts the undefined assignment but the getter creates a new instance
		expect(explicit.dynamic).toBeDefined();
		expect(explicit.dynamic.name).toBe("Explicit");
	});

	it("should work alongside other field initializers", () => {
		@XmlRoot({ name: "Check" })
		class Check {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			// Other field to test initialization order
			otherField: string = "initialized";
		}

		const check = new Check();

		// Check all properties
		const dynamicDesc = Object.getOwnPropertyDescriptor(check, "dynamic");
		const otherDesc = Object.getOwnPropertyDescriptor(check, "otherField");

		// dynamic should have a getter
		expect(dynamicDesc?.get).toBeDefined();

		// otherField should be a plain value
		expect(otherDesc).toBeDefined();
		expect("value" in (otherDesc || {})).toBe(true);

		expect(check.otherField).toBe("initialized");
		expect(check.dynamic).toBeDefined();
		expect(check.dynamic.name).toBe("Check");
	});

	it("should work when accessed in constructor", () => {
		let constructorValue: DynamicElement | undefined;

		@XmlRoot({ name: "Track" })
		class Track {
			@XmlDynamic({ lazyLoad: false })
			dynamic!: DynamicElement;

			constructor() {
				// Access dynamic in constructor
				constructorValue = this.dynamic;
			}
		}

		const track = new Track();

		// Should have been created in constructor
		expect(constructorValue).toBeDefined();
		expect(constructorValue?.name).toBe("Track");

		// Should still be accessible after construction
		expect(track.dynamic).toBeDefined();
		expect(track.dynamic.name).toBe("Track");

		// Should be the same instance
		expect(track.dynamic).toBe(constructorValue);
	});
});
