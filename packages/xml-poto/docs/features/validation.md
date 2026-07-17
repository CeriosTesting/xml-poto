# Validation & Type Conversion

Learn how to validate XML data and convert values using patterns, enums, and custom converters.

## Table of Contents

- [Overview](#overview)
- [Type Conversion](#type-conversion)
- [Custom Converters](#custom-converters)
- [Pattern Validation](#pattern-validation)
- [Enum Validation](#enum-validation)
- [XSD Facets](#xsd-facets)
- [Validation Mode](#validation-mode)
- [Lists, Choice Groups, and Occurs](#lists-choice-groups-and-occurs)
- [Required Fields](#required-fields)
- [Combining Validation Rules](#combining-validation-rules)
- [Strict Validation Mode](#strict-validation-mode)
- [Require All By Default](#require-all-by-default)
- [Best Practices](#best-practices)

## Overview

The library automatically handles type conversion between XML strings and TypeScript types. You can also add custom validation through patterns, enums, and converters to ensure data integrity.

[↑ Back to top](#table-of-contents)

## Type Conversion

### Automatic Type Conversion

The library automatically converts XML string values to TypeScript types:

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from "@cerios/xml-poto";

@XmlRoot({ elementName: "Product" })
class Product {
	@XmlElement({ name: "Name" })
	name: string = "";

	@XmlElement({ name: "Price" })
	price: number = 0;

	@XmlElement({ name: "InStock" })
	inStock: boolean = false;
}

const xml = `
<Product>
    <Name>Laptop</Name>
    <Price>999.99</Price>
    <InStock>true</InStock>
</Product>`;

const serializer = new XmlSerializer();
const product = serializer.fromXml(xml, Product);

console.log(typeof product.name); // "string"
console.log(typeof product.price); // "number" - auto-converted from "999.99"
console.log(typeof product.inStock); // "boolean" - auto-converted from "true"
```

### Boolean Conversion

Multiple formats are recognized:

```typescript
// All these are converted to true
("true", "1", 1, true);

// All these are converted to false
("false", "0", 0, false);
```

**Example:**

```typescript
@XmlRoot({ elementName: "Settings" })
class Settings {
	@XmlElement({ name: "Enabled" })
	enabled: boolean = false;
}

// These all work
const xml1 = "<Settings><Enabled>true</Enabled></Settings>";
const xml2 = "<Settings><Enabled>1</Enabled></Settings>";
const xml3 = "<Settings><Enabled>false</Enabled></Settings>";
```

### Number Conversion

Supports integers, decimals, and negative numbers:

```typescript
@XmlRoot({ elementName: "Measurement" })
class Measurement {
	@XmlElement({ name: "Value" })
	value: number = 0;

	@XmlElement({ name: "Temperature" })
	temperature: number = 0;
}

const xml = `
<Measurement>
    <Value>19.99</Value>
    <Temperature>-5</Temperature>
</Measurement>`;

const measurement = serializer.fromXml(xml, Measurement);
console.log(measurement.value); // 19.99
console.log(measurement.temperature); // -5
```

### Invalid Conversions

Invalid values default to type-appropriate fallbacks:

```typescript
@XmlRoot({ elementName: "Data" })
class Data {
	@XmlElement({ name: "Count" })
	count: number = 0;
}

const xml = "<Data><Count>not-a-number</Count></Data>";
const data = serializer.fromXml(xml, Data);

console.log(data.count); // 0 (fallback for invalid number)
```

[↑ Back to top](#table-of-contents)

## Custom Converters

Custom converters allow you to transform values during serialization and deserialization.

### Converter Interface

```typescript
interface Converter {
	serialize?: (value: any) => any;
	deserialize?: (value: any) => any;
}
```

### Date Converter Example

```typescript
const dateConverter = {
	serialize: (val: Date) => val.toISOString(),
	deserialize: (val: string) => new Date(val),
};

@XmlRoot({ elementName: "Event" })
class Event {
	@XmlElement({ name: "Name" })
	name: string = "";

	@XmlElement({
		name: "Date",
		converter: dateConverter,
	})
	date: Date = new Date();
}

const event = new Event();
event.name = "Conference";
event.date = new Date("2024-01-15");

const xml = serializer.toXml(event);
```

**Output:**

```xml
<Event>
    <Name>Conference</Name>
    <Date>2024-01-15T00:00:00.000Z</Date>
</Event>
```

**Deserialization:**

```typescript
const restored = serializer.fromXml(xml, Event);
console.log(restored.date instanceof Date); // true
console.log(restored.date); // Date object: 2024-01-15T00:00:00.000Z
```

### String Transform Converter

```typescript
const upperCaseConverter = {
	serialize: (val: string) => val.toUpperCase(),
	deserialize: (val: string) => val.toLowerCase(),
};

@XmlRoot({ elementName: "User" })
class User {
	@XmlElement({
		name: "Username",
		converter: upperCaseConverter,
	})
	username: string = "";
}

const user = new User();
user.username = "john_doe";

const xml = serializer.toXml(user);
// <User><Username>JOHN_DOE</Username></User>

const restored = serializer.fromXml(xml, User);
console.log(restored.username); // "john_doe" (converted to lowercase)
```

### Number Formatting Converter

```typescript
const currencyConverter = {
	serialize: (val: number) => val.toFixed(2),
	deserialize: (val: string) => parseFloat(val),
};

@XmlRoot({ elementName: "Invoice" })
class Invoice {
	@XmlElement({
		name: "Total",
		converter: currencyConverter,
	})
	total: number = 0;
}

const invoice = new Invoice();
invoice.total = 123.456;

const xml = serializer.toXml(invoice);
// <Invoice><Total>123.46</Total></Invoice>
```

### Complex Object Converter

```typescript
interface Color {
	r: number;
	g: number;
	b: number;
}

const colorConverter = {
	serialize: (val: Color) => `rgb(${val.r},${val.g},${val.b})`,
	deserialize: (val: string) => {
		const match = val.match(/rgb\((\d+),(\d+),(\d+)\)/);
		if (match) {
			return {
				r: parseInt(match[1]),
				g: parseInt(match[2]),
				b: parseInt(match[3]),
			};
		}
		return { r: 0, g: 0, b: 0 };
	},
};

@XmlRoot({ elementName: "Style" })
class Style {
	@XmlElement({
		name: "BackgroundColor",
		converter: colorConverter,
	})
	backgroundColor: Color = { r: 0, g: 0, b: 0 };
}

const style = new Style();
style.backgroundColor = { r: 255, g: 128, b: 0 };

const xml = serializer.toXml(style);
// <Style><BackgroundColor>rgb(255,128,0)</BackgroundColor></Style>
```

### Array Converter

```typescript
const csvConverter = {
	serialize: (val: string[]) => val.join(","),
	deserialize: (val: string) => val.split(",").map((s) => s.trim()),
};

@XmlRoot({ elementName: "Tags" })
class Tags {
	@XmlElement({
		name: "Items",
		converter: csvConverter,
	})
	items: string[] = [];
}

const tags = new Tags();
tags.items = ["typescript", "xml", "serialization"];

const xml = serializer.toXml(tags);
// <Tags><Items>typescript,xml,serialization</Items></Tags>
```

[↑ Back to top](#table-of-contents)

## Pattern Validation

Use regular expressions to validate element values:

### Basic Pattern

```typescript
@XmlRoot({ elementName: "User" })
class User {
	@XmlElement({
		name: "Code",
		pattern: /^[0-9]+$/,
	})
	code: string = "";
}

const user = new User();
user.code = "123"; // ✅ Valid
// user.code = 'abc';   // ❌ Invalid pattern
```

### Email Pattern

```typescript
@XmlRoot({ elementName: "Contact" })
class Contact {
	@XmlElement({
		name: "Email",
		pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
	})
	email: string = "";
}

const contact = new Contact();
contact.email = "user@example.com"; // ✅ Valid
// contact.email = 'invalid-email';     // ❌ Invalid pattern
```

### Phone Number Pattern

```typescript
@XmlRoot({ elementName: "Person" })
class Person {
	@XmlElement({
		name: "Phone",
		pattern: /^\d{3}-\d{3}-\d{4}$/,
	})
	phone: string = "";
}

const person = new Person();
person.phone = "555-123-4567"; // ✅ Valid
```

### Postal Code Pattern

```typescript
@XmlRoot({ elementName: "Address" })
class Address {
	@XmlElement({
		name: "PostalCode",
		pattern: /^[A-Z]\d[A-Z] \d[A-Z]\d$/, // Canadian postal code
	})
	postalCode: string = "";
}

const address = new Address();
address.postalCode = "K1A 0B1"; // ✅ Valid
```

### Validation Behavior

```typescript
// During deserialization, invalid values are handled gracefully
const xml = "<User><Code>abc</Code></User>";
const user = serializer.fromXml(xml, User);

// The value may be rejected or replaced with default
// Check implementation for specific behavior
```

[↑ Back to top](#table-of-contents)

## Enum Validation

Restrict values to a specific set of allowed values:

### String Enum

```typescript
@XmlRoot({ elementName: "Product" })
class Product {
	@XmlElement({
		name: "Color",
		enumValues: ["red", "green", "blue"],
	})
	color: string = "";
}

const product = new Product();
product.color = "red"; // ✅ Valid
// product.color = 'yellow';  // ❌ Invalid enum value
```

### Status Enum

```typescript
@XmlRoot({ elementName: "Order" })
class Order {
	@XmlElement({
		name: "Status",
		enumValues: ["pending", "processing", "shipped", "delivered", "cancelled"],
	})
	status: string = "pending";
}

const order = new Order();
order.status = "shipped"; // ✅ Valid
```

### Priority Enum

```typescript
@XmlRoot({ elementName: "Task" })
class Task {
	@XmlElement({
		name: "Priority",
		enumValues: ["low", "medium", "high", "critical"],
	})
	priority: string = "medium";
}
```

### Using TypeScript Enums

```typescript
enum UserRole {
	Admin = "admin",
	User = "user",
	Guest = "guest",
}

@XmlRoot({ elementName: "Account" })
class Account {
	@XmlElement({
		name: "Role",
		enumValues: Object.values(UserRole),
	})
	role: UserRole = UserRole.User;
}

const account = new Account();
account.role = UserRole.Admin; // ✅ Valid
```

[↑ Back to top](#table-of-contents)

## XSD Facets

All XSD restriction facets are available on `@XmlElement`, `@XmlAttribute`, `@XmlText`, and `@XmlArray` (where array facets validate each item). Facets are checked during both serialization and deserialization:

```typescript
@XmlRoot({ name: "Payment" })
class Payment {
	// String length facets
	@XmlElement({ name: "Country", length: 2, pattern: /^[A-Z]{2}$/ })
	country: string = "";

	@XmlElement({ name: "Beneficiary", minLength: 2, maxLength: 20 })
	beneficiary: string = "";

	// Numeric bounds and digit facets
	@XmlElement({ name: "Total", minInclusive: 0, maxExclusive: 1000000, totalDigits: 8, fractionDigits: 2 })
	total: number = 0;

	// Whitespace normalization applied before validation: 'preserve' | 'replace' | 'collapse'
	@XmlElement({ name: "Note", whiteSpace: "collapse" })
	note: string = "";

	// Fixed value: used as default when absent, must match when present
	@XmlAttribute({ name: "version", fixedValue: "2.1" })
	version: string = "2.1";
}
```

[↑ Back to top](#table-of-contents)

## Validation Mode

All facet checks (including the `pattern`/`enumValues` checks above) are governed by a single `validationMode` setting on the serializer:

- `"strict"` (default) — throw an error on violation
- `"warn"` — log a `console.warn` and continue
- `"off"` — skip validation entirely

Individual rules can be tuned with `validationModeOverrides`. Each key names one rule; unlisted rules follow `validationMode`:

```typescript
const serializer = new XmlDecoratorSerializer({
	validationMode: "strict", // default for all rules
	validationModeOverrides: {
		pattern: "warn", // pattern violations only warn
		fixedValue: "off", // fixed-value checks skipped
		choiceGroup: "warn", // choice-group violations only warn
		maxOccurs: "off",
	},
});
```

Available rule keys: `pattern`, `enumValues`, `length`, `minLength`, `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`, `fractionDigits`, `fixedValue`, `choiceGroup`, `minOccurs`, `maxOccurs`.

When a value violates multiple rules, each violation is handled according to its own rule's mode — e.g. with `{ pattern: "off" }`, a value that breaks both `pattern` and `maxLength` still throws for `maxLength`. (`whiteSpace` is a normalization, not a validation rule.)

[↑ Back to top](#table-of-contents)

## Lists, Choice Groups, and Occurs

**`xs:list`** — serialize an array as a single space-separated text value:

```typescript
@XmlElement({ name: "Sizes", list: { itemType: "number" } })
sizes: number[] = []; // <Sizes>1 2 3</Sizes> ↔ [1, 2, 3]
```

The `list` option is available on `@XmlElement`, `@XmlAttribute`, and `@XmlText`. Length facets apply to the item count; other facets apply to each item.

**Choice groups (`xs:choice`)** — enforce that at most one member of a group is set (and at least one, when `choiceRequired` is set):

```typescript
@XmlElement({ name: "Email", choiceGroup: "contact", choiceRequired: true })
email?: string;

@XmlElement({ name: "Phone", choiceGroup: "contact", choiceRequired: true })
phone?: string;
```

**Occurs bounds** — validate array item counts with `minOccurs`/`maxOccurs` on `@XmlArray`:

```typescript
@XmlArray({ itemName: "Item", minOccurs: 1, maxOccurs: 10 })
items: string[] = [];
```

**`xsi:nil` round-trip** — `isNullable` elements serialize `null` as `xsi:nil="true"` and deserialize it back to `null`.

[↑ Back to top](#table-of-contents)

## Required Fields

Mark fields as required to enforce their presence:

### Basic Required Field

```typescript
@XmlRoot({ elementName: "User" })
class User {
	@XmlElement({
		name: "Id",
		required: true,
	})
	id: string = "";

	@XmlElement({ name: "Name" })
	name: string = ""; // Optional
}

// ✅ Valid - has required Id
const xml1 = "<User><Id>123</Id><Name>John</Name></User>";

// ❌ Invalid - missing required Id
const xml2 = "<User><Name>John</Name></User>";
```

### Multiple Required Fields

```typescript
@XmlRoot({ elementName: "Product" })
class Product {
	@XmlElement({
		name: "SKU",
		required: true,
	})
	sku: string = "";

	@XmlElement({
		name: "Name",
		required: true,
	})
	name: string = "";

	@XmlElement({
		name: "Price",
		required: true,
	})
	price: number = 0;

	@XmlElement({ name: "Description" })
	description: string = ""; // Optional
}
```

### Required with Default Values

```typescript
@XmlRoot({ elementName: "Settings" })
class Settings {
	@XmlElement({
		name: "Version",
		required: true,
	})
	version: string = "1.0"; // Default if missing
}
```

[↑ Back to top](#table-of-contents)

## Combining Validation Rules

Combine multiple validation rules for comprehensive data validation:

### Pattern + Enum

```typescript
@XmlRoot({ elementName: "User" })
class User {
	@XmlElement({
		name: "Code",
		pattern: /^[A-Z]+$/,
		enumValues: ["ABC", "DEF", "GHI"],
	})
	code: string = "";
}

// Must match both pattern AND be in enum
const user = new User();
user.code = "ABC"; // ✅ Valid (uppercase AND in enum)
// user.code = 'abc';   // ❌ Invalid (doesn't match pattern)
// user.code = 'XYZ';   // ❌ Invalid (not in enum)
```

### Required + Pattern

```typescript
@XmlRoot({ elementName: "Document" })
class Document {
	@XmlElement({
		name: "DocumentId",
		required: true,
		pattern: /^DOC-\d{6}$/,
	})
	documentId: string = "";
}

// Must exist AND match pattern
const doc = new Document();
doc.documentId = "DOC-123456"; // ✅ Valid
```

### Required + Enum + Converter

```typescript
const dateConverter = {
	serialize: (val: Date) => val.toISOString(),
	deserialize: (val: string) => new Date(val),
};

@XmlRoot({ elementName: "Task" })
class Task {
	@XmlElement({
		name: "Priority",
		required: true,
		enumValues: ["low", "medium", "high"],
	})
	priority: string = "medium";

	@XmlElement({
		name: "DueDate",
		required: true,
		converter: dateConverter,
	})
	dueDate: Date = new Date();
}
```

### Complex Validation Example

```typescript
@XmlRoot({ elementName: "Employee" })
class Employee {
	@XmlElement({
		name: "EmployeeId",
		required: true,
		pattern: /^E\d{5}$/,
	})
	employeeId: string = "";

	@XmlElement({
		name: "Email",
		required: true,
		pattern: /^[a-zA-Z0-9._%+-]+@company\.com$/,
	})
	email: string = "";

	@XmlElement({
		name: "Department",
		required: true,
		enumValues: ["Engineering", "Sales", "HR", "Finance"],
	})
	department: string = "";

	@XmlElement({
		name: "Level",
		required: true,
		enumValues: ["Junior", "Mid", "Senior", "Lead"],
		converter: {
			serialize: (val: string) => val.toUpperCase(),
			deserialize: (val: string) => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase(),
		},
	})
	level: string = "Junior";
}

const employee = new Employee();
employee.employeeId = "E12345";
employee.email = "john.doe@company.com";
employee.department = "Engineering";
employee.level = "Senior";
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Use Converters for Complex Types

```typescript
// ✅ Good - converter handles complexity
@XmlElement({
    name: 'Date',
    converter: dateConverter
})
date: Date = new Date();

// ❌ Bad - storing as string
@XmlElement({ name: 'Date' })
date: string = '';
```

### 2. Validate Input Data

```typescript
// ✅ Good - pattern validates format
@XmlElement({
    name: 'Email',
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
})
email: string = '';

// ❌ Bad - no validation
@XmlElement({ name: 'Email' })
email: string = '';
```

### 3. Use Enums for Fixed Sets

```typescript
// ✅ Good - restricts to valid values
@XmlElement({
    name: 'Status',
    enumValues: ['active', 'inactive', 'suspended']
})
status: string = '';

// ❌ Bad - any string accepted
@XmlElement({ name: 'Status' })
status: string = '';
```

### 4. Mark Critical Fields as Required

```typescript
// ✅ Good - enforces required fields
@XmlElement({
    name: 'Id',
    required: true
})
id: string = '';

// ⚠️ Optional field
@XmlElement({ name: 'Id' })
id: string = '';
```

### 5. Test Validation Rules

```typescript
describe("Validation", () => {
	it("should enforce pattern validation", () => {
		const xml = "<User><Code>123</Code></User>";
		const user = serializer.fromXml(xml, User);

		expect(user.code).toBe("123");
	});

	it("should reject invalid pattern", () => {
		const xml = "<User><Code>abc</Code></User>";
		// Test that invalid pattern is handled appropriately
	});

	it("should enforce enum validation", () => {
		const xml = "<Product><Color>red</Color></Product>";
		const product = serializer.fromXml(xml, Product);

		expect(product.color).toBe("red");
	});
});
```

### 6. Document Validation Rules

```typescript
/**
 * Employee record with validated fields.
 * - EmployeeId: Required, format E##### (5 digits)
 * - Email: Required, must be @company.com domain
 * - Department: Required, one of: Engineering, Sales, HR, Finance
 * - Level: Required, one of: Junior, Mid, Senior, Lead
 */
@XmlRoot({ elementName: "Employee" })
class Employee {
	// Implementation...
}
```

### 7. Handle Validation Errors Gracefully

```typescript
try {
	const product = serializer.fromXml(xml, Product);
	// Process valid product
} catch (error) {
	console.error("Validation failed:", error);
	// Handle invalid data
}
```

[↑ Back to top](#table-of-contents)

---

## Strict Validation Mode

**Strict validation** enforces type safety by catching configuration errors where nested objects lack proper type information. This is especially important for features like `@XmlDynamic` that require proper class instantiation.

### The Problem

Without proper type configuration, nested objects become plain Objects instead of class instances:

```typescript
@XmlElement({ name: "metadata" })
class Metadata {
	@XmlDynamic()
	query?: DynamicElement;

	@XmlElement({ name: "title" })
	title: string = "";
}

@XmlRoot({ elementName: "Document" })
class Document {
	// ❌ Missing type parameter
	@XmlElement({ name: "metadata" })
	metadata?: Metadata;
}

const xml = `
<Document>
    <metadata>
        <title>Example</title>
    </metadata>
</Document>
`;

const serializer = new XmlSerializer();
const doc = serializer.fromXml(xml, Document);

// ❌ Problem: metadata is a plain Object, not a Metadata instance
console.log(doc.metadata instanceof Metadata); // false
console.log(doc.metadata?.query); // undefined - @XmlDynamic doesn't work!
```

### Enabling Strict Validation

```typescript
const serializer = new XmlSerializer({
	strictValidation: true, // Enable strict mode
});

try {
	const doc = serializer.fromXml(xml, Document);
} catch (error) {
	// Clear error message with fix instructions
	console.error(error.message);
}
```

### Error Messages

Strict validation provides detailed, actionable error messages:

```
[Strict Validation Error] Property 'metadata' is not properly instantiated.

The property contains a plain Object with nested data, but no type parameter is specified.
This usually indicates missing type information in your decorator.

Current decorator: @XmlElement({ name: 'metadata' })
Fix: @XmlElement({ name: 'metadata', type: Metadata })

This validation catches common configuration errors early.
If you need to work with plain objects temporarily, you can disable strict validation:
new XmlSerializer({ strictValidation: false })

Learn more about type parameters in the documentation.
```

### The Solution

Add Type Parameter (Explicit)

```typescript
@XmlRoot({ elementName: "Document" })
class Document {
	// ✅ Add type parameter
	@XmlElement({ name: "metadata", type: Metadata })
	metadata: Metadata = new Metadata();
}
```

With fix:

```typescript
const serializer = new XmlSerializer({ strictValidation: true });
const doc = serializer.fromXml(xml, Document);

// ✅ Works: metadata is properly instantiated
console.log(doc.metadata instanceof Metadata); // true
console.log(doc.metadata?.query); // DynamicElement instance
```

### When to Use Strict Validation

#### ✅ Enable For:

- **New projects**: Catch errors early during development
- **CI/CD pipelines**: Enforce correct configuration
- **Development environments**: Get immediate feedback
- **External XML sources**: Validate configuration for untrusted data
- **Using @XmlDynamic**: Required for proper query functionality

```typescript
const devSerializer = new XmlSerializer({
	strictValidation: true, // Recommended for development
});
```

#### ⚠️ Disable For:

- **Working with dynamic data**: Plain objects without class structure
- **Legacy code migration**: Gradual migration of existing code
- **Production flexibility**: More lenient error handling
- **Known edge cases**: Intentional use of plain objects

```typescript
const prodSerializer = new XmlSerializer({
	strictValidation: false, // Default: more lenient
});
```

### What It Validates

Strict validation checks for:

1. **Plain Objects with nested data**: Detects when deserialization creates plain Objects instead of class instances
2. **Missing type parameters**: Identifies `@XmlElement` decorators that need `type` option
3. **Classes with @XmlDynamic**: Ensures classes using `@XmlDynamic` are properly instantiated
4. **Extra/Unmapped XML fields**: Validates that all XML elements are defined in the class model (only for classes without `@XmlDynamic`)

**It does NOT validate:**

- Simple values (strings, numbers, booleans)
- Arrays of primitives
- Properly typed nested objects
- Null or undefined values
- Extra fields when class has `@XmlDynamic` decorator
- Extra fields when class has `mixedContent` enabled

```typescript
@XmlRoot({ elementName: "Config" })
class Config {
	// ✅ Simple values - no validation needed
	@XmlElement({ name: "host" })
	host: string = "";

	@XmlElement({ name: "port" })
	port: number = 0;

	// ✅ Arrays of primitives - no validation needed
	@XmlArray({ itemName: "tag" })
	tags: string[] = [];

	// ⚠️ Nested object - validation applies
	@XmlElement({ name: "database" })
	database?: DatabaseConfig; // Needs type parameter or @XmlRoot
}
```

### Extra Field Validation

In strict mode, the library validates that all XML elements are defined in your class model. This helps catch typos, API changes, and schema mismatches early.

#### Without @XmlDynamic - Strict Validation

```typescript
@XmlRoot({ name: "User" })
class User {
	@XmlElement({ name: "Name" })
	name: string = "";

	@XmlElement({ name: "Email" })
	email: string = "";
}

const xml = `
<User>
    <Name>John Doe</Name>
    <Email>john@example.com</Email>
    <Age>30</Age>
    <Phone>555-1234</Phone>
</User>`;

const serializer = new XmlSerializer({ strictValidation: true });

// ❌ Throws error - Age and Phone are not defined in the model
try {
	serializer.fromXml(xml, User);
} catch (error) {
	console.error(error.message);
	// [Strict Validation Error] Unexpected XML element(s) found in 'User'.
	//
	// The following XML elements are not defined in the class model:
	//   - <Age>
	//   - <Phone>
	//
	// Defined elements in User:
	//   - <Name>
	//   - <Email>
	//
	// To fix this issue:
	// 1. Add @XmlElement decorators for these fields in your class
	// 2. Use @XmlDynamic to handle arbitrary/dynamic XML content
	// 3. Disable strict validation: new XmlSerializer({ strictValidation: false })
}
```

#### With @XmlDynamic - No Extra Field Validation

When a class has `@XmlDynamic`, extra fields are allowed because the decorator is designed to handle arbitrary XML structures:

```typescript
@XmlRoot({ name: "Document" })
class Document {
	@XmlElement({ name: "Title" })
	title: string = "";

	// ✅ @XmlDynamic allows any extra fields
	@XmlDynamic()
	query?: DynamicElement;
}

const xml = `
<Document>
    <Title>My Document</Title>
    <Author>John Doe</Author>
    <Date>2024-01-01</Date>
    <Version>1.0</Version>
</Document>`;

const serializer = new XmlSerializer({ strictValidation: true });

// ✅ No error - @XmlDynamic handles extra fields
const doc = serializer.fromXml(xml, Document);
console.log(doc.title); // "My Document"
console.log(doc.query?.children.length); // 4 (Title, Author, Date, Version)
```

#### Forward Compatibility Pattern

Use `@XmlDynamic` to handle versioned APIs where new fields may be added:

```typescript
@XmlRoot({ name: "ApiResponse" })
class ApiResponse {
	@XmlElement({ name: "Status" })
	status: string = "";

	@XmlElement({ name: "Message" })
	message: string = "";

	// ✅ Handle future API versions gracefully
	@XmlDynamic()
	query?: DynamicElement;
}

// Works with both v1 and v2 API responses
const v1Xml = `<ApiResponse><Status>success</Status><Message>OK</Message></ApiResponse>`;
const v2Xml = `<ApiResponse><Status>success</Status><Message>OK</Message><RequestId>123</RequestId><Timestamp>2024-01-01</Timestamp></ApiResponse>`;

const serializer = new XmlSerializer({ strictValidation: true });

const v1 = serializer.fromXml(v1Xml, ApiResponse); // ✅ Works
const v2 = serializer.fromXml(v2Xml, ApiResponse); // ✅ Works - extra fields captured in query
```

#### Mixed Content Exception

Classes with `mixedContent` enabled also allow arbitrary elements:

```typescript
@XmlRoot({ name: "Paragraph" })
class Paragraph {
	@XmlElement({ name: "content", mixedContent: true })
	content: any[] = [];
}

const xml = `
<Paragraph>
    <content>Some text <bold>bold text</bold> more <italic>italic</italic></content>
</Paragraph>`;

const serializer = new XmlSerializer({ strictValidation: true });

// ✅ No error - mixedContent allows arbitrary elements
const para = serializer.fromXml(xml, Paragraph);
```

### Environment-Specific Configuration

```typescript
// config/serializer.ts
export function createSerializer() {
	const isDevelopment = process.env.NODE_ENV === "development";

	return new XmlSerializer({
		strictValidation: isDevelopment, // Strict in dev, lenient in prod
		omitNullValues: true,
	});
}
```

### Combining with Other Validation

Strict validation works alongside field-level validation:

```typescript
@XmlRoot({ elementName: "User" })
class User {
	// Field-level validation
	@XmlElement({
		name: "email",
		required: true,
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	})
	email: string = "";

	// Strict validation ensures Profile is properly instantiated
	@XmlElement({ name: "profile", type: Profile })
	profile: Profile = new Profile();
}

@XmlElement({ elementName: "Profile" })
class Profile {
	@XmlElement({ name: "bio" })
	bio: string = "";
}

const serializer = new XmlSerializer({
	strictValidation: true, // Validates type configuration
});

// Both validations apply:
// 1. Field-level: email must match pattern
// 2. Strict: profile must be properly typed
```

[↑ Back to top](#table-of-contents)

---

## Require All By Default

The `requireAllByDefault` serializer option makes every decorated property (`@XmlElement`, `@XmlAttribute`, `@XmlArray`, `@XmlText`) required during deserialization unless `required: false` is **explicitly** set on that decorator.

This is useful when you want strict presence checking globally without having to write `required: true` on every individual field.

> **Opt-in, non-breaking**: the default value is `false`, preserving existing behaviour.

### Enabling `requireAllByDefault`

```typescript
const serializer = new XmlDecoratorSerializer({ requireAllByDefault: true });
```

### Basic Example

```typescript
@XmlRoot({ name: "config" })
class Config {
	@XmlElement({ name: "host" })
	host!: string; // required by requireAllByDefault

	@XmlElement({ name: "port", required: false })
	port?: number; // explicitly optional — never throws
}

const serializer = new XmlDecoratorSerializer({ requireAllByDefault: true });

// ✅ Both present
serializer.fromXml("<config><host>localhost</host><port>8080</port></config>", Config);

// ✅ Only host — port is explicitly optional
serializer.fromXml("<config><host>localhost</host></config>", Config);

// ❌ host is absent — throws "Required element 'host' is missing"
serializer.fromXml("<config><port>8080</port></config>", Config);
```

### Opting Individual Fields Out

Set `required: false` on a decorator to opt that field out of the global requirement:

```typescript
@XmlRoot({ name: "Server" })
class Server {
	@XmlAttribute({ name: "id" })
	id!: string; // required (throws if absent)

	@XmlAttribute({ name: "region", required: false })
	region?: string; // optional — skipped by requireAllByDefault

	@XmlElement({ name: "host" })
	host!: string; // required

	@XmlElement({ name: "port", required: false })
	port?: number; // optional

	@XmlArray({ containerName: "tags", itemName: "tag" })
	tags!: string[]; // required

	@XmlArray({ containerName: "aliases", itemName: "alias", required: false })
	aliases?: string[]; // optional
}

const serializer = new XmlDecoratorSerializer({ requireAllByDefault: true });
```

### `defaultValue` Suppresses the Error

A field with `defaultValue` set is never considered missing, even under `requireAllByDefault`:

```typescript
@XmlRoot({ name: "config" })
class Config {
	@XmlElement({ name: "host" })
	host!: string;

	@XmlElement({ name: "port", defaultValue: 3000 })
	port: number = 3000; // absent → uses defaultValue, no error
}

const serializer = new XmlDecoratorSerializer({ requireAllByDefault: true });
const config = serializer.fromXml("<config><host>localhost</host></config>", Config);
console.log(config.port); // 3000
```

### Combining with `strictValidation`

Both options can be enabled simultaneously:

```typescript
const serializer = new XmlDecoratorSerializer({
	requireAllByDefault: true, // all decorated properties must be present
	strictValidation: true, // nested objects must be properly instantiated
});
```

- `requireAllByDefault` validates **presence** of XML elements, attributes, and arrays.
- `strictValidation` validates **type instantiation** of nested class instances.

### Comparison with Per-Field `required: true`

| Approach                          | Description                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `@XmlElement({ required: true })` | Marks one specific field as required; default behaviour per field is optional                |
| `requireAllByDefault: true`       | All decorated fields are required globally; opt individual fields out with `required: false` |

Use `requireAllByDefault: true` when most fields should be required and only a few are optional. Use per-field `required: true` when only a handful of fields need enforcement.

### Environment-Specific Configuration

```typescript
export function createSerializer() {
	return new XmlDecoratorSerializer({
		requireAllByDefault: process.env.NODE_ENV !== "production", // strict in dev
		strictValidation: process.env.NODE_ENV !== "production",
	});
}
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Converters](converters.md) - Custom value transformations
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Mixed Content](mixed-content.md) | [Home](../../README.md) | [Converters →](converters.md)
