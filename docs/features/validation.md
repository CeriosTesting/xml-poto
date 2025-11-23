# Validation & Type Conversion

Learn how to validate XML data and convert values using patterns, enums, and custom converters.

## Table of Contents

- [Overview](#overview)
- [Type Conversion](#type-conversion)
- [Custom Converters](#custom-converters)
- [Pattern Validation](#pattern-validation)
- [Enum Validation](#enum-validation)
- [Required Fields](#required-fields)
- [Combining Validation Rules](#combining-validation-rules)
- [Best Practices](#best-practices)

## Overview

The library automatically handles type conversion between XML strings and TypeScript types. You can also add custom validation through patterns, enums, and converters to ensure data integrity.

[↑ Back to top](#table-of-contents)

## Type Conversion

### Automatic Type Conversion

The library automatically converts XML string values to TypeScript types:

```typescript
import { XmlRoot, XmlElement, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Price' })
    price: number = 0;

    @XmlElement({ name: 'InStock' })
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

console.log(typeof product.name);     // "string"
console.log(typeof product.price);    // "number" - auto-converted from "999.99"
console.log(typeof product.inStock);  // "boolean" - auto-converted from "true"
```

### Boolean Conversion

Multiple formats are recognized:

```typescript
// All these are converted to true
"true", "1", 1, true

// All these are converted to false
"false", "0", 0, false
```

**Example:**
```typescript
@XmlRoot({ elementName: 'Settings' })
class Settings {
    @XmlElement({ name: 'Enabled' })
    enabled: boolean = false;
}

// These all work
const xml1 = '<Settings><Enabled>true</Enabled></Settings>';
const xml2 = '<Settings><Enabled>1</Enabled></Settings>';
const xml3 = '<Settings><Enabled>false</Enabled></Settings>';
```

### Number Conversion

Supports integers, decimals, and negative numbers:

```typescript
@XmlRoot({ elementName: 'Measurement' })
class Measurement {
    @XmlElement({ name: 'Value' })
    value: number = 0;

    @XmlElement({ name: 'Temperature' })
    temperature: number = 0;
}

const xml = `
<Measurement>
    <Value>19.99</Value>
    <Temperature>-5</Temperature>
</Measurement>`;

const measurement = serializer.fromXml(xml, Measurement);
console.log(measurement.value);        // 19.99
console.log(measurement.temperature);  // -5
```

### Invalid Conversions

Invalid values default to type-appropriate fallbacks:

```typescript
@XmlRoot({ elementName: 'Data' })
class Data {
    @XmlElement({ name: 'Count' })
    count: number = 0;
}

const xml = '<Data><Count>not-a-number</Count></Data>';
const data = serializer.fromXml(xml, Data);

console.log(data.count);  // 0 (fallback for invalid number)
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
    deserialize: (val: string) => new Date(val)
};

@XmlRoot({ elementName: 'Event' })
class Event {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({
        name: 'Date',
        converter: dateConverter
    })
    date: Date = new Date();
}

const event = new Event();
event.name = 'Conference';
event.date = new Date('2024-01-15');

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
console.log(restored.date instanceof Date);  // true
console.log(restored.date);  // Date object: 2024-01-15T00:00:00.000Z
```

### String Transform Converter

```typescript
const upperCaseConverter = {
    serialize: (val: string) => val.toUpperCase(),
    deserialize: (val: string) => val.toLowerCase()
};

@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({
        name: 'Username',
        converter: upperCaseConverter
    })
    username: string = '';
}

const user = new User();
user.username = 'john_doe';

const xml = serializer.toXml(user);
// <User><Username>JOHN_DOE</Username></User>

const restored = serializer.fromXml(xml, User);
console.log(restored.username);  // "john_doe" (converted to lowercase)
```

### Number Formatting Converter

```typescript
const currencyConverter = {
    serialize: (val: number) => val.toFixed(2),
    deserialize: (val: string) => parseFloat(val)
};

@XmlRoot({ elementName: 'Invoice' })
class Invoice {
    @XmlElement({
        name: 'Total',
        converter: currencyConverter
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
                b: parseInt(match[3])
            };
        }
        return { r: 0, g: 0, b: 0 };
    }
};

@XmlRoot({ elementName: 'Style' })
class Style {
    @XmlElement({
        name: 'BackgroundColor',
        converter: colorConverter
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
    serialize: (val: string[]) => val.join(','),
    deserialize: (val: string) => val.split(',').map(s => s.trim())
};

@XmlRoot({ elementName: 'Tags' })
class Tags {
    @XmlElement({
        name: 'Items',
        converter: csvConverter
    })
    items: string[] = [];
}

const tags = new Tags();
tags.items = ['typescript', 'xml', 'serialization'];

const xml = serializer.toXml(tags);
// <Tags><Items>typescript,xml,serialization</Items></Tags>
```

[↑ Back to top](#table-of-contents)

## Pattern Validation

Use regular expressions to validate element values:

### Basic Pattern

```typescript
@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({
        name: 'Code',
        pattern: /^[0-9]+$/
    })
    code: string = '';
}

const user = new User();
user.code = '123';   // ✅ Valid
// user.code = 'abc';   // ❌ Invalid pattern
```

### Email Pattern

```typescript
@XmlRoot({ elementName: 'Contact' })
class Contact {
    @XmlElement({
        name: 'Email',
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    })
    email: string = '';
}

const contact = new Contact();
contact.email = 'user@example.com';  // ✅ Valid
// contact.email = 'invalid-email';     // ❌ Invalid pattern
```

### Phone Number Pattern

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
    @XmlElement({
        name: 'Phone',
        pattern: /^\d{3}-\d{3}-\d{4}$/
    })
    phone: string = '';
}

const person = new Person();
person.phone = '555-123-4567';  // ✅ Valid
```

### Postal Code Pattern

```typescript
@XmlRoot({ elementName: 'Address' })
class Address {
    @XmlElement({
        name: 'PostalCode',
        pattern: /^[A-Z]\d[A-Z] \d[A-Z]\d$/  // Canadian postal code
    })
    postalCode: string = '';
}

const address = new Address();
address.postalCode = 'K1A 0B1';  // ✅ Valid
```

### Validation Behavior

```typescript
// During deserialization, invalid values are handled gracefully
const xml = '<User><Code>abc</Code></User>';
const user = serializer.fromXml(xml, User);

// The value may be rejected or replaced with default
// Check implementation for specific behavior
```

[↑ Back to top](#table-of-contents)

## Enum Validation

Restrict values to a specific set of allowed values:

### String Enum

```typescript
@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlElement({
        name: 'Color',
        enumValues: ['red', 'green', 'blue']
    })
    color: string = '';
}

const product = new Product();
product.color = 'red';     // ✅ Valid
// product.color = 'yellow';  // ❌ Invalid enum value
```

### Status Enum

```typescript
@XmlRoot({ elementName: 'Order' })
class Order {
    @XmlElement({
        name: 'Status',
        enumValues: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    })
    status: string = 'pending';
}

const order = new Order();
order.status = 'shipped';  // ✅ Valid
```

### Priority Enum

```typescript
@XmlRoot({ elementName: 'Task' })
class Task {
    @XmlElement({
        name: 'Priority',
        enumValues: ['low', 'medium', 'high', 'critical']
    })
    priority: string = 'medium';
}
```

### Using TypeScript Enums

```typescript
enum UserRole {
    Admin = 'admin',
    User = 'user',
    Guest = 'guest'
}

@XmlRoot({ elementName: 'Account' })
class Account {
    @XmlElement({
        name: 'Role',
        enumValues: Object.values(UserRole)
    })
    role: UserRole = UserRole.User;
}

const account = new Account();
account.role = UserRole.Admin;  // ✅ Valid
```

[↑ Back to top](#table-of-contents)

## Required Fields

Mark fields as required to enforce their presence:

### Basic Required Field

```typescript
@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({
        name: 'Id',
        required: true
    })
    id: string = '';

    @XmlElement({ name: 'Name' })
    name: string = '';  // Optional
}

// ✅ Valid - has required Id
const xml1 = '<User><Id>123</Id><Name>John</Name></User>';

// ❌ Invalid - missing required Id
const xml2 = '<User><Name>John</Name></User>';
```

### Multiple Required Fields

```typescript
@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlElement({
        name: 'SKU',
        required: true
    })
    sku: string = '';

    @XmlElement({
        name: 'Name',
        required: true
    })
    name: string = '';

    @XmlElement({
        name: 'Price',
        required: true
    })
    price: number = 0;

    @XmlElement({ name: 'Description' })
    description: string = '';  // Optional
}
```

### Required with Default Values

```typescript
@XmlRoot({ elementName: 'Settings' })
class Settings {
    @XmlElement({
        name: 'Version',
        required: true
    })
    version: string = '1.0';  // Default if missing
}
```

[↑ Back to top](#table-of-contents)

## Combining Validation Rules

Combine multiple validation rules for comprehensive data validation:

### Pattern + Enum

```typescript
@XmlRoot({ elementName: 'User' })
class User {
    @XmlElement({
        name: 'Code',
        pattern: /^[A-Z]+$/,
        enumValues: ['ABC', 'DEF', 'GHI']
    })
    code: string = '';
}

// Must match both pattern AND be in enum
const user = new User();
user.code = 'ABC';   // ✅ Valid (uppercase AND in enum)
// user.code = 'abc';   // ❌ Invalid (doesn't match pattern)
// user.code = 'XYZ';   // ❌ Invalid (not in enum)
```

### Required + Pattern

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({
        name: 'DocumentId',
        required: true,
        pattern: /^DOC-\d{6}$/
    })
    documentId: string = '';
}

// Must exist AND match pattern
const doc = new Document();
doc.documentId = 'DOC-123456';  // ✅ Valid
```

### Required + Enum + Converter

```typescript
const dateConverter = {
    serialize: (val: Date) => val.toISOString(),
    deserialize: (val: string) => new Date(val)
};

@XmlRoot({ elementName: 'Task' })
class Task {
    @XmlElement({
        name: 'Priority',
        required: true,
        enumValues: ['low', 'medium', 'high']
    })
    priority: string = 'medium';

    @XmlElement({
        name: 'DueDate',
        required: true,
        converter: dateConverter
    })
    dueDate: Date = new Date();
}
```

### Complex Validation Example

```typescript
@XmlRoot({ elementName: 'Employee' })
class Employee {
    @XmlElement({
        name: 'EmployeeId',
        required: true,
        pattern: /^E\d{5}$/
    })
    employeeId: string = '';

    @XmlElement({
        name: 'Email',
        required: true,
        pattern: /^[a-zA-Z0-9._%+-]+@company\.com$/
    })
    email: string = '';

    @XmlElement({
        name: 'Department',
        required: true,
        enumValues: ['Engineering', 'Sales', 'HR', 'Finance']
    })
    department: string = '';

    @XmlElement({
        name: 'Level',
        required: true,
        enumValues: ['Junior', 'Mid', 'Senior', 'Lead'],
        converter: {
            serialize: (val: string) => val.toUpperCase(),
            deserialize: (val: string) => val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
        }
    })
    level: string = 'Junior';
}

const employee = new Employee();
employee.employeeId = 'E12345';
employee.email = 'john.doe@company.com';
employee.department = 'Engineering';
employee.level = 'Senior';
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
describe('Validation', () => {
    it('should enforce pattern validation', () => {
        const xml = '<User><Code>123</Code></User>';
        const user = serializer.fromXml(xml, User);

        expect(user.code).toBe('123');
    });

    it('should reject invalid pattern', () => {
        const xml = '<User><Code>abc</Code></User>';
        // Test that invalid pattern is handled appropriately
    });

    it('should enforce enum validation', () => {
        const xml = '<Product><Color>red</Color></Product>';
        const product = serializer.fromXml(xml, Product);

        expect(product.color).toBe('red');
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
@XmlRoot({ elementName: 'Employee' })
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
    console.error('Validation failed:', error);
    // Handle invalid data
}
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Converters](converters.md) - Custom value transformations
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Mixed Content](mixed-content.md) | [Home](../../README.md) | [Converters →](converters.md)
