# Transform

The `transform` option in `@XmlElement` allows you to customize how property values are converted between TypeScript and XML representations. This is useful for handling dates, custom formats, enums, and other data transformations.

## Basic Usage

The `transform` option accepts an object with two optional functions:
- `serialize`: Transforms the property value to XML (TypeScript → XML string)
- `deserialize`: Transforms the XML value to the property (XML string → TypeScript)

Both functions are optional, allowing you to customize only serialization, only deserialization, or both.

## Date Handling

Transform dates to/from ISO format or timestamps:

```typescript
import { XmlRoot, XmlElement } from '@cerios/xml-poto';

@XmlRoot({ name: 'Event' })
class Event {
  @XmlElement({
    name: 'created',
    transform: {
      serialize: (date: Date) => date.toISOString(),
      deserialize: (str: string) => new Date(str)
    }
  })
  createdAt: Date = new Date();

  @XmlElement({
    name: 'timestamp',
    transform: {
      serialize: (date: Date) => date.getTime().toString(),
      deserialize: (str: string) => new Date(parseInt(str, 10))
    }
  })
  updatedAt: Date = new Date();
}

// Serializes to:
// <Event>
//   <created>2024-01-15T10:30:00.000Z</created>
//   <timestamp>1705314600000</timestamp>
// </Event>
```

## Custom Formats

Transform values to custom string formats:

```typescript
@XmlRoot({ name: 'Product' })
class Product {
  @XmlElement({
    name: 'price',
    transform: {
      serialize: (price: number) => price.toFixed(2)
    }
  })
  price: number = 19.99;

  @XmlElement({
    name: 'tags',
    transform: {
      serialize: (tags: string[]) => tags.join(','),
      deserialize: (str: string) => str.split(',').map(s => s.trim())
    }
  })
  tags: string[] = ['electronics', 'gadgets'];
}

// Serializes to:
// <Product>
//   <price>19.99</price>
//   <tags>electronics,gadgets</tags>
// </Product>
```

## Enum Transformations

Convert enums to different formats:

```typescript
enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Pending = 'PENDING'
}

@XmlRoot({ name: 'User' })
class User {
  @XmlElement({
    name: 'status',
    transform: {
      serialize: (status: Status) => status.toLowerCase(),
      deserialize: (str: string) => str.toUpperCase() as Status
    }
  })
  status: Status = Status.Active;
}

// Serializes to:
// <User>
//   <status>active</status>
// </User>
```

## Parse Custom Formats

Extract values from formatted strings:

```typescript
@XmlRoot({ name: 'Measurement' })
class Measurement {
  @XmlElement({
    name: 'value',
    transform: {
      deserialize: (str: string) => {
        // Parse "42.5 kg" to just the number
        return parseFloat(str.split(' ')[0]);
      }
    }
  })
  value!: number;
}

// Parses: <value>42.5 kg</value>
// Result: measurement.value === 42.5
```

## Boolean Conversions

Convert between different boolean representations:

```typescript
@XmlRoot({ name: 'Config' })
class Config {
  @XmlElement({
    name: 'enabled',
    transform: {
      serialize: (enabled: boolean) => enabled ? 'yes' : 'no',
      deserialize: (str: string) => str.toLowerCase() === 'yes'
    }
  })
  enabled: boolean = true;
}

// Serializes to:
// <Config>
//   <enabled>yes</enabled>
// </Config>
```

## Serialize-Only Transform

Use transform only during serialization (e.g., for formatting output):

```typescript
@XmlRoot({ name: 'Report' })
class Report {
  @XmlElement({
    name: 'amount',
    transform: {
      serialize: (amount: number) => `$${amount.toFixed(2)}`
    }
  })
  amount: number = 1234.5;
}

// Serializes to:
// <Report>
//   <amount>$1234.50</amount>
// </Report>
```

## Deserialize-Only Transform

Use transform only during deserialization (e.g., for parsing):

```typescript
@XmlRoot({ name: 'Input' })
class Input {
  @XmlElement({
    name: 'value',
    transform: {
      deserialize: (str: string) => str.trim().toUpperCase()
    }
  })
  value!: string;
}

// Parses: <value>  hello  </value>
// Result: input.value === 'HELLO'
```

## Important Notes

### Transform Scope

- **Primitives**: Transform is applied to strings, numbers, booleans, and `Date` objects
- **Arrays**: Transform can handle arrays (useful for join/split operations)
- **Complex Objects**: Transform is **not** applied to nested objects with their own decorators

```typescript
@XmlElement({ name: 'Address' })
class Address {
  @XmlElement() city: string = 'Boston';
}

@XmlRoot({ name: 'Person' })
class Person {
  @XmlElement({
    transform: {
      serialize: () => 'transformed' // This won't be called!
    }
  })
  address: Address = new Address();
}

// The Address object is serialized normally, not through the transform
```

### Type Conversion Order

During deserialization, transformations happen in this order:

1. XML parsing (string → parsed value)
2. **Transform deserialize function** (if provided)
3. Type conversion (to property type)

This means your transform function receives the parsed XML value and can return any type that makes sense for your property.

### Error Handling

Transform functions should handle edge cases:

```typescript
@XmlElement({
  transform: {
    deserialize: (str: string) => {
      try {
        return new Date(str);
      } catch (e) {
        // Return default value on error
        return new Date();
      }
    }
  }
})
createdAt!: Date;
```

## Complete Example

```typescript
import { XmlDecoratorSerializer } from '@cerios/xml-poto';
import { XmlRoot, XmlElement } from '@cerios/xml-poto';

enum Priority {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH'
}

@XmlRoot({ name: 'Task' })
class Task {
  @XmlElement({
    transform: {
      serialize: (date: Date) => date.toISOString(),
      deserialize: (str: string) => new Date(str)
    }
  })
  createdAt: Date = new Date('2024-01-15T10:30:00Z');

  @XmlElement({
    transform: {
      serialize: (priority: Priority) => priority.toLowerCase(),
      deserialize: (str: string) => str.toUpperCase() as Priority
    }
  })
  priority: Priority = Priority.High;

  @XmlElement({
    transform: {
      serialize: (tags: string[]) => tags.join(', '),
      deserialize: (str: string) => str.split(',').map(s => s.trim())
    }
  })
  tags: string[] = ['urgent', 'backend'];
}

const serializer = new XmlDecoratorSerializer({ indent: '  ', newLine: '\n' });
const task = new Task();

// Serialize
const xml = serializer.toXml(task);
console.log(xml);
// Output:
// <?xml version="1.0" encoding="UTF-8"?>
// <Task>
//   <createdAt>2024-01-15T10:30:00.000Z</createdAt>
//   <priority>high</priority>
//   <tags>urgent, backend</tags>
// </Task>

// Deserialize
const deserialized = serializer.fromXml(xml, Task);
console.log(deserialized.createdAt instanceof Date); // true
console.log(deserialized.priority); // Priority.High
console.log(deserialized.tags); // ['urgent', 'backend']
```

## See Also

- [Converters](./converters.md) - Custom converters for `@XmlAttribute` and `@XmlText`
- [Elements and Attributes](./elements-and-attributes.md) - Basic decorator usage
- [Advanced Type Handling](../integration/advanced-type-handling.test.ts) - Complex type transformations
