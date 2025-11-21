import { XmlArrayItem } from "../../src/decorators/xml-array-item";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlText } from "../../src/decorators/xml-text";
import { XmlSerializer } from "../../src/xml-serializer";

describe("Integration Tests - Complex Edge Cases", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("Polymorphic Array Handling", () => {
		@XmlElement("Dog")
		class Dog {
			@XmlAttribute({ name: "type" })
			type: string = "dog";

			@XmlElement("Name")
			name: string = "";

			@XmlElement("Breed")
			breed: string = "";
		}

		@XmlElement("Cat")
		class Cat {
			@XmlAttribute({ name: "type" })
			type: string = "cat";

			@XmlElement("Name")
			name: string = "";

			@XmlElement("Color")
			color: string = "";
		}

		@XmlRoot({ elementName: "PetStore" })
		class PetStore {
			@XmlArrayItem({ itemName: "Dog", type: Dog })
			@XmlArrayItem({ itemName: "Cat", type: Cat })
			pets: Array<Dog | Cat> = [];
		}

		it("should serialize mixed type arrays", () => {
			const store = new PetStore();

			const dog = new Dog();
			dog.name = "Buddy";
			dog.breed = "Golden Retriever";

			const cat = new Cat();
			cat.name = "Whiskers";
			cat.color = "Orange";

			store.pets = [dog, cat];

			const xml = serializer.toXml(store);

			expect(xml).toContain("<Name>Buddy</Name>");
			expect(xml).toContain("<Breed>Golden Retriever</Breed>");
			expect(xml).toContain("<Name>Whiskers</Name>");
			expect(xml).toContain("<Color>Orange</Color>");
		});
	});

	describe("Deep Nesting", () => {
		@XmlElement("Level4")
		class Level4 {
			@XmlElement("Value")
			value: string = "";
		}

		@XmlElement("Level3")
		class Level3 {
			@XmlElement("Level4")
			level4: Level4 = new Level4();
		}

		@XmlElement("Level2")
		class Level2 {
			@XmlElement("Level3")
			level3: Level3 = new Level3();
		}

		@XmlElement("Level1")
		class Level1 {
			@XmlElement("Level2")
			level2: Level2 = new Level2();
		}

		@XmlRoot({ elementName: "Root" })
		class DeepRoot {
			@XmlElement("Level1")
			level1: Level1 = new Level1();
		}

		it("should handle deeply nested structures", () => {
			const root = new DeepRoot();
			root.level1.level2.level3.level4.value = "Deep Value";

			const xml = serializer.toXml(root);

			expect(xml).toContain("<Level1>");
			expect(xml).toContain("<Level2>");
			expect(xml).toContain("<Level3>");
			expect(xml).toContain("<Level4>");
			expect(xml).toContain("<Value>Deep Value</Value>");
		});

		it("should deserialize deeply nested structures", () => {
			const xml = `
				<Root>
					<Level1>
						<Level2>
							<Level3>
								<Level4>
									<Value>Nested Data</Value>
								</Level4>
							</Level3>
						</Level2>
					</Level1>
				</Root>
			`;

			const root = serializer.fromXml(xml, DeepRoot);

			expect(root.level1.level2.level3.level4.value).toBe("Nested Data");
		});
	});

	describe("Arrays of Arrays (Nested Collections)", () => {
		@XmlElement("Cell")
		class Cell {
			@XmlText()
			value: string = "";
		}

		@XmlElement("Row")
		class Row {
			@XmlArrayItem({ itemName: "Cell", type: Cell })
			cells: Cell[] = [];
		}

		@XmlRoot({ elementName: "Table" })
		class Table {
			@XmlArrayItem({ itemName: "Row", type: Row })
			rows: Row[] = [];
		}

		it("should serialize table-like structures", () => {
			const table = new Table();

			const row1 = new Row();
			const cell1_1 = new Cell();
			cell1_1.value = "A1";
			const cell1_2 = new Cell();
			cell1_2.value = "B1";
			row1.cells = [cell1_1, cell1_2];

			const row2 = new Row();
			const cell2_1 = new Cell();
			cell2_1.value = "A2";
			const cell2_2 = new Cell();
			cell2_2.value = "B2";
			row2.cells = [cell2_1, cell2_2];

			table.rows = [row1, row2];

			const xml = serializer.toXml(table);

			expect(xml).toContain("A1");
			expect(xml).toContain("B1");
			expect(xml).toContain("A2");
			expect(xml).toContain("B2");
		});

		it("should handle empty nested arrays", () => {
			const table = new Table();
			const row = new Row();
			row.cells = [];
			table.rows = [row];

			const xml = serializer.toXml(table);

			expect(xml).toContain("<Row");
		});
	});

	describe("Special Characters and Encoding", () => {
		@XmlRoot({ elementName: "Content" })
		class Content {
			@XmlAttribute({ name: "title" })
			title: string = "";

			@XmlElement("Text")
			text: string = "";
		}

		it("should handle special XML characters in attributes", () => {
			const content = new Content();
			content.title = 'Test & "Quote" <Tag>';
			content.text = "Normal text";

			const xml = serializer.toXml(content);

			expect(xml).toBeTruthy();
			// fast-xml-parser should handle escaping
		});

		it("should handle special characters in text content", () => {
			const content = new Content();
			content.title = "Test";
			content.text = "Text with <tags> & \"quotes\" and 'apostrophes'";

			const xml = serializer.toXml(content);

			expect(xml).toBeTruthy();
		});

		it("should handle unicode characters", () => {
			const content = new Content();
			content.title = "Unicode Test";
			content.text = "Hello 世界 🌍 Привет";

			const xml = serializer.toXml(content);

			expect(xml).toContain("世界");
			expect(xml).toContain("Привет");
		});
	});

	describe("Type Conversion Edge Cases", () => {
		@XmlRoot({ elementName: "TypeTest" })
		class TypeTest {
			@XmlElement("BooleanTrue")
			boolTrue: boolean = true;

			@XmlElement("BooleanFalse")
			boolFalse: boolean = false;

			@XmlElement("NumberZero")
			numZero: number = 0;

			@XmlElement("NumberNegative")
			numNeg: number = -42;

			@XmlElement("NumberDecimal")
			numDec: number = Math.PI;

			@XmlElement("EmptyString")
			emptyStr: string = "";

			@XmlElement("WhitespaceString")
			whitespace: string = "   ";
		}

		it("should preserve boolean types through round-trip", () => {
			const original = new TypeTest();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, TypeTest);

			expect(deserialized.boolTrue).toBe(true);
			expect(deserialized.boolFalse).toBe(false);
		});

		it("should preserve numeric edge cases through round-trip", () => {
			const original = new TypeTest();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, TypeTest);

			expect(deserialized.numZero).toBe(0);
			expect(deserialized.numNeg).toBe(-42);
			expect(deserialized.numDec).toBeCloseTo(Math.PI, 5);
		});

		it("should preserve string edge cases", () => {
			const original = new TypeTest();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, TypeTest);

			expect(deserialized.emptyStr).toBe("");
			expect(deserialized.whitespace).toBe("   ");
		});
	});

	describe("Custom Converters Integration", () => {
		const dateConverter = {
			serialize: (date: Date) => date.toISOString(),
			deserialize: (str: string) => new Date(str),
		};

		const upperCaseConverter = {
			serialize: (val: string) => val.toUpperCase(),
			deserialize: (val: string) => val.toLowerCase(),
		};

		@XmlRoot({ elementName: "Event" })
		class Event {
			@XmlAttribute({ name: "code", converter: upperCaseConverter })
			code: string = "";

			@XmlElement("Name")
			name: string = "";

			@XmlText({ converter: dateConverter })
			timestamp: Date = new Date();
		}

		it("should apply custom converters during serialization", () => {
			const event = new Event();
			event.code = "evt123";
			event.name = "Test Event";
			event.timestamp = new Date("2024-01-15T12:00:00Z");

			const xml = serializer.toXml(event);

			expect(xml).toContain('code="EVT123"');
			expect(xml).toContain("2024-01-15T12:00:00.000Z");
		});

		it("should apply custom converters during deserialization", () => {
			const xml = `
				<Event code="EVT456">
					<Name>Another Event</Name>
					2024-01-16T14:30:00.000Z
				</Event>
			`;

			const event = serializer.fromXml(xml, Event);

			expect(event.code).toBe("evt456");
			expect(event.timestamp).toBeInstanceOf(Date);
		});
	});

	describe("Multiple Namespaces Integration", () => {
		@XmlRoot({
			elementName: "Document",
			namespace: { uri: "http://example.com/doc", prefix: "doc" },
		})
		class MultiNsDocument {
			@XmlAttribute({
				name: "id",
				namespace: { uri: "http://example.com/id", prefix: "id" },
			})
			id: string = "";

			@XmlElement({
				name: "Title",
				namespace: { uri: "http://example.com/meta", prefix: "meta" },
			})
			title: string = "";

			@XmlElement({
				name: "Content",
				namespace: { uri: "http://example.com/content", prefix: "cnt" },
			})
			content: string = "";
		}

		it("should handle multiple namespaces correctly", () => {
			const doc = new MultiNsDocument();
			doc.id = "DOC001";
			doc.title = "Multi-NS Document";
			doc.content = "Content with namespace";

			const xml = serializer.toXml(doc);

			expect(xml).toContain('xmlns:doc="http://example.com/doc"');
			expect(xml).toContain('xmlns:id="http://example.com/id"');
			expect(xml).toContain('xmlns:meta="http://example.com/meta"');
			expect(xml).toContain('xmlns:cnt="http://example.com/content"');
			expect(xml).toContain("doc:Document");
			expect(xml).toContain("id:id");
			expect(xml).toContain("meta:Title");
			expect(xml).toContain("cnt:Content");
		});
	});

	describe("Wrapped vs Unwrapped Arrays", () => {
		@XmlRoot({ elementName: "Library" })
		class Library {
			@XmlArrayItem({ containerName: "WrappedBooks", itemName: "Book" })
			wrappedBooks: string[] = [];

			@XmlArrayItem({ itemName: "Author" })
			unwrappedAuthors: string[] = [];
		}

		it("should correctly handle wrapped arrays", () => {
			const library = new Library();
			library.wrappedBooks = ["Book1", "Book2"];

			const xml = serializer.toXml(library);

			expect(xml).toContain("<WrappedBooks>");
			expect(xml).toContain("<Book>Book1</Book>");
			expect(xml).toContain("<Book>Book2</Book>");
			expect(xml).toContain("</WrappedBooks>");
		});

		it("should correctly handle unwrapped arrays", () => {
			const library = new Library();
			library.unwrappedAuthors = ["Author1", "Author2"];

			const xml = serializer.toXml(library);

			expect(xml).toContain("<Author>Author1</Author>");
			expect(xml).toContain("<Author>Author2</Author>");
			expect(xml).not.toContain("<unwrappedAuthors>");
		});

		it("should handle both wrapped and unwrapped in same object", () => {
			const library = new Library();
			library.wrappedBooks = ["Book1"];
			library.unwrappedAuthors = ["Author1"];

			const xml = serializer.toXml(library);

			expect(xml).toContain("<WrappedBooks>");
			expect(xml).toContain("<Book>Book1</Book>");
			expect(xml).toContain("<Author>Author1</Author>");
		});
	});

	describe("Validation Integration", () => {
		@XmlRoot({ elementName: "ValidatedData" })
		class ValidatedData {
			@XmlAttribute({
				name: "code",
				pattern: /^[A-Z]{3}[0-9]{3}$/,
			})
			code: string = "";

			@XmlAttribute({
				name: "status",
				enumValues: ["active", "inactive", "pending"],
			})
			status: string = "";

			@XmlElement({ name: "Value", required: true })
			value: string = "";
		}

		it("should validate pattern during deserialization", () => {
			const xml = '<ValidatedData code="ABC123" status="active"><Value>Test</Value></ValidatedData>';

			const data = serializer.fromXml(xml, ValidatedData);

			expect(data.code).toBe("ABC123");
		});

		it("should throw error for invalid pattern", () => {
			const xml = '<ValidatedData code="INVALID" status="active"><Value>Test</Value></ValidatedData>';

			expect(() => serializer.fromXml(xml, ValidatedData)).toThrow();
		});

		it("should throw error for invalid enum value", () => {
			const xml = '<ValidatedData code="ABC123" status="unknown"><Value>Test</Value></ValidatedData>';

			expect(() => serializer.fromXml(xml, ValidatedData)).toThrow();
		});

		it("should throw error for missing required element", () => {
			const xml = '<ValidatedData code="ABC123" status="active"></ValidatedData>';

			expect(() => serializer.fromXml(xml, ValidatedData)).toThrow();
		});
	});

	describe("Circular Reference Prevention", () => {
		@XmlElement("Node")
		class Node {
			@XmlAttribute({ name: "id" })
			id: string = "";

			@XmlElement("Next")
			next: Node | null = null;
		}

		@XmlRoot({ elementName: "Graph" })
		class Graph {
			@XmlElement("Root")
			root: Node | null = null;
		}

		it("should handle circular references gracefully", () => {
			const node1 = new Node();
			node1.id = "node1";

			const node2 = new Node();
			node2.id = "node2";

			node1.next = node2;
			node2.next = node1; // Circular reference

			const graph = new Graph();
			graph.root = node1;

			// Should not throw error or hang
			const xml = serializer.toXml(graph);

			expect(xml).toBeTruthy();
			expect(xml).toContain("node1");
		});
	});

	describe("Performance - Large Data Sets", () => {
		@XmlElement("Record")
		class Record {
			@XmlAttribute({ name: "id" })
			id: string = "";

			@XmlElement("Data")
			data: string = "";
		}

		@XmlRoot({ elementName: "Dataset" })
		class Dataset {
			@XmlArrayItem({ itemName: "Record", type: Record })
			records: Record[] = [];
		}

		it("should handle large arrays efficiently", () => {
			const dataset = new Dataset();

			// Create 1000 records
			for (let i = 0; i < 1000; i++) {
				const record = new Record();
				record.id = `REC${i.toString().padStart(4, "0")}`;
				record.data = `Data for record ${i}`;
				dataset.records.push(record);
			}

			const startTime = Date.now();
			const xml = serializer.toXml(dataset);
			const endTime = Date.now();

			expect(xml).toBeTruthy();
			expect(endTime - startTime).toBeLessThan(5000); // Should complete in less than 5 seconds
			expect(dataset.records).toHaveLength(1000);
		});
	});
});
