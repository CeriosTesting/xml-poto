import { XmlElement, XmlRoot, XmlSerializer } from "../../src";

describe("Advanced Type Handling", () => {
	let serializer: XmlSerializer;

	beforeEach(() => {
		serializer = new XmlSerializer();
	});

	describe("xsi:nil Support", () => {
		@XmlRoot({ name: "Person" })
		class Person {
			@XmlElement({ name: "Name" })
			name: string = "";

			@XmlElement({ name: "MiddleName", isNullable: true })
			middleName: string | null = null;

			@XmlElement({ name: "Age", isNullable: true })
			age: number | null = null;
		}

		it("should serialize xsi:nil='true' for nullable fields with null values", () => {
			const person = new Person();
			person.name = "John Doe";
			person.middleName = null;
			person.age = null;

			const xml = serializer.toXml(person);

			expect(xml).toContain("<Name>John Doe</Name>");
			expect(xml).toContain('xsi:nil="true"');
			expect(xml).toContain("<MiddleName");
			expect(xml).toContain("<Age");
		});

		it("should automatically add xmlns:xsi namespace declaration", () => {
			const person = new Person();
			person.name = "Jane Smith";
			person.middleName = null;

			const xml = serializer.toXml(person);

			expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
		});

		it("should serialize normal values when nullable field has value", () => {
			const person = new Person();
			person.name = "Bob Johnson";
			person.middleName = "William";
			person.age = 45;

			const xml = serializer.toXml(person);

			expect(xml).toContain("<Name>Bob Johnson</Name>");
			expect(xml).toContain("<MiddleName>William</MiddleName>");
			expect(xml).toContain("<Age>45</Age>");
			expect(xml).not.toContain('xsi:nil="true"');
		});

		it("should not add xsi:nil when omitNullValues is true", () => {
			const serializerWithOmit = new XmlSerializer({ omitNullValues: true });

			const person = new Person();
			person.name = "Alice Brown";
			person.middleName = null;

			const xml = serializerWithOmit.toXml(person);

			expect(xml).toContain("<Name>Alice Brown</Name>");
			expect(xml).not.toContain("MiddleName");
			expect(xml).not.toContain("xsi:nil");
		});
	});

	describe("xsi:type for Polymorphism", () => {
		@XmlElement("Animal")
		class Animal {
			@XmlElement({ name: "Name" })
			name: string = "";
		}

		@XmlElement("Dog")
		class Dog extends Animal {
			@XmlElement({ name: "Breed" })
			breed: string = "";
		}

		@XmlElement("Cat")
		class Cat extends Animal {
			@XmlElement({ name: "Color" })
			color: string = "";
		}

		@XmlRoot({ name: "Zoo" })
		class Zoo {
			@XmlElement({ name: "MainAnimal", type: Animal })
			mainAnimal: Animal = new Animal();
		}

		it("should add xsi:type when runtime type differs from declared type", () => {
			const serializerWithXsiType = new XmlSerializer({ useXsiType: true });

			const zoo = new Zoo();
			const dog = new Dog();
			dog.name = "Buddy";
			dog.breed = "Golden Retriever";
			zoo.mainAnimal = dog;

			const xml = serializerWithXsiType.toXml(zoo);

			expect(xml).toContain('xsi:type="Dog"');
			expect(xml).toContain("<Name>Buddy</Name>");
			expect(xml).toContain("<Breed>Golden Retriever</Breed>");
		});

		it("should add xmlns:xsi when xsi:type is used", () => {
			const serializerWithXsiType = new XmlSerializer({ useXsiType: true });

			const zoo = new Zoo();
			zoo.mainAnimal = new Cat();

			const xml = serializerWithXsiType.toXml(zoo);

			expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
		});

		it("should not add xsi:type when runtime type matches declared type", () => {
			const serializerWithXsiType = new XmlSerializer({ useXsiType: true });

			const zoo = new Zoo();
			zoo.mainAnimal = new Animal();
			zoo.mainAnimal.name = "Generic Animal";

			const xml = serializerWithXsiType.toXml(zoo);

			expect(xml).not.toContain("xsi:type");
		});

		it("should not add xsi:type when useXsiType is false", () => {
			const zoo = new Zoo();
			const cat = new Cat();
			cat.name = "Whiskers";
			cat.color = "Orange";
			zoo.mainAnimal = cat;

			const xml = serializer.toXml(zoo);

			expect(xml).not.toContain("xsi:type");
		});
	});

	describe("Union Type Support", () => {
		@XmlRoot({ name: "Config" })
		class Config {
			@XmlElement({ name: "Port", unionTypes: [Number, String] })
			port: number | string = 8080;

			@XmlElement({ name: "Enabled", unionTypes: [Boolean, String] })
			enabled: boolean | string = true;

			@XmlElement({ name: "Timeout", unionTypes: [Number, String] })
			timeout: number | string = "30s";
		}

		it("should deserialize numeric string to number for union types", () => {
			const xml = `<?xml version="1.0"?>
<Config>
  <Port>3000</Port>
  <Enabled>true</Enabled>
  <Timeout>60</Timeout>
</Config>`;

			const config = serializer.fromXml(xml, Config);

			expect(config.port).toBe(3000);
			expect(typeof config.port).toBe("number");
			expect(config.enabled).toBe(true);
			expect(typeof config.enabled).toBe("boolean");
			expect(config.timeout).toBe(60);
			expect(typeof config.timeout).toBe("number");
		});

		it("should deserialize non-numeric string as string for union types", () => {
			const xml = `<?xml version="1.0"?>
<Config>
  <Port>auto</Port>
  <Enabled>disabled</Enabled>
  <Timeout>default</Timeout>
</Config>`;

			const config = serializer.fromXml(xml, Config);

			expect(config.port).toBe("auto");
			expect(typeof config.port).toBe("string");
			expect(config.timeout).toBe("default");
			expect(typeof config.timeout).toBe("string");
		});

		it("should handle boolean strings for union types", () => {
			const xml = `<?xml version="1.0"?>
<Config>
  <Port>8080</Port>
  <Enabled>false</Enabled>
  <Timeout>30</Timeout>
</Config>`;

			const config = serializer.fromXml(xml, Config);

			expect(config.enabled).toBe(false);
			expect(typeof config.enabled).toBe("boolean");
		});

		it("should serialize union types normally", () => {
			const config = new Config();
			config.port = "auto";
			config.enabled = false;
			config.timeout = 120;

			const xml = serializer.toXml(config);

			expect(xml).toContain("<Port>auto</Port>");
			expect(xml).toContain("<Enabled>false</Enabled>");
			expect(xml).toContain("<Timeout>120</Timeout>");
		});
	});

	describe("Combined Advanced Features", () => {
		@XmlElement("Product")
		class Product {
			@XmlElement({ name: "Name" })
			name: string = "";

			@XmlElement({ name: "Price", unionTypes: [Number, String] })
			price: number | string = 0;
		}

		@XmlElement("DigitalProduct")
		class DigitalProduct extends Product {
			@XmlElement({ name: "DownloadUrl" })
			downloadUrl: string = "";
		}

		@XmlRoot({ name: "Store" })
		class Store {
			@XmlElement({ name: "FeaturedProduct", type: Product, isNullable: true })
			featuredProduct: Product | null = null;

			@XmlElement({ name: "SpecialOffer", unionTypes: [Number, String], isNullable: true })
			specialOffer: number | string | null = null;
		}

		it("should handle xsi:nil with union types", () => {
			const store = new Store();
			store.featuredProduct = null;
			store.specialOffer = null;

			const xml = serializer.toXml(store);

			expect(xml).toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
			expect(xml).toContain('xsi:nil="true"');
		});

		it("should handle xsi:type with union types", () => {
			const serializerWithXsiType = new XmlSerializer({ useXsiType: true });

			const store = new Store();
			const digitalProduct = new DigitalProduct();
			digitalProduct.name = "E-Book";
			digitalProduct.price = "9.99";
			digitalProduct.downloadUrl = "https://example.com/ebook.pdf";
			store.featuredProduct = digitalProduct;
			store.specialOffer = 50;

			const xml = serializerWithXsiType.toXml(store);

			expect(xml).toContain('xsi:type="DigitalProduct"');
			expect(xml).toContain("<Name>E-Book</Name>");
			expect(xml).toContain("<Price>9.99</Price>");
			expect(xml).toContain("<DownloadUrl>https://example.com/ebook.pdf</DownloadUrl>");
			expect(xml).toContain("<SpecialOffer>50</SpecialOffer>");
		});

		it("should deserialize with union types and handle nulls", () => {
			const xml = `<?xml version="1.0"?>
<Store>
  <FeaturedProduct>
    <Name>Book</Name>
    <Price>19.99</Price>
  </FeaturedProduct>
  <SpecialOffer>15</SpecialOffer>
</Store>`;

			const store = serializer.fromXml(xml, Store);

			expect(store.featuredProduct).not.toBeNull();
			expect(store.featuredProduct?.name).toBe("Book");
			expect(store.specialOffer).toBe(15);
			expect(typeof store.specialOffer).toBe("number");
		});
	});

	describe("Edge Cases", () => {
		@XmlRoot({ name: "Data" })
		class Data {
			@XmlElement({ name: "Value", unionTypes: [Number, Boolean, String] })
			value: number | boolean | string = "";
		}

		it("should prioritize number conversion for numeric strings", () => {
			const xml = `<?xml version="1.0"?><Data><Value>123</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(123);
			expect(typeof data.value).toBe("number");
		});

		it("should handle zero as number", () => {
			const xml = `<?xml version="1.0"?><Data><Value>0</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(0);
			expect(typeof data.value).toBe("number");
		});

		it("should handle boolean true", () => {
			const xml = `<?xml version="1.0"?><Data><Value>true</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(true);
			expect(typeof data.value).toBe("boolean");
		});

		it("should handle boolean false", () => {
			const xml = `<?xml version="1.0"?><Data><Value>false</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(false);
			expect(typeof data.value).toBe("boolean");
		});

		it("should handle string '1' as number", () => {
			const xml = `<?xml version="1.0"?><Data><Value>1</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(1);
			expect(typeof data.value).toBe("number");
		});

		it("should handle decimal numbers", () => {
			const xml = `<?xml version="1.0"?><Data><Value>${Math.PI}</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(Math.PI);
			expect(typeof data.value).toBe("number");
		});

		it("should handle negative numbers", () => {
			const xml = `<?xml version="1.0"?><Data><Value>-42</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe(-42);
			expect(typeof data.value).toBe("number");
		});

		it("should fallback to string for non-convertible values", () => {
			const xml = `<?xml version="1.0"?><Data><Value>not-a-number</Value></Data>`;
			const data = serializer.fromXml(xml, Data);

			expect(data.value).toBe("not-a-number");
			expect(typeof data.value).toBe("string");
		});
	});
});
