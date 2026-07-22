# @cerios/xml-poto

## 2.5.0

### Minor Changes

- b80042f: Honour `elementFormDefault` when writing, and resolve elements by namespace URI when reading.

  Round-tripping a real JAX-WS WSDL (GBAV) through codegen and `XmlDecoratorSerializer` produced XML the owning service would reject, and the generated classes could not read back either their own output or a realistic response.

  **`@XmlType` no longer qualifies local elements.** `@XmlType` declares a class's _schema type_ identity; whether a member element is namespace-qualified is decided by the schema's `elementFormDefault` (which defaults to `unqualified`) or the member's own `form`, not by the namespace of the type containing it. Previously a class-level `@XmlType` namespace was inherited by every child element that declared none, so a schema with no `elementFormDefault` emitted `<tns:indicatie>` where .NET's `XmlSerializer` emits `<indicatie>`. Qualification is now opt-in via `form: 'qualified'` on the member — exactly what the codegen emits for an `elementFormDefault="qualified"` schema. A class-level `@XmlElement` still propagates its namespace to unqualified children, since that decorator does declare an element identity (SOAP `Envelope`/`Body` shapes are unaffected).

  This also fixes qualification being _inconsistent_ within one document: array item names and root-class primitives escaped the old fallback while complexType-typed members did not, so a single response mixed `<tns:categorieen>`, `<categorie>`, `<tns:nummer>` and `<adresVraag>`.

  **Deserialization matches on `{namespace-uri, local-name}`.** Element lookup previously compared the literal prefixed string, so `<gbavAntwoord xmlns="…">` or `<ns2:gbavAntwoord xmlns:ns2="…">` — what a JAX-WS peer routinely sends — failed with "Root element tns:gbavAntwoord not found in XML" even though they denote the same element. Prefix bindings are now tracked down the document and resolved to URIs for the root element, required-element checks, child elements and array items alike. An element in a genuinely different namespace is still rejected.

  **Single-item arrays stay arrays.** An unwrapped `@XmlArray` whose item tag was namespace-prefixed was looked up by its bare name on the read path; the lookup missed and the element fell through to the scalar path, so one item deserialized to a bare object instead of a one-element array — silently the wrong shape rather than an error. One `persoon`/`categorie`/`rubriek` is ordinary data, so this hit real payloads.

  **New `elementForm` codegen option** (`'schema' | 'qualified' | 'unqualified'`, default `'schema'`). `'schema'` honours the XSD and keeps existing generation byte-identical; the others force the choice, as an escape hatch for a service whose WSDL disagrees with what it puts on the wire. Available globally and per source.

  **Generated class-level decorators are indented correctly.** Multi-line `@XmlRoot`/`@XmlType`/`@XmlElement` on a class were indented as if they sat on a property.

  Serialized output changes for `@XmlType`-namespaced classes whose members declare no `form`: their local elements are now unqualified. Add `form: 'qualified'` to those members (or generate with `elementForm: 'qualified'`) to keep the previous shape.

- b80042f: Reconcile nested namespace handling and add an `@XmlType` decorator (issue #96).

  - **Namespace declaration dedup**: nested elements no longer re-declare a namespace prefix/URI pair that an ancestor already declares. `<S:Envelope xmlns:S="…"><S:Body xmlns:S="…">` now serializes as `<S:Envelope xmlns:S="…"><S:Body>`. A prefix rebound to a different URI is preserved (legal namespace rebinding).
  - **Property/class metadata reconciliation**: when a property's `@XmlElement` sets a name but no namespace and the referenced type carries a namespace, the wrapper element is now qualified from that namespace instead of producing an unqualified wrapper around prefixed children. The property still overrides the class; the class only fills a missing namespace/form (mirroring C# `XmlSerializer` `[XmlElement]` + `[XmlType]`).
  - **New `@XmlType` decorator**: describes a class's XML type identity (schema type name/namespace), distinct from `@XmlRoot` (document root) and the wrapper form of `@XmlElement`. It supplies the class-level name/namespace as a fallback used to qualify nested/array references (and to derive root defaults when no `@XmlRoot`/`@XmlElement` is present). `XmlType` and `XmlTypeOptions` are now exported.
  - **Array items qualified consistently**: for `@XmlArray({ form: "qualified" })`, item elements are now prefixed with the array's namespace like the container (previously only the container was prefixed), matching C# `XmlArrayItem`.
  - **Attributes are never in the default namespace**: a namespaced attribute without a prefix now gets a synthesized prefix and is declared inline, instead of emitting `xmlns="…"` on the root and hijacking the document default namespace (matching C#). Attributes with an explicit prefix and attributes with no namespace are unchanged.
  - **`xmlns=""` reset**: a nested element whose type is in no namespace, nested under a default-namespace ancestor, now emits `xmlns=""` so it is not pulled into the ancestor namespace (matching C#).
  - **Namespace-qualified `xsi:type`**: when `useXsiType` is enabled, `xsi:type` now uses the runtime type's schema name (`@XmlType`/`@XmlRoot`/`@XmlElement`) qualified with its namespace prefix (e.g. `xsi:type="tns:Derived"`), instead of the raw class name.

  **Behavior change — null handling now matches C#:** null/undefined non-nullable members are **omitted** by default (previously emitted as empty elements). `isNullable` members still emit `xsi:nil="true"` (even when omission is on). The default of `omitNullValues` changed from `false` to `true`; set `omitNullValues: false` to restore the legacy empty-element behavior.

  These changes make serialized output more closely match .NET `XmlSerializer` and remove redundant/mixed namespace shapes. Output for documents that previously emitted duplicate declarations, unqualified wrappers, or empty elements for null members will change accordingly.

- b80042f: Deserialized values now match their declared TypeScript types for numeric, boolean and enum members.

  A round-trip sweep of every XSD and WSDL fixture found that the XML on the wire was always correct, but the objects coming back out of `fromXml` did not inhabit the types the generated classes declare.

  **Numeric and boolean attributes came back as strings.** The worst case is silent and inverted:

  ```ts
  @XmlAttribute({ name: 'draft' }) draft?: boolean;   // generated

  doc.draft        // "false"  ← a string
  if (doc.draft)   // TRUE — the document says false
  ```

  Coercion is driven by a member's `dataType`, and codegen only ever assigned one for `xs:dateTime`/`xs:date`/`xs:time` — every numeric and boolean type got none. All numeric types and `xs:boolean` now carry an explicit `dataType`, so a member deserializes to the type it declares. Elements needed this too, not just attributes: the parser leaves a non-canonical number such as `<amount>007</amount>` as the string `"007"`.

  **`xs:boolean` lexical `1`/`0` never became a boolean.** `coerceByDataType` bailed on any non-string input, and the parser had already turned `<flag>1</flag>` into the number `1`, so the boolean branch never ran. All four legal lexical forms (`true`/`false`/`1`/`0`) now deserialize to a boolean on elements, attributes and text content alike.

  **Numeric-looking enum tokens failed on elements.** An enumeration of `"1"`/`"2"` validated fine as an attribute but threw `is not one of the allowed values` as an element, because the parser numericised the token before the facet check compared it against the declared strings. Enumeration facets now match on the lexical form, and a token the parser numericised is restored to its string form so it still inhabits the generated `'1' | '2'` union. Codegen also suppresses `dataType` on enum members, so an `xs:int`-based enumeration keeps its tokens verbatim rather than coercing them to numbers.

  **Required members whose facets reject the default now use definite assignment.** `country: string = ''` under `pattern="[A-Z]{2}"` could never serialize — it merely deferred the problem to a runtime facet error. Such members are now emitted as `country!: string`, so `tsc` catches a missing assignment. Only members that are both required _and_ carry facets no default satisfies are affected; `total: number = 0` under `minInclusive="0"` keeps its initializer, as does any member with a schema `default`/`fixed` value.

  Values change shape on deserialization, so drop any compensation you added for the old behaviour:

  | member                                   | before               | after            |
  | ---------------------------------------- | -------------------- | ---------------- |
  | boolean attribute                        | `"true"` / `"false"` | `true` / `false` |
  | numeric attribute                        | `"42"`               | `42`             |
  | `xs:boolean` element written as `1`/`0`  | `1` / `0`            | `true` / `false` |
  | non-canonical numeric element (`007`)    | `"007"`              | `7`              |
  | numeric-looking enum token on an element | threw, or `2`        | `"2"`            |

  A comparison such as `doc.draft === "true"` must become `doc.draft === true`. Regenerating from your schemas is recommended so members pick up their `dataType`; the runtime fixes apply to hand-written classes that already declare one.

- b80042f: Ordered heterogeneous collections, mixed complex types, and validation fidelity.

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

- b80042f: Add `SoapSerializer`: read and write SOAP envelopes without hand-written wrapper classes.

  Consuming a SOAP service previously meant declaring your own `Envelope`/`Body` classes and nesting the payload in them by hand. `SoapSerializer` does it for you — `toXml` takes your payload and returns a complete SOAP request, `fromXml` takes a response and returns your payload type.

  ```ts
  const soap = new SoapSerializer({ faultDetailTypes: { gbavFout: GbavFout } });

  const request = soap.toXml(vraag);
  // <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  //   <soapenv:Body><tns:gbavVraag …>…</tns:gbavVraag></soapenv:Body>
  // </soapenv:Envelope>

  const antwoord = soap.fromXml(response, GbavAntwoord);
  ```

  - **Prefix-independent reading.** The envelope is matched on its namespace URI, so `soap:`, `soapenv:`, `S:`, `env:` and a default `xmlns=` are all understood. Namespace bindings are carried down from the `Envelope`, which is how JAX-WS and most Java stacks actually write responses — they hoist every declaration onto the envelope and prefix the payload with something like `ns2:`.
  - **SOAP 1.1 and 1.2.** Writing uses the configured version (default `1.1`); reading auto-detects it from the envelope namespace, so a 1.2 response parses on a 1.1-configured serializer. Fault parsing is version-aware: SOAP 1.1 leaves `faultcode`/`faultstring`/`detail` unqualified, while 1.2 renames them to `Code/Value`, `Reason/Text`, `Detail` and moves them into the envelope namespace.
  - **Typed faults.** A `<Fault>` in the body throws `SoapFaultError` carrying `faultCode`, `faultString`, `faultActor`, `detail` and `rawDetail`, so a fault can never be silently mistaken for a success. Register `faultDetailTypes` to have the detail deserialized into your own class.
  - **Typed headers.** `toXml(payload, { headers: [security] })` writes any decorated objects into the SOAP `Header`; `fromEnvelope(xml, { body, headers })` reads them back. No `<Header>` element is emitted when there are none.

  `XmlDecoratorSerializer` gains two protected extension points (`buildDocumentRoot`, `resolveDocumentBody`) that `SoapSerializer` hooks, and its internals become `protected` rather than `private`. Both hooks default to the identity, so plain serialization is byte-for-byte unchanged.

  Exports: `SoapSerializer`, `SoapFaultError`, `SOAP_1_1_NAMESPACE`, `SOAP_1_2_NAMESPACE`, `DEFAULT_SOAP_PREFIX`, and the types `SoapFault`, `SoapVersion`, `SoapSerializerOptions`, `SoapWriteOptions`, `SoapHeaderSpec`, `SoapReadSpec`, `SoapEnvelopeResult`, `FaultDetailTypes`.

  See [SOAP Envelopes](https://github.com/CeriosTesting/xml-poto/blob/main/packages/xml-poto/docs/features/soap.md) for the full guide.

- b80042f: Add .NET `XmlSerializer` parity for polymorphic deserialization, enum remapping, and default-value omission.

  - **`xsi:type` is now read on deserialization.** A base-typed property, array item, or document root carrying `xsi:type="prefix:Derived"` is deserialized into the concrete subtype (previously `xsi:type` was write-only and polymorphic input relied on element-name registration). Resolution is by namespace URI (prefix-independent) with a prefixed-name and plain-name fallback; an unknown type falls back to the declared type, and a resolved type that is not a subtype is reported per the effective `validationMode`. Polymorphic **array items** now also emit `xsi:type` on serialize (previously only single nested objects did).
  - **New `@XmlInclude(...types)` decorator** (mirrors C# `[XmlInclude]`): declares the derived types that may substitute for a base via `xsi:type`, so they resolve without the caller pre-loading them. Accepts constructors or `() => Constructor` thunks. `XmlInclude` is exported.
  - **New `enumMap` option** on element/attribute/text (mirrors C# `[XmlEnum(Name=...)]`): maps an in-memory enum member to a different XML token, translated on write and reversed on read. `enumValues` (when set) validates the wire token.
  - **`[DefaultValue]` omit-on-write.** A scalar element/attribute/text member equal to its `defaultValue` is now omitted on serialize (matching .NET), and re-applied on read. Controlled by the new `omitDefaultValues` serializer option (default `true`); required and `isNullable` members are never omitted. Set `omitDefaultValues: false` to always emit the value.

  **Behavior change:** members equal to their declared `defaultValue` are omitted by default. Set `omitDefaultValues: false` to restore always emitting them.

### Patch Changes

- b80042f: Document every serialization option, and fix the samples that could not compile.

  **New [Serialization Options](https://github.com/CeriosTesting/xml-poto/blob/main/packages/xml-poto/docs/serialization-options.md) reference.** Every field of `SerializationOptions` with its default, in one place. Three were documented nowhere: `omitDefaultValues`, `schemaLocation` and `noNamespaceSchemaLocation` — the first of which is a default-ON behavior change, so a reader had no way to learn that a member equal to its `defaultValue` is now dropped from output. Five older options (`ignoreAttributes`, `attributeNamePrefix`, `textNodeName`, `xmlVersion`, `standalone`) had never been documented either. The page opens with the `omitNullValues` and `omitDefaultValues` default changes and how to restore the previous behavior.

  **Samples that did not compile.** `serializer.toXml(obj, { … })` appeared in five guides, but `toXml` takes a single argument — options belong on the constructor, as `core-concepts.md` itself says. Three option names in samples did not exist at all: `indentSize` and `declaration` (in the Getting Started "Serialization Options" block, so the page teaching options taught two that are not real) and `newLine`.

  **`@XmlType` and `@XmlInclude` reach the Decorator Overview** in Core Concepts, which had listed every other decorator. `defaultValue` in the element and attribute option blocks now mentions omit-on-write.

  **Navigation.** Three anchors pointed at headings that do not exist (or differed in case, which a browser does not forgive); "Type Identity with @XmlType" and "Two shapes, two options" were missing from their page tables of contents; and the Getting Started pointer for SOAP now reaches the SOAP guide instead of a section of the namespaces page that was never written.

  A `tests/docs/docs-samples.test.ts` guard now checks the documentation against the source of truth on every run — option names against the option interfaces, `toXml`/`fromXml` arity, and every relative link and anchor — so this class of drift fails the build rather than shipping.

- b80042f: Fix XML that was written or read incorrectly, and expose compact output.

  A pre-release audit against the XML 1.0 and XSD specs turned up six defects, all of which
  produced wrong output or wrong values silently rather than raising an error.

  **`pattern` facets now constrain the whole value.** `xs:pattern` is an implicit full match, but
  `RegExp.test` succeeds on any substring, so `pattern: /[0-9]{9}/` accepted `"abc123456789xyz"`.
  Patterns are anchored at validation time, so hand-written decorators and generated code are both
  fixed without rewriting any regex. Already-anchored patterns behave identically; `g`/`y` flags
  are dropped, as they made validation depend on how many values had been checked before.
  **This rejects values that previously passed** — a pattern that was meant to be a partial match
  now needs explicit `.*` on either side.

  **Line breaks and tabs in attribute values survive the round-trip.** They are now written as
  `&#10;`/`&#13;`/`&#9;`; previously they were emitted literally and every conforming reader
  collapsed them to spaces under attribute-value normalization, so a multi-line attribute silently
  lost its formatting. Text content is unaffected — line breaks stay literal there.

  **CDATA and comments can no longer produce an unparseable document.** A value containing `]]>`
  inside a CDATA section is split across two sections instead of terminating the section early,
  and `--` (or a trailing `-`) inside a comment is padded. Adjacent CDATA sections are joined back
  into one value on read, as XML requires.

  **Entity decoding no longer decodes its own output.** The chained replacements turned
  `&amp;#65;` — the escaped literal text `&#65;` — into `A`. Decoding is now a single pass. Character
  references above U+FFFF (`&#128512;`) decode correctly instead of being truncated by
  `String.fromCharCode`.

  **Documents this library writes can be read back.** The parser stripped only the first `<?xml?>`
  declaration and cut a DOCTYPE at the first `>`, so a document with several processing
  instructions — or a DOCTYPE with an internal subset, both of which `XmlDecoratorSerializer` can
  emit — left fragments behind that were then read as an element name.

  **New `format` and `indent` serialization options.** Output was hardcoded to indented, with no
  way to get a compact document — what SOAP requests usually want, and what anything hashing or
  signing the payload requires. `format` defaults to `true`, so existing output is unchanged.
  (The constructor's JSDoc previously documented `indent`/`newLine` options that did not exist.)

  Documentation: every decorator option used in an example now exists on its option type. `@XmlRoot`
  and `@XmlElement` samples used `elementName`, which is spelled `name` — including the README's
  Quick Start, so the first sample in the docs did not compile. `converter` was shown on
  `@XmlElement`, which takes `transform` (attributes and text take `converter`). `enum` was shown
  where the option is `enumValues`, and `@XmlText({ preserveWhitespace })` where whitespace is
  controlled by `xmlSpace` on the containing element. Eleven links pointed at pages that do not
  exist; four existing guides were unlinked.

## 2.4.0

### Minor Changes

- d9a3cce: Add XSD validation support to the decorators and serializer:

  - **XSD facets on `@XmlElement`, `@XmlAttribute`, `@XmlText`, and `@XmlArray`**: `pattern`, `enumValues`, `length`, `minLength`, `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace`, and `fixedValue`. Facets are validated during both serialization and deserialization.
  - **Unified `validationMode` serializer option** (`"strict"` | `"warn"` | `"off"`, default `"strict"`): governs all facet validation including the pre-existing `pattern`/`enumValues` checks on `@XmlAttribute` (whose default throw behavior is unchanged but can now be relaxed). Individual rules can be tuned per rule via **`validationModeOverrides`** (e.g. `{ pattern: "warn", fixedValue: "off", choiceGroup: "warn" }`); unlisted rules follow `validationMode`. When a value violates several rules, each violation is handled by its own rule's mode.
  - **`xs:list` support**: the new `list` option on `@XmlElement`, `@XmlAttribute`, and `@XmlText` round-trips arrays as space-separated text (e.g. `<sizes>1 2 3</sizes>` ↔ `number[]`), with optional typed items via `list: { itemType: "number" }`.
  - **Choice groups (`xs:choice`)**: `choiceGroup` and `choiceRequired` options on `@XmlElement`/`@XmlArray` enforce that at most one (and, when required, at least one) member of a group is set.
  - **`minOccurs`/`maxOccurs` on `@XmlArray`**: item-count validation.
  - **`xsi:nil` round-trip**: `isNullable` elements now deserialize `xsi:nil="true"` back to `null` (previously serialize-only). Applies only when `isNullable: true` is set.
  - **`dataType` activated**: the previously inert `dataType` option now coerces values (numeric/boolean XSD types) during deserialization when the property type cannot be inferred from its runtime value (i.e. optional properties that were previously left as raw strings).
  - **`fixedValue`**: acts as a default when the value is absent and as a constraint (value must equal it) when present.
  - `@XmlText` now also deserializes text-only elements that parse to a plain primitive.

- d9a3cce: Add lazy type references: the `type` option on `@XmlElement`, `@XmlAttribute`, and `@XmlArray` now accepts a `() => Constructor` thunk (new `TypeRef` type, exported along with `resolveTypeRef`/`isTypeThunk`) in addition to a plain constructor.

  Thunks make forward, circular, and self references safe. With standard TC39 decorators, an option object like `{ type: Section }` is evaluated while the referenced class may still be in its temporal dead zone (self-recursive types, mutually referencing types, or classes declared later in the same module) and throws a `ReferenceError`. A thunk (`{ type: () => Section }`) defers the lookup until (de)serialization:

  ```ts
  @XmlElement({ name: "Section" })
  class Section {
  	@XmlArray({ itemName: "Section", type: () => Section })
  	children?: Section[];
  }
  ```

  Resolution is lazy with write-back caching, and registry registration (auto-discovery) for thunk-referenced classes is deferred to the first registry lookup. Plain constructor usage is unchanged. `unionTypes` intentionally still takes plain constructors (it is only used for primitive wrapper types).

## 2.3.3

### Patch Changes

- f9d5028: Updated dependencies. Pinned `vitest` to `4.0.18` and kept `tsdown`/`typescript` on their previous stable versions (`^0.21.10`/`^6.0.3`) after `0.22.4`/`7.0.2` were found to break the build (missing `--config-loader bundle` support and stray `.d.ts` files emitted into `src`).

## 2.3.2

### Patch Changes

- 7558f2f: Error messages for missing required elements, arrays, attributes, and queryable elements now include the parent element class name (e.g. `Required element 'name' is missing in element 'Book'`).

## 2.3.1

### Patch Changes

- 9f3b009: Improved error message for missing required attributes to include the parent element class name (e.g. `Required attribute 'id' is missing in element 'MyClass'`).

## 2.3.0

### Minor Changes

- 19532c4: Add `requireAllByDefault` serialization option.

  When set to `true`, all `@XmlElement`, `@XmlAttribute`, `@XmlArray`, and `@XmlText` decorated fields are treated as required during deserialization unless the decorator explicitly sets `required: false`. This complements the existing per-field `required` option by providing a class-wide default, removing the need to mark every field individually.

  Key behaviours:

  - Fields with `required: false` are always optional regardless of this option.
  - Fields with a `defaultValue` in the decorator are exempt from the required check (the default is used instead).
  - TypeScript field initializers (e.g. `= ""`) have no effect on the required check; only `defaultValue` in the decorator suppresses the error.
  - Can be combined with `strictValidation`.

### Patch Changes

- 9acd721: Fix `strictValidation` not checking required property values after deserialization.

  When `strictValidation: true`, a new post-deserialization check now throws a `[Strict Validation Error]` if a required `@XmlElement` property resolves to `null` or `undefined` on the instance (e.g. when a `transform.deserialize` function returns a nullish value). Properties with a `defaultValue` are excluded from this check.

## 2.2.1

### Patch Changes

- bd53e3b: Fix `package.json` entry points to match tsdown's default output extensions.

  After the tsup → tsdown migration, the emitted CJS artifacts are `index.cjs`
  and `index.d.cts` (instead of tsup's `index.js` / `index.d.ts`), but the
  manifests still referenced the old filenames. As a result `main`, `types`,
  and the `require` export condition pointed at files that no longer exist,
  which broke CJS consumers and `@arethetypeswrong/cli` resolution.

  Updated in both packages:

  - `main`: `./dist/index.js` → `./dist/index.cjs`
  - `types`: `./dist/index.d.ts` → `./dist/index.d.cts`
  - `exports["."].require.default`: `./dist/index.js` → `./dist/index.cjs`
  - `exports["."].require.types`: `./dist/index.d.ts` → `./dist/index.d.cts`

  In `@cerios/xml-poto-codegen` the `bin` entry was also corrected:

  - `bin["xml-poto-codegen"]`: `dist/cli.js` → `dist/cli.cjs`

  ESM entry points (`.mjs` / `.d.mts`) were already correct and are unchanged.

- bd53e3b: Fix `@XmlElement` name precedence so a property-level explicit name correctly
  overrides the class-level `@XmlElement` / `@XmlRoot` name of the referenced
  type.

  Previously, when a property's type carried a class-level `@XmlElement({ name })`
  or `@XmlRoot({ name })`, that name would win even if the property itself was
  decorated with `@XmlElement({ name: "..." })`. This was inconsistent with the
  C# `System.Xml.Serialization.XmlSerializer` behaviour, where a property-level
  `[XmlElement(ElementName = "...")]` always overrides the referenced type's
  `[XmlType]` / `[XmlRoot]` name.

  The serializer now resolves an element's tag name using a 3-tier priority:

  1. Explicit name provided on the property's `@XmlElement` decorator.
  2. Class-level `@XmlElement` / `@XmlRoot` name of the referenced type.
  3. The property key (default).

  Internally, `@XmlElement` now tracks whether the name was explicitly supplied
  via a new `nameExplicitlySet` metadata flag, so tier 1 can be distinguished
  from tier 3. The detection lives in a dedicated `isElementNameExplicitlySet`
  helper and uses `!== undefined` (rather than `!= null`) to remain robust
  against formatter rewrites that turn loose null checks into strict ones.

- 6b19404: Migrate build tooling from tsup to tsdown (powered by Rolldown).
  Upgrade TypeScript to 6.0.
  Update dev dependencies.

## 2.2.0

### Minor Changes

- c4f2ffd: Implement `form` namespace qualification for `@XmlElement`, `@XmlAttribute`, and `@XmlArray`.

  The `form` option (`"qualified"` | `"unqualified"`) now has runtime effect, matching the XSD `form` attribute semantics:

  - **`"qualified"`** — the element or attribute is serialized with its namespace prefix (e.g. `<ns:city>`).
  - **`"unqualified"`** — the prefix is suppressed even when a namespace is configured (e.g. `<city>`), matching local elements in schemas with `elementFormDefault="unqualified"`.
  - **default (undefined)** — existing behaviour is preserved: prefix applied when present for `@XmlElement`/`@XmlAttribute`; no prefix on `@XmlArray` containers.

  **Changes in `@cerios/xml-poto`:**

  - `XmlNamespaceUtil.buildElementName()` — respects `form` when building the prefixed element name. Cache key now includes `form` to avoid cross-contamination.
  - `XmlNamespaceUtil.buildAttributeName()` — same logic; parameter type extended to accept `form?`.
  - `XmlMappingUtil.serializeArrayValue()` — container element name is now prefixed when `form === "qualified"` and a namespace prefix is configured.
  - `XmlMappingUtil.buildXmlToPropertyMap()` — also registers the prefixed container name in the deserialization lookup map for `"qualified"` arrays, enabling round-trips.
  - `XmlArrayOptions` and `XmlArrayMetadata` — `form` option added (was already present on `XmlElementOptions`/`XmlAttributeOptions`).

  **Changes in `@cerios/xml-poto-codegen`:**

  - `buildArrayDecorator()` — now emits `form: '...'` in generated `@XmlArray` decorators, consistent with `@XmlElement` and `@XmlAttribute`.

## 2.1.3

### Patch Changes

- be741c9: Fix handling of empty elements for typed complex optional fields

  **`fromXml`**: An empty element (`<tag/>` or `<tag></tag>`) mapped to a field decorated with `@XmlElement({ type: SomeClass })` now correctly deserializes into a new instance of `SomeClass` with default values, instead of returning an empty string `""`.

  **`toXml`**: A typed complex optional field (`field?: SomeClass`) whose value is `undefined` is now omitted from the output entirely, instead of emitting an empty self-closing element (`<tag/>`).

## 2.1.2

### Patch Changes

- 0e1a3ee: Enforce @XmlArray for list properties — strict validation error when using @XmlElement for arrays

  **Breaking (strict mode):** When `strictValidation` is enabled, using `@XmlElement` on a property that receives multiple XML elements (producing an array) now throws a `[Strict Validation Error]`. The error message includes the property name, the XML element name, and a concrete fix suggesting `@XmlArray({ itemName: '...', type: YourItemClass })`.

  - `@XmlElement` no longer auto-deserializes repeated XML elements into typed array items. Arrays pass through as plain objects unless `@XmlArray` is used.
  - The error is thrown for any `@XmlElement` property receiving an array, even when a `type` is specified.
  - Mixed content arrays (`mixedContent: true`) are excluded from this validation and continue to work as before.
  - Without `strictValidation`, `@XmlElement` arrays still work but items are not typed — no error is thrown.

## 2.1.1

### Patch Changes

- c6a2644: Fixed deserialization of classes with only `@XmlAttribute` and `@XmlText` decorators (no class-level `@XmlRoot`/`@XmlElement`) when used as nested types. Previously, `JSON.stringify` on deserialized instances produced internal parser keys (`@_`, `#text`) instead of the actual property names. Classes with these decorators are now registered for auto-discovery, and a metadata-based fallback resolves them when name-based discovery fails. Also fixed premature CDATA extraction that discarded attribute data when both `@XmlAttribute` and `@XmlText({ useCDATA: true })` were present on the same class.

## 2.1.0

### Minor Changes

- 5769a0c: Add cross-decorator child serialization ordering support and document it.

  ### What changed
  - Added `order?: number` to `@XmlArray` and `@XmlDynamic` options and metadata.
  - Kept `@XmlElement` ordering and implemented serializer-side ordering so it is now actually applied at runtime.
  - Child serialization order now resolves across `@XmlElement`, `@XmlArray`, and `@XmlDynamic` together.
  - Sorting behavior:
    - Lower `order` values serialize first.
    - Unordered properties serialize after ordered properties.
    - Ties preserve stable existing property order.

  ### Documentation
  - Updated array docs with `order` option and example.
  - Updated bi-directional XML docs with `@XmlDynamic({ order })` usage.
  - Updated elements/attributes docs with cross-decorator ordering notes.

  ### Why this matters

  Previously `order` existed in element metadata but did not affect output ordering. This change makes ordering deterministic and consistent across the three child-producing decorators.

## 2.0.0

### Major Changes

- 045a46b: **Switched linting toolchain from Biome to oxlint and removed deprecations**

  - Replaced Biome with oxlint across the project.
  - Updated linting configuration.
  - Refactored internal modules to reduce complexity.

- 5543478: **Enhanced `@XmlComment` with required `targetProperty` and multi-line support**
  - Improved `@XmlComment` with better positioning control.
  - Added support for multi-line comments.
  - `targetProperty` is now required, where previously it was optional.

### Breaking Changes

- `@XmlComment` now requires `targetProperty`, where previously it was optional.
- Removed deprecated options, aliases, and properties:
  - `XmlRootOptions.elementName` (use `name`)
  - `XmlArrayOptions.name` (use `containerName`)
  - `XmlArrayOptions.elementName` (use `itemName`)
  - `XmlArrayItemOptions` (use `XmlArrayOptions`)
  - `ReadonlyXmlArrayItemOptions` (use `ReadonlyXmlArrayOptions`)
  - `XmlQueryableOptions` and `ReadonlyXmlQueryableOptions` (use `XmlDynamicOptions` / `ReadonlyXmlDynamicOptions`)
  - `XmlArrayItem` decorator alias (use `XmlArray`)
  - `XmlQueryable` decorator alias (use `XmlDynamic`)
  - `QueryableElement` class alias (use `DynamicElement`)
  - `XmlNamespace.isDefault` (omit `prefix` to use default namespace)

## 1.5.5

### Patch Changes

- 6d7b2f8: Fix duplicate element name conflicts and strict validation behavior

  ## What Changed

  ### Strict Validation Fix
  - Fixed strict validation mode to properly reject unmapped XML elements instead of falling back to auto-discovery
  - In strict mode, elements must now be explicitly declared in the model to be considered valid
  - Auto-discovery is now only used for elements that have explicit field mappings in the model

  ### Breaking Change Behavior
  - When `strictValidation: true` is enabled, the deserializer will now correctly throw an error for:
    - Unexpected XML elements that don't match any declared field (even if a class exists in the global registry)
    - Missing expected elements when field names don't match the XML structure

## 1.5.4

### Patch Changes

- 824b657: Fix registry conflicts when multiple classes use the same @XmlElement name

  **Problem:** When two different classes were decorated with the same `@XmlElement` name (e.g., `@XmlElement("security")`), they would compete for the same global registry entry. Whichever class was imported last would overwrite the first, causing deserialization to use the wrong class.

  **Solution:** Implemented a context-aware element registration system that:

  - Tracks elements within their parent class context when explicit types are provided
  - Prevents registry collisions between classes with identical element names
  - Maintains full backward compatibility with existing code
  - Preserves auto-discovery functionality for classes without explicit types

  **Impact:** Multiple classes can now safely use the same element name in different contexts without conflicts. All existing tests pass (1481/1481).

## 1.5.3

### Patch Changes

- 1ef6e0b: Ensures attribute and field element metadata is registered at class definition time for classes decorated with @xmlelement (not just @xmlRoot). Previously, metadata registration could be delayed until instance creation, causing validation and serialization issues.

  Processes pending attribute and field element metadata from decorator context and registers them immediately when the class decorator executes. This guarantees metadata availability before any instances are created.

  Additionally improves error messaging by adding guidance about avoiding circular dependencies when reusing namespace constants across multiple files.

## 1.5.2

### Patch Changes

- bfc1708: Enhances the auto-discovery mechanism for XML deserialization by introducing a constructor name registry and lookup caching to improve performance and reliability.

  Adds a new constructor registry that maps class names to their constructors, enabling auto-discovery of undecorated classes when property names match class names. This complements the existing element name registry.

  Implements caching for element class lookups to avoid repeated registry searches. Cache is automatically cleared when new classes are registered to maintain consistency.

  Consolidates the auto-discovery logic into a single method with multiple fallback strategies, including namespace-aware lookups, dotted name handling, naming convention variants, and constructor name matching.

  Registers class constructors automatically during decorator application, ensuring all decorated classes are discoverable without manual registration.

  Updates strict validation error messages to clarify that decorators are required for all properties that should be deserialized, as TypeScript type annotations alone are insufficient.

## 1.5.1

### Patch Changes

- b51db6b: Excludes properties decorated with @XmlDynamic from strict validation checks since they intentionally contain plain objects with dynamic content. Also skips validation for unmapped XML elements on classes using @XmlDynamic, allowing XBRL-style dynamic content to work correctly without throwing false positive validation errors.

## 1.5.0

### Minor Changes

- f33cf70: ### Auto-Discovery
  Classes with @XmlElement decorator are automatically discovered and instantiated during deserialization without explicit type parameters or property initialization.

  Features:

  - Namespace-aware lookup (strips prefixes like ns:element)
  - Dotted name handling (sender.identifier → identifier)
  - Naming convention variants (camelCase, PascalCase, special char removal)
  - Property name hints for edge cases

## 1.4.0

### Minor Changes

- cc6b306: Add extra field validation in strict mode. When `strictValidation: true` is enabled, the library now validates that all XML elements are defined in the class model, throwing detailed errors for unmapped fields. This validation is automatically skipped for classes with `@XmlDynamic` decorators or `mixedContent` fields, allowing flexible schemas where needed. This helps catch typos, API changes, and schema mismatches early in development while maintaining backward compatibility.

## 1.3.1

### Patch Changes

- ab7287c: Performance improvements: Replaced Object.keys/entries/values with for-in/for-of loops throughout hot paths to eliminate intermediate array allocations. Optimized metadata destructuring and reduced duplicate lookups in serialization/deserialization.

## 1.3.0

### Minor Changes

- fc4b289: **Added support for multiple namespace declarations on XML elements.**

  - You can now declare multiple namespaces on a single element using the new `namespaces` array property, while maintaining backward compatibility with the existing `namespace` property.
  - Enables XBRL-style documents and other complex XML structures where the root element declares all namespaces upfront, reducing redundant namespace declarations throughout the document tree.
  - All decorator interfaces (`XmlRoot`, `XmlElement`, `XmlAttribute`, `XmlArray`) and metadata structures now support the `namespaces` array pattern.
  - Comprehensive documentation and examples for multi-namespace scenarios, nested element patterns, and XBRL use cases have been added.

  **Improved XML namespace handling for nested elements.**

  - Nested elements now declare their own namespaces, matching C# XmlSerializer behavior.
  - Namespace context is propagated to child properties that don’t have explicit namespace declarations, ensuring proper inheritance.
  - Namespace collection is optimized to avoid redundant declarations from deeply nested objects.
  - Added support for namespace declarations on nested element content, allowing correct scoping of namespace prefixes throughout the XML document.

## 1.2.0

### Minor Changes

- e4a2c63: Performance Improvements:

  - 3x faster serialization/deserialization via optimized metadata lookups and caching
  - Removed public metadata getter functions (use direct getMetadata() instead)
  - Cached namespace collections and element/attribute name building
  - Refactored to flatMap for cleaner array operations

  Features:

  - Transform functions and class conversion methods
  - Automated release workflow with GitHub Actions + npm provenance

  Cleanup:

  - Removed manual initializeDynamicProperty functions (no longer needed)
  - Simplified namespace handling in DynamicElement
  - Migrated tests from Jest to Vitest

## 1.1.1

### Patch Changes

- 555c6d7: Added XPath 1.0 features support. Fixed field initialization overwriting decorator properties

## 1.1.0

### Minor Changes

- 8988e48: Lazy Loading Control for XmlDynamic: Added lazy loading control for the XmlDynamic decorator, providing better performance and flexibility in XML handling. XmlRoot Property Rename: Renamed elementName property to name in XmlRoot for improved clarity and consistency. QueryableElement Refactor: Renamed QueryableElement to DynamicElement throughout the codebase for better semantic meaning

## 1.0.4

### Patch Changes

- 605e4e9: Renamed @XmlArrayItem decorator to @XmlArray for better clarity and consistency. The old @XmlArrayItem decorator is now deprecated but still functional for backward compatibility. Added support for undecorated classes within @XmlArray elements. Arrays can now contain plain classes without requiring decorators on every element.

## 1.0.3

### Patch Changes

- 101fbab: Added

  - Support for XML mapping of undecorated classes
  - Strict validation for nested object instantiation

  Fixed:

  - Circular reference detection logic refactored and improved
  - Issue with reusing instances resulting in empty elements after first use
  - Query initialization bugs
  - Nested queryables handling

  Changed:

  - Enhanced circular reference detection in XML mappingPlease enter a summary for your changes.
  - An empty message aborts the editor.

## 1.0.2

### Patch Changes

- d8a57cc: bugfix for XmlQueryable undefined when not using targetName

## 1.0.1

### Patch Changes

- c9f0883: **Performance & IntelliSense Optimization**

  This release significantly improves TypeScript IntelliSense performance and runtime efficiency through metadata storage consolidation:

  **Core Improvements:**

  - **Unified Metadata Storage**: Consolidated 9+ separate WeakMaps into a single `ClassMetadata` structure, reducing metadata lookups from multiple operations to just one per class
  - **Type-Safe Storage**: Introduced `TypedMetadataStorage<K, V>` wrapper for better type inference and IntelliSense autocomplete
  - **Symbol-Based Lazy Loading**: Enhanced `@XmlDynamic` to use `Symbol.for()` keys for cache and builder storage, preventing property collisions and improving memory efficiency
  - **Optimized Type Exports**: Reorganized type exports with explicit `type` imports/exports for faster TypeScript compilation
  - **Better Type Hints**: Added `Constructor<T>` type helper and `DeepReadonly<T>` utility for improved type safety and IntelliSense suggestions

  **Technical Details:**

  - Decorator metadata registration now uses centralized helper functions (`registerAttributeMetadata`, `registerFieldElementMetadata`, etc.)
  - Metadata getters optimized with single-lookup strategy using `getMetadata()` and `hasMetadata()` checks
  - Removed legacy constructor property fallback patterns (`__xmlAttributes`, `__xmlPropertyMappings`, etc.)
  - Enhanced `fromXml()` and `toXml()` method signatures with `const` generics for better type inference

  **Developer Experience:**

  - Faster IntelliSense autocomplete in editors
  - Reduced memory footprint for classes with many decorators
  - Improved type narrowing and inference in serializer methods
  - More predictable property access patterns in decorated classes

  This is a patch release focused on internal optimizations with no breaking changes to the public API.

## 1.0.0

### Major Changes

- f437574: This release represents a stable, feature-complete API suitable for production use in REST APIs, configuration files, SOAP services, RSS/Atom feeds, and any TypeScript project requiring robust XML handling.

## 0.1.0

### Minor Changes

- dc64eab: Initial implementation of XML serialization library

  Complete TypeScript 5+ decorator-based framework with bidirectional XML-object mapping, namespace support, validation, custom converters, and flexible array handling. Includes comprehensive documentation.
