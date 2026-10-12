---
"@cerios/xml-poto": minor
"@cerios/xml-poto-codegen": minor
---

**Extra root namespace declarations without wrapping generated models.**

`@cerios/xml-poto`: the new `additionalRootNamespaces` serializer option adds prefixed `xmlns:*`
declarations to the document root, even when nothing uses the prefix. A generated root no longer
needs a subclass that only redeclares `@XmlRoot({ namespaces })`:

```ts
const serializer = new XmlSerializer({
	additionalRootNamespaces: [{ prefix: "xsi", uri: "http://www.w3.org/2001/XMLSchema-instance" }],
});
serializer.toXml(new Statement());
// <Statement xmlns="urn:example:statement:v1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
```

The option only adds declarations:

- A binding the root already has, from its decorator, `xsi:nil`/`xsi:type`, or `schemaLocation`,
  is declared once.
- A prefix the root already binds to a different URI throws.
- Every entry needs a prefix.
- `xmlns`, `xml` and `xsi` are protected.

Without the option, output is unchanged.

`@cerios/xml-poto-codegen`: the new per-source `rootNamespaces` setting writes the given
declarations into every generated `@XmlRoot` as `namespaces: [...]`. It is opt-in, and nothing is
copied from the XSD's own `xmlns:*` bindings.
