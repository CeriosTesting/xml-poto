# Custom Converters

Learn how to create and use custom converters for transforming values during serialization and deserialization.

## Table of Contents

- [Overview](#overview)
- [Converter Interface](#converter-interface)
- [Date and Time Converters](#date-and-time-converters)
- [String Transform Converters](#string-transform-converters)
- [Number Formatting Converters](#number-formatting-converters)
- [Object Converters](#object-converters)
- [Array Converters](#array-converters)
- [Boolean Converters](#boolean-converters)
- [Reusable Converter Library](#reusable-converter-library)
- [Best Practices](#best-practices)

## Overview

Custom converters allow you to transform values between their TypeScript representation and their XML string representation. This is essential for handling complex types, formatting, and custom data transformations.

**Converter Flow:**
```
TypeScript Object → serialize → XML String
XML String → deserialize → TypeScript Object
```

[↑ Back to top](#table-of-contents)

## Converter Interface

### Basic Structure

```typescript
interface Converter {
    serialize?: (value: any) => any;
    deserialize?: (value: any) => any;
}
```

- `serialize`: Converts TypeScript value to XML-compatible format
- `deserialize`: Converts XML value back to TypeScript type
- Both methods are optional

### Simple Example

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
```

[↑ Back to top](#table-of-contents)

## Date and Time Converters

### ISO Date Converter

```typescript
const isoDateConverter = {
    serialize: (val: Date) => val.toISOString(),
    deserialize: (val: string) => new Date(val)
};

@XmlRoot({ elementName: 'Event' })
class Event {
    @XmlElement({
        name: 'Date',
        converter: isoDateConverter
    })
    date: Date = new Date();
}

const event = new Event();
event.date = new Date('2024-01-15T10:30:00Z');

const serializer = new XmlSerializer();
const xml = serializer.toXml(event);
```

**Output:**
```xml
<Event>
    <Date>2024-01-15T10:30:00.000Z</Date>
</Event>
```

### Custom Date Format Converter

```typescript
const customDateConverter = {
    serialize: (val: Date) => {
        const year = val.getFullYear();
        const month = String(val.getMonth() + 1).padStart(2, '0');
        const day = String(val.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    deserialize: (val: string) => {
        const [year, month, day] = val.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
};

@XmlRoot({ elementName: 'Booking' })
class Booking {
    @XmlElement({
        name: 'CheckIn',
        converter: customDateConverter
    })
    checkIn: Date = new Date();
}
```

**Output:**
```xml
<Booking>
    <CheckIn>2024-01-15</CheckIn>
</Booking>
```

### Unix Timestamp Converter

```typescript
const unixTimestampConverter = {
    serialize: (val: Date) => Math.floor(val.getTime() / 1000).toString(),
    deserialize: (val: string) => new Date(parseInt(val) * 1000)
};

@XmlRoot({ elementName: 'Log' })
class Log {
    @XmlElement({
        name: 'Timestamp',
        converter: unixTimestampConverter
    })
    timestamp: Date = new Date();
}
```

**Output:**
```xml
<Log>
    <Timestamp>1705315800</Timestamp>
</Log>
```

### Time-Only Converter

```typescript
const timeConverter = {
    serialize: (val: Date) => {
        const hours = String(val.getHours()).padStart(2, '0');
        const minutes = String(val.getMinutes()).padStart(2, '0');
        const seconds = String(val.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    },
    deserialize: (val: string) => {
        const [hours, minutes, seconds] = val.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, seconds, 0);
        return date;
    }
};

@XmlRoot({ elementName: 'Schedule' })
class Schedule {
    @XmlElement({
        name: 'StartTime',
        converter: timeConverter
    })
    startTime: Date = new Date();
}
```

**Output:**
```xml
<Schedule>
    <StartTime>14:30:00</StartTime>
</Schedule>
```

[↑ Back to top](#table-of-contents)

## String Transform Converters

### Case Converters

```typescript
// Uppercase converter
const upperCaseConverter = {
    serialize: (val: string) => val.toUpperCase(),
    deserialize: (val: string) => val.toLowerCase()
};

// Title case converter
const titleCaseConverter = {
    serialize: (val: string) => {
        return val.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },
    deserialize: (val: string) => val.toLowerCase()
};

@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({
        name: 'Code',
        converter: upperCaseConverter
    })
    code: string = '';

    @XmlElement({
        name: 'Title',
        converter: titleCaseConverter
    })
    title: string = '';
}
```

### Trim Converter

```typescript
const trimConverter = {
    serialize: (val: string) => val.trim(),
    deserialize: (val: string) => val.trim()
};

@XmlRoot({ elementName: 'Input' })
class Input {
    @XmlElement({
        name: 'Value',
        converter: trimConverter
    })
    value: string = '';
}
```

### Base64 Converter

```typescript
const base64Converter = {
    serialize: (val: string) => Buffer.from(val).toString('base64'),
    deserialize: (val: string) => Buffer.from(val, 'base64').toString('utf-8')
};

@XmlRoot({ elementName: 'Secret' })
class Secret {
    @XmlElement({
        name: 'Data',
        converter: base64Converter
    })
    data: string = '';
}

const secret = new Secret();
secret.data = 'sensitive information';
```

**Output:**
```xml
<Secret>
    <Data>c2Vuc2l0aXZlIGluZm9ybWF0aW9u</Data>
</Secret>
```

[↑ Back to top](#table-of-contents)

## Number Formatting Converters

### Currency Converter

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
```

**Output:**
```xml
<Invoice>
    <Total>123.46</Total>
</Invoice>
```

### Percentage Converter

```typescript
const percentageConverter = {
    serialize: (val: number) => `${(val * 100).toFixed(1)}%`,
    deserialize: (val: string) => parseFloat(val.replace('%', '')) / 100
};

@XmlRoot({ elementName: 'Stats' })
class Stats {
    @XmlElement({
        name: 'SuccessRate',
        converter: percentageConverter
    })
    successRate: number = 0;
}

const stats = new Stats();
stats.successRate = 0.856;
```

**Output:**
```xml
<Stats>
    <SuccessRate>85.6%</SuccessRate>
</Stats>
```

### Scientific Notation Converter

```typescript
const scientificConverter = {
    serialize: (val: number) => val.toExponential(2),
    deserialize: (val: string) => parseFloat(val)
};

@XmlRoot({ elementName: 'Measurement' })
class Measurement {
    @XmlElement({
        name: 'Distance',
        converter: scientificConverter
    })
    distance: number = 0;
}

const measurement = new Measurement();
measurement.distance = 12345678;
```

**Output:**
```xml
<Measurement>
    <Distance>1.23e+7</Distance>
</Measurement>
```

[↑ Back to top](#table-of-contents)

## Object Converters

### JSON Converter

```typescript
const jsonConverter = {
    serialize: (val: any) => JSON.stringify(val),
    deserialize: (val: string) => JSON.parse(val)
};

interface Metadata {
    author: string;
    version: string;
}

@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlElement({
        name: 'Metadata',
        converter: jsonConverter
    })
    metadata: Metadata = { author: '', version: '' };
}

const doc = new Document();
doc.metadata = { author: 'John Doe', version: '1.0' };
```

**Output:**
```xml
<Document>
    <Metadata>{"author":"John Doe","version":"1.0"}</Metadata>
</Document>
```

### RGB Color Converter

```typescript
interface Color {
    r: number;
    g: number;
    b: number;
}

const rgbConverter = {
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
        converter: rgbConverter
    })
    backgroundColor: Color = { r: 0, g: 0, b: 0 };
}

const style = new Style();
style.backgroundColor = { r: 255, g: 128, b: 0 };
```

**Output:**
```xml
<Style>
    <BackgroundColor>rgb(255,128,0)</BackgroundColor>
</Style>
```

### Hex Color Converter

```typescript
const hexColorConverter = {
    serialize: (val: Color) => {
        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        return `#${toHex(val.r)}${toHex(val.g)}${toHex(val.b)}`;
    },
    deserialize: (val: string) => {
        const hex = val.replace('#', '');
        return {
            r: parseInt(hex.slice(0, 2), 16),
            g: parseInt(hex.slice(2, 4), 16),
            b: parseInt(hex.slice(4, 6), 16)
        };
    }
};

@XmlRoot({ elementName: 'Theme' })
class Theme {
    @XmlElement({
        name: 'PrimaryColor',
        converter: hexColorConverter
    })
    primaryColor: Color = { r: 0, g: 0, b: 0 };
}

const theme = new Theme();
theme.primaryColor = { r: 33, g: 150, b: 243 };
```

**Output:**
```xml
<Theme>
    <PrimaryColor>#2196f3</PrimaryColor>
</Theme>
```

[↑ Back to top](#table-of-contents)

## Array Converters

### CSV Converter

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
```

**Output:**
```xml
<Tags>
    <Items>typescript,xml,serialization</Items>
</Tags>
```

### Pipe-Separated Converter

```typescript
const pipeConverter = {
    serialize: (val: string[]) => val.join('|'),
    deserialize: (val: string) => val.split('|').map(s => s.trim())
};

@XmlRoot({ elementName: 'Options' })
class Options {
    @XmlElement({
        name: 'Values',
        converter: pipeConverter
    })
    values: string[] = [];
}
```

**Output:**
```xml
<Options>
    <Values>option1|option2|option3</Values>
</Options>
```

### Number Array Converter

```typescript
const numberArrayConverter = {
    serialize: (val: number[]) => val.join(','),
    deserialize: (val: string) => val.split(',').map(s => parseFloat(s.trim()))
};

@XmlRoot({ elementName: 'Coordinates' })
class Coordinates {
    @XmlElement({
        name: 'Points',
        converter: numberArrayConverter
    })
    points: number[] = [];
}

const coords = new Coordinates();
coords.points = [1.5, 2.3, 4.8, 6.1];
```

**Output:**
```xml
<Coordinates>
    <Points>1.5,2.3,4.8,6.1</Points>
</Coordinates>
```

[↑ Back to top](#table-of-contents)

## Boolean Converters

### Yes/No Converter

```typescript
const yesNoConverter = {
    serialize: (val: boolean) => val ? 'yes' : 'no',
    deserialize: (val: string) => val.toLowerCase() === 'yes'
};

@XmlRoot({ elementName: 'Settings' })
class Settings {
    @XmlElement({
        name: 'Enabled',
        converter: yesNoConverter
    })
    enabled: boolean = false;
}
```

**Output:**
```xml
<Settings>
    <Enabled>yes</Enabled>
</Settings>
```

### Numeric Boolean Converter

```typescript
const numericBooleanConverter = {
    serialize: (val: boolean) => val ? '1' : '0',
    deserialize: (val: string) => val === '1'
};

@XmlRoot({ elementName: 'Flags' })
class Flags {
    @XmlElement({
        name: 'Active',
        converter: numericBooleanConverter
    })
    active: boolean = false;
}
```

**Output:**
```xml
<Flags>
    <Active>1</Active>
</Flags>
```

[↑ Back to top](#table-of-contents)

## Reusable Converter Library

Create a library of reusable converters:

### converters.ts

```typescript
export const Converters = {
    // Date/Time
    isoDate: {
        serialize: (val: Date) => val.toISOString(),
        deserialize: (val: string) => new Date(val)
    },

    shortDate: {
        serialize: (val: Date) => {
            const year = val.getFullYear();
            const month = String(val.getMonth() + 1).padStart(2, '0');
            const day = String(val.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        },
        deserialize: (val: string) => {
            const [year, month, day] = val.split('-').map(Number);
            return new Date(year, month - 1, day);
        }
    },

    // String
    upperCase: {
        serialize: (val: string) => val.toUpperCase(),
        deserialize: (val: string) => val.toLowerCase()
    },

    trim: {
        serialize: (val: string) => val.trim(),
        deserialize: (val: string) => val.trim()
    },

    base64: {
        serialize: (val: string) => Buffer.from(val).toString('base64'),
        deserialize: (val: string) => Buffer.from(val, 'base64').toString('utf-8')
    },

    // Number
    currency: {
        serialize: (val: number) => val.toFixed(2),
        deserialize: (val: string) => parseFloat(val)
    },

    percentage: {
        serialize: (val: number) => `${(val * 100).toFixed(1)}%`,
        deserialize: (val: string) => parseFloat(val.replace('%', '')) / 100
    },

    // Array
    csv: {
        serialize: (val: string[]) => val.join(','),
        deserialize: (val: string) => val.split(',').map(s => s.trim())
    },

    // Boolean
    yesNo: {
        serialize: (val: boolean) => val ? 'yes' : 'no',
        deserialize: (val: string) => val.toLowerCase() === 'yes'
    },

    // Object
    json: {
        serialize: (val: any) => JSON.stringify(val),
        deserialize: (val: string) => JSON.parse(val)
    }
};
```

### Usage

```typescript
import { Converters } from './converters';

@XmlRoot({ elementName: 'Product' })
class Product {
    @XmlElement({
        name: 'Name',
        converter: Converters.trim
    })
    name: string = '';

    @XmlElement({
        name: 'Price',
        converter: Converters.currency
    })
    price: number = 0;

    @XmlElement({
        name: 'ReleaseDate',
        converter: Converters.shortDate
    })
    releaseDate: Date = new Date();

    @XmlElement({
        name: 'Tags',
        converter: Converters.csv
    })
    tags: string[] = [];
}
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Handle Edge Cases

```typescript
// ✅ Good - handles null/undefined
const safeConverter = {
    serialize: (val: Date | null) => val ? val.toISOString() : '',
    deserialize: (val: string) => val ? new Date(val) : null
};

// ❌ Bad - will crash on null
const unsafeConverter = {
    serialize: (val: Date) => val.toISOString(),
    deserialize: (val: string) => new Date(val)
};
```

### 2. Validate Input

```typescript
// ✅ Good - validates before parsing
const emailConverter = {
    serialize: (val: string) => val.toLowerCase().trim(),
    deserialize: (val: string) => {
        const email = val.trim();
        if (!email.includes('@')) {
            throw new Error('Invalid email format');
        }
        return email;
    }
};
```

### 3. Make Converters Symmetric

```typescript
// ✅ Good - serialize and deserialize are inverses
const converter = {
    serialize: (val: number) => val.toString(),
    deserialize: (val: string) => parseInt(val)
};

// Test roundtrip
const original = 123;
const serialized = converter.serialize(original);
const deserialized = converter.deserialize(serialized);
// deserialized === original ✅
```

### 4. Use TypeScript Types

```typescript
// ✅ Good - properly typed
const typedConverter: Converter = {
    serialize: (val: Date): string => val.toISOString(),
    deserialize: (val: string): Date => new Date(val)
};
```

### 5. Document Converter Behavior

```typescript
/**
 * Converts dates to ISO 8601 format for XML serialization.
 * Serializes: Date → "2024-01-15T10:30:00.000Z"
 * Deserializes: "2024-01-15T10:30:00.000Z" → Date
 */
const isoDateConverter = {
    serialize: (val: Date) => val.toISOString(),
    deserialize: (val: string) => new Date(val)
};
```

### 6. Test Converters Thoroughly

```typescript
describe('Date Converter', () => {
    it('should serialize date to ISO format', () => {
        const date = new Date('2024-01-15T10:30:00Z');
        const result = isoDateConverter.serialize(date);
        expect(result).toBe('2024-01-15T10:30:00.000Z');
    });

    it('should deserialize ISO string to date', () => {
        const iso = '2024-01-15T10:30:00.000Z';
        const result = isoDateConverter.deserialize(iso);
        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBe(new Date(iso).getTime());
    });

    it('should handle roundtrip', () => {
        const original = new Date('2024-01-15T10:30:00Z');
        const serialized = isoDateConverter.serialize(original);
        const deserialized = isoDateConverter.deserialize(serialized);
        expect(deserialized.getTime()).toBe(original.getTime());
    });
});
```

### 7. Reuse Common Converters

```typescript
// ✅ Good - centralized converter library
import { Converters } from './converters';

@XmlElement({ name: 'Date', converter: Converters.isoDate })
date: Date = new Date();

// ❌ Bad - duplicate converter definitions
@XmlElement({ name: 'Date', converter: { serialize: ..., deserialize: ... } })
date: Date = new Date();
```

### 8. Keep Converters Simple

```typescript
// ✅ Good - simple, focused converter
const upperCaseConverter = {
    serialize: (val: string) => val.toUpperCase(),
    deserialize: (val: string) => val.toLowerCase()
};

// ❌ Bad - too complex, should be split
const complexConverter = {
    serialize: (val: any) => {
        // 50 lines of complex logic...
    },
    deserialize: (val: string) => {
        // 50 lines of complex logic...
    }
};
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Validation](validation.md) - Data validation and type conversion
- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Validation](validation.md) | [Home](../../README.md) | [Comments →](comments.md)
