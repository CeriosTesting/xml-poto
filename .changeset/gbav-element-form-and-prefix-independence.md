---
"@cerios/xml-poto": minor
"@cerios/xml-poto-codegen": minor
---

Honour `elementFormDefault` when writing, and resolve elements by namespace URI when reading.

Round-tripping a real JAX-WS WSDL (GBAV) through codegen and `XmlDecoratorSerializer` produced XML the owning service would reject, and the generated classes could not read back either their own output or a realistic response.

**`@XmlType` no longer qualifies local elements.** `@XmlType` declares a class's _schema type_ identity; whether a member element is namespace-qualified is decided by the schema's `elementFormDefault` (which defaults to `unqualified`) or the member's own `form`, not by the namespace of the type containing it. Previously a class-level `@XmlType` namespace was inherited by every child element that declared none, so a schema with no `elementFormDefault` emitted `<tns:indicatie>` where .NET's `XmlSerializer` emits `<indicatie>`. Qualification is now opt-in via `form: 'qualified'` on the member — exactly what the codegen emits for an `elementFormDefault="qualified"` schema. A class-level `@XmlElement` still propagates its namespace to unqualified children, since that decorator does declare an element identity (SOAP `Envelope`/`Body` shapes are unaffected).

This also fixes qualification being _inconsistent_ within one document: array item names and root-class primitives escaped the old fallback while complexType-typed members did not, so a single response mixed `<tns:categorieen>`, `<categorie>`, `<tns:nummer>` and `<adresVraag>`.

**Deserialization matches on `{namespace-uri, local-name}`.** Element lookup previously compared the literal prefixed string, so `<gbavAntwoord xmlns="…">` or `<ns2:gbavAntwoord xmlns:ns2="…">` — what a JAX-WS peer routinely sends — failed with "Root element tns:gbavAntwoord not found in XML" even though they denote the same element. Prefix bindings are now tracked down the document and resolved to URIs for the root element, required-element checks, child elements and array items alike. An element in a genuinely different namespace is still rejected.

**Single-item arrays stay arrays.** An unwrapped `@XmlArray` whose item tag was namespace-prefixed was looked up by its bare name on the read path; the lookup missed and the element fell through to the scalar path, so one item deserialized to a bare object instead of a one-element array — silently the wrong shape rather than an error. One `persoon`/`categorie`/`rubriek` is ordinary data, so this hit real payloads.

**New `elementForm` codegen option** (`'schema' | 'qualified' | 'unqualified'`, default `'schema'`). `'schema'` honours the XSD and keeps existing generation byte-identical; the others force the choice, as an escape hatch for a service whose WSDL disagrees with what it puts on the wire. Available globally and per source.

**Generated class-level decorators are indented correctly.** Multi-line `@XmlRoot`/`@XmlType`/`@XmlElement` on a class were indented as if they sat on a property.

Serialized output changes for `@XmlType`-namespaced classes whose members declare no `form`: their local elements are now unqualified. Add `form: 'qualified'` to those members (or generate with `elementForm: 'qualified'`) to keep the previous shape.
