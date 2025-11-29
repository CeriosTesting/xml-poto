# DynamicElement Conversion

The `DynamicElement` class provides bi-directional conversion methods to seamlessly convert between dynamically parsed XML elements and strongly-typed decorated classes.

## Overview

Two conversion methods are available:

1. **`DynamicElement.fromDecoratedClass(obj, serializer?)`** - Static method to convert a decorated class instance to a `DynamicElement`
2. **`element.toDecoratedClass(targetClass, serializer?)`** - Instance method to convert a `DynamicElement` to a decorated class instance

These methods enable powerful workflows where you can:
- Parse XML into dynamic elements for flexible manipulation
- Convert to strongly-typed classes when you need type safety
- Modify elements dynamically and convert back to typed objects
- Build hybrid systems that leverage both dynamic and static typing

## Converting Decorated Class to DynamicElement

Use the static `fromDecoratedClass` method to convert a decorated class instance to a `DynamicElement`:

```typescript
import { XmlRoot, XmlAttribute, XmlElement, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Person' })
class Person {
  @XmlAttribute() id!: string;
  @XmlElement() name!: string;
  @XmlElement() age!: number;
}

const person = new Person();
person.id = '123';
person.name = 'John Doe';
person.age = 30;

// Convert to DynamicElement (async operation)
const element = await DynamicElement.fromDecoratedClass(person);

console.log(element.name);              // 'Person'
console.log(element.attributes['id']); // '123'
console.log(element.children[0].text); // 'John Doe'
```

## Converting DynamicElement to Decorated Class

Use the instance method `toDecoratedClass` to convert a `DynamicElement` to a strongly-typed class:

```typescript
import { DynamicElement } from '@cerios/xml-poto';

// Create a DynamicElement (e.g., from parsing XML)
const element = new DynamicElement({
  name: 'Person',
  attributes: { id: '123' },
});

element.createChild({ name: 'name', text: 'John Doe' });
element.createChild({ name: 'age', text: '30' });

// Convert to decorated class
const person = element.toDecoratedClass(Person);

console.log(person.id);   // '123'
console.log(person.name); // 'John Doe'
console.log(person.age);  // 30 (automatically parsed as number)
```

## Round-Trip Conversion

You can perform round-trip conversions with modifications:

```typescript
@XmlRoot({ elementName: 'Person' })
class Person {
  @XmlAttribute() id!: string;
  @XmlElement() name!: string;
  @XmlElement() age!: number;
  @XmlElement() email?: string;
}

// Start with typed object
const person = new Person();
person.id = '123';
person.name = 'John Doe';
person.age = 30;

// Convert to DynamicElement
const element = await DynamicElement.fromDecoratedClass(person);

// Modify dynamically
element.setAttribute('id', '456');
const nameChild = element.children.find(c => c.name === 'name');
nameChild?.setText('Jane Smith');
element.createChild({ name: 'email', text: 'jane@example.com' });

// Convert back to typed class
const updated = element.toDecoratedClass(Person);

console.log(updated.id);    // '456'
console.log(updated.name);  // 'Jane Smith'
console.log(updated.age);   // 30
console.log(updated.email); // 'jane@example.com'
```

## Using with XmlQuery API

The conversion methods work seamlessly with the XmlQuery API:

```typescript
const person = new Person();
person.id = '123';
person.name = 'John Doe';
person.age = 30;

// Convert to DynamicElement
const element = await DynamicElement.fromDecoratedClass(person);

// Use query API for complex operations
element.query()
  .find('name')
  .setText('Jane Smith');

element.query()
  .find('age')
  .setText('25');

// Convert back
const result = element.toDecoratedClass(Person);
console.log(result.name); // 'Jane Smith'
console.log(result.age);  // 25
```

## Custom Serializer

Both methods accept an optional `XmlDecoratorSerializer` instance for custom serialization options:

```typescript
import { XmlDecoratorSerializer } from '@cerios/xml-poto';

const serializer = new XmlDecoratorSerializer({
  encoding: 'UTF-8',
  omitXmlDeclaration: false,
  emptyElementStyle: 'explicit'
});

// Use custom serializer for conversion
const element = await DynamicElement.fromDecoratedClass(person, serializer);
const typedPerson = element.toDecoratedClass(Person, serializer);
```

## Use Cases

### 1. Dynamic Data Transformation

Process XML data dynamically before converting to typed objects:

```typescript
const xml = '<Person id="123"><name>John</name><age>30</age></Person>';
const parser = new XmlQueryParser();
const query = parser.parse(xml);
const element = query.first()!;

// Transform data dynamically
element.query()
  .find('age')
  .forEach(e => {
    const age = e.numericValue || 0;
    e.setText((age + 5).toString()); // Add 5 years
  });

// Convert to typed object with transformed data
const person = element.toDecoratedClass(Person);
console.log(person.age); // 35
```

### 2. Flexible API Responses

Build APIs that accept both XML strings and typed objects:

```typescript
async function processPerson(input: string | Person): Promise<Person> {
  let element: DynamicElement;

  if (typeof input === 'string') {
    // Parse XML string
    const parser = new XmlQueryParser();
    element = parser.parse(input).first()!;
  } else {
    // Convert typed object to DynamicElement
    element = await DynamicElement.fromDecoratedClass(input);
  }

  // Apply business logic on DynamicElement
  // ... perform transformations ...

  // Return as typed object
  return element.toDecoratedClass(Person);
}
```

### 3. Schema Evolution

Handle XML with optional or additional fields gracefully:

```typescript
const xml = `
  <Person id="123">
    <name>John</name>
    <age>30</age>
    <department>Engineering</department>
    <legacy-field>old-data</legacy-field>
  </Person>
`;

const parser = new XmlQueryParser();
const element = parser.parse(xml).first()!;

// Filter out unknown fields before converting
element.children = element.children.filter(c =>
  ['name', 'age', 'email'].includes(c.name)
);

// Convert to typed class (unknown fields removed)
const person = element.toDecoratedClass(Person);
```

## Notes

- The `fromDecoratedClass` method is **async** because it uses dynamic imports internally
- Both methods use `XmlDecoratorSerializer` for serialization/deserialization
- Type conversions (string to number, boolean) are handled automatically
- Namespace declarations are preserved during conversion
- Circular references and complex object graphs are supported

## Related Features

- [Dynamic Elements](./bi-directional-xml.md) - Learn about DynamicElement basics
- [Querying](./querying.md) - Use XmlQuery API with DynamicElement
- [Decorators](./elements-and-attributes.md) - Define typed classes with decorators
