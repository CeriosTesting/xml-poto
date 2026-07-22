# Polymorphism (`xsi:type` and `@XmlInclude`)

Serialize and deserialize inheritance hierarchies the way .NET `XmlSerializer` does:
a base-typed member carries an `xsi:type` attribute naming the concrete subtype, and
deserialization restores the correct subclass.

## Table of Contents

- [Overview](#overview)
- [Writing `xsi:type`](#writing-xsitype)
- [Reading `xsi:type`](#reading-xsitype)
- [`@XmlInclude` — declaring known subtypes](#xmlinclude--declaring-known-subtypes)
- [How a subtype is resolved](#how-a-subtype-is-resolved)

## Overview

A property, array item, or document root declared as a base type can hold any subtype
instance. To make that round-trip:

1. Serialize with `useXsiType: true` so the runtime writes `xsi:type="prefix:Subtype"`
   whenever the runtime type differs from the declared type.
2. Give each subtype a stable schema identity with `@XmlType` (name + namespace).
3. Declare the subtypes on the base with `@XmlInclude` so they resolve on read.

```typescript
@XmlType({ name: "Shape", namespace: { uri: "urn:shapes", prefix: "s" } })
@XmlInclude(() => Circle, () => Square)
abstract class Shape {
	@XmlElement() id!: string;
}

@XmlType({ name: "Circle", namespace: { uri: "urn:shapes", prefix: "s" } })
class Circle extends Shape {
	@XmlElement() radius!: number;
}

@XmlRoot({ name: "Drawing", namespace: { uri: "urn:shapes", prefix: "s" } })
class Drawing {
	@XmlElement({ name: "shape", type: () => Shape })
	shape!: Shape;
}

const serializer = new XmlDecoratorSerializer({ useXsiType: true });
const xml = serializer.toXml(drawing); // <s:shape xsi:type="s:Circle">…</s:shape>
const back = serializer.fromXml(xml, Drawing);
back.shape instanceof Circle; // true
```

[↑ Back to top](#table-of-contents)

## Writing `xsi:type`

`xsi:type` is emitted only when `useXsiType: true` **and** the runtime type differs from
the declared (`type`) type. The type name comes from the runtime type's
`@XmlType`/`@XmlRoot`/`@XmlElement` identity, qualified with its namespace prefix
(`xsi:type="s:Circle"`). Single nested objects and array items are both handled.

## Reading `xsi:type`

On deserialization, an `xsi:type` attribute redirects mapping into the named subtype. If
the type is unknown, the declared type is used. If it resolves to a type that is **not** a
subtype of the declared type, that mismatch is reported according to the serializer's
`validationMode` (`strict` throws, `warn` logs, `off` ignores).

## `@XmlInclude` — declaring known subtypes

```typescript
@XmlInclude(() => Circle, () => Square) // thunks support forward references
abstract class Shape {
	/* … */
}
```

`@XmlInclude` registers each subtype's schema identity so `xsi:type` can find it even if
the caller never imported the subtype directly. Use `() => Subtype` thunks — subtypes are
usually declared after the base.

## How a subtype is resolved

Given `xsi:type="prefix:Local"`, the runtime resolves the constructor by, in order:

1. **namespace URI + local name** — using the `xmlns:prefix` in scope on the element
   (prefix-independent; a foreign document may use any prefix for the same namespace);
2. the **prefixed name** `prefix:Local` (round-trips of xml-poto's own output);
3. the **plain type name** `Local` (types in no namespace).

Only a resolved **subtype** of the declared type is used; anything else falls back to the
declared type (and is reported per `validationMode`).
