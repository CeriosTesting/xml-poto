import { XmlAttribute, XmlElement, XmlRoot } from "../../src/decorators";
import { XmlDecoratorSerializer } from "../../src/xml-decorator-serializer";

describe("Reusing Decorated Objects", () => {
	@XmlElement({ name: "Address" })
	class Address {
		@XmlElement() street: string = "";
		@XmlElement() city: string = "";
		@XmlElement() zipCode: string = "";
	}

	@XmlRoot({ name: "Person" })
	class Person {
		@XmlAttribute() id: string = "";
		@XmlElement() name: string = "";
		@XmlElement() homeAddress?: Address;
		@XmlElement() workAddress?: Address;
		@XmlElement() billingAddress?: Address;
	}

	describe("Serialization", () => {
		it("should handle same object instance used multiple times correctly", () => {
			const serializer = new XmlDecoratorSerializer();

			// Create a single address instance
			const sharedAddress = new Address();
			sharedAddress.street = "123 Main St";
			sharedAddress.city = "Springfield";
			sharedAddress.zipCode = "12345";

			// Use the same address instance for multiple properties
			const person = new Person();
			person.id = "1";
			person.name = "John Doe";
			person.homeAddress = sharedAddress;
			person.workAddress = sharedAddress;
			person.billingAddress = sharedAddress;

			const xml = serializer.toXml(person);

			// All three addresses should be serialized with the same values
			expect(xml).toContain("<homeAddress>");
			expect(xml).toContain("<street>123 Main St</street>");

			// Count occurrences of the street value - should appear 3 times (once for each address)
			const streetMatches = xml.match(/<street>123 Main St<\/street>/g);
			expect(streetMatches).toHaveLength(3);

			// Count occurrences of city - should appear 3 times
			const cityMatches = xml.match(/<city>Springfield<\/city>/g);
			expect(cityMatches).toHaveLength(3);

			// Verify structure
			expect(xml).toMatch(
				/<homeAddress>\s*<street>123 Main St<\/street>\s*<city>Springfield<\/city>\s*<zipCode>12345<\/zipCode>\s*<\/homeAddress>/
			);
			expect(xml).toMatch(
				/<workAddress>\s*<street>123 Main St<\/street>\s*<city>Springfield<\/city>\s*<zipCode>12345<\/zipCode>\s*<\/workAddress>/
			);
			expect(xml).toMatch(
				/<billingAddress>\s*<street>123 Main St<\/street>\s*<city>Springfield<\/city>\s*<zipCode>12345<\/zipCode>\s*<\/billingAddress>/
			);
		});

		it("should handle same object instance in array correctly", () => {
			@XmlRoot({ name: "AddressBook" })
			class AddressBook {
				@XmlElement({ name: "Address" })
				addresses: Address[] = [];
			}

			const serializer = new XmlDecoratorSerializer();

			// Create a single address instance
			const sharedAddress = new Address();
			sharedAddress.street = "456 Oak Ave";
			sharedAddress.city = "Portland";
			sharedAddress.zipCode = "67890";

			// Use the same address instance multiple times in an array
			const addressBook = new AddressBook();
			addressBook.addresses = [sharedAddress, sharedAddress, sharedAddress];

			const xml = serializer.toXml(addressBook);

			// All three addresses should be serialized with the same values
			const streetMatches = xml.match(/<street>456 Oak Ave<\/street>/g);
			expect(streetMatches).toHaveLength(3);

			const cityMatches = xml.match(/<city>Portland<\/city>/g);
			expect(cityMatches).toHaveLength(3);
		});
	});

	describe("Deserialization", () => {
		it("should deserialize multiple instances of same element structure correctly", () => {
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Person id="1">
  <name>John Doe</name>
  <homeAddress>
    <street>123 Main St</street>
    <city>Springfield</city>
    <zipCode>12345</zipCode>
  </homeAddress>
  <workAddress>
    <street>456 Work Blvd</street>
    <city>Downtown</city>
    <zipCode>54321</zipCode>
  </workAddress>
  <billingAddress>
    <street>789 Bill St</street>
    <city>Uptown</city>
    <zipCode>99999</zipCode>
  </billingAddress>
</Person>`;

			const serializer = new XmlDecoratorSerializer();
			const person = serializer.fromXml(xml, Person);

			expect(person.id).toBe("1");
			expect(person.name).toBe("John Doe");

			// Verify each address is properly deserialized
			expect(person.homeAddress).toBeDefined();
			expect(person.homeAddress?.street).toBe("123 Main St");
			expect(person.homeAddress?.city).toBe("Springfield");
			expect(person.homeAddress?.zipCode).toBe(12345); // Parser converts numeric strings to numbers

			expect(person.workAddress).toBeDefined();
			expect(person.workAddress?.street).toBe("456 Work Blvd");
			expect(person.workAddress?.city).toBe("Downtown");
			expect(person.workAddress?.zipCode).toBe(54321); // Parser converts numeric strings to numbers

			expect(person.billingAddress).toBeDefined();
			expect(person.billingAddress?.street).toBe("789 Bill St");
			expect(person.billingAddress?.city).toBe("Uptown");
			expect(person.billingAddress?.zipCode).toBe(99999); // Parser converts numeric strings to numbers
		});
	});

	describe("Round-trip", () => {
		it("should preserve values when serializing and deserializing with shared instances", () => {
			const serializer = new XmlDecoratorSerializer();

			// Create a single address instance
			const sharedAddress = new Address();
			sharedAddress.street = "999 Shared Ln";
			sharedAddress.city = "Reuseville";
			sharedAddress.zipCode = "11111";

			// Use the same address instance for multiple properties
			const originalPerson = new Person();
			originalPerson.id = "2";
			originalPerson.name = "Jane Smith";
			originalPerson.homeAddress = sharedAddress;
			originalPerson.workAddress = sharedAddress;

			// Serialize
			const xml = serializer.toXml(originalPerson);

			// Deserialize
			const deserializedPerson = serializer.fromXml(xml, Person);

			// Verify all properties are correct
			expect(deserializedPerson.id).toBe("2");
			expect(deserializedPerson.name).toBe("Jane Smith");

			expect(deserializedPerson.homeAddress).toBeDefined();
			expect(deserializedPerson.homeAddress?.street).toBe("999 Shared Ln");
			expect(deserializedPerson.homeAddress?.city).toBe("Reuseville");
			expect(deserializedPerson.homeAddress?.zipCode).toBe(11111); // Parser converts numeric strings to numbers

			expect(deserializedPerson.workAddress).toBeDefined();
			expect(deserializedPerson.workAddress?.street).toBe("999 Shared Ln");
			expect(deserializedPerson.workAddress?.city).toBe("Reuseville");
			expect(deserializedPerson.workAddress?.zipCode).toBe(11111); // Parser converts numeric strings to numbers

			// Note: After deserialization, these will be separate instances
			// (not the same reference), but they should have the same values
			expect(deserializedPerson.homeAddress).not.toBe(deserializedPerson.workAddress);
		});
	});
});
