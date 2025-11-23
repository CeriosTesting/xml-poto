# Nested Objects

Learn how to work with nested object structures and complex hierarchies in XML.

## Table of Contents

- [Overview](#overview)
- [Basic Nesting](#basic-nesting)
- [Multiple Levels of Nesting](#multiple-levels-of-nesting)
- [Nested Objects with Arrays](#nested-objects-with-arrays)
- [Optional Nested Objects](#optional-nested-objects)
- [Circular References](#circular-references)
- [Nested Objects with Namespaces](#nested-objects-with-namespaces)
- [Best Practices](#best-practices)

## Overview

Nested objects allow you to represent complex hierarchical structures in XML. Each nested object is decorated with `@XmlElement` and its own class definition.

**Example Structure:**
```xml
<Company>
    <Name>TechCorp</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>Springfield</City>
        <Country>USA</Country>
    </Address>
</Company>
```

[↑ Back to top](#table-of-contents)

## Basic Nesting

### Simple Nested Object

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

// Define the nested class first
@XmlElement({ elementName: 'Address' })
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';

    @XmlElement({ name: 'Country' })
    country: string = '';
}

// Use it in the parent class
@XmlRoot({ elementName: 'Company' })
class Company {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Address', type: Address })
    address: Address = new Address();
}

// Usage
const company = new Company();
company.name = 'TechCorp';
company.address.street = '123 Main St';
company.address.city = 'Springfield';
company.address.country = 'USA';

const serializer = new XmlSerializer();
const xml = serializer.toXml(company);
```

**Output:**
```xml
<Company>
    <Name>TechCorp</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>Springfield</City>
        <Country>USA</Country>
    </Address>
</Company>
```

### Deserialization

```typescript
const xml = `
<Company>
    <Name>TechCorp</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>Springfield</City>
        <Country>USA</Country>
    </Address>
</Company>`;

const company = serializer.fromXml(xml, Company);

console.log(company.name);              // "TechCorp"
console.log(company.address.street);    // "123 Main St"
console.log(company.address.city);      // "Springfield"
console.log(company.address.country);   // "USA"
```

[↑ Back to top](#table-of-contents)

## Multiple Levels of Nesting

You can nest objects as deeply as needed:

### Three-Level Hierarchy

```typescript
@XmlElement({ elementName: 'Country' })
class Country {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Code' })
    code: string = '';
}

@XmlElement({ elementName: 'Address' })
class Address {
    @XmlElement({ name: 'Street' })
    street: string = '';

    @XmlElement({ name: 'City' })
    city: string = '';

    @XmlElement({ name: 'Country', type: Country })
    country: Country = new Country();
}

@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Address', type: Address })
    address: Address = new Address();
}

const person = new Person();
person.name = 'John Doe';
person.address.street = '456 Oak Ave';
person.address.city = 'Portland';
person.address.country.name = 'United States';
person.address.country.code = 'US';

const xml = serializer.toXml(person);
```

**Output:**
```xml
<Person>
    <Name>John Doe</Name>
    <Address>
        <Street>456 Oak Ave</Street>
        <City>Portland</City>
        <Country>
            <Name>United States</Name>
            <Code>US</Code>
        </Country>
    </Address>
</Person>
```

### Deep Nesting Example

```typescript
@XmlElement({ elementName: 'Specification' })
class Specification {
    @XmlElement({ name: 'CPU' })
    cpu: string = '';

    @XmlElement({ name: 'RAM' })
    ram: string = '';
}

@XmlElement({ elementName: 'Hardware' })
class Hardware {
    @XmlElement({ name: 'Model' })
    model: string = '';

    @XmlElement({ name: 'Spec', type: Specification })
    spec: Specification = new Specification();
}

@XmlElement({ elementName: 'Computer' })
class Computer {
    @XmlElement({ name: 'Brand' })
    brand: string = '';

    @XmlElement({ name: 'Hardware', type: Hardware })
    hardware: Hardware = new Hardware();
}

@XmlRoot({ elementName: 'Inventory' })
class Inventory {
    @XmlElement({ name: 'Computer', type: Computer })
    computer: Computer = new Computer();
}

const inventory = new Inventory();
inventory.computer.brand = 'Dell';
inventory.computer.hardware.model = 'XPS 15';
inventory.computer.hardware.spec.cpu = 'Intel i7';
inventory.computer.hardware.spec.ram = '16GB';
```

**Output:**
```xml
<Inventory>
    <Computer>
        <Brand>Dell</Brand>
        <Hardware>
            <Model>XPS 15</Model>
            <Spec>
                <CPU>Intel i7</CPU>
                <RAM>16GB</RAM>
            </Spec>
        </Hardware>
    </Computer>
</Inventory>
```

[↑ Back to top](#table-of-contents)

## Nested Objects with Arrays

Combine nested objects with arrays for complex structures:

### Array of Nested Objects

```typescript
@XmlElement({ elementName: 'PhoneNumber' })
class PhoneNumber {
    @XmlAttribute({ name: 'type' })
    type: string = '';

    @XmlText()
    number: string = '';
}

@XmlElement({ elementName: 'Contact' })
class Contact {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlArrayItem({ containerName: 'PhoneNumbers', itemName: 'Phone', type: PhoneNumber })
    phones: PhoneNumber[] = [];
}

@XmlRoot({ elementName: 'AddressBook' })
class AddressBook {
    @XmlArrayItem({ itemName: 'Contact', type: Contact })
    contacts: Contact[] = [];
}

const addressBook = new AddressBook();

const contact1 = new Contact();
contact1.name = 'Alice';

const phone1 = new PhoneNumber();
phone1.type = 'mobile';
phone1.number = '555-1234';

const phone2 = new PhoneNumber();
phone2.type = 'home';
phone2.number = '555-5678';

contact1.phones = [phone1, phone2];
addressBook.contacts = [contact1];

const xml = serializer.toXml(addressBook);
```

**Output:**
```xml
<AddressBook>
    <Contact>
        <Name>Alice</Name>
        <PhoneNumbers>
            <Phone type="mobile">555-1234</Phone>
            <Phone type="home">555-5678</Phone>
        </PhoneNumbers>
    </Contact>
</AddressBook>
```

### Nested Arrays Example

```typescript
@XmlElement({ elementName: 'Item' })
class Item {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Price' })
    price: number = 0;
}

@XmlElement({ elementName: 'Category' })
class Category {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlArrayItem({ itemName: 'Item', type: Item })
    items: Item[] = [];
}

@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlArrayItem({ itemName: 'Category', type: Category })
    categories: Category[] = [];
}

const catalog = new Catalog();

const electronics = new Category();
electronics.name = 'Electronics';

const laptop = new Item();
laptop.name = 'Laptop';
laptop.price = 999;

const phone = new Item();
phone.name = 'Phone';
phone.price = 599;

electronics.items = [laptop, phone];
catalog.categories = [electronics];
```

**Output:**
```xml
<Catalog>
    <Category>
        <Name>Electronics</Name>
        <Item>
            <Name>Laptop</Name>
            <Price>999</Price>
        </Item>
        <Item>
            <Name>Phone</Name>
            <Price>599</Price>
        </Item>
    </Category>
</Catalog>
```

[↑ Back to top](#table-of-contents)

## Optional Nested Objects

Handle optional nested objects that may not always be present:

### Using Optional Properties

```typescript
@XmlElement({ elementName: 'Metadata' })
class Metadata {
    @XmlElement({ name: 'CreatedDate' })
    createdDate: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';
}

@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Metadata', type: Metadata })
    metadata?: Metadata;  // Optional
}

// With metadata
const doc1 = new Document();
doc1.title = 'Report';
doc1.metadata = new Metadata();
doc1.metadata.author = 'John Doe';
doc1.metadata.createdDate = '2024-01-01';

// Without metadata
const doc2 = new Document();
doc2.title = 'Quick Note';
// metadata is undefined
```

### Omitting Null Values

```typescript
const doc = new Document();
doc.title = 'Test';
doc.metadata = undefined;

const xml = serializer.toXml(doc, { omitNullValues: true });
```

**Output (without metadata):**
```xml
<Document>
    <Title>Test</Title>
</Document>
```

[↑ Back to top](#table-of-contents)

## Circular References

⚠️ **Warning:** Circular references are not supported and will cause infinite recursion.

### What NOT to Do

```typescript
// ❌ BAD - Circular reference
@XmlElement({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Friend', type: Person })
    friend?: Person;  // Circular reference!
}

const person1 = new Person();
person1.name = 'Alice';

const person2 = new Person();
person2.name = 'Bob';

person1.friend = person2;
person2.friend = person1;  // ❌ Circular!

// This will cause stack overflow
// const xml = serializer.toXml(person1);
```

### Alternative Approach

Use identifiers to reference related objects:

```typescript
// ✅ GOOD - Use IDs instead
@XmlElement({ elementName: 'Person' })
class Person {
    @XmlElement({ name: 'Id' })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'FriendId' })
    friendId?: string;  // Reference by ID
}

@XmlRoot({ elementName: 'People' })
class People {
    @XmlArrayItem({ itemName: 'Person', type: Person })
    persons: Person[] = [];
}
```

**Output:**
```xml
<People>
    <Person>
        <Id>1</Id>
        <Name>Alice</Name>
        <FriendId>2</FriendId>
    </Person>
    <Person>
        <Id>2</Id>
        <Name>Bob</Name>
        <FriendId>1</FriendId>
    </Person>
</People>
```

[↑ Back to top](#table-of-contents)

## Nested Objects with Namespaces

Apply namespaces to nested objects:

```typescript
const companyNs = { uri: 'http://example.com/company', prefix: 'co' };
const addressNs = { uri: 'http://example.com/address', prefix: 'addr' };

@XmlElement({ elementName: 'Address', namespace: addressNs })
class Address {
    @XmlElement({ name: 'Street', namespace: addressNs })
    street: string = '';

    @XmlElement({ name: 'City', namespace: addressNs })
    city: string = '';
}

@XmlRoot({ elementName: 'Company', namespace: companyNs })
class Company {
    @XmlElement({ name: 'Name', namespace: companyNs })
    name: string = '';

    @XmlElement({ name: 'Address', type: Address, namespace: addressNs })
    address: Address = new Address();
}

const company = new Company();
company.name = 'TechCorp';
company.address.street = '123 Main St';
company.address.city = 'Springfield';
```

**Output:**
```xml
<co:Company xmlns:co="http://example.com/company" xmlns:addr="http://example.com/address">
    <co:Name>TechCorp</co:Name>
    <addr:Address>
        <addr:Street>123 Main St</addr:Street>
        <addr:City>Springfield</addr:City>
    </addr:Address>
</co:Company>
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Always Specify Type for Nested Objects

```typescript
// ✅ Good - type specified
@XmlElement({ name: 'Address', type: Address })
address: Address = new Address();

// ❌ Bad - will not deserialize correctly
@XmlElement({ name: 'Address' })
address: Address = new Address();
```

### 2. Initialize Nested Objects

```typescript
// ✅ Good - initialized
@XmlElement({ name: 'Address', type: Address })
address: Address = new Address();

// ⚠️ Acceptable for optional objects
@XmlElement({ name: 'Address', type: Address })
address?: Address;
```

### 3. Use Meaningful Class Names

```typescript
// ✅ Good - clear, descriptive
class ShippingAddress { }
class BillingAddress { }

// ❌ Bad - unclear
class Addr1 { }
class Addr2 { }
```

### 4. Keep Nesting Reasonable

```typescript
// ✅ Good - 3-4 levels max
Person -> Address -> Country

// ❌ Bad - too deep
A -> B -> C -> D -> E -> F -> G
```

### 5. Document Complex Structures

```typescript
/**
 * Represents a product in the catalog.
 * Contains pricing, specifications, and availability information.
 */
@XmlElement({ elementName: 'Product' })
class Product {
    /**
     * Product pricing information including base price, discounts, and tax.
     */
    @XmlElement({ name: 'Pricing', type: Pricing })
    pricing: Pricing = new Pricing();
}
```

### 6. Test Roundtrip Serialization

```typescript
describe('Nested Object Serialization', () => {
    it('should handle nested objects roundtrip', () => {
        const original = new Company();
        original.name = 'TechCorp';
        original.address.street = '123 Main St';
        original.address.city = 'Springfield';

        const xml = serializer.toXml(original);
        const restored = serializer.fromXml(xml, Company);

        expect(restored.name).toBe(original.name);
        expect(restored.address.street).toBe(original.address.street);
        expect(restored.address.city).toBe(original.address.city);
    });
});
```

### 7. Handle Optional Nested Objects Carefully

```typescript
@XmlRoot({ elementName: 'Order' })
class Order {
    @XmlElement({ name: 'Id' })
    id: string = '';

    @XmlElement({ name: 'ShippingAddress', type: Address })
    shippingAddress?: Address;

    getShippingCity(): string {
        return this.shippingAddress?.city ?? 'Unknown';
    }
}
```

### 8. Avoid Circular References

```typescript
// ✅ Good - use references by ID
@XmlElement({ name: 'ParentId' })
parentId?: string;

// ❌ Bad - direct circular reference
@XmlElement({ name: 'Parent', type: Node })
parent?: Node;
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Arrays](arrays.md) - Working with collections
- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Namespaces](namespaces.md) - XML namespace support
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Arrays](arrays.md) | [Home](../../README.md) | [Namespaces →](namespaces.md)
