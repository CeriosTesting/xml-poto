import { describe, expect, it } from "vitest";

import { XmlArray, XmlElement, XmlRoot, XmlSerializer } from "../../src";

/**
 * Tests for the mixed content guard — verifying that mixed content arrays
 * bypass both the early-return array deserialization path and strict array validation.
 *
 * The bug: our array item deserialization intercepts ALL arrays and returns early,
 * bypassing deserializeMixedContent. The guard skips arrays with mixedContent: true.
 *
 * Covers:
 * - Mixed content arrays not intercepted by the array early-return path
 * - Mixed content arrays excluded from strict validation
 * - Non-mixed arrays still properly deserialized alongside mixed content
 * - Round-trip preservation of mixed content with strict mode
 */
describe("Mixed content guard", () => {
	describe("Mixed content arrays bypass array deserialization path", () => {
		it("should deserialize mixed content as text and element nodes, not typed array items", () => {
			@XmlRoot({ name: "Announcement" })
			class Announcement {
				@XmlElement({ name: "body", mixedContent: true })
				body: unknown[] = [];
			}

			const xml = `<Announcement>
				<body>Welcome to <em>version 3</em> of our platform!</body>
			</Announcement>`;

			const serializer = new XmlSerializer();
			const result = serializer.fromXml(xml, Announcement);

			expect(Array.isArray(result.body)).toBe(true);
			expect(result.body.length).toBeGreaterThan(0);
		});

		it("should preserve both text and element nodes in mixed content", () => {
			@XmlRoot({ name: "Note" })
			class Note {
				@XmlElement({ name: "message", mixedContent: true })
				message: unknown[] = [
					{ text: "Please review " },
					{ element: "strong", content: "section 4" },
					{ text: " before the meeting." },
				];
			}

			const serializer = new XmlSerializer();
			const original = new Note();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Note);

			expect(Array.isArray(deserialized.message)).toBe(true);
			expect(deserialized.message.length).toBeGreaterThan(0);

			const elementNodes = deserialized.message.filter(
				(n: unknown) => (n as Record<string, unknown>).element !== undefined,
			);
			expect(elementNodes.some((n: unknown) => (n as Record<string, unknown>).element === "strong")).toBe(true);
		});

		it("should not interfere with non-mixed arrays in the same class", () => {
			class Attachment {
				@XmlElement()
				filename: string = "";

				@XmlElement()
				size: number = 0;
			}

			@XmlRoot({ name: "Email" })
			class Email {
				@XmlElement({ name: "body", mixedContent: true })
				body: unknown[] = [];

				@XmlArray({ itemName: "Attachment", type: Attachment })
				attachments: Attachment[] = [];
			}

			const xml = `<Email>
				<body>See <em>attached</em> files.</body>
				<Attachment><filename>report.pdf</filename><size>1024</size></Attachment>
				<Attachment><filename>data.csv</filename><size>512</size></Attachment>
			</Email>`;

			const serializer = new XmlSerializer();
			const result = serializer.fromXml(xml, Email);

			// Mixed content should be deserialized as mixed nodes
			expect(Array.isArray(result.body)).toBe(true);

			// Typed array should be properly deserialized as instances
			expect(result.attachments).toHaveLength(2);
			result.attachments.forEach((a) => expect(a).toBeInstanceOf(Attachment));
			expect(result.attachments[0].filename).toBe("report.pdf");
			expect(result.attachments[0].size).toBe(1024);
			expect(result.attachments[1].filename).toBe("data.csv");
		});
	});

	describe("Mixed content excluded from strict validation", () => {
		it("should NOT throw strict validation error for mixed content arrays", () => {
			@XmlRoot({ name: "Warning" })
			class Warning {
				@XmlElement({ name: "text", mixedContent: true })
				text: unknown[] = [];
			}

			const xml = `<Warning>
				<text>This action is <strong>irreversible</strong>. Proceed with <em>caution</em>.</text>
			</Warning>`;

			const serializer = new XmlSerializer({ strictValidation: true });

			// Mixed content naturally contains plain objects — strict mode must not flag them
			expect(() => serializer.fromXml(xml, Warning)).not.toThrow();
		});

		it("should still validate non-mixed arrays in strict mode alongside mixed content", () => {
			@XmlRoot({ name: "Page" })
			class Page {
				@XmlElement({ name: "content", mixedContent: true })
				content: unknown[] = [];

				@XmlElement({ name: "Widget" })
				widgets!: unknown[];
			}

			const xml = `<Page>
				<content>Hello <b>world</b></content>
				<Widget><type>chart</type></Widget>
				<Widget><type>table</type></Widget>
			</Page>`;

			const serializer = new XmlSerializer({ strictValidation: true });

			// Mixed content should pass, but untyped Widget array should fail
			expect(() => serializer.fromXml(xml, Page)).toThrowError(/Strict Validation Error/);
		});
	});

	describe("Round-trip with strict mode", () => {
		it("should round-trip mixed content with attributes in strict mode", () => {
			@XmlRoot({ name: "Banner" })
			class Banner {
				@XmlElement({ name: "message", mixedContent: true })
				message: unknown[] = [
					{ text: "Click " },
					{ element: "a", content: "here", attributes: { href: "/signup" } },
					{ text: " to register." },
				];
			}

			const serializer = new XmlSerializer({ strictValidation: true });
			const original = new Banner();
			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Banner);

			expect(Array.isArray(deserialized.message)).toBe(true);
			expect(deserialized.message.length).toBeGreaterThan(0);

			const linkNode = deserialized.message.find((n: unknown) => (n as Record<string, unknown>).element === "a");
			expect(linkNode).toBeDefined();
		});

		it("should round-trip class with both mixed content and typed arrays in strict mode", () => {
			class Tag {
				@XmlElement()
				label: string = "";
			}

			@XmlRoot({ name: "Post" })
			class Post {
				@XmlElement({ name: "body", mixedContent: true })
				body: unknown[] = [{ text: "A " }, { element: "code", content: "snippet" }, { text: " example." }];

				@XmlArray({ itemName: "Tag", type: Tag })
				tags: Tag[] = [];
			}

			const serializer = new XmlSerializer({ strictValidation: true });

			const original = new Post();
			const t1 = new Tag();
			t1.label = "tutorial";
			const t2 = new Tag();
			t2.label = "xml";
			original.tags = [t1, t2];

			const xml = serializer.toXml(original);
			const deserialized = serializer.fromXml(xml, Post);

			// Mixed content preserved
			expect(Array.isArray(deserialized.body)).toBe(true);

			// Typed array preserved
			expect(deserialized.tags).toHaveLength(2);
			deserialized.tags.forEach((t) => expect(t).toBeInstanceOf(Tag));
			expect(deserialized.tags[0].label).toBe("tutorial");
			expect(deserialized.tags[1].label).toBe("xml");
		});
	});
});
