/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic class definitions */
import { beforeEach, describe, expect, it } from "vitest";

import { XmlDecoratorSerializer } from "../../src";
import { XmlArray } from "../../src/decorators/xml-array";
import { XmlAttribute } from "../../src/decorators/xml-attribute";
import { XmlElement } from "../../src/decorators/xml-element";
import { XmlRoot } from "../../src/decorators/xml-root";
import { XmlNamespaceUtil } from "../../src/utils/xml-namespace-util";

describe("form option — namespace qualification", () => {
	let serializer: XmlDecoratorSerializer;
	let util: XmlNamespaceUtil;

	beforeEach(() => {
		serializer = new XmlDecoratorSerializer();
		util = new XmlNamespaceUtil();
	});

	describe("XmlNamespaceUtil.buildElementName", () => {
		it("applies prefix when form is undefined (existing behaviour)", () => {
			const result = util.buildElementName({
				name: "Address",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
				required: false,
			});
			expect(result).toBe("ns:Address");
		});

		it("applies prefix when form is 'qualified'", () => {
			const result = util.buildElementName({
				name: "Address",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
				required: false,
				form: "qualified",
			});
			expect(result).toBe("ns:Address");
		});

		it("suppresses prefix when form is 'unqualified'", () => {
			const result = util.buildElementName({
				name: "Address",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
				required: false,
				form: "unqualified",
			});
			expect(result).toBe("Address");
		});

		it("caches qualified and unqualified results independently", () => {
			const base = { name: "Item", namespaces: [{ uri: "http://x.com", prefix: "x" }], required: false };
			const qualified = util.buildElementName({ ...base, form: "qualified" });
			const unqualified = util.buildElementName({ ...base, form: "unqualified" });
			expect(qualified).toBe("x:Item");
			expect(unqualified).toBe("Item");
		});
	});

	describe("XmlNamespaceUtil.buildAttributeName", () => {
		it("applies prefix when form is undefined (existing behaviour)", () => {
			const result = util.buildAttributeName({
				name: "id",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
			});
			expect(result).toBe("ns:id");
		});

		it("applies prefix when form is 'qualified'", () => {
			const result = util.buildAttributeName({
				name: "id",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
				form: "qualified",
			});
			expect(result).toBe("ns:id");
		});

		it("suppresses prefix when form is 'unqualified'", () => {
			const result = util.buildAttributeName({
				name: "id",
				namespaces: [{ uri: "http://example.com", prefix: "ns" }],
				form: "unqualified",
			});
			expect(result).toBe("id");
		});
	});

	describe("@XmlElement form integration", () => {
		it("serializes with prefix when form is 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({
					name: "city",
					namespace: { uri: "http://addr.com", prefix: "addr" },
					form: "qualified",
				})
				city!: string;
			}

			const obj = new Root();
			obj.city = "Amsterdam";

			const xml = serializer.toXml(obj);
			expect(xml).toContain("<addr:city>Amsterdam</addr:city>");
		});

		it("serializes without prefix when form is 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({
					name: "city",
					namespace: { uri: "http://addr.com", prefix: "addr" },
					form: "unqualified",
				})
				city!: string;
			}

			const obj = new Root();
			obj.city = "Amsterdam";

			const xml = serializer.toXml(obj);
			expect(xml).toContain("<city>Amsterdam</city>");
			expect(xml).not.toContain("addr:city");
		});

		it("round-trips with form 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({
					name: "city",
					namespace: { uri: "http://addr.com", prefix: "addr" },
					form: "qualified",
				})
				city!: string;
			}

			const obj = new Root();
			obj.city = "Utrecht";

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.city).toBe("Utrecht");
		});

		it("round-trips with form 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlElement({
					name: "city",
					namespace: { uri: "http://addr.com", prefix: "addr" },
					form: "unqualified",
				})
				city!: string;
			}

			const obj = new Root();
			obj.city = "Rotterdam";

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.city).toBe("Rotterdam");
		});
	});

	describe("@XmlAttribute form integration", () => {
		it("serializes attribute with prefix when form is 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlAttribute({
					name: "lang",
					namespace: { uri: "http://xml.org", prefix: "xml" },
					form: "qualified",
				})
				lang!: string;
			}

			const obj = new Root();
			obj.lang = "en";

			const xml = serializer.toXml(obj);
			expect(xml).toContain('xml:lang="en"');
		});

		it("serializes attribute without prefix when form is 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlAttribute({
					name: "lang",
					namespace: { uri: "http://xml.org", prefix: "xml" },
					form: "unqualified",
				})
				lang!: string;
			}

			const obj = new Root();
			obj.lang = "en";

			const xml = serializer.toXml(obj);
			expect(xml).toContain('lang="en"');
			expect(xml).not.toContain("xml:lang");
		});

		it("round-trips attribute with form 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlAttribute({
					name: "lang",
					namespace: { uri: "http://xml.org", prefix: "xml" },
					form: "qualified",
				})
				lang!: string;
			}

			const obj = new Root();
			obj.lang = "nl";

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.lang).toBe("nl");
		});

		it("round-trips attribute with form 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlAttribute({
					name: "lang",
					namespace: { uri: "http://xml.org", prefix: "xml" },
					form: "unqualified",
				})
				lang!: string;
			}

			const obj = new Root();
			obj.lang = "de";

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.lang).toBe("de");
		});
	});

	describe("@XmlArray form integration", () => {
		it("serializes container with prefix when form is 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlArray({
					containerName: "Books",
					itemName: "Book",
					namespace: { uri: "http://lib.com", prefix: "lib" },
					form: "qualified",
				})
				books: string[] = [];
			}

			const obj = new Root();
			obj.books = ["Dune", "Foundation"];

			const xml = serializer.toXml(obj);
			expect(xml).toContain("<lib:Books>");
			expect(xml).toContain("</lib:Books>");
		});

		it("serializes container without prefix when form is 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlArray({
					containerName: "Books",
					itemName: "Book",
					namespace: { uri: "http://lib.com", prefix: "lib" },
					form: "unqualified",
				})
				books: string[] = [];
			}

			const obj = new Root();
			obj.books = ["Dune"];

			const xml = serializer.toXml(obj);
			expect(xml).toContain("<Books>");
			expect(xml).not.toContain("lib:Books");
		});

		it("serializes container without prefix when form is undefined (existing behaviour)", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlArray({
					containerName: "Books",
					itemName: "Book",
					namespace: { uri: "http://lib.com", prefix: "lib" },
				})
				books: string[] = [];
			}

			const obj = new Root();
			obj.books = ["Dune"];

			const xml = serializer.toXml(obj);
			expect(xml).toContain("<Books>");
			expect(xml).not.toContain("lib:Books");
		});

		it("round-trips array with form 'qualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlArray({
					containerName: "Books",
					itemName: "Book",
					namespace: { uri: "http://lib.com", prefix: "lib" },
					form: "qualified",
				})
				books: string[] = [];
			}

			const obj = new Root();
			obj.books = ["Dune", "Foundation"];

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.books).toEqual(["Dune", "Foundation"]);
		});

		it("round-trips array with form 'unqualified'", () => {
			@XmlRoot({ name: "Root" })
			class Root {
				@XmlArray({
					containerName: "Books",
					itemName: "Book",
					namespace: { uri: "http://lib.com", prefix: "lib" },
					form: "unqualified",
				})
				books: string[] = [];
			}

			const obj = new Root();
			obj.books = ["Dune", "Foundation"];

			const xml = serializer.toXml(obj);
			const parsed = serializer.fromXml(xml, Root);
			expect(parsed.books).toEqual(["Dune", "Foundation"]);
		});
	});
});
