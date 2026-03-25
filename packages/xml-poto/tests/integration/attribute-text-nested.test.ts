/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";

/**
 * Tests for classes with @XmlAttribute + @XmlText (no class-level decorator)
 * used as nested types in parent classes.
 *
 * Bug: When a class has only @XmlAttribute and @XmlText decorators (no @XmlRoot/@XmlElement
 * on the class itself) and is used as nested type, JSON.stringify produces
 * {"@_scheme": "urn:example", "#text": "test-value"} instead of using property names.
 */
describe("Attribute + Text nested class (no class-level decorator)", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("deserialization (fromXml)", () => {
		it("should deserialize nested class with @XmlAttribute and @XmlText using property names", () => {
			class CategoryValue {
				@XmlAttribute({ name: "scheme" })
				scheme: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({ name: "Category", type: CategoryValue })
				category: CategoryValue = new CategoryValue();
			}

			const xml = `<?xml version="1.0"?><Root><Category scheme="urn:example">test-value</Category></Root>`;
			const result = serializer.fromXml(xml, Root);

			expect(result.category).toBeInstanceOf(CategoryValue);
			expect(result.category.scheme).toBe("urn:example");
			expect(result.category.value).toBe("test-value");

			// Verify JSON.stringify uses property names, not parser keys
			const json = JSON.parse(JSON.stringify(result.category));
			expect(json).toHaveProperty("scheme", "urn:example");
			expect(json).toHaveProperty("value", "test-value");
			expect(json).not.toHaveProperty("@_scheme");
			expect(json).not.toHaveProperty("#text");
		});

		it("should deserialize nested class without explicit type via auto-discovery", () => {
			class TagValue {
				@XmlAttribute({ name: "scheme" })
				scheme: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({ name: "TagValue" })
				tagValue: TagValue = new TagValue();
			}

			const xml = `<?xml version="1.0"?><Root><TagValue scheme="urn:sample">test</TagValue></Root>`;
			const result = serializer.fromXml(xml, Root);

			expect(result.tagValue.scheme).toBe("urn:sample");
			expect(result.tagValue.value).toBe("test");

			const json = JSON.parse(JSON.stringify(result.tagValue));
			expect(json).not.toHaveProperty("@_scheme");
			expect(json).not.toHaveProperty("#text");
		});

		it("should deserialize class with @XmlAttribute and @XmlText at multiple levels", () => {
			class TypedValue {
				@XmlAttribute({ name: "type" })
				type: string = "";

				@XmlText()
				content: string = "";
			}

			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement({ name: "Title", type: TypedValue })
				title: TypedValue = new TypedValue();

				@XmlElement({ name: "Description", type: TypedValue })
				description: TypedValue = new TypedValue();

				@XmlElement({ name: "Note", type: TypedValue })
				note: TypedValue = new TypedValue();
			}

			const xml = `<?xml version="1.0"?>
<Document>
  <Title type="main">Hello World</Title>
  <Description type="short">A brief description</Description>
  <Note type="info">Additional info</Note>
</Document>`;

			const result = serializer.fromXml(xml, Document);

			// Verify all three instances have proper property names
			expect(result.title.type).toBe("main");
			expect(result.title.content).toBe("Hello World");
			expect(result.description.type).toBe("short");
			expect(result.description.content).toBe("A brief description");
			expect(result.note.type).toBe("info");
			expect(result.note.content).toBe("Additional info");

			// Verify JSON serialization uses property names
			for (const prop of [result.title, result.description, result.note]) {
				const json = JSON.parse(JSON.stringify(prop));
				expect(json).not.toHaveProperty("@_type");
				expect(json).not.toHaveProperty("#text");
			}
		});

		it("should handle attribute-text class with custom attribute name", () => {
			class Amount {
				@XmlAttribute({ name: "currency" })
				currency: string = "";

				@XmlText({ dataType: "number" })
				amount: number = 0;
			}

			@XmlRoot({ name: "Invoice" })
			class Invoice {
				@XmlElement({ name: "Total", type: Amount })
				total: Amount = new Amount();
			}

			const xml = `<?xml version="1.0"?><Invoice><Total currency="EUR">99.99</Total></Invoice>`;
			const result = serializer.fromXml(xml, Invoice);

			expect(result.total.currency).toBe("EUR");
			expect(result.total.amount).toBe(99.99);

			const json = JSON.parse(JSON.stringify(result.total));
			expect(json).toHaveProperty("currency", "EUR");
			expect(json).toHaveProperty("amount", 99.99);
			expect(json).not.toHaveProperty("@_currency");
			expect(json).not.toHaveProperty("#text");
		});

		it("should handle attribute-text class with multiple attributes", () => {
			class StyledText {
				@XmlAttribute({ name: "font" })
				font: string = "";

				@XmlAttribute({ name: "size" })
				size: string = "";

				@XmlText()
				text: string = "";
			}

			@XmlRoot({ name: "Page" })
			class Page {
				@XmlElement({ name: "Heading", type: StyledText })
				heading: StyledText = new StyledText();
			}

			const xml = `<?xml version="1.0"?><Page><Heading font="Arial" size="24">Welcome</Heading></Page>`;
			const result = serializer.fromXml(xml, Page);

			expect(result.heading.font).toBe("Arial");
			expect(result.heading.size).toBe("24");
			expect(result.heading.text).toBe("Welcome");

			const json = JSON.parse(JSON.stringify(result.heading));
			expect(json).not.toHaveProperty("@_font");
			expect(json).not.toHaveProperty("@_size");
			expect(json).not.toHaveProperty("#text");
		});

		it("should handle attribute-text class without default initialization via type", () => {
			class TaggedValue {
				@XmlAttribute({ name: "tag" })
				tag: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Container" })
			class Container {
				@XmlElement({ name: "Item", type: TaggedValue })
				item!: TaggedValue;
			}

			const xml = `<?xml version="1.0"?><Container><Item tag="important">data</Item></Container>`;
			const result = serializer.fromXml(xml, Container);

			expect(result.item).toBeInstanceOf(TaggedValue);
			expect(result.item.tag).toBe("important");
			expect(result.item.value).toBe("data");

			const json = JSON.parse(JSON.stringify(result.item));
			expect(json).not.toHaveProperty("@_tag");
			expect(json).not.toHaveProperty("#text");
		});
	});

	describe("serialization (toXml)", () => {
		it("should serialize nested class with @XmlAttribute and @XmlText", () => {
			class CategoryValue {
				@XmlAttribute({ name: "scheme" })
				scheme: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({ name: "Category", type: CategoryValue })
				category: CategoryValue = new CategoryValue();
			}

			const root = new Root();
			root.category.scheme = "urn:example";
			root.category.value = "test-value";

			const xml = serializer.toXml(root);
			expect(xml).toContain('scheme="urn:example"');
			expect(xml).toContain("test-value");
		});

		it("should round-trip serialize and deserialize", () => {
			class LabeledValue {
				@XmlAttribute({ name: "label" })
				label: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Form" })
			class Form {
				@XmlElement({ name: "Field1", type: LabeledValue })
				field1: LabeledValue = new LabeledValue();

				@XmlElement({ name: "Field2", type: LabeledValue })
				field2: LabeledValue = new LabeledValue();
			}

			const form = new Form();
			form.field1.label = "Name";
			form.field1.value = "John";
			form.field2.label = "Age";
			form.field2.value = "30";

			const xml = serializer.toXml(form);
			const result = serializer.fromXml(xml, Form);

			expect(result.field1.label).toBe("Name");
			expect(result.field1.value).toBe("John");
			expect(result.field2.label).toBe("Age");
			expect(result.field2.value).toBe("30");
		});
	});

	describe("attribute-metadata auto-discovery fallback", () => {
		it("should discover class by attribute metadata when name-based discovery fails", () => {
			class MetricValue {
				@XmlAttribute({ name: "unit" })
				unit: string = "";

				@XmlText()
				measurement: string = "";
			}

			// Force registration by creating an instance
			new MetricValue();

			@XmlRoot({ name: "Report" })
			class Report {
				// Using @XmlElement with type ensures proper deserialization
				@XmlElement({ name: "Temperature", type: MetricValue })
				temperature!: MetricValue;
			}

			const xml = `<?xml version="1.0"?><Report><Temperature unit="celsius">36.6</Temperature></Report>`;
			const result = serializer.fromXml(xml, Report);

			expect(result.temperature).toBeInstanceOf(MetricValue);
			expect(result.temperature.unit).toBe("celsius");
			expect(result.temperature.measurement).toBe("36.6");
		});

		it("should work with default-initialized property (constructor provides type info)", () => {
			class StatusCode {
				@XmlAttribute({ name: "system" })
				system: string = "";

				@XmlText()
				code: string = "";
			}

			@XmlRoot({ name: "Response" })
			class Response {
				@XmlElement({ name: "Status" })
				status: StatusCode = new StatusCode();
			}

			const xml = `<?xml version="1.0"?><Response><Status system="HTTP">200</Status></Response>`;
			const result = serializer.fromXml(xml, Response);

			expect(result.status).toBeInstanceOf(StatusCode);
			expect(result.status.system).toBe("HTTP");
			expect(result.status.code).toBe("200");

			const json = JSON.parse(JSON.stringify(result.status));
			expect(json).not.toHaveProperty("@_system");
			expect(json).not.toHaveProperty("#text");
		});

		it("should handle CDATA text content with attributes in nested class", () => {
			class ScriptBlock {
				@XmlAttribute({ name: "language" })
				language: string = "";

				@XmlText({ useCDATA: true })
				code: string = "";
			}

			@XmlRoot({ name: "Page" })
			class Page {
				@XmlElement({ name: "Script", type: ScriptBlock })
				script: ScriptBlock = new ScriptBlock();
			}

			const xml = `<?xml version="1.0"?><Page><Script language="js"><![CDATA[if (x < 5) { alert("hello"); }]]></Script></Page>`;
			const result = serializer.fromXml(xml, Page);

			expect(result.script).toBeInstanceOf(ScriptBlock);
			expect(result.script.language).toBe("js");
			expect(result.script.code).toBe('if (x < 5) { alert("hello"); }');
		});
	});

	describe("strict validation", () => {
		let strictSerializer: XmlSerializer;

		beforeEach(() => {
			strictSerializer = new XmlSerializer({ strictValidation: true });
		});

		it("should deserialize nested attribute+text class with explicit type under strict validation", () => {
			class RatedValue {
				@XmlAttribute({ name: "scheme" })
				scheme: string = "";

				@XmlText()
				value: string = "";
			}

			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({ name: "Rating", type: RatedValue })
				rating: RatedValue = new RatedValue();
			}

			const xml = `<?xml version="1.0"?><Root><Rating scheme="urn:stars">5</Rating></Root>`;
			const result = strictSerializer.fromXml(xml, Root);

			expect(result.rating).toBeInstanceOf(RatedValue);
			expect(result.rating.scheme).toBe("urn:stars");
			expect(result.rating.value).toBe("5");

			const json = JSON.parse(JSON.stringify(result.rating));
			expect(json).not.toHaveProperty("@_scheme");
			expect(json).not.toHaveProperty("#text");
		});

		it("should deserialize via default-initialized property under strict validation", () => {
			class PriorityValue {
				@XmlAttribute({ name: "level" })
				level: string = "";

				@XmlText()
				label: string = "";
			}

			@XmlRoot({ name: "Task" })
			class Task {
				@XmlElement({ name: "Priority" })
				priority: PriorityValue = new PriorityValue();
			}

			const xml = `<?xml version="1.0"?><Task><Priority level="high">Urgent</Priority></Task>`;
			const result = strictSerializer.fromXml(xml, Task);

			expect(result.priority).toBeInstanceOf(PriorityValue);
			expect(result.priority.level).toBe("high");
			expect(result.priority.label).toBe("Urgent");

			const json = JSON.parse(JSON.stringify(result.priority));
			expect(json).not.toHaveProperty("@_level");
			expect(json).not.toHaveProperty("#text");
		});

		it("should round-trip attribute+text class under strict validation", () => {
			class ScoredItem {
				@XmlAttribute({ name: "scale" })
				scale: string = "";

				@XmlText()
				score: string = "";
			}

			@XmlRoot({ name: "Result" })
			class Result {
				@XmlElement({ name: "Score", type: ScoredItem })
				score: ScoredItem = new ScoredItem();
			}

			const result = new Result();
			result.score.scale = "1-10";
			result.score.score = "8";

			const xml = strictSerializer.toXml(result);
			const deserialized = strictSerializer.fromXml(xml, Result);

			expect(deserialized.score).toBeInstanceOf(ScoredItem);
			expect(deserialized.score.scale).toBe("1-10");
			expect(deserialized.score.score).toBe("8");
		});

		it("should deserialize attribute+text class at multiple levels under strict validation", () => {
			class LabeledEntry {
				@XmlAttribute({ name: "category" })
				category: string = "";

				@XmlText()
				text: string = "";
			}

			@XmlRoot({ name: "Catalog" })
			class Catalog {
				@XmlElement({ name: "Title", type: LabeledEntry })
				title: LabeledEntry = new LabeledEntry();

				@XmlElement({ name: "Subtitle", type: LabeledEntry })
				subtitle: LabeledEntry = new LabeledEntry();
			}

			const xml = `<?xml version="1.0"?>
<Catalog>
  <Title category="main">Product Catalog</Title>
  <Subtitle category="secondary">Spring Edition</Subtitle>
</Catalog>`;

			const result = strictSerializer.fromXml(xml, Catalog);

			expect(result.title.category).toBe("main");
			expect(result.title.text).toBe("Product Catalog");
			expect(result.subtitle.category).toBe("secondary");
			expect(result.subtitle.text).toBe("Spring Edition");

			for (const prop of [result.title, result.subtitle]) {
				const json = JSON.parse(JSON.stringify(prop));
				expect(json).not.toHaveProperty("@_category");
				expect(json).not.toHaveProperty("#text");
			}
		});
	});
});
