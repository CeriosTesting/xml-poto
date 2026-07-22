---
"@cerios/xml-poto": minor
---

Add `anonymous` to `@XmlType`, mirroring C# `[XmlType(AnonymousType=true)]`.

An XSD complexType declared inline on an element has no type name of its own, so
the only `name` a class can carry for it is the _element's_. Registering that name
let such a class answer lookups meant for whatever type the schema really names
there — resolving an `xsi:type="prefix:Local"` that names no schema type, and
claiming the element name in the auto-discovery registry, which is last-writer-wins.

`@XmlType({ anonymous: true })` keeps the name/namespace as the members' fallback
but leaves the class out of both name-keyed registries. Default is unchanged.
