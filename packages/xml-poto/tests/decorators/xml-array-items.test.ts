/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Test file with dynamic mock data */
import { describe, expect, it } from "vitest";

import { XmlArray, XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlType } from "../../src";

@XmlType({ name: "NoteType" })
class Note {
	@XmlElement({ name: "body" })
	body: string = "";
}

@XmlType({ name: "TaskType" })
class Task {
	@XmlElement({ name: "title" })
	title: string = "";

	@XmlAttribute({ name: "done", dataType: "xs:boolean" })
	done: boolean = false;
}

@XmlRoot({ name: "journal" })
class Journal {
	@XmlArray({
		items: [
			{ name: "note", type: Note },
			{ name: "task", type: Task },
		],
	})
	entries: (Note | Task)[] = [];
}

describe("@XmlArray({ items })", () => {
	const serializer = new XmlSerializer();

	// The point of the feature: a repeating xs:choice interleaves differently named
	// elements, and grouping them by name would silently reorder the document.
	const INTERLEAVED = `<journal>
	<note><body>first</body></note>
	<task done="true"><title>ship it</title></task>
	<note><body>second</body></note>
</journal>`;

	it("reads interleaved elements into one array, in document order", () => {
		const journal = serializer.fromXml(INTERLEAVED, Journal);

		expect(journal.entries).toHaveLength(3);
		expect(journal.entries[0]).toBeInstanceOf(Note);
		expect(journal.entries[1]).toBeInstanceOf(Task);
		expect(journal.entries[2]).toBeInstanceOf(Note);
		expect((journal.entries[0] as Note).body).toBe("first");
		expect((journal.entries[1] as Task).title).toBe("ship it");
		expect((journal.entries[1] as Task).done).toBe(true);
		expect((journal.entries[2] as Note).body).toBe("second");
	});

	it("writes them back in the same order", () => {
		const xml = serializer.toXml(serializer.fromXml(INTERLEAVED, Journal));

		// The regression this feature exists to prevent: note, note, task.
		const order = [...xml.matchAll(/<(note|task)[\s>]/g)].map((m) => m[1]);
		expect(order).toEqual(["note", "task", "note"]);
	});

	it("round-trips the values, not just the shape", () => {
		const once = serializer.toXml(serializer.fromXml(INTERLEAVED, Journal));
		const twice = serializer.toXml(serializer.fromXml(once, Journal));

		expect(twice).toBe(once);
	});

	it("handles a single occurrence of one alternative", () => {
		const journal = serializer.fromXml("<journal><task><title>only</title></task></journal>", Journal);

		expect(journal.entries).toHaveLength(1);
		expect(journal.entries[0]).toBeInstanceOf(Task);
	});

	it("leaves the array empty when no alternative is present", () => {
		expect(serializer.fromXml("<journal/>", Journal).entries).toEqual([]);
	});

	it("writes an element name chosen by the value's own type", () => {
		const journal = new Journal();
		const task = new Task();
		task.title = "written";
		const note = new Note();
		note.body = "also written";
		journal.entries = [task, note];

		const xml = serializer.toXml(journal);

		expect([...xml.matchAll(/<(note|task)[\s>]/g)].map((m) => m[1])).toEqual(["task", "note"]);
		expect(xml).toContain("<title>written</title>");
		expect(xml).toContain("<body>also written</body>");
	});

	it("supports scalar alternatives declared with dataType", () => {
		@XmlRoot({ name: "log" })
		class Log {
			@XmlArray({
				items: [{ name: "count", dataType: "xs:int" }, { name: "label" }],
			})
			values: (number | string)[] = [];
		}

		const log = serializer.fromXml("<log><count>3</count><label>x</label><count>4</count></log>", Log);

		expect(log.values).toEqual([3, "x", 4]);
	});

	describe("configuration errors", () => {
		it("rejects items combined with itemName", () => {
			expect(() => {
				@XmlRoot({ name: "bad" })
				class Bad {
					@XmlArray({ itemName: "a", items: [{ name: "a" }] })
					values: string[] = [];
				}
				serializer.toXml(new Bad());
			}).toThrow(/cannot be combined with 'itemName'/);
		});

		it("rejects an empty items list", () => {
			expect(() => {
				@XmlRoot({ name: "bad" })
				class Bad {
					@XmlArray({ items: [] })
					values: string[] = [];
				}
				serializer.toXml(new Bad());
			}).toThrow(/must list at least one element/);
		});
	});
});
