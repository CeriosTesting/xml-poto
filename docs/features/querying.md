# Querying XML

The Query API provides powerful XPath-like querying capabilities for extracting data from XML without fully deserializing into typed objects. This is perfect for data extraction, filtering, and transformation scenarios.

## Overview

The `@XmlDynamic` decorator creates a `DynamicElement` property that provides a fluent interface for querying XML structures. Think of it as jQuery for XML, integrated directly into your TypeScript classes.

**Key Features:**
- **Lazy Loading**: DynamicElement is built only when first accessed, improving deserialization performance
- **Caching**: Results are cached by default, making repeated queries instant
- **Flexible Querying**: Powerful fluent API for filtering, searching, and transforming XML data

**When to use:**
- Extract specific data without mapping the entire XML structure
- Filter and search through large XML documents
- Navigate complex XML hierarchies dynamically
- Combine typed objects with dynamic queries
- Defer parsing of large sections until needed

## Table of Contents

- [Basic Usage](#basic-usage)
- [@XmlDynamic Decorator](#xmldynamic-decorator)
- [DynamicElement Structure](#dynamicelement-structure)
- [Selection Methods](#selection-methods)
  - [By Name](#selection-by-name)
  - [By Namespace](#selection-by-namespace)
  - [Hierarchical](#hierarchical-selection)
- [Filtering](#filtering)
  - [By Attributes](#filter-by-attributes)
  - [By Text Content](#filter-by-text-content)
  - [By Numeric Values](#filter-by-numeric-values)
  - [By Structure](#filter-by-structure)
- [XPath Support](#xpath-support)
- [Sorting and Ordering](#sorting-and-ordering)
- [Aggregation](#aggregation)
- [Transformation](#transformation)
- [Namespace-Aware Queries](#namespace-aware-queries)
- [Performance Optimization](#performance-optimization)
- [Real-World Examples](#real-world-examples)

## Basic Usage

```typescript
import { XmlRoot, XmlDynamic, XmlSerializer, DynamicElement } from '@cerios/xml-poto';

@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlDynamic()
    query!: DynamicElement;
}

const xml = `
<Catalog>
    <Product id="1">
        <Title>Laptop</Title>
        <Price>999.99</Price>
        <Category>Electronics</Category>
    </Product>
    <Product id="2">
        <Title>Mouse</Title>
        <Price>29.99</Price>
        <Category>Electronics</Category>
    </Product>
</Catalog>
`;

const serializer = new XmlSerializer();
const catalog = serializer.fromXml(xml, Catalog);

// Query examples
const titles = catalog.query.find('Title').texts();
// ['Laptop', 'Mouse']

const prices = catalog.query.find('Price').values();
// [999.99, 29.99]

const expensiveProducts = catalog.query
    .find('Product')
    .whereValueGreaterThan(100);
```

[↑ Back to top](#table-of-contents)

## @XmlDynamic Decorator

The `@XmlDynamic` decorator enables query functionality on a property.

### Options

```typescript
interface XmlDynamicOptions {
    /** Specific property to query (default: root element) */
    targetProperty?: string;

    /** Whether the queryable element is required */
    required?: boolean;

    /** Parse child elements (default: true) */
    parseChildren?: boolean;

    /** Auto-parse numeric values (default: true) */
    parseNumeric?: boolean;

    /** Auto-parse boolean values (default: true) */
    parseBoolean?: boolean;

    /** Trim whitespace from text values (default: true) */
    trimValues?: boolean;

    /** Keep original text with whitespace (default: false) */
    preserveRawText?: boolean;

    /** Maximum depth to parse for performance optimization */
    maxDepth?: number;

    /** Cache query results for repeated queries (default: true)
     * When enabled, the DynamicElement is built once and reused.
     * When disabled, a new DynamicElement is built on each access. */
    cache?: boolean;
}
```

### Basic Example

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    // Query the entire root element
    @XmlDynamic()
    query!: DynamicElement;

    @XmlElement()
    title!: string;

    @XmlElement()
    content!: string;
}

const doc = serializer.fromXml(xmlString, Document);

// Access typed properties
console.log(doc.title);  // Typed access

// Use query API for dynamic searches
// Note: DynamicElement is built lazily on first access and cached
const allElements = doc.query.children;  // First access: builds DynamicElement
const hasFooter = doc.query.exists('Footer');  // Second access: uses cached result
```

### Lazy Loading

By default, DynamicElement is built lazily when first accessed, not during XML deserialization. This significantly improves performance, especially for large XML documents where the query API may not be needed.

```typescript
@XmlRoot({ elementName: 'LargeDocument' })
class LargeDocument {
    @XmlElement()
    metadata!: string;  // Parsed immediately

    @XmlDynamic()  // Built only when accessed
    query!: DynamicElement;

    @XmlDynamic({ targetProperty: 'largeSection' })
    sectionQuery!: DynamicElement;  // Built only if needed
}

const doc = serializer.fromXml(largeXml, LargeDocument);

// Fast deserialization - query structures not built yet
console.log(doc.metadata);  // Instant access

// Query built on first access
const results = doc.query.find('Item');  // Builds DynamicElement here

// If sectionQuery is never accessed, it's never built (saves memory and time)
```

### Query Specific Property

```typescript
@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlElement()
    name!: string;

    @XmlArray({ itemName: 'Book', containerName: 'Books' })
    books!: Book[];

    // Query just the Books container
    @XmlDynamic({ targetProperty: 'books' })
    booksQuery?: DynamicElement;
}

const library = serializer.fromXml(xml, Library);

// Query within the Books container only
const bookTitles = library.booksQuery?.find('Title').texts();
const expensiveBooks = library.booksQuery?.filter(
    book => parseFloat(book.attr('price') || '0') > 50
);
```

### Performance Optimization

```typescript
@XmlRoot({ elementName: 'LargeDocument' })
class LargeDocument {
    // Only parse 3 levels deep for better performance
    @XmlDynamic({ maxDepth: 3 })
    query!: DynamicElement;
}
```

[↑ Back to top](#table-of-contents)

## DynamicElement Structure

Every `DynamicElement` provides rich metadata about the XML element:

```typescript
interface DynamicElement {
    // Basic properties
    name: string;                    // Element tag name
    namespace?: string;              // Namespace prefix
    namespaceUri?: string;           // Namespace URI
    localName: string;               // Name without prefix
    qualifiedName: string;           // Full qualified name (prefix:name)

    // Content
    text?: string;                   // Text content
    numericValue?: number;           // Auto-parsed numeric value
    booleanValue?: boolean;          // Auto-parsed boolean value
    rawText?: string;                // Original text with whitespace
    textNodes?: string[];            // All text nodes (mixed content)

    // Attributes
    attributes: Record<string, string>;              // All attributes
    xmlnsDeclarations?: Record<string, string>;      // Namespace declarations

    // Structure
    children: DynamicElement[];    // Child elements
    siblings: DynamicElement[];    // Sibling elements
    parent?: DynamicElement;       // Parent element

    // Metadata
    depth: number;                   // Element depth in tree (0 = root)
    path: string;                    // Path from root
    indexInParent: number;           // Index among siblings with same name
    indexAmongAllSiblings: number;   // Index among all siblings
    hasChildren: boolean;            // Whether element has children
    isLeaf: boolean;                 // Whether element is a leaf node

    // Additional
    comments?: string[];             // XML comments within element
}
```

### Example

```typescript
const element = catalog.query.find('Product').first();

console.log(element?.name);           // 'Product'
console.log(element?.attributes.id);  // '1'
console.log(element?.depth);          // 2
console.log(element?.path);           // 'Catalog/Product'
console.log(element?.hasChildren);    // true
console.log(element?.children.length); // 3 (Title, Price, Category)
```

[↑ Back to top](#table-of-contents)

## Selection Methods

### Selection by Name

```typescript
// Find all descendants by name (recursive)
query.find('Product')

// Find by qualified name (namespace:name)
query.findQualified('soap:Envelope')

// Find by pattern (supports wildcards)
query.findPattern('Product*')  // Matches Product, ProductInfo, etc.
query.findPattern(/^Item\d+$/) // Regex support

// Find first occurrence only
query.findFirst('Product')
```

### Selection by Namespace

```typescript
// Find by namespace prefix
query.namespace('soap')

// Find elements with any namespace
query.hasNamespace()

// Find elements without namespace
query.noNamespace()

// Find by namespace URI
query.namespaceUri('http://schemas.xmlsoap.org/soap/envelope/')

// Find by local name (ignoring prefix)
query.localName('Envelope')

// Find in specific namespace
query.inNamespace('http://example.com/schema', 'Product')

// Find elements with xmlns declarations
query.hasXmlnsDeclarations()
```

### Hierarchical Selection

```typescript
// Select all direct children
query.children()

// Select children by name
query.childrenNamed('Product')

// Select first/last child
query.firstChild()
query.lastChild()

// Select child at index
query.childAt(0)

// Select parent elements
query.parent()

// Select all ancestors (parents up to root)
query.ancestors()

// Select ancestors by name
query.ancestorsNamed('Catalog')

// Find closest ancestor matching name
query.closest('Section')

// Find closest ancestor matching predicate
query.closestWhere(el => el.attributes.type === 'container')

// Select all descendants (recursive)
query.descendants()

// Select siblings (excluding self)
query.siblings()

// Select siblings by name
query.siblingsNamed('Product')

// Select siblings including self
query.siblingsIncludingSelf()

// Select next/previous sibling
query.nextSibling()
query.previousSibling()
```

**Example:**

```typescript
const xml = `
<Catalog>
    <Section name="Electronics">
        <Category name="Computers">
            <Product id="1">Laptop</Product>
            <Product id="2">Desktop</Product>
        </Category>
    </Section>
</Catalog>
`;

const catalog = serializer.fromXml(xml, Catalog);

// Navigate hierarchy
const products = catalog.query.find('Product');
const parent = products.first()?.parent;  // Category element
const grandparent = products.first()?.parent?.parent;  // Section element

// Find ancestor
const section = catalog.query.find('Product').first()?.closest('Section');

// Get siblings
const laptop = catalog.query.find('Product').first();
const desktop = laptop?.nextSibling();
```

[↑ Back to top](#table-of-contents)

## Filtering

### Filter by Attributes

```typescript
// Filter by attribute existence
query.find('Product').hasAttribute('id')

// Filter by multiple attributes
query.find('Product').hasAttributes('id', 'sku', 'price')

// Filter by attribute value (exact match)
query.find('Product').whereAttribute('category', 'Electronics')

// Filter by attribute pattern
query.find('Product').whereAttributeMatches('sku', /^PROD-\d+$/)

// Filter by attribute predicate
query.find('Product').whereAttributePredicate('price',
    price => parseFloat(price) > 100
)

// Filter elements with any attributes
query.find('Product').hasAnyAttribute()

// Filter elements without any attributes
query.find('Product').noAttributes()
```

### Filter by Text Content

```typescript
// Filter by exact text
query.find('Status').whereText('active')

// Filter by text pattern
query.find('Email').whereTextMatches(/^[\w.]+@[\w.]+$/)

// Filter by text predicate
query.find('Description').whereTextPredicate(
    text => text.length > 100
)

// Filter by text contains
query.find('Title').whereTextContains('TypeScript')

// Filter by text starts/ends with
query.find('Code').whereTextStartsWith('TS-')
query.find('Code').whereTextEndsWith('-END')

// Filter elements with text
query.find('Element').hasText()

// Filter elements without text
query.find('Element').noText()
```

### Filter by Numeric Values

```typescript
// Filter by numeric predicate
query.find('Price').whereValue(value => value > 50 && value < 100)

// Filter by value equals
query.find('Quantity').whereValueEquals(10)

// Filter by value greater/less than
query.find('Price').whereValueGreaterThan(100)
query.find('Stock').whereValueLessThan(5)

// Filter by value range
query.find('Age').whereValueBetween(18, 65)

// Filter elements with numeric values
query.find('Element').hasNumericValue()
```

### Filter by Boolean Values

```typescript
// Filter by boolean value
query.find('IsActive').whereBooleanEquals(true)

// Filter elements with boolean values
query.find('Element').hasBooleanValue()
```

### Filter by Structure

```typescript
// Filter elements with children
query.find('Element').hasChildren()

// Filter leaf nodes (no children)
query.find('Element').isLeaf()

// Filter by number of children
query.find('Section').whereChildCount(count => count > 5)

// Filter by depth
query.find('Element').atDepth(3)
query.find('Element').minDepth(2)
query.find('Element').maxDepth(5)

// Filter by path
query.find('Element').wherePath('Catalog/Section/Product')

// Filter by path pattern
query.find('Element').wherePathMatches(/^Catalog\/.*\/Product$/)
```

### Advanced Filters

```typescript
// Custom predicate
query.find('Product').where((element, index) =>
    element.attributes.stock &&
    parseInt(element.attributes.stock) > 0 &&
    index < 10
)

// Multiple conditions (AND logic)
query.find('Product').whereAll(
    el => el.hasAttribute('id'),
    el => el.attributes.price !== undefined,
    el => parseFloat(el.attributes.price) > 0
)

// Any condition (OR logic)
query.find('Product').whereAny(
    el => el.attributes.featured === 'true',
    el => el.attributes.bestseller === 'true',
    el => parseFloat(el.attributes.discount || '0') > 20
)

// Complex query object
query.find('Product').whereMatches({
    'attributes.category': 'Electronics',
    'numericValue': value => value > 100,
    'hasChildren': true
})
```

**Example:**

```typescript
const xml = `
<Catalog>
    <Product id="1" category="Electronics" stock="10">
        <Title>Laptop</Title>
        <Price>999.99</Price>
    </Product>
    <Product id="2" category="Books" stock="0">
        <Title>TypeScript Guide</Title>
        <Price>29.99</Price>
    </Product>
    <Product id="3" category="Electronics" stock="5">
        <Title>Mouse</Title>
        <Price>19.99</Price>
    </Product>
</Catalog>
`;

const catalog = serializer.fromXml(xml, Catalog);

// Complex filtering
const availableElectronics = catalog.query
    .find('Product')
    .whereAttribute('category', 'Electronics')
    .whereAttributePredicate('stock', stock => parseInt(stock) > 0)
    .map(p => ({
        title: p.children.find(c => c.name === 'Title')?.text,
        price: p.children.find(c => c.name === 'Price')?.numericValue
    }));

// Result: [{ title: 'Laptop', price: 999.99 }, { title: 'Mouse', price: 19.99 }]
```

[↑ Back to top](#table-of-contents)

## XPath Support

The Query API supports common XPath 1.0 features:

```typescript
// Basic paths
query.xpath('/root/child')
query.xpath('root/child')
query.xpath('child')

// Descendant-or-self
query.xpath('//child')
query.xpath('/root//child')

// Wildcards
query.xpath('*')
query.xpath('ns:*')

// Predicates
query.xpath('book[1]')              // First book
query.xpath('book[last()]')         // Last book
query.xpath('book[@id]')            // Books with id attribute
query.xpath('book[@id="123"]')      // Books where id="123"
query.xpath('book[price<30]')       // Books with price < 30

// Functions
query.xpath('//text()')             // All text nodes
query.xpath('//name()')             // All element names
query.xpath('//local-name()')       // All local names
query.xpath('book[position()=1]')   // First book
query.xpath('section[count(book)>5]') // Sections with > 5 books

// Operators
query.xpath('book[price=29.99]')
query.xpath('book[price!=0]')
query.xpath('book[price<50]')
query.xpath('book[price>10]')
query.xpath('book[price<=100]')
query.xpath('book[price>=20]')

// Axes
query.xpath('.')                    // Self
query.xpath('..')                   // Parent

// Get first match
query.xpathFirst('//book[@id="123"]')
```

**Example:**

```typescript
const xml = `
<Library>
    <Section name="Programming">
        <Book id="1">
            <Title>TypeScript Handbook</Title>
            <Price>49.99</Price>
            <Year>2024</Year>
        </Book>
        <Book id="2">
            <Title>JavaScript Guide</Title>
            <Price>39.99</Price>
            <Year>2023</Year>
        </Book>
    </Section>
    <Section name="Fiction">
        <Book id="3">
            <Title>The Novel</Title>
            <Price>19.99</Price>
            <Year>2022</Year>
        </Book>
    </Section>
</Library>
`;

const library = serializer.fromXml(xml, Library);

// XPath queries
const allBooks = library.query.xpath('//Book');
const expensiveBooks = library.query.xpath('//Book[Price>30]');
const programmingBooks = library.query.xpath('//Section[@name="Programming"]/Book');
const firstBook = library.query.xpathFirst('//Book[1]');
const recentBooks = library.query.xpath('//Book[Year>=2023]');
```

[↑ Back to top](#table-of-contents)

## Sorting and Ordering

```typescript
// Sort by element name
query.find('Product').sortByName()
query.find('Product').sortByName(false)  // descending

// Sort by attribute value
query.find('Product').sortByAttribute('price')
query.find('Product').sortByAttribute('name', false)

// Sort by text content
query.find('Title').sortByText()

// Sort by numeric value
query.find('Price').sortByValue()
query.find('Price').sortByValue(false)

// Sort by depth
query.descendants().sortByDepth()

// Custom comparator
query.find('Product').sortBy((a, b) => {
    const priceA = parseFloat(a.attributes.price || '0');
    const priceB = parseFloat(b.attributes.price || '0');
    return priceA - priceB;
})

// Reverse order
query.find('Product').reverse()
```

[↑ Back to top](#table-of-contents)

## Aggregation

```typescript
// Get first/last element
const first = query.find('Product').first();
const last = query.find('Product').last();

// Get element at index
const product = query.find('Product').at(2);
const lastThree = query.find('Product').at(-3);

// Get all as array
const products = query.find('Product').toArray();

// Count
const count = query.find('Product').count();

// Check existence
const exists = query.find('Product').exists();

// Check conditions
const allExpensive = query.find('Product').all(p =>
    parseFloat(p.attributes.price || '0') > 100
);

const anyExpensive = query.find('Product').any(p =>
    parseFloat(p.attributes.price || '0') > 100
);

// Get all text values
const titles = query.find('Title').texts();
// ['Laptop', 'Mouse', 'Keyboard']

// Get all numeric values
const prices = query.find('Price').values();
// [999.99, 29.99, 79.99]

// Get all attribute values
const ids = query.find('Product').attributes('id');
// ['1', '2', '3']

// Get unique attribute values
const categories = query.find('Product').distinctAttributes('category');
// ['Electronics', 'Books']

// Sum numeric values
const total = query.find('Price').sum();
// 1109.97

// Average
const avgPrice = query.find('Price').average();
// 369.99

// Min/Max
const minPrice = query.find('Price').min();
const maxPrice = query.find('Price').max();
```

[↑ Back to top](#table-of-contents)

## Transformation

```typescript
// Map to values
const productNames = query.find('Product').map((p, index) => ({
    index,
    name: p.children.find(c => c.name === 'Title')?.text,
    price: p.children.find(c => c.name === 'Price')?.numericValue
}));

// Execute for each
query.find('Product').each((p, index) => {
    console.log(`${index}: ${p.attributes.id}`);
});

// Reduce to single value
const totalValue = query.find('Price').reduce((sum, p) =>
    sum + (p.numericValue || 0),
    0
);

// Slice elements
const firstThree = query.find('Product').take(3);
const skipFirst = query.find('Product').skip(1);
const middle = query.find('Product').slice(1, 4);

// Get distinct elements
const uniqueCategories = query.find('Product').distinctBy(p =>
    p.attributes.category
);

// Group by property
const byCategory = query.find('Product').groupByAttribute('category');
const byName = query.find('Element').groupByName();
const byNamespace = query.find('Element').groupByNamespace();
const byDepth = query.descendants().groupByDepth();

// Custom grouping
const grouped = query.find('Product').groupBy(p =>
    parseFloat(p.attributes.price || '0') > 100 ? 'expensive' : 'affordable'
);

// Convert to key-value map
const productMap = query.find('Product').toMap(
    p => p.attributes.id,
    p => p.children.find(c => c.name === 'Title')?.text
);
// { '1': 'Laptop', '2': 'Mouse' }

// Convert to JSON
const json = query.find('Product').toJSON();
const jsonWithOptions = query.find('Product').toJSON({
    includeAttributes: true,
    includeMetadata: false,
    flattenSingle: true,
    simplifyLeaves: true
});
```

[↑ Back to top](#table-of-contents)

## Namespace-Aware Queries

```typescript
const xml = `
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:app="http://example.com/app">
    <soap:Body>
        <app:Request>
            <app:UserId>123</app:UserId>
            <app:Action>GetData</app:Action>
        </app:Request>
    </soap:Body>
</soap:Envelope>
`;

const doc = serializer.fromXml(xml, Document);

// Find by namespace prefix
const soapElements = doc.query.namespace('soap');

// Find by namespace URI
const appElements = doc.query.namespaceUri('http://example.com/app');

// Find by local name (ignoring namespace)
const bodies = doc.query.localName('Body');

// Find in specific namespace
const userId = doc.query.inNamespace(
    'http://example.com/app',
    'UserId'
);

// Use namespace context with aliases
const nsContext = doc.query.withNamespaces({
    s: 'http://schemas.xmlsoap.org/soap/envelope/',
    a: 'http://example.com/app'
});

const body = nsContext.find('s:Body');
const request = nsContext.find('a:Request');
const action = nsContext.find('a:Action').first();

// Resolve namespace URI
const soapUri = doc.query.resolveNamespace('soap');

// Get all namespace prefixes
const prefixes = doc.query.getNamespacePrefixes();

// Get namespace mappings
const mappings = doc.query.getNamespaceMappings();
// { 'soap': 'http://...', 'app': 'http://...' }

// Find prefix for namespace URI
const prefix = doc.query.getPrefixForNamespace('http://example.com/app');
```

[↑ Back to top](#table-of-contents)

## Performance Optimization

### Limit Parsing Depth

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    // Only parse 3 levels deep
    @XmlDynamic({ maxDepth: 3 })
    query!: DynamicElement;
}
```

### Caching (Enabled by Default)

Caching is enabled by default for optimal performance. The DynamicElement is built once on first access and reused for subsequent accesses.

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    // Caching enabled by default (cache: true)
    @XmlDynamic()
    query!: DynamicElement;

    // Explicitly disable caching if you need fresh results each time
    @XmlDynamic({ cache: false })
    uncachedQuery!: DynamicElement;
}

const doc = serializer.fromXml(xml, Document);

// Cached: Same instance returned
const query1 = doc.query;
const query2 = doc.query;
console.log(query1 === query2);  // true

// Uncached: Different instances
const uncached1 = doc.uncachedQuery;
const uncached2 = doc.uncachedQuery;
console.log(uncached1 === uncached2);  // false
```

**When to disable caching:**
- Testing scenarios where you need fresh instances
- Dynamic XML that changes between accesses (rare)
- When you manually modify the DynamicElement and want changes to reset

### Disable Unnecessary Parsing

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlDynamic({
        parseNumeric: false,  // Skip numeric parsing
        parseBoolean: false,  // Skip boolean parsing
        parseChildren: true   // Still parse children
    })
    query!: DynamicElement;
}
```

### Use Specific Queries

```typescript
// ❌ Inefficient - searches entire tree
const all = catalog.query.descendants();
const products = all.filter(e => e.name === 'Product');

// ✅ Efficient - direct search
const products = catalog.query.find('Product');
```

### Query Specific Properties

```typescript
@XmlRoot({ elementName: 'Library' })
class Library {
    @XmlArray({ containerName: 'Books', itemName: 'Book' })
    books!: Book[];

    // Query only the Books container, not entire document
    @XmlDynamic({ targetProperty: 'books' })
    booksQuery!: DynamicElement;
}
```

### Lazy Loading and Caching Benefits

**Performance Gains:**

```typescript
@XmlRoot({ elementName: 'Report' })
class Report {
    @XmlElement() summary!: string;

    // Large section - only parsed if queried
    @XmlDynamic({ targetProperty: 'detailedData' })
    dataQuery!: DynamicElement;

    // Another large section
    @XmlDynamic({ targetProperty: 'historicalData' })
    historyQuery!: DynamicElement;
}

const report = serializer.fromXml(largeXml, Report);

// Fast deserialization - only summary is parsed
console.log(report.summary);

// Only parse detailed data if needed
if (needsDetails) {
    const details = report.dataQuery.find('Entry');
    // DynamicElement built here, then cached
}

// Historical data never parsed if not accessed (saves time and memory)
```

**Memory Efficiency:**

```typescript
@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    // Main query for common operations (cached)
    @XmlDynamic()
    query!: DynamicElement;

    // Specialized queries built only when needed
    @XmlDynamic({ targetProperty: 'products' })
    productsQuery!: DynamicElement;

    @XmlDynamic({ targetProperty: 'categories' })
    categoriesQuery!: DynamicElement;

    @XmlDynamic({ targetProperty: 'reviews' })
    reviewsQuery!: DynamicElement;
}

const catalog = serializer.fromXml(xml, Catalog);

// Only build the queries you actually use
const products = catalog.productsQuery.find('Product');
// Other queries remain unbuilt unless accessed
```

**Selective Parsing:**

```typescript
@XmlRoot({ elementName: 'Document' })
class Document {
    @XmlDynamic({ targetProperty: 'header', maxDepth: 2 })
    headerQuery!: DynamicElement;

    @XmlDynamic({ targetProperty: 'body', maxDepth: 5 })
    bodyQuery!: DynamicElement;

    @XmlDynamic({ targetProperty: 'footer', parseChildren: false })
    footerQuery!: DynamicElement;
}

// Each query has independent settings and is built only when accessed
// This allows fine-grained control over parsing behavior and performance
```

[↑ Back to top](#table-of-contents)

## Real-World Examples

### Example 1: Product Catalog Search

```typescript
@XmlRoot({ elementName: 'Catalog' })
class Catalog {
    @XmlDynamic()
    query!: DynamicElement;
}

const xml = `
<Catalog>
    <Product id="1" category="Electronics" featured="true">
        <Title>Gaming Laptop</Title>
        <Price>1299.99</Price>
        <Stock>15</Stock>
        <Rating>4.5</Rating>
    </Product>
    <Product id="2" category="Electronics">
        <Title>Wireless Mouse</Title>
        <Price>29.99</Price>
        <Stock>50</Stock>
        <Rating>4.2</Rating>
    </Product>
    <Product id="3" category="Books">
        <Title>TypeScript Guide</Title>
        <Price>39.99</Price>
        <Stock>0</Stock>
        <Rating>4.8</Rating>
    </Product>
</Catalog>
`;

const catalog = serializer.fromXml(xml, Catalog);

// Find all available electronics
const availableElectronics = catalog.query
    .find('Product')
    .whereAttribute('category', 'Electronics')
    .whereAttributePredicate('Stock', stock => parseInt(stock) > 0)
    .map(p => ({
        id: p.attributes.id,
        title: p.children.find(c => c.name === 'Title')?.text,
        price: p.children.find(c => c.name === 'Price')?.numericValue,
        stock: parseInt(p.attributes.Stock || '0')
    }));

// Find featured products under $100
const featuredDeals = catalog.query
    .find('Product')
    .whereAttribute('featured', 'true')
    .filter(p => {
        const price = p.children.find(c => c.name === 'Price')?.numericValue;
        return price !== undefined && price < 100;
    });

// Get top-rated products
const topRated = catalog.query
    .find('Product')
    .filter(p => {
        const rating = p.children.find(c => c.name === 'Rating')?.numericValue;
        return rating !== undefined && rating >= 4.5;
    })
    .sortByAttribute('Rating', false)
    .take(5);

// Calculate statistics
const avgPrice = catalog.query.find('Price').average();
const totalStock = catalog.query
    .find('Product')
    .map(p => parseInt(p.attributes.Stock || '0'))
    .reduce((sum, stock) => sum + stock, 0);
```

### Example 2: RSS Feed Parser

```typescript
@XmlRoot({ elementName: 'rss' })
class RSSFeed {
    @XmlDynamic()
    query!: DynamicElement;
}

const xml = `
<rss version="2.0">
    <channel>
        <title>Tech Blog</title>
        <item>
            <title>TypeScript 5.0 Released</title>
            <link>https://blog.example.com/ts5</link>
            <pubDate>2024-01-15</pubDate>
            <category>TypeScript</category>
        </item>
        <item>
            <title>Understanding Decorators</title>
            <link>https://blog.example.com/decorators</link>
            <pubDate>2024-01-10</pubDate>
            <category>TypeScript</category>
        </item>
        <item>
            <title>Node.js Best Practices</title>
            <link>https://blog.example.com/nodejs</link>
            <pubDate>2024-01-08</pubDate>
            <category>Node.js</category>
        </item>
    </channel>
</rss>
`;

const feed = serializer.fromXml(xml, RSSFeed);

// Extract all article titles
const titles = feed.query.find('item').find('title').texts();

// Get TypeScript articles
const tsArticles = feed.query
    .find('item')
    .filter(item =>
        item.children.find(c => c.name === 'category')?.text === 'TypeScript'
    )
    .map(item => ({
        title: item.children.find(c => c.name === 'title')?.text,
        link: item.children.find(c => c.name === 'link')?.text,
        date: item.children.find(c => c.name === 'pubDate')?.text
    }));

// Group by category
const byCategory = feed.query
    .find('item')
    .groupBy(item =>
        item.children.find(c => c.name === 'category')?.text || 'Uncategorized'
    );
```

### Example 3: Configuration File Parser

```typescript
@XmlRoot({ elementName: 'Configuration' })
class Configuration {
    @XmlDynamic()
    query!: DynamicElement;
}

const xml = `
<Configuration>
    <Database>
        <Connection name="primary" enabled="true">
            <Host>localhost</Host>
            <Port>5432</Port>
            <Database>myapp</Database>
        </Connection>
        <Connection name="backup" enabled="false">
            <Host>backup.example.com</Host>
            <Port>5432</Port>
            <Database>myapp_backup</Database>
        </Connection>
    </Database>
    <Settings>
        <Setting key="debug" value="true" />
        <Setting key="logLevel" value="info" />
        <Setting key="maxConnections" value="100" />
    </Settings>
</Configuration>
`;

const config = serializer.fromXml(xml, Configuration);

// Get enabled connections
const enabledConnections = config.query
    .find('Connection')
    .whereAttribute('enabled', 'true')
    .map(conn => ({
        name: conn.attributes.name,
        host: conn.children.find(c => c.name === 'Host')?.text,
        port: parseInt(conn.children.find(c => c.name === 'Port')?.text || '0'),
        database: conn.children.find(c => c.name === 'Database')?.text
    }));

// Get settings as key-value map
const settings = config.query
    .find('Setting')
    .toMap(
        s => s.attributes.key,
        s => s.attributes.value
    );

// Get numeric settings
const numericSettings = config.query
    .find('Setting')
    .whereAttributeMatches('value', /^\d+$/)
    .toMap(
        s => s.attributes.key,
        s => parseInt(s.attributes.value)
    );
```

### Example 4: SOAP Message Processing

```typescript
@XmlRoot({ elementName: 'Envelope' })
class SOAPEnvelope {
    @XmlDynamic()
    query!: DynamicElement;
}

const xml = `
<soap:Envelope
    xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:app="http://example.com/app">
    <soap:Header>
        <app:Authentication>
            <app:Token>abc123</app:Token>
            <app:UserId>user@example.com</app:UserId>
        </app:Authentication>
    </soap:Header>
    <soap:Body>
        <app:GetOrdersRequest>
            <app:CustomerId>12345</app:CustomerId>
            <app:DateFrom>2024-01-01</app:DateFrom>
            <app:DateTo>2024-12-31</app:DateTo>
        </app:GetOrdersRequest>
    </soap:Body>
</soap:Envelope>
`;

const envelope = serializer.fromXml(xml, SOAPEnvelope);

// Use namespace context
const ns = envelope.query.withNamespaces({
    soap: 'http://schemas.xmlsoap.org/soap/envelope/',
    app: 'http://example.com/app'
});

// Extract authentication
const token = ns.find('app:Token').first()?.text;
const userId = ns.find('app:UserId').first()?.text;

// Extract request parameters
const customerId = ns.find('app:CustomerId').first()?.text;
const dateFrom = ns.find('app:DateFrom').first()?.text;
const dateTo = ns.find('app:DateTo').first()?.text;

// Check for specific elements
const hasAuth = envelope.query
    .localName('Authentication')
    .exists();
```

[↑ Back to top](#table-of-contents)

---

## See Also

- [API Reference](../api-reference.md#xmlquery) - Complete XmlQuery API documentation
- [Namespaces](namespaces.md) - Working with XML namespaces
- [XPath Reference](../xpath-reference.md) - Detailed XPath syntax guide

[← Back to Features](../README.md#core-features) | [Home](../../README.md)
