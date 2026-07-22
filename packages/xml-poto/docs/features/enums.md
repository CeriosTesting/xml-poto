# Enum Mapping (`enumMap`)

Map an in-memory enum member to a different XML token, mirroring C#
`[XmlEnum(Name = "...")]`. Use it when the value you keep in TypeScript differs from the
token written to XML (for example `Male` ↔ `M`, or a numeric code).

## Overview

`enumMap` is a `Record<memberValue, xmlToken>` accepted by `@XmlElement`, `@XmlAttribute`,
and `@XmlText`. The member is translated to its token on write and the token is translated
back to the member on read. Values not present in the map pass through unchanged.

```typescript
@XmlRoot({ name: "Person" })
class Person {
	@XmlElement({ name: "gender", enumMap: { Male: "M", Female: "F" }, enumValues: ["M", "F"] })
	gender!: string;
}

const serializer = new XmlDecoratorSerializer();
serializer.toXml(person); // <gender>M</gender>  (person.gender === "Male")
serializer.fromXml("<Person><gender>F</gender></Person>", Person).gender; // "Female"
```

## Validation

When `enumValues` is also set, it validates the **wire token** (`M`/`F`), not the in-memory
member — validation runs against the value as it appears in XML. The token→member reverse
mapping is applied after validation on read, and member→token before validation on write.

## Note on generated code

Code generated from XSD `xs:enumeration` does **not** need `enumMap`: the generated enum's
value is the exact XSD token in every enum style (`union`, `enum`, `const-object`), so
tokens like `US-EN` or `1` already round-trip losslessly. `enumMap` is for hand-authored
classes where the member and token intentionally differ.
