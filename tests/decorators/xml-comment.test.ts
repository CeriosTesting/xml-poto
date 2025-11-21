import { XmlComment, XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("@XmlComment Decorator", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("Basic Comment Support", () => {
		@XmlRoot({ elementName: "Document" })
		class DocumentWithComment {
			@XmlComment()
			comment: string = "";

			@XmlElement({ name: "Title" })
			title: string = "";
		}

		it("should serialize a simple comment", () => {
			const doc = new DocumentWithComment();
			doc.comment = "This is a document comment";
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--This is a document comment-->");
			expect(xml).toContain("<Title>My Document</Title>");
		});

		it("should handle empty comment", () => {
			const doc = new DocumentWithComment();
			doc.comment = "";
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<Title>My Document</Title>");
		});

		it("should handle undefined comment", () => {
			const doc = new DocumentWithComment();
			doc.title = "My Document";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<Title>My Document</Title>");
			expect(xml).not.toContain("<!--");
		});
	});

	describe("Required Comments", () => {
		@XmlRoot({ elementName: "Report" })
		class ReportWithRequiredComment {
			@XmlComment({ required: true })
			comment: string = "";

			@XmlElement({ name: "Data" })
			data: string = "";
		}

		it("should throw error when required comment is missing", () => {
			const report = new ReportWithRequiredComment();
			report.data = "Some data";

			expect(() => serializer.toXml(report)).toThrow("Required comment is missing");
		});

		it("should serialize when required comment is provided", () => {
			const report = new ReportWithRequiredComment();
			report.comment = "Monthly report";
			report.data = "Some data";

			const xml = serializer.toXml(report);

			expect(xml).toContain("<!--Monthly report-->");
			expect(xml).toContain("<Data>Some data</Data>");
		});
	});

	describe("Special Characters in Comments", () => {
		@XmlRoot({ elementName: "SpecialDoc" })
		class DocWithSpecialComment {
			@XmlComment()
			comment: string = "";

			@XmlElement({ name: "Content" })
			content: string = "";
		}

		it("should handle comments with special characters", () => {
			const doc = new DocWithSpecialComment();
			doc.comment = "TODO: Fix the <bug> in version 2.0 & update docs";
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--TODO: Fix the <bug> in version 2.0 & update docs-->");
		});

		it("should handle multi-line comments", () => {
			const doc = new DocWithSpecialComment();
			doc.comment = "Line 1\nLine 2\nLine 3";
			doc.content = "Test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--Line 1\nLine 2\nLine 3-->");
		});
	});

	describe("Comments with Various Element Types", () => {
		@XmlRoot({ elementName: "Config" })
		class ConfigWithComment {
			@XmlComment()
			comment: string = "";

			@XmlElement({ name: "Setting" })
			setting: string = "";

			@XmlElement({ name: "Value" })
			value: number = 0;

			@XmlElement({ name: "Enabled" })
			enabled: boolean = false;
		}

		it("should serialize comment with multiple elements", () => {
			const config = new ConfigWithComment();
			config.comment = "Configuration for production environment";
			config.setting = "timeout";
			config.value = 30;
			config.enabled = true;

			const xml = serializer.toXml(config);

			expect(xml).toContain("<!--Configuration for production environment-->");
			expect(xml).toContain("<Setting>timeout</Setting>");
			expect(xml).toContain("<Value>30</Value>");
			expect(xml).toContain("<Enabled>true</Enabled>");
		});
	});

	describe("Comment Use Cases", () => {
		@XmlRoot({ elementName: "Code" })
		class CodeSnippet {
			@XmlComment()
			description: string = "";

			@XmlElement({ name: "Language" })
			language: string = "";

			@XmlElement({ name: "Snippet" })
			snippet: string = "";
		}

		it("should add documentation comments", () => {
			const code = new CodeSnippet();
			code.description = "Example of a hello world program";
			code.language = "TypeScript";
			code.snippet = 'console.log("Hello World");';

			const xml = serializer.toXml(code);

			expect(xml).toContain("<!--Example of a hello world program-->");
			expect(xml).toContain("<Language>TypeScript</Language>");
		});

		@XmlRoot({ elementName: "Task" })
		class TaskWithComment {
			@XmlComment()
			note: string = "";

			@XmlElement({ name: "Name" })
			name: string = "";

			@XmlElement({ name: "Status" })
			status: string = "";
		}

		it("should add metadata comments", () => {
			const task = new TaskWithComment();
			task.note = "Created by automation script v1.2";
			task.name = "Deploy to production";
			task.status = "pending";

			const xml = serializer.toXml(task);

			expect(xml).toContain("<!--Created by automation script v1.2-->");
			expect(xml).toContain("<Name>Deploy to production</Name>");
		});
	});

	describe("Edge Cases", () => {
		@XmlRoot({ elementName: "Test" })
		class TestDoc {
			@XmlComment()
			comment: string = "";

			@XmlElement({ name: "Data" })
			data: string = "";
		}

		it("should handle null comment", () => {
			const doc = new TestDoc();
			doc.comment = null as any;
			doc.data = "test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<Data>test</Data>");
			expect(xml).not.toContain("<!--null-->");
		});

		it("should convert non-string values to strings", () => {
			const doc = new TestDoc();
			doc.comment = 12345 as any;
			doc.data = "test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--12345-->");
		});

		it("should handle comments with whitespace", () => {
			const doc = new TestDoc();
			doc.comment = "   Comment with spaces   ";
			doc.data = "test";

			const xml = serializer.toXml(doc);

			expect(xml).toContain("<!--   Comment with spaces   -->");
		});
	});
});
