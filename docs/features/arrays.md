# Arrays & Collections

Learn how to serialize and deserialize arrays using the `@XmlArrayItem` decorator.

## Table of Contents

- [Overview](#overview)
- [@XmlArrayItem Decorator](#xmlarrayitem-decorator)
- [Wrapped vs Unwrapped Arrays](#wrapped-vs-unwrapped-arrays)
- [Simple Arrays](#simple-arrays)
- [Complex Object Arrays](#complex-object-arrays)
- [Mixed Types in Arrays](#mixed-types-in-arrays)
- [Nested Arrays](#nested-arrays)
- [Array Namespaces](#array-namespaces)
- [Best Practices](#best-practices)

## Overview

XML arrays can be structured in two ways:

**Wrapped Array:**
```xml
<Library>
    <Books>
        <Book>...</Book>
        <Book>...</Book>
    </Books>
</Library>
```

**Unwrapped Array:**
```xml
<Library>
    <Book>...</Book>
    <Book>...</Book>
</Library>
```

The `@XmlArrayItem` decorator handles both patterns.

[↑ Back to top](#table-of-contents)

## @XmlArrayItem Decorator

The `@XmlArrayItem` decorator configures how arrays are serialized to XML.

### Options

```typescript
interface XmlArrayItemOptions {
    itemName: string;              // Name for each array element (required)
    containerName?: string;        // Optional wrapper element name
    type?: Function;               // Type constructor for complex objects
    namespace?: XmlNamespace;      // Namespace for array items
    unwrapped?: boolean;           // Legacy: true = no container (default: false)
}
```

### Basic Usage

```typescript
import { XmlRoot, XmlArrayItem, XmlSerializer } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlElement({ name: 'Name' })
    name: string = '';

    // Unwrapped array (no container)
    @XmlArrayItem({ itemName: 'Book' })
    books: string[] = [];
}

const library = new Library();
library.name = 'City Library';
library.books = ['Book 1', 'Book 2', 'Book 3'];

const serializer = new XmlSerializer();
const xml = serializer.toXml(library);
```

**Output:**
```xml
<Library>
    <Name>City Library</Name>
    <Book>Book 1</Book>
    <Book>Book 2</Book>
    <Book>Book 3</Book>
</Library>
```

[↑ Back to top](#table-of-contents)

## Wrapped vs Unwrapped Arrays

### Unwrapped Arrays

Array items appear directly under the parent element (no wrapper):

```typescript
@XmlRoot({ elementName: 'Playlist' })
class Playlist {
    @XmlArrayItem({ itemName: 'Song' })
    songs: string[] = [];
}
```

**XML:**
```xml
<Playlist>
    <Song>Song 1</Song>
    <Song>Song 2</Song>
</Playlist>
```

### Wrapped Arrays

Array items are contained in a wrapper element:

```typescript
@XmlRoot({ elementName: 'Playlist' })
class Playlist {
    @XmlArrayItem({ containerName: 'Songs', itemName: 'Song' })
    songs: string[] = [];
}
```

**XML:**
```xml
<Playlist>
    <Songs>
        <Song>Song 1</Song>
        <Song>Song 2</Song>
    </Songs>
</Playlist>
```

### When to Use Each

**Use Unwrapped** when:
- Following RSS/Atom feed patterns
- Schema requires direct children
- Simplicity is preferred

**Use Wrapped** when:
- Clear grouping is needed
- Multiple arrays in same parent
- Better readability/organization

[↑ Back to top](#table-of-contents)

## Simple Arrays

### String Arrays

```typescript
@XmlRoot({ elementName: 'Tags' })
class Tags {
    @XmlArrayItem({ itemName: 'Tag' })
    items: string[] = [];
}

const tags = new Tags();
tags.items = ['typescript', 'xml', 'serialization'];
```

**Output:**
```xml
<Tags>
    <Tag>typescript</Tag>
    <Tag>xml</Tag>
    <Tag>serialization</Tag>
</Tags>
```

### Number Arrays

```typescript
@XmlRoot({ elementName: 'Scores' })
class Scores {
    @XmlArrayItem({ containerName: 'Values', itemName: 'Score' })
    values: number[] = [];
}

const scores = new Scores();
scores.values = [95, 87, 92, 88];
```

**Output:**
```xml
<Scores>
    <Values>
        <Score>95</Score>
        <Score>87</Score>
        <Score>92</Score>
        <Score>88</Score>
    </Values>
</Scores>
```

[↑ Back to top](#table-of-contents)

## Complex Object Arrays

For arrays of complex objects, **always specify the `type` parameter**.

### Basic Example

```typescript
@XmlElement({ elementName: 'Book' })
class Book {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Author' })
    author: string = '';

    @XmlElement({ name: 'Year' })
    year: number = 0;
}

@XmlRoot({ elementName: 'Library' })
class Library {
    // ✅ Specify type for complex objects
    @XmlArrayItem({ containerName: 'Books', itemName: 'Book', type: Book })
    books: Book[] = [];
}

const library = new Library();
const book1 = new Book();
book1.title = 'TypeScript Handbook';
book1.author = 'Microsoft';
book1.year = 2024;

const book2 = new Book();
book2.title = 'XML Guide';
book2.author = 'John Doe';
book2.year = 2023;

library.books = [book1, book2];

const xml = serializer.toXml(library);
```

**Output:**
```xml
<Library>
    <Books>
        <Book>
            <Title>TypeScript Handbook</Title>
            <Author>Microsoft</Author>
            <Year>2024</Year>
        </Book>
        <Book>
            <Title>XML Guide</Title>
            <Author>John Doe</Author>
            <Year>2023</Year>
        </Book>
    </Books>
</Library>
```

### Unwrapped Complex Arrays

```typescript
@XmlRoot({ elementName: 'Feed' })
class Feed {
    @XmlElement({ name: 'Title' })
    title: string = '';

    // Unwrapped array - common in RSS feeds
    @XmlArrayItem({ itemName: 'Item', type: Item })
    items: Item[] = [];
}

@XmlElement({ elementName: 'Item' })
class Item {
    @XmlElement({ name: 'Title' })
    title: string = '';

    @XmlElement({ name: 'Link' })
    link: string = '';
}
```

**Output:**
```xml
<Feed>
    <Title>My Blog</Title>
    <Item>
        <Title>Post 1</Title>
        <Link>http://example.com/post1</Link>
    </Item>
    <Item>
        <Title>Post 2</Title>
        <Link>http://example.com/post2</Link>
    </Item>
</Feed>
```

[↑ Back to top](#table-of-contents)

## Mixed Types in Arrays

You can have arrays with different element types using union types:

```typescript
@XmlElement({ elementName: 'Dog' })
class Dog {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Breed' })
    breed: string = '';
}

@XmlElement({ elementName: 'Cat' })
class Cat {
    @XmlElement({ name: 'Name' })
    name: string = '';

    @XmlElement({ name: 'Color' })
    color: string = '';
}

@XmlRoot({ elementName: 'Pets' })
class Pets {
    @XmlArrayItem({ itemName: 'Dog', type: Dog })
    dogs: Dog[] = [];

    @XmlArrayItem({ itemName: 'Cat', type: Cat })
    cats: Cat[] = [];
}
```

**Output:**
```xml
<Pets>
    <Dog>
        <Name>Buddy</Name>
        <Breed>Labrador</Breed>
    </Dog>
    <Dog>
        <Name>Max</Name>
        <Breed>Beagle</Breed>
    </Dog>
    <Cat>
        <Name>Whiskers</Name>
        <Color>Orange</Color>
    </Cat>
</Pets>
```

[↑ Back to top](#table-of-contents)

## Nested Arrays

Arrays can contain objects that themselves have arrays:

```typescript
@XmlElement({ elementName: 'Row' })
class Row {
    @XmlArrayItem({ itemName: 'Cell', type: Cell })
    cells: Cell[] = [];
}

@XmlElement({ elementName: 'Cell' })
class Cell {
    @XmlElement({ name: 'Value' })
    value: string = '';
}

@XmlRoot({ elementName: 'Table' })
class Table {
    @XmlArrayItem({ itemName: 'Row', type: Row })
    rows: Row[] = [];
}

const table = new Table();

const row1 = new Row();
const cell1 = new Cell();
cell1.value = 'A1';
const cell2 = new Cell();
cell2.value = 'B1';
row1.cells = [cell1, cell2];

const row2 = new Row();
const cell3 = new Cell();
cell3.value = 'A2';
const cell4 = new Cell();
cell4.value = 'B2';
row2.cells = [cell3, cell4];

table.rows = [row1, row2];
```

**Output:**
```xml
<Table>
    <Row>
        <Cell>
            <Value>A1</Value>
        </Cell>
        <Cell>
            <Value>B1</Value>
        </Cell>
    </Row>
    <Row>
        <Cell>
            <Value>A2</Value>
        </Cell>
        <Cell>
            <Value>B2</Value>
        </Cell>
    </Row>
</Table>
```

[↑ Back to top](#table-of-contents)

## Array Namespaces

Apply namespaces to array items:

```typescript
const itemNs = { uri: 'http://example.com/items', prefix: 'item' };

@XmlRoot({ elementName: 'Container' })
class Container {
    @XmlArrayItem({
        containerName: 'Items',
        itemName: 'Item',
        type: Item,
        namespace: itemNs
    })
    items: Item[] = [];
}

@XmlElement({ elementName: 'Item' })
class Item {
    @XmlElement({ name: 'Name' })
    name: string = '';
}
```

**Output:**
```xml
<Container>
    <Items>
        <item:Item xmlns:item="http://example.com/items">
            <Name>Item 1</Name>
        </item:Item>
        <item:Item xmlns:item="http://example.com/items">
            <Name>Item 2</Name>
        </item:Item>
    </Items>
</Container>
```

[↑ Back to top](#table-of-contents)

## Best Practices

### 1. Always Specify Type for Complex Objects

```typescript
// ✅ Good - type specified
@XmlArrayItem({ itemName: 'Book', type: Book })
books: Book[] = [];

// ❌ Bad - will not deserialize correctly
@XmlArrayItem({ itemName: 'Book' })
books: Book[] = [];
```

### 2. Initialize Arrays

```typescript
// ✅ Good - initialized
@XmlArrayItem({ itemName: 'Item' })
items: string[] = [];

// ❌ Bad - uninitialized
@XmlArrayItem({ itemName: 'Item' })
items: string[];
```

### 3. Use Descriptive Item Names

```typescript
// ✅ Good - clear singular form
@XmlArrayItem({ itemName: 'Product' })
products: Product[] = [];

// ❌ Bad - unclear
@XmlArrayItem({ itemName: 'Prod' })
products: Product[] = [];
```

### 4. Container Names Should Be Plural

```typescript
// ✅ Good - plural container, singular item
@XmlArrayItem({ containerName: 'Books', itemName: 'Book', type: Book })
books: Book[] = [];

// ❌ Bad - confusing naming
@XmlArrayItem({ containerName: 'Book', itemName: 'BookItem', type: Book })
books: Book[] = [];
```

### 5. Choose Wrapped vs Unwrapped Consistently

```typescript
// ✅ Good - consistent style
@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlArrayItem({ containerName: 'Books', itemName: 'Book', type: Book })
    books: Book[] = [];

    @XmlArrayItem({ containerName: 'Authors', itemName: 'Author' })
    authors: string[] = [];
}

// ❌ Bad - inconsistent
@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlArrayItem({ containerName: 'Books', itemName: 'Book', type: Book })
    books: Book[] = [];

    @XmlArrayItem({ itemName: 'Author' })  // No container
    authors: string[] = [];
}
```

### 6. Handle Empty Arrays

```typescript
const library = new Library();
library.books = [];  // Empty array

const xml = serializer.toXml(library, { omitNullValues: true });
// Empty arrays are omitted from output
```

### 7. Test Roundtrip with Arrays

```typescript
describe('Library Serialization', () => {
    it('should handle array roundtrip', () => {
        const original = new Library();
        original.books = [book1, book2, book3];

        const xml = serializer.toXml(original);
        const restored = serializer.fromXml(xml, Library);

        expect(restored.books).toHaveLength(3);
        expect(restored.books[0].title).toBe(book1.title);
    });
});
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [Elements & Attributes](elements-and-attributes.md) - Basic XML mapping
- [Nested Objects](nested-objects.md) - Complex hierarchies
- [Namespaces](namespaces.md) - XML namespace support
- [Core Concepts](../core-concepts.md) - Understanding decorators

[← Elements & Attributes](elements-and-attributes.md) | [Home](../../README.md) | [Nested Objects →](nested-objects.md)
