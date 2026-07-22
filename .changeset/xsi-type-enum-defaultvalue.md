---
"@cerios/xml-poto": minor
---

Add .NET `XmlSerializer` parity for polymorphic deserialization, enum remapping, and default-value omission.

- **`xsi:type` is now read on deserialization.** A base-typed property, array item, or document root carrying `xsi:type="prefix:Derived"` is deserialized into the concrete subtype (previously `xsi:type` was write-only and polymorphic input relied on element-name registration). Resolution is by namespace URI (prefix-independent) with a prefixed-name and plain-name fallback; an unknown type falls back to the declared type, and a resolved type that is not a subtype is reported per the effective `validationMode`. Polymorphic **array items** now also emit `xsi:type` on serialize (previously only single nested objects did).
- **New `@XmlInclude(...types)` decorator** (mirrors C# `[XmlInclude]`): declares the derived types that may substitute for a base via `xsi:type`, so they resolve without the caller pre-loading them. Accepts constructors or `() => Constructor` thunks. `XmlInclude` is exported.
- **New `enumMap` option** on element/attribute/text (mirrors C# `[XmlEnum(Name=...)]`): maps an in-memory enum member to a different XML token, translated on write and reversed on read. `enumValues` (when set) validates the wire token.
- **`[DefaultValue]` omit-on-write.** A scalar element/attribute/text member equal to its `defaultValue` is now omitted on serialize (matching .NET), and re-applied on read. Controlled by the new `omitDefaultValues` serializer option (default `true`); required and `isNullable` members are never omitted. Set `omitDefaultValues: false` to always emit the value.

**Behavior change:** members equal to their declared `defaultValue` are omitted by default. Set `omitDefaultValues: false` to restore always emitting them.
