import { beforeEach, describe, expect, it } from "vitest";
import { XmlDecoratorSerializer } from "../../src";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";

describe("XML Namespace Integration Tests", () => {
	let serializer: XmlDecoratorSerializer;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
	});

	describe("Default namespace (xmlns)", () => {
		it("should serialize root element with default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "Test";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title>Test</title>");
		});

		it("should serialize empty element with default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title");
			expect(xml).toContain("</Document>");
		});

		it("should handle complex default namespace URIs", () => {
			@XmlRoot({
				name: "Root",
				namespace: { uri: "urn:example:schema:v1.0" },
			})
			class Root {
				@XmlElement()
				value!: string;
			}

			const root = new Root();
			root.value = "test";

			const xml = serializer.toXml(root);
			expect(xml).toContain('xmlns="urn:example:schema:v1.0"');
		});
	});

	describe("Prefixed namespace (xmlns:prefix)", () => {
		it("should serialize root element with prefixed namespace", () => {
			@XmlRoot({
				name: "Person",
				namespace: {
					uri: "http://example.com/person",
					prefix: "per",
				},
			})
			class Person {
				@XmlElement()
				name!: string;
			}

			const person = new Person();
			person.name = "John";

			const xml = serializer.toXml(person);
			expect(xml).toContain('xmlns:per="http://example.com/person"');
			expect(xml).toContain("<per:Person");
			expect(xml).toContain("</per:Person>");
		});

		it("should handle multiple different prefixed namespaces", () => {
			@XmlRoot({
				name: "Book",
				namespace: {
					uri: "http://example.com/books",
					prefix: "bk",
				},
			})
			class Book {
				@XmlElement()
				title!: string;
			}

			const book = new Book();
			book.title = "XML Guide";

			const xml = serializer.toXml(book);
			expect(xml).toContain('xmlns:bk="http://example.com/books"');
			expect(xml).toContain("<bk:Book");
			expect(xml).toContain("</bk:Book>");
		});
	});

	describe("No namespace", () => {
		it("should serialize root element without namespace", () => {
			@XmlRoot({ name: "Document" })
			class Document {
				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.title = "Test";

			const xml = serializer.toXml(doc);
			expect(xml).not.toContain("xmlns");
			expect(xml).toContain("<Document>");
			expect(xml).toContain("<title>Test</title>");
		});
	});

	describe("Nested elements with parent namespace", () => {
		it("should handle nested elements with parent namespace", () => {
			@XmlRoot({
				name: "Book",
				namespace: { uri: "http://example.com/books" },
			})
			class Book {
				@XmlElement()
				title!: string;

				@XmlElement()
				author!: string;
			}

			const book = new Book();
			book.title = "XML Guide";
			book.author = "John Doe";

			const xml = serializer.toXml(book);
			expect(xml).toContain('xmlns="http://example.com/books"');
			expect(xml).toContain("<Book");
			expect(xml).toContain("<title>XML Guide</title>");
			expect(xml).toContain("<author>John Doe</author>");
		});
	});

	describe("@XmlElement with default namespace (no prefix)", () => {
		it("should serialize element with default namespace without prefix", () => {
			@XmlRoot({
				name: "Document",
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/content" },
				})
				content!: string;
			}

			const doc = new Document();
			doc.content = "Test content";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/content"');
			expect(xml).toContain("<content>Test content</content>");
		});

		it("should use last default namespace when multiple elements have different default namespaces", () => {
			// Note: In XML, only one default namespace can be declared at root level.
			// When multiple child elements have different default namespaces, the last one wins.
			@XmlRoot({
				name: "Root",
			})
			class Root {
				@XmlElement({
					namespace: { uri: "http://example.com/ns1" },
				})
				element1!: string;

				@XmlElement({
					namespace: { uri: "http://example.com/ns2" },
				})
				element2!: string;
			}

			const root = new Root();
			root.element1 = "Value 1";
			root.element2 = "Value 2";

			const xml = serializer.toXml(root);
			// Only the last default namespace declaration is kept
			expect(xml).toContain('xmlns="http://example.com/ns2"');
			expect(xml).toContain("<element1>Value 1</element1>");
			expect(xml).toContain("<element2>Value 2</element2>");
		});

		it("should use element default namespace when it differs from root", () => {
			// When root has a default namespace and child element has a different one,
			// the child's namespace declaration overrides the root's
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/content" },
				})
				content!: string;

				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.content = "Test content";
			doc.title = "Test title";

			const xml = serializer.toXml(doc);
			// The element's default namespace overrides the root's
			expect(xml).toContain('xmlns="http://example.com/content"');
			expect(xml).toContain("<content>Test content</content>");
			expect(xml).toContain("<title>Test title</title>");
		});

		it("should use prefixed namespaces to distinguish different namespaces on sibling elements", () => {
			// Proper way to handle multiple namespaces: use prefixes
			@XmlRoot({
				name: "Root",
			})
			class Root {
				@XmlElement({
					namespace: { uri: "http://example.com/ns1", prefix: "ns1" },
				})
				element1!: string;

				@XmlElement({
					namespace: { uri: "http://example.com/ns2", prefix: "ns2" },
				})
				element2!: string;
			}

			const root = new Root();
			root.element1 = "Value 1";
			root.element2 = "Value 2";

			const xml = serializer.toXml(root);
			expect(xml).toContain('xmlns:ns1="http://example.com/ns1"');
			expect(xml).toContain('xmlns:ns2="http://example.com/ns2"');
			expect(xml).toContain("<ns1:element1>Value 1</ns1:element1>");
			expect(xml).toContain("<ns2:element2>Value 2</ns2:element2>");
		});
	});

	describe("Combining default namespaces in @XmlRoot and @XmlElement", () => {
		it("should handle root with default namespace and element without namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement()
				title!: string;

				@XmlElement()
				content!: string;
			}

			const doc = new Document();
			doc.title = "Test Title";
			doc.content = "Test Content";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title>Test Title</title>");
			expect(xml).toContain("<content>Test Content</content>");
		});

		it("should handle root with default namespace and element with same default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/doc" },
				})
				title!: string;

				@XmlElement()
				content!: string;
			}

			const doc = new Document();
			doc.title = "Test Title";
			doc.content = "Test Content";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain("<Document");
			expect(xml).toContain("<title>Test Title</title>");
			expect(xml).toContain("<content>Test Content</content>");
		});

		it("should handle root with default namespace and element with different default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/special" },
				})
				special!: string;

				@XmlElement()
				normal!: string;
			}

			const doc = new Document();
			doc.special = "Special Value";
			doc.normal = "Normal Value";

			const xml = serializer.toXml(doc);
			// Element's default namespace overrides root's
			expect(xml).toContain('xmlns="http://example.com/special"');
			expect(xml).toContain("<special>Special Value</special>");
			expect(xml).toContain("<normal>Normal Value</normal>");
		});

		it("should handle root with default namespace and element with prefixed namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/special", prefix: "sp" },
				})
				special!: string;

				@XmlElement()
				normal!: string;
			}

			const doc = new Document();
			doc.special = "Special Value";
			doc.normal = "Normal Value";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/doc"');
			expect(xml).toContain('xmlns:sp="http://example.com/special"');
			expect(xml).toContain("<sp:special>Special Value</sp:special>");
			expect(xml).toContain("<normal>Normal Value</normal>");
		});

		it("should handle root with prefixed namespace and element with default namespace", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc", prefix: "doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/content" },
				})
				content!: string;

				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.content = "Test Content";
			doc.title = "Test Title";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns:doc="http://example.com/doc"');
			expect(xml).toContain('xmlns="http://example.com/content"');
			expect(xml).toContain("<doc:Document");
			expect(xml).toContain("<content>Test Content</content>");
			expect(xml).toContain("<title>Test Title</title>");
		});

		it("should handle root with prefixed namespace and elements with different prefixed namespaces", () => {
			@XmlRoot({
				name: "Document",
				namespace: { uri: "http://example.com/doc", prefix: "doc" },
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/meta", prefix: "meta" },
				})
				metadata!: string;

				@XmlElement({
					namespace: { uri: "http://example.com/content", prefix: "cnt" },
				})
				content!: string;

				@XmlElement()
				title!: string;
			}

			const doc = new Document();
			doc.metadata = "Metadata Value";
			doc.content = "Content Value";
			doc.title = "Title Value";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns:doc="http://example.com/doc"');
			expect(xml).toContain('xmlns:meta="http://example.com/meta"');
			expect(xml).toContain('xmlns:cnt="http://example.com/content"');
			expect(xml).toContain("<doc:Document");
			expect(xml).toContain("<meta:metadata>Metadata Value</meta:metadata>");
			expect(xml).toContain("<cnt:content>Content Value</cnt:content>");
			expect(xml).toContain("<title>Title Value</title>");
		});

		it("should handle root without namespace and elements with mixed namespaces", () => {
			@XmlRoot({
				name: "Document",
			})
			class Document {
				@XmlElement({
					namespace: { uri: "http://example.com/ns1" },
				})
				element1!: string;

				@XmlElement({
					namespace: { uri: "http://example.com/ns2", prefix: "ns2" },
				})
				element2!: string;

				@XmlElement()
				element3!: string;
			}

			const doc = new Document();
			doc.element1 = "Value 1";
			doc.element2 = "Value 2";
			doc.element3 = "Value 3";

			const xml = serializer.toXml(doc);
			expect(xml).toContain('xmlns="http://example.com/ns1"');
			expect(xml).toContain('xmlns:ns2="http://example.com/ns2"');
			expect(xml).toContain("<element1>Value 1</element1>");
			expect(xml).toContain("<ns2:element2>Value 2</ns2:element2>");
			expect(xml).toContain("<element3>Value 3</element3>");
		});
	});

	describe("Edge cases", () => {
		it("should handle namespace with special characters in URI", () => {
			@XmlRoot({
				name: "Data",
				namespace: { uri: "http://example.com/data?version=1&type=xml" },
			})
			class Data {
				@XmlElement()
				value!: string;
			}

			const data = new Data();
			data.value = "test";

			const xml = serializer.toXml(data);
			expect(xml).toContain('xmlns="http://example.com/data?version=1&amp;type=xml"');
		});

		it("should not add namespace declaration when namespace is empty object", () => {
			@XmlRoot({
				name: "Root",
				namespace: {} as any,
			})
			class Root {
				@XmlElement()
				value!: string;
			}

			const root = new Root();
			root.value = "test";

			const xml = serializer.toXml(root);
			expect(xml).not.toContain("xmlns");
		});
	});

	describe("Multi-namespace support", () => {
		describe("Root element with multiple namespaces", () => {
			it("should declare multiple namespaces on root element", () => {
				@XmlRoot({
					name: "Document",
					namespace: { uri: "http://example.com/doc", prefix: "doc" },
					namespaces: [
						{ uri: "http://example.com/meta", prefix: "meta" },
						{ uri: "http://example.com/data", prefix: "data" },
					],
				})
				class Document {
					@XmlElement()
					title!: string;
				}

				const doc = new Document();
				doc.title = "Test";

				const xml = serializer.toXml(doc);
				expect(xml).toContain('xmlns:doc="http://example.com/doc"');
				expect(xml).toContain('xmlns:meta="http://example.com/meta"');
				expect(xml).toContain('xmlns:data="http://example.com/data"');
				expect(xml).toContain("<doc:Document");
			});

			it("should support primary default namespace with additional prefixed namespaces", () => {
				@XmlRoot({
					name: "Root",
					namespace: { uri: "http://example.com/default" },
					namespaces: [
						{ uri: "http://example.com/custom1", prefix: "c1" },
						{ uri: "http://example.com/custom2", prefix: "c2" },
					],
				})
				class Root {
					@XmlElement()
					value!: string;
				}

				const root = new Root();
				root.value = "test";

				const xml = serializer.toXml(root);
				expect(xml).toContain('xmlns="http://example.com/default"');
				expect(xml).toContain('xmlns:c1="http://example.com/custom1"');
				expect(xml).toContain('xmlns:c2="http://example.com/custom2"');
			});

			it("should support only additional namespaces without primary namespace", () => {
				@XmlRoot({
					name: "Container",
					namespaces: [
						{ uri: "http://example.com/ns1", prefix: "ns1" },
						{ uri: "http://example.com/ns2", prefix: "ns2" },
						{ uri: "http://example.com/ns3", prefix: "ns3" },
					],
				})
				class Container {
					@XmlElement()
					item!: string;
				}

				const container = new Container();
				container.item = "data";

				const xml = serializer.toXml(container);
				expect(xml).toContain('xmlns:ns1="http://example.com/ns1"');
				expect(xml).toContain('xmlns:ns2="http://example.com/ns2"');
				expect(xml).toContain('xmlns:ns3="http://example.com/ns3"');
			});
		});

		describe("Nested elements with additional namespaces", () => {
			it("should collect and declare namespaces from nested XmlElement class at root", () => {
				@XmlElement({
					name: "Address",
					namespace: { uri: "http://example.com/address", prefix: "addr" },
					namespaces: [{ uri: "http://example.com/geo", prefix: "geo" }],
				})
				class Address {
					@XmlElement()
					street!: string;

					@XmlElement()
					city!: string;
				}

				@XmlRoot({
					name: "Person",
					namespace: { uri: "http://example.com/person", prefix: "p" },
				})
				class Person {
					@XmlElement()
					name!: string;

					@XmlElement()
					address!: Address;
				}

				const person = new Person();
				person.name = "John";
				person.address = new Address();
				person.address.street = "123 Main St";
				person.address.city = "Springfield";

				const xml = serializer.toXml(person);
				// Namespaces declared at element where first used
				expect(xml).toContain('xmlns:p="http://example.com/person"'); // On root
				expect(xml).toContain('xmlns:addr="http://example.com/address"'); // On Address element
				expect(xml).toContain('xmlns:geo="http://example.com/geo"'); // On Address element
				// Nested element should use its namespace prefix
				expect(xml).toContain("<addr:Address");
				// Verify namespaces are on Address, not root
				expect(xml).toContain(
					'<addr:Address xmlns:addr="http://example.com/address" xmlns:geo="http://example.com/geo">'
				);
			});

			it("should support field-level element with additional namespaces", () => {
				@XmlRoot({
					name: "Document",
				})
				class Document {
					@XmlElement({
						name: "metadata",
						namespace: { uri: "http://example.com/meta", prefix: "m" },
						namespaces: [
							{ uri: "http://example.com/author", prefix: "auth" },
							{ uri: "http://example.com/date", prefix: "dt" },
						],
					})
					metadata!: string;
				}

				const doc = new Document();
				doc.metadata = "test";

				const xml = serializer.toXml(doc);
				expect(xml).toContain('xmlns:m="http://example.com/meta"');
				expect(xml).toContain('xmlns:auth="http://example.com/author"');
				expect(xml).toContain('xmlns:dt="http://example.com/date"');
			});
		});

		describe("Namespace usage in child elements", () => {
			it("should allow child elements to use namespace prefix declared by parent", () => {
				@XmlRoot({
					name: "Report",
					namespace: { uri: "http://example.com/report", prefix: "rpt" },
					namespaces: [
						{ uri: "http://example.com/data", prefix: "data" },
						{ uri: "http://example.com/meta", prefix: "meta" },
					],
				})
				class Report {
					@XmlElement({
						name: "title",
						namespace: { uri: "http://example.com/meta", prefix: "meta" },
					})
					title!: string;

					@XmlElement({
						name: "value",
						namespace: { uri: "http://example.com/data", prefix: "data" },
					})
					value!: string;
				}

				const report = new Report();
				report.title = "Q4 Report";
				report.value = "12345";

				const xml = serializer.toXml(report);
				expect(xml).toContain('xmlns:rpt="http://example.com/report"');
				expect(xml).toContain('xmlns:data="http://example.com/data"');
				expect(xml).toContain('xmlns:meta="http://example.com/meta"');
				expect(xml).toContain("<rpt:Report");
				expect(xml).toContain("<meta:title>Q4 Report</meta:title>");
				expect(xml).toContain("<data:value>12345</data:value>");
			});
		});

		describe("XBRL-style scenarios", () => {
			it("should support parent declaring multiple child namespaces (XBRL pattern)", () => {
				@XmlRoot({
					name: "xbrl",
					namespace: { uri: "http://www.xbrl.org/2003/instance", prefix: "xbrli" },
					namespaces: [
						{ uri: "http://xbrl.us/us-gaap/2023", prefix: "us-gaap" },
						{ uri: "http://example.com/custom/2023", prefix: "custom" },
						{ uri: "http://www.xbrl.org/2003/iso4217", prefix: "iso4217" },
						{ uri: "http://www.w3.org/2001/XMLSchema-instance", prefix: "xsi" },
					],
				})
				class XbrlDocument {
					@XmlElement({
						name: "Assets",
						namespace: { uri: "http://xbrl.us/us-gaap/2023", prefix: "us-gaap" },
					})
					assets!: string;

					@XmlElement({
						name: "CustomMetric",
						namespace: { uri: "http://example.com/custom/2023", prefix: "custom" },
					})
					customMetric!: string;
				}

				const xbrl = new XbrlDocument();
				xbrl.assets = "1000000";
				xbrl.customMetric = "500";

				const xml = serializer.toXml(xbrl);
				expect(xml).toContain('xmlns:xbrli="http://www.xbrl.org/2003/instance"');
				expect(xml).toContain('xmlns:us-gaap="http://xbrl.us/us-gaap/2023"');
				expect(xml).toContain('xmlns:custom="http://example.com/custom/2023"');
				expect(xml).toContain('xmlns:iso4217="http://www.xbrl.org/2003/iso4217"');
				expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
				expect(xml).toContain("<us-gaap:Assets>1000000</us-gaap:Assets>");
				expect(xml).toContain("<custom:CustomMetric>500</custom:CustomMetric>");
			});
		});

		describe("Backward compatibility", () => {
			it("should work with existing single namespace property", () => {
				@XmlRoot({
					name: "Document",
					namespace: { uri: "http://example.com/doc", prefix: "doc" },
				})
				class Document {
					@XmlElement()
					title!: string;
				}

				const doc = new Document();
				doc.title = "Test";

				const xml = serializer.toXml(doc);
				expect(xml).toContain('xmlns:doc="http://example.com/doc"');
				expect(xml).toContain("<doc:Document");
			});

			it("should combine namespace and namespaces properties", () => {
				@XmlRoot({
					name: "Root",
					namespace: { uri: "http://example.com/primary", prefix: "p" },
					namespaces: [{ uri: "http://example.com/secondary", prefix: "s" }],
				})
				class Root {
					@XmlElement()
					value!: string;
				}

				const root = new Root();
				root.value = "test";

				const xml = serializer.toXml(root);
				expect(xml).toContain('xmlns:p="http://example.com/primary"');
				expect(xml).toContain('xmlns:s="http://example.com/secondary"');
			});
		});

		describe("Attributes with additional namespaces", () => {
			it("should declare additional namespaces from attributes", () => {
				@XmlRoot({
					name: "Element",
				})
				class Element {
					@XmlElement({
						namespaces: [{ uri: "http://example.com/attr-ns", prefix: "ans" }],
					})
					value!: string;
				}

				const elem = new Element();
				elem.value = "test";

				const xml = serializer.toXml(elem);
				expect(xml).toContain('xmlns:ans="http://example.com/attr-ns"');
			});
		});

		describe("Array with additional namespaces", () => {
			it("should declare additional namespaces on array containers", () => {
				@XmlRoot({
					name: "Library",
				})
				class Library {
					@XmlElement({
						namespaces: [{ uri: "http://example.com/book", prefix: "book" }],
					})
					books!: string[];
				}

				const library = new Library();
				library.books = ["Book1", "Book2"];

				const xml = serializer.toXml(library);
				expect(xml).toContain('xmlns:book="http://example.com/book"');
			});
		});

		describe("Deduplication", () => {
			it("should deduplicate same namespace declared multiple times", () => {
				@XmlRoot({
					name: "Root",
					namespace: { uri: "http://example.com/ns", prefix: "ns" },
					namespaces: [
						{ uri: "http://example.com/ns", prefix: "ns" }, // duplicate
						{ uri: "http://example.com/other", prefix: "other" },
					],
				})
				class Root {
					@XmlElement()
					value!: string;
				}

				const root = new Root();
				root.value = "test";

				const xml = serializer.toXml(root);
				// Should only appear once
				const matches = xml.match(/xmlns:ns="http:\/\/example\.com\/ns"/g);
				expect(matches).toHaveLength(1);
			});
		});
	});
});
