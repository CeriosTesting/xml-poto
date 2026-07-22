/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { XmlArray, XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";

/**
 * A mixed complex type interleaves text with its declared child elements, which
 * the parser reports as a `#mixed` run. Before this was bound to anything, that
 * run reached neither the typed members (they read back empty) nor the output as
 * anything legal — it was written out as a `<#mixed>` element, which is not a
 * well-formed name.
 */
describe("mixed complex types", () => {
	const serializer = new XmlSerializer({ format: false });

	describe("with an @XmlText({ mixed: true }) member", () => {
		@XmlRoot({ name: "Config" })
		class Config {
			@XmlText({ mixed: true })
			text: string[] = [];

			@XmlElement({ name: "Setting" })
			setting: string = "";
		}

		const XML = "<Config>lead <Setting>a</Setting> tail</Config>";

		it("reads the typed member and the text runs", () => {
			const config = serializer.fromXml(XML, Config);

			expect(config.setting).toBe("a");
			expect(config.text).toEqual(["lead ", " tail"]);
		});

		it("writes the text back among the elements", () => {
			expect(serializer.toXml(serializer.fromXml(XML, Config))).toContain(
				"<Config>lead <Setting>a</Setting> tail</Config>",
			);
		});

		it("round-trips unchanged", () => {
			const once = serializer.toXml(serializer.fromXml(XML, Config));
			expect(serializer.toXml(serializer.fromXml(once, Config))).toBe(once);
		});

		it("handles text only before the first element", () => {
			const config = serializer.fromXml("<Config>lead <Setting>a</Setting></Config>", Config);

			expect(config.text).toEqual(["lead "]);
			expect(serializer.toXml(config)).toContain("<Config>lead <Setting>a</Setting></Config>");
		});

		it("keeps attributes on interleaved children", () => {
			@XmlRoot({ name: "Doc" })
			class Doc {
				@XmlText({ mixed: true })
				text: string[] = [];

				@XmlElement({ name: "ref", type: Ref })
				ref!: Ref;
			}

			const doc = serializer.fromXml('<Doc>see <ref id="7">here</ref> now</Doc>', Doc);

			expect(doc.ref.id).toBe("7");
			expect(doc.ref.label).toBe("here");
			expect(doc.text).toEqual(["see ", " now"]);
		});
	});

	describe("without a mixed member", () => {
		@XmlRoot({ name: "Plain" })
		class Plain {
			@XmlElement({ name: "Setting" })
			setting: string = "";
		}

		it("still reads the typed member — the children are no longer buried", () => {
			expect(serializer.fromXml("<Plain>lead <Setting>a</Setting> tail</Plain>", Plain).setting).toBe("a");
		});

		it("emits well-formed XML, never a <#mixed> element", () => {
			const xml = serializer.toXml(serializer.fromXml("<Plain>lead <Setting>a</Setting> tail</Plain>", Plain));

			expect(xml).not.toContain("#mixed");
			expect(xml).toContain("<Setting>a</Setting>");
		});
	});

	describe("repeated children", () => {
		@XmlRoot({ name: "List" })
		class Doc {
			@XmlText({ mixed: true })
			text: string[] = [];

			@XmlArray({ itemName: "item" })
			items: string[] = [];
		}

		it("keeps every occurrence", () => {
			const doc = serializer.fromXml("<List>a <item>1</item> b <item>2</item> c</List>", Doc);

			expect(doc.items).toEqual([1, 2]);
			expect(doc.text).toEqual(["a ", " b ", " c"]);
		});
	});
});

@XmlElement({ name: "ref" })
class Ref {
	@XmlAttribute({ name: "id" })
	id: string = "";

	@XmlText()
	label: string = "";
}
