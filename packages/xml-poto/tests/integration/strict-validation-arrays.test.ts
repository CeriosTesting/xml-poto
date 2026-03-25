import { describe, expect, it } from "vitest";

import { XmlArray, XmlAttribute, XmlElement, XmlRoot, XmlSerializer, XmlText } from "../../src";

/**
 * Tests for strict validation of arrays — verifying that strict mode properly
 * enforces @XmlArray usage for list properties and rejects @XmlElement for arrays.
 *
 * Covers:
 * - @XmlArray typed arrays that pass strict validation
 * - @XmlElement receiving repeated elements (should throw in strict mode)
 * - Primitive arrays that pass (no type needed)
 * - Error message content verification
 */
describe("Strict validation for arrays", () => {
	describe("Arrays that should pass strict validation", () => {
		it("should pass when @XmlArray has type and items are properly instantiated", () => {
			class Sensor {
				@XmlElement()
				id: string = "";

				@XmlElement()
				reading: number = 0;
			}

			@XmlRoot({ name: "Dashboard" })
			class Dashboard {
				@XmlArray({ itemName: "Sensor", type: Sensor })
				sensors: Sensor[] = [];
			}

			const xml = `<Dashboard>
				<Sensor><id>temp-01</id><reading>22</reading></Sensor>
				<Sensor><id>temp-02</id><reading>25</reading></Sensor>
			</Dashboard>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			const result = serializer.fromXml(xml, Dashboard);

			expect(result.sensors).toHaveLength(2);
			result.sensors.forEach((s) => expect(s).toBeInstanceOf(Sensor));
		});

		it("should pass for arrays of primitive values", () => {
			@XmlRoot({ name: "Config" })
			class Config {
				@XmlArray({ itemName: "port" })
				ports: number[] = [];
			}

			const xml = `<Config>
				<port>8080</port>
				<port>8443</port>
				<port>9090</port>
			</Config>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			const result = serializer.fromXml(xml, Config);

			expect(result.ports).toEqual([8080, 8443, 9090]);
		});

		it("should pass for arrays with @XmlAttribute + @XmlText typed items", () => {
			class Currency {
				@XmlAttribute({ name: "code" })
				code: string = "";

				@XmlText()
				amount: string = "";
			}

			@XmlRoot({ name: "Invoice" })
			class Invoice {
				@XmlArray({ containerName: "LineItems", itemName: "Price", type: Currency })
				prices: Currency[] = [];
			}

			const xml = `<Invoice>
				<LineItems>
					<Price code="USD">49.99</Price>
					<Price code="EUR">42.50</Price>
				</LineItems>
			</Invoice>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			const result = serializer.fromXml(xml, Invoice);

			expect(result.prices).toHaveLength(2);
			result.prices.forEach((p) => expect(p).toBeInstanceOf(Currency));
			expect(result.prices[0].code).toBe("USD");
			expect(result.prices[0].amount).toBe("49.99");
		});

		it("should pass for @XmlArray without type (untyped array metadata present)", () => {
			@XmlRoot({ name: "List" })
			class List {
				@XmlArray({ itemName: "Item" })
				items: unknown[] = [];
			}

			const xml = `<List>
				<Item><label>Alpha</label></Item>
				<Item><label>Beta</label></Item>
			</List>`;

			const serializer = new XmlSerializer({ strictValidation: true });

			// Should pass — @XmlArray is used even though items are plain objects
			const result = serializer.fromXml(xml, List);
			expect(result.items).toHaveLength(2);
		});
	});

	describe("@XmlElement should fail strict validation when it receives arrays", () => {
		it("should throw when @XmlElement receives repeated elements producing an array", () => {
			@XmlRoot({ name: "Playlist" })
			class Playlist {
				@XmlElement({ name: "Track" })
				tracks!: unknown[];
			}

			const xml = `<Playlist>
				<Track><title>Song A</title><artist>Band X</artist></Track>
				<Track><title>Song B</title><artist>Band Y</artist></Track>
			</Playlist>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			expect(() => serializer.fromXml(xml, Playlist)).toThrowError(/Strict Validation Error/);
		});

		it("should throw even when @XmlElement has a type specified", () => {
			class Vehicle {
				@XmlElement()
				make: string = "";
			}

			@XmlRoot({ name: "Garage" })
			class Garage {
				@XmlElement({ name: "Vehicle", type: Vehicle })
				vehicles!: unknown[];
			}

			const xml = `<Garage>
				<Vehicle><make>Toyota</make></Vehicle>
				<Vehicle><make>Honda</make></Vehicle>
			</Garage>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			expect(() => serializer.fromXml(xml, Garage)).toThrowError(/Strict Validation Error/);
		});

		it("should include property name in the error message", () => {
			@XmlRoot({ name: "Garage" })
			class Garage {
				@XmlElement({ name: "Vehicle" })
				vehicles!: unknown[];
			}

			const xml = `<Garage>
				<Vehicle><make>Toyota</make></Vehicle>
				<Vehicle><make>Honda</make></Vehicle>
			</Garage>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			expect(() => serializer.fromXml(xml, Garage)).toThrowError(/vehicles/);
		});

		it("should include XML element name in the error message", () => {
			@XmlRoot({ name: "Catalog" })
			class Catalog {
				@XmlElement({ name: "ProductItem" })
				products!: unknown[];
			}

			const xml = `<Catalog>
				<ProductItem><sku>ABC</sku></ProductItem>
				<ProductItem><sku>DEF</sku></ProductItem>
			</Catalog>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			expect(() => serializer.fromXml(xml, Catalog)).toThrowError(/ProductItem/);
		});

		it("should suggest @XmlArray fix in the error message", () => {
			@XmlRoot({ name: "Store" })
			class Store {
				@XmlElement({ name: "Item" })
				items!: unknown[];
			}

			const xml = `<Store>
				<Item><name>Widget</name></Item>
				<Item><name>Gadget</name></Item>
			</Store>`;

			const serializer = new XmlSerializer({ strictValidation: true });
			expect(() => serializer.fromXml(xml, Store)).toThrowError(/@XmlArray/);
		});
	});

	describe("Strict validation should NOT trigger without strictValidation flag", () => {
		it("should allow @XmlElement array items in default mode (no validation)", () => {
			@XmlRoot({ name: "Basket" })
			class Basket {
				@XmlElement({ name: "Fruit" })
				fruits!: unknown[];
			}

			const xml = `<Basket>
				<Fruit><name>Apple</name><color>Red</color></Fruit>
				<Fruit><name>Banana</name><color>Yellow</color></Fruit>
			</Basket>`;

			const serializer = new XmlSerializer();
			const result = serializer.fromXml(xml, Basket);

			expect(Array.isArray(result.fruits)).toBe(true);
			expect(result.fruits).toHaveLength(2);
		});
	});
});
