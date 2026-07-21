---
"@cerios/xml-poto": minor
---

Ordered heterogeneous collections, mixed complex types, and validation fidelity.

**`@XmlArray({ items })` — several element names in one ordered collection.** A repeating
`xs:choice` interleaves differently named elements, and one array per name cannot say whether the
document read `note task note` or `note note task`. `items` maps the alternatives onto a single
member and keeps document order, the equivalent of repeating C#
`[XmlElement(name, typeof(T))]` on one member:

```ts
@XmlArray({ items: [{ name: "note", type: Note }, { name: "task", type: Task }] })
entries: (Note | Task)[] = [];
// <note/><task/><note/> reads and writes back in that exact order
```

Reading matches each child against the alternatives' names; writing picks the element name from
the value's own constructor. Alternatives may also be scalar (`{ name, dataType }`). Useful to
hand-written models on its own, and what the codegen now emits for repeating compositors and
substitution groups.

**Mixed complex types round-trip.** An element interleaving text with its declared children was
broken in both directions: the typed members read back **empty** (the children were buried in the
parser's `#mixed` run and never matched), and serializing the result emitted a `<#mixed>` element
— not a well-formed name, so the output could not be parsed at all. The run is now flattened into
ordinary children, so the typed members read correctly and nothing illegal is ever written.

To keep the text as well, add `@XmlText({ mixed: true })`, mirroring C# `[XmlText] string[]`:

```ts
@XmlText({ mixed: true }) text: string[] = [];
@XmlElement({ name: "Setting" }) setting: string = "";
// <Config>lead <Setting>a</Setting> tail</Config> round-trips byte for byte
```

Text runs go back in by position: run _i_ precedes child element _i_, with any remainder after
the last element.

**Bounds facets accept strings.** `minInclusive`/`maxInclusive`/`minExclusive`/`maxExclusive`
were typed `number`, so a date bound — `<xs:minInclusive value="2000-01-01"/>` on an `xs:date` —
was silently dropped. They now take `number | string`; a string bound compares
lexicographically, which is exactly right for the ordered XSD date/time types, whose canonical
forms sort chronologically. Numeric bounds still compare numerically.

**`xs:length` counts XSD units.** It measured UTF-16 code units; XSD counts characters for string
types and octets for `xs:hexBinary`/`xs:base64Binary`. An astral character now counts once, and
`length: 4` on a `hexBinary` means four bytes.

**`xsi:schemaLocation` on write.** New `schemaLocation` (namespace URI → location) and
`noNamespaceSchemaLocation` serialization options, written on the document root — often required
by public schemas.

**SOAP header control attributes.** `headers` now accepts
`{ value, mustUnderstand?, actor?, relay? }` alongside a bare object. The right spelling comes
from the version being written: 1.1 uses `actor` and `1`/`0`, 1.2 uses `role` and `true`/`false`,
and `relay` is written only for 1.2.

**`DynamicElement` mixed content, patched.** `DynamicElement.toXml` emitted interleaved text but
`XmlBuilder` — the path taken when a `DynamicElement` is a member of a decorated class — dropped
it whenever the element also had children, so the same tree serialized two different ways.

**Malformed input is rejected instead of half-read.** Two shapes used to make a failed transfer
look like a successful empty one:

- A document that ends before its elements close (`<a><b>`) parsed to `{ a: { b: "" } }` — a
  response cut off mid-stream deserialized as a valid object with everything after the break
  missing. It now throws, naming the element that is never closed.
- Input that is not XML at all — an HTML or JSON error page from a gateway, which happens
  routinely — parsed to `{}`, and the caller was then told `Root element X not found in XML`,
  blaming the schema. It now throws saying the input is not XML, quoting its first characters.

Empty and whitespace-only input still parse to `{}`, and well-formed documents are unaffected.
