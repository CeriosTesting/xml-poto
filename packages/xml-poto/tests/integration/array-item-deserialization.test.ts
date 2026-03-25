import { describe, expect, it } from "vitest";

import { XmlArray, XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";

/**
 * Tests for array item deserialization — verifying that repeated XML elements
 * are properly deserialized through mapToObject when @XmlArray specifies a type.
 *
 * Covers:
 * - @XmlArray with itemName and type (unwrapped / wrapped)
 * - Nested typed objects inside array items (e.g., @XmlAttribute + @XmlText classes)
 * - Primitive array items (no type needed)
 * - Single @XmlElement that should NOT become an array
 */
describe("Array item deserialization", () => {
	describe("@XmlArray with repeated XML elements", () => {
		it("should deserialize repeated elements into typed array items", () => {
			class Ingredient {
				@XmlElement()
				name: string = "";

				@XmlElement()
				amount: string = "";
			}

			@XmlRoot({ name: "Recipe" })
			class Recipe {
				@XmlElement({ name: "title" })
				title: string = "";

				@XmlArray({ itemName: "Ingredient", type: Ingredient })
				ingredients: Ingredient[] = [];
			}

			const xml = `<Recipe>
				<title>Pancakes</title>
				<Ingredient><name>Flour</name><amount>200g</amount></Ingredient>
				<Ingredient><name>Milk</name><amount>300ml</amount></Ingredient>
				<Ingredient><name>Eggs</name><amount>2</amount></Ingredient>
			</Recipe>`;

			const result = new XmlSerializer().fromXml(xml, Recipe);

			expect(result.title).toBe("Pancakes");
			expect(Array.isArray(result.ingredients)).toBe(true);
			expect(result.ingredients).toHaveLength(3);

			expect(result.ingredients[0]).toBeInstanceOf(Ingredient);
			expect(result.ingredients[0].name).toBe("Flour");
			expect(result.ingredients[0].amount).toBe("200g");

			expect(result.ingredients[1].name).toBe("Milk");
			expect(result.ingredients[1].amount).toBe("300ml");

			expect(result.ingredients[2].name).toBe("Eggs");
			expect(result.ingredients[2].amount).toBe("2");
		});

		it("should deserialize repeated elements with nested @XmlAttribute + @XmlText types", () => {
			class Rating {
				@XmlAttribute({ name: "scale" })
				scale: string = "";

				@XmlText()
				value: string = "";
			}

			class Review {
				@XmlElement()
				author: string = "";

				@XmlElement({ name: "score", type: Rating })
				score!: Rating;
			}

			@XmlRoot({ name: "Product" })
			class Product {
				@XmlElement()
				name: string = "";

				@XmlArray({ itemName: "Review", type: Review })
				reviews: Review[] = [];
			}

			const xml = `<Product>
				<name>Widget Pro</name>
				<Review>
					<author>Alice</author>
					<score scale="5-star">4</score>
				</Review>
				<Review>
					<author>Bob</author>
					<score scale="5-star">5</score>
				</Review>
				<Review>
					<author>Carol</author>
					<score scale="10-point">8</score>
				</Review>
			</Product>`;

			const result = new XmlSerializer().fromXml(xml, Product);

			expect(result.name).toBe("Widget Pro");
			expect(result.reviews).toHaveLength(3);

			// Verify each review is properly typed
			result.reviews.forEach((r) => expect(r).toBeInstanceOf(Review));

			// Verify nested @XmlAttribute + @XmlText are mapped to property names
			expect(result.reviews[0].author).toBe("Alice");
			expect(result.reviews[0].score).toBeInstanceOf(Rating);
			expect(result.reviews[0].score.scale).toBe("5-star");
			expect(result.reviews[0].score.value).toBe("4");

			expect(result.reviews[2].author).toBe("Carol");
			expect(result.reviews[2].score.scale).toBe("10-point");
			expect(result.reviews[2].score.value).toBe("8");

			// Verify JSON.stringify produces property names, not parser keys
			const json = JSON.parse(JSON.stringify(result.reviews[1].score));
			expect(json).toHaveProperty("scale", "5-star");
			expect(json).toHaveProperty("value", "5");
			expect(json).not.toHaveProperty("@_scale");
			expect(json).not.toHaveProperty("#text");
		});

		it("should handle @XmlArray with a single item", () => {
			class Tag {
				@XmlElement()
				label: string = "";
			}

			@XmlRoot({ name: "Article" })
			class Article {
				@XmlArray({ itemName: "Tag", type: Tag })
				tags: Tag[] = [];
			}

			const xml = `<Article><Tag><label>typescript</label></Tag></Article>`;
			const result = new XmlSerializer().fromXml(xml, Article);

			expect(result.tags).toHaveLength(1);
			expect(result.tags[0]).toBeInstanceOf(Tag);
			expect(result.tags[0].label).toBe("typescript");
		});
	});

	describe("@XmlElement should not be used for arrays", () => {
		it("should leave repeated @XmlElement items as plain objects without type instantiation", () => {
			class Item {
				@XmlElement()
				name: string = "";
			}

			@XmlRoot({ name: "Box" })
			class Box {
				@XmlElement({ name: "Item", type: Item })
				items!: unknown;
			}

			const xml = `<Box>
				<Item><name>Pen</name></Item>
				<Item><name>Paper</name></Item>
			</Box>`;

			// Without strict validation, the array is returned but items are NOT deserialized as typed instances
			const result = new XmlSerializer().fromXml(xml, Box);
			const items = result.items as unknown[];
			expect(Array.isArray(items)).toBe(true);
			expect(items).toHaveLength(2);
			// Items should be plain objects, not Item instances (since @XmlArray was not used)
			expect(items[0]).not.toBeInstanceOf(Item);
		});
	});

	describe("Primitive arrays", () => {
		it("should handle repeated string elements without type", () => {
			@XmlRoot({ name: "Tags" })
			class TagList {
				@XmlArray({ itemName: "tag" })
				tags: string[] = [];
			}

			const xml = `<Tags>
				<tag>xml</tag>
				<tag>typescript</tag>
				<tag>serialization</tag>
			</Tags>`;

			const result = new XmlSerializer().fromXml(xml, TagList);

			expect(result.tags).toHaveLength(3);
			expect(result.tags).toEqual(["xml", "typescript", "serialization"]);
		});
	});

	describe("Deeply nested typed arrays", () => {
		it("should deserialize arrays of typed items with multiple nested levels", () => {
			class Coordinate {
				@XmlAttribute({ name: "system" })
				system: string = "";

				@XmlText()
				value: string = "";
			}

			class Waypoint {
				@XmlElement()
				label: string = "";

				@XmlElement({ name: "position", type: Coordinate })
				position!: Coordinate;
			}

			class Segment {
				@XmlElement()
				name: string = "";

				@XmlArray({ itemName: "Waypoint", type: Waypoint })
				waypoints: Waypoint[] = [];
			}

			@XmlRoot({ name: "Route" })
			class Route {
				@XmlArray({ itemName: "Segment", type: Segment })
				segments: Segment[] = [];
			}

			const xml = `<Route>
				<Segment>
					<name>Coast Road</name>
					<Waypoint>
						<label>Start</label>
						<position system="GPS">51.5074,-0.1278</position>
					</Waypoint>
					<Waypoint>
						<label>Checkpoint</label>
						<position system="GPS">51.4545,-0.9781</position>
					</Waypoint>
				</Segment>
				<Segment>
					<name>Mountain Pass</name>
					<Waypoint>
						<label>Summit</label>
						<position system="UTM">32T-654321-5678901</position>
					</Waypoint>
				</Segment>
			</Route>`;

			const result = new XmlSerializer().fromXml(xml, Route);

			expect(result.segments).toHaveLength(2);
			result.segments.forEach((s) => expect(s).toBeInstanceOf(Segment));

			// First segment
			expect(result.segments[0].name).toBe("Coast Road");
			expect(result.segments[0].waypoints).toHaveLength(2);
			expect(result.segments[0].waypoints[0]).toBeInstanceOf(Waypoint);
			expect(result.segments[0].waypoints[0].label).toBe("Start");
			expect(result.segments[0].waypoints[0].position).toBeInstanceOf(Coordinate);
			expect(result.segments[0].waypoints[0].position.system).toBe("GPS");
			expect(result.segments[0].waypoints[0].position.value).toBe("51.5074,-0.1278");

			// Second segment
			expect(result.segments[1].name).toBe("Mountain Pass");
			expect(result.segments[1].waypoints).toHaveLength(1);
			expect(result.segments[1].waypoints[0].position.system).toBe("UTM");
			expect(result.segments[1].waypoints[0].position.value).toBe("32T-654321-5678901");
		});
	});
});
