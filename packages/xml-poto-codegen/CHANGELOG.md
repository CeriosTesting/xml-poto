# @cerios/xml-poto-codegen

## 2.3.0

### Minor Changes

- 426f84e: Name an anonymous inline complexType after the type that declares it when its own
  name is taken, and mark it anonymous.

  `<element name="Foo">` with an inline complexType wants the class name `FooType`,
  which collides with the named complexType `FooType` under the convention most
  schemas follow. The loser used to become `FooType2`, a name that says nothing about
  which of the two it is. It is now named after where it was declared —
  `TijdvakCorrectieCollectieveAangifte` rather than `CollectieveAangifteType2` — and
  the coverage note explains the anonymous case in its own terms. Only names that
  actually collide change; an inline type with its preferred name free keeps it, as
  does a collision between two _named_ types, which has no declaring type to borrow.

  Inline complexTypes are now emitted as `@XmlType({ anonymous: true })`, so they no
  longer claim a schema type identity the XSD never declared. This requires
  `@cerios/xml-poto` 2.6.0 or later.

## 2.2.0

### Minor Changes

- b80042f: Generate WSDL operations, and stop dropping the XSD constructs that used to be flattened.

  Every item below changes generated output where the schema uses the construct, so regenerate and
  review the diff. Requires the `@cerios/xml-poto` release alongside this one.

  **WSDL operations.** `<message>`, `<portType>` and `<binding>` were discarded, so the
  `SoapSerializer` had no idea what `soapAction` to send or which class a response was. A WSDL
  source now also emits an `operations.ts`:

  ```typescript
  export const CompetentPortOperations = {
  	stelGbavVraag: {
  		soapAction: "stelGbavVraag",
  		input: GbavVraag,
  		output: GbavAntwoord,
  		faults: { gbavException: GbavFout },
  	},
  } as const;
  ```

  Data, not a client: it composes with any transport, and `faults` is keyed to drop straight into
  `SoapSerializer`'s `faultDetailTypes`. It stays out of the barrel `index.ts` it imports from, so
  import it directly. RPC-style, SOAP-encoded and multi-part operations are reported in the
  coverage notes and skipped rather than half-generated; `<service>` ports are ignored, since an
  endpoint URL is deployment configuration rather than schema.

  **Repeating compositors keep document order.** `<xs:choice maxOccurs="unbounded">` resolved to
  one single-valued member per branch — so a document reading `note task note` came back as
  `note: [a, b], task: [c]` and wrote out as `note note task`. Such a compositor now generates one
  `@XmlArray({ items })` collection that round-trips the order. `xs:sequence` did not parse its
  occurs attributes at all, and a repeating `<xs:group ref maxOccurs="unbounded"/>` — where the
  _reference_ carries the occurs rather than the group's own compositor — was missed entirely;
  both are handled now. **This is the output change most likely to need follow-up in consuming
  code** — several members become one.

  The collection is only generated when a written value can say which element it came from: its
  class for a complex alternative, the JavaScript type its `dataType` implies for a scalar one. Two
  alternatives sharing either — a `key`/`value` pair of strings, say — would round-trip to the
  wrong element names, so those keep their individual members and the limitation is reported in the
  coverage notes.

  **`mixed="true"` complex types keep their text.** `mixed` was resolved and then never emitted, so
  interleaved text was lost; `mixed` declared on `complexContent` never even reached the model.
  Such a type now gets an `@XmlText({ mixed: true })` member beside its typed ones.

  **`substitutionGroup` heads are typed.** The head generated as an untyped `DynamicElement`. It
  now becomes `@XmlArray({ items })` over the head and its substitutes, each with its own class, so
  the members are reachable with types instead of queries. An `abstract="true"` head is excluded
  from the alternatives, since it cannot appear in a document. Falls back to `DynamicElement` when
  a member's type cannot be resolved.

  **`xs:any` inside `xs:choice`.** A wildcard declared as a choice branch was dropped silently —
  `XsdChoice` had no field for it. It now generates the same `@XmlDynamic()` member a wildcard in a
  sequence does.

  **Inline `xs:union` / `xs:list` member types.** Only the `memberTypes` and `itemType` _attributes_
  were read, so the equally common nested form — `<xs:union><xs:simpleType>…` — collapsed to
  `string`. Both forms now resolve, and may be combined. A union whose members are all enumerated
  carries the combined vocabulary as `enumValues`.

  **List-valued built-ins.** `xs:IDREFS`, `xs:NMTOKENS` and `xs:ENTITIES` fell through to `string`,
  losing their list semantics; they now generate as `string[]` with the `list` option.
  `xs:ENTITY` and `xs:NOTATION` were also missing from the type map.

  **Unresolvable references are reported, and no longer generate code that will not compile.** A
  reference the schema does not define — routinely because an `xs:import` points at a remote
  `schemaLocation` the generator does not fetch — was swallowed without a word:

  | Reference                            | Was                                                         | Now                                       |
  | ------------------------------------ | ----------------------------------------------------------- | ----------------------------------------- |
  | `<xs:extension base="Missing">`      | `class R extends Missing` — **the module does not compile** | `extends` dropped, members kept, reported |
  | `<xs:group ref="Missing"/>`          | every element it carries silently vanished                  | reported                                  |
  | `<xs:attributeGroup ref="Missing"/>` | every attribute silently vanished                           | reported                                  |
  | `type="tns:Missing"`                 | silently became `string`                                    | reported                                  |
  | `<xs:element ref="Missing"/>`        | silently became `string`                                    | reported                                  |

  Generation still succeeds in every case — an unfetched import is a normal situation, not a
  failure — but the coverage notes now say what was lost and why.

- b80042f: Generate polymorphism decorators, flatten complexContent restrictions, and preserve per-type namespaces.

  - **Polymorphism from XSD inheritance.** An `xs:complexType abstract="true"` now generates an `abstract class`, and (in single-file / `per-xsd` mode) a base type emits `@XmlInclude(() => Derived)` for each subtype so `xsi:type` resolves to the concrete class at runtime. In `per-type` mode subtypes instead self-register their `@XmlType` identity when the barrel is loaded (emitting `@XmlInclude` there would create an import cycle whose eager `extends` hits the base's temporal dead zone).
  - **complexContent restriction narrowing.** A `<xs:restriction>` of a complex type is now generated as a flattened standalone class containing exactly the restricted members, instead of `extends Base` plus re-declared members. This fixes derived types wrongly re-inheriting members the restriction dropped. **Output change:** restriction-derived classes no longer carry an `extends` clause.
  - **Multi-target-namespace fidelity.** Types imported via `xs:import` of a _different_ target namespace now keep their own namespace (and element/attribute form) on the generated `@XmlType`/`@XmlElement`, instead of adopting the importing schema's namespace.
  - Enum tokens that are not valid identifiers (e.g. `US-EN`, `1`) already round-trip losslessly in all enum styles — the generated member value is the exact token — so no `@XmlEnum` remapping is emitted; a round-trip regression test locks this in.

  Requires `@cerios/xml-poto` with the `XmlInclude` decorator.

- b80042f: Resolve `ref="…"` declarations, keep colliding type names apart, and stop generating code that
  does not compile.

  A pre-release audit found five constructs that generated silently wrong output. Each fix changes
  generated code, so regenerate and review the diff.

  **`xs:element ref="…"` resolves to the element it names.** Only the _name_ was taken from a
  reference; the type was then looked for on the reference itself, found nothing, and fell back to
  `string`. Every element declared by reference — pervasive in WSDL-adjacent schemas — generated as
  a bare `string`, losing its complex type, its facets and its nillability. References now draw
  type, facets, `nillable` and `default` from the global declaration, keeping only the occurrence
  constraints from the reference itself. A reference to a global element carrying an _inline_
  complexType reuses the class already generated for it rather than minting a duplicate.

  **Referenced elements are namespace-qualified.** A global element declaration is always
  qualified; `elementFormDefault` governs local declarations only. References previously inherited
  the local-element form, so in an unqualified schema they were written without their namespace.

  **`xs:attribute ref="…"` resolves too.** It hardcoded `string`, dropped all facets, and dropped
  the reference's prefix — so the near-universal `ref="xml:lang"` produced a bare local `lang` in
  the wrong namespace. Prefixes now resolve through the schema's bindings, including the `xml`
  prefix that the XML spec binds implicitly and no schema declares. (Top-level `xs:attribute`
  declarations were not parsed at all before; they are now.)

  **Two distinct types no longer collapse onto one class.** Class names were assigned from the
  local name alone, and the second claimant was dropped. Two namespaces merged from one WSDL that
  each define `Header`, or two elements in different parents that each carry an inline complexType
  of the same name, produced a single class — and every reference to the second silently got the
  first one's content model. This is not hypothetical: in the UPA 2026 schema, the element
  `CollectieveAangifte` (inline, one member) was typed with `CollectieveAangifteType` (two
  members), advertising a member the schema forbids there. Colliding names are now suffixed
  (`CollectieveAangifteType2`) and reported in the coverage notes. An `xs:redefine` pair is exempt,
  since its shared name is deliberate.

  **Abstract types are never instantiated.** A member typed by an `abstract="true"` complexType was
  initialized with `new AbstractType()`, which `tsc` rejects — generated code that did not compile.
  Such members now use a definite-assignment assertion, the same mechanism already used for
  enum-typed members.

  **`xs:pattern` is translated rather than passed through.** XSD's name-character escapes (`\i`,
  `\I`, `\c`, `\C`) are expanded to their JavaScript equivalents. Patterns using syntax JavaScript
  cannot express — character-class subtraction (`[a-z-[aeiou]]`) and Unicode block escapes
  (`\p{IsBasicLatin}`) — are dropped with a coverage note instead of being emitted verbatim:
  generated code passes the source to `new RegExp` while the decorator is being applied, so an
  untranslatable pattern threw on _import_ of the module, taking down code that never touched the
  type. Patterns are matched against the whole value by the runtime, per `xs:pattern` semantics —
  this requires `@cerios/xml-poto` with that fix.

  **Mutually referencing schemas no longer overflow the stack.** `xs:include`/`xs:import` recursion
  had no visited set, so two schemas that reference each other — legal, and common — recursed until
  the stack ran out, and a diamond merged the shared schema twice.

  Also: string literals in generated code (enumeration tokens, default values) are escaped through
  `JSON.stringify`, so a value containing a newline or a quote can no longer break the literal.

- b80042f: Add `requiredPropertyStyle` to control how required properties are declared.

  A required member is generated either with a default initializer (`nummer: string = ''`) or with a definite-assignment assertion (`str!: string`). Until now the choice was made per property and followed the schema: the initializer was kept unless the property's own facets rejected it, since a `''` under `minLength="1"` cannot serialize and only turns a missing assignment into a runtime facet error. That means a schema declaring elements against raw built-ins and one restricting them generate differently, which is surprising when both describe the same service.

  The new option forces one uniform shape:

  - `'schema'` — **default**, today's facet-aware behaviour, so existing output is unchanged
  - `'definite'` — always `!`
  - `'initialized'` — always an initializer where one is possible

  Settable globally or per source, like the other generation options. Enum-typed and abstract-typed members still take `!` under every style: neither has an assignable initializer.

- b80042f: Follow `wsdl:import`, and stop dropping `xs:anyAttribute` outside a bare `complexType`.

  Both change generated output where the schema uses the construct, so regenerate and review the diff.

  **A WSDL split across files no longer loses its imported half.** Only the `<definitions>` element
  handed to the parser was read: `<wsdl:import location="…"/>` was never looked at. The routine split —
  `service.wsdl` holding `<service>` and `<binding>` while importing an `interface.wsdl` that holds
  `<types>`, `<message>` and `<portType>` — therefore generated either no operations or no types,
  depending on which half the CLI was pointed at. Every reachable file now contributes:

  - Bindings are collected across all files before any portType is walked, so an imported operation
    still gets the `soapAction` from the `<binding>` in the file that imported it.
  - Each file resolves its own `xs:import`/`xs:include` locations against its own directory, so an
    imported WSDL elsewhere on disk finds its schemas.
  - Mutual imports terminate and a file reached twice contributes once.
  - A `wsdl:import` may name a bare `.xsd`, which WSDL 1.1 allows; it merges like an `xs:import` and
    keeps its own target namespace and element form.
  - Remote `http(s)` locations are reported and skipped, matching `xs:import`.

  A single-file WSDL generates exactly as before.

  **`xs:anyAttribute` is honoured everywhere it is legal.** The wildcard was only read directly off
  `<xs:complexType>`. Declared on a `complexContent` extension or restriction, on a `simpleContent`
  extension or restriction, or on an `attributeGroup` definition, it was parsed into nothing and the
  class came out with no member for it. All of those now produce the `@XmlDynamic() anyAttributes`
  member, including a wildcard reached through any depth of `attributeGroup` references. A type that
  names the wildcard more than once — directly _and_ through a group — still gets exactly one member.

  Found while fixing the above, and fixed with it: an `xs:attributeGroup ref` inside a `simpleContent`
  extension or restriction was not parsed at all, so every attribute it contributed was silently
  missing from the class. A WSDL `<documentation>` written as plain text (rather than carrying an
  `xml:lang` attribute) was likewise dropped, leaving the JSDoc off the generated operation.

- b80042f: Generate `@XmlType` for XSD complex types instead of a class-level `@XmlElement`.

  A named `xs:complexType` is a type definition, not a global element declaration, so it now receives `@XmlType` (type identity: name + namespace + form). Global/root elements continue to receive `@XmlRoot`. Combined with the serializer's namespace dedup and property/class reconciliation, this removes the redundant per-object namespace re-declarations and unqualified-wrapper shapes seen in generated output (issue #96).

  The `useXmlRoot: false` flat mode is unchanged: it still emits class-level `@XmlElement` everywhere.

  This release requires `@cerios/xml-poto` `^2.5.0` (generated code imports the new `XmlType` decorator).

- b80042f: Honour `elementFormDefault` when writing, and resolve elements by namespace URI when reading.

  Round-tripping a real JAX-WS WSDL (GBAV) through codegen and `XmlDecoratorSerializer` produced XML the owning service would reject, and the generated classes could not read back either their own output or a realistic response.

  **`@XmlType` no longer qualifies local elements.** `@XmlType` declares a class's _schema type_ identity; whether a member element is namespace-qualified is decided by the schema's `elementFormDefault` (which defaults to `unqualified`) or the member's own `form`, not by the namespace of the type containing it. Previously a class-level `@XmlType` namespace was inherited by every child element that declared none, so a schema with no `elementFormDefault` emitted `<tns:indicatie>` where .NET's `XmlSerializer` emits `<indicatie>`. Qualification is now opt-in via `form: 'qualified'` on the member — exactly what the codegen emits for an `elementFormDefault="qualified"` schema. A class-level `@XmlElement` still propagates its namespace to unqualified children, since that decorator does declare an element identity (SOAP `Envelope`/`Body` shapes are unaffected).

  This also fixes qualification being _inconsistent_ within one document: array item names and root-class primitives escaped the old fallback while complexType-typed members did not, so a single response mixed `<tns:categorieen>`, `<categorie>`, `<tns:nummer>` and `<adresVraag>`.

  **Deserialization matches on `{namespace-uri, local-name}`.** Element lookup previously compared the literal prefixed string, so `<gbavAntwoord xmlns="…">` or `<ns2:gbavAntwoord xmlns:ns2="…">` — what a JAX-WS peer routinely sends — failed with "Root element tns:gbavAntwoord not found in XML" even though they denote the same element. Prefix bindings are now tracked down the document and resolved to URIs for the root element, required-element checks, child elements and array items alike. An element in a genuinely different namespace is still rejected.

  **Single-item arrays stay arrays.** An unwrapped `@XmlArray` whose item tag was namespace-prefixed was looked up by its bare name on the read path; the lookup missed and the element fell through to the scalar path, so one item deserialized to a bare object instead of a one-element array — silently the wrong shape rather than an error. One `persoon`/`categorie`/`rubriek` is ordinary data, so this hit real payloads.

  **New `elementForm` codegen option** (`'schema' | 'qualified' | 'unqualified'`, default `'schema'`). `'schema'` honours the XSD and keeps existing generation byte-identical; the others force the choice, as an escape hatch for a service whose WSDL disagrees with what it puts on the wire. Available globally and per source.

  **Generated class-level decorators are indented correctly.** Multi-line `@XmlRoot`/`@XmlType`/`@XmlElement` on a class were indented as if they sat on a property.

  Serialized output changes for `@XmlType`-namespaced classes whose members declare no `form`: their local elements are now unqualified. Add `form: 'qualified'` to those members (or generate with `elementForm: 'qualified'`) to keep the previous shape.

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

- b80042f: Fix choice branches, named-enum vocabularies, and numeric types whose lexical form carries meaning.

  Auditing a real production schema (the Dutch UPA 2026 pension declaration — 63 simpleTypes, 17 complexTypes, unprefixed XSD declarations, `elementFormDefault="qualified"` with `attributeFormDefault="unqualified"`) surfaced three defects that no existing fixture reached. Two made schema-valid documents unreadable or silently corrupted.

  **A `<choice>` of `<sequence>` branches no longer marks its members required.** A choice offers alternatives, so a document taking one branch contains none of the others. Members of a `<sequence>` branch were nevertheless generated `required: true`, and a perfectly valid document taking a different branch failed to deserialize with `Required element 'X' is missing`. Members of a choice's _direct_ elements were already handled; only branch members were missed. Exclusivity **between** branches remains unmodelled — expressing "these are required together iff this branch is taken" needs branch-level groups — so this relaxes `required` without adding a `choiceGroup`.

  **Named enum simpleTypes now carry their vocabulary.** A named `<simpleType>` with `<enumeration>` members generated a string-union type but emitted no `enumValues`, so the runtime had nothing to validate against:

  ```xml
  <CdAard>99</CdAard>   <!-- accepted: 99 is not one of the 14 allowed codes -->
  <CdAard>11</CdAard>   <!-- returned the NUMBER 11, outside its own "1"|"4"|…|"11" union -->
  ```

  Anonymous enumerations already emitted `enumValues`, so the two spellings of the same concept disagreed. Named ones now emit it too — the generated union type is unchanged; the decorator simply gains the tokens. This makes the enumeration enforced and lets the existing lexical-form restoration return `"11"` rather than `11`.

  **A numeric type constrained by a `pattern` is generated as `string`.** A pattern constrains the _lexical_ space, which is how a schema expresses "nine digits, leading zero permitted". A Dutch BSN declared `xs:nonNegativeInteger` with a 9-digit pattern read `012345678` back as `12345678` and re-serialized it as `"12345678"` — a different, invalid identifier. The pattern could not catch it either, since pattern facets only apply to strings. Such members now generate `string` with no `dataType`, preserving the value and making the pattern enforceable. Numeric types without a pattern are unaffected.

  **New `bigIntegerAs` option** (`'number' | 'string'`, default `'number'`). `xs:integer` is arbitrary-precision and `xs:long` reaches 9223372036854775807, both beyond `Number.MAX_SAFE_INTEGER` — `9007199254740993` silently becomes `…992`. Setting `'string'` generates integer types as `string` when their `totalDigits` is absent or exceeds 15; types bounded within the safe range stay `number` either way. Available globally and per source, alongside `elementForm`.

  Generated output changes for three shapes, all TypeScript-visible at compile time:

  | shape                                | before           | after               |
  | ------------------------------------ | ---------------- | ------------------- |
  | member of a choice's sequence branch | `x: T = new T()` | `x?: T`             |
  | member typed by a named enum         | no `enumValues`  | `enumValues: [...]` |
  | numeric member with a `pattern`      | `x?: number`     | `x?: string`        |

  Regenerate from your schemas to pick these up. The third is the one to look at: a member that was `number` becomes `string`, which `tsc` will point at.

## 2.1.0

### Minor Changes

- d9a3cce: Generate classes in dependency order so the output always compiles (fixes broken `per-xsd` output for XSDs that declare types before their dependencies, e.g. alphabetically ordered schemas):

  - **Topological sorting**: classes are now emitted dependency-first (based on `extends` bases and decorator `type:` references), with a stable order — schemas already in a valid order produce unchanged output, and independent types keep their XSD document order. Previously classes were emitted in raw document order, producing `class X used before its declaration` compile errors and runtime TDZ crashes.
  - **Circular and self references** (which no ordering can satisfy) are emitted as lazy `() => Foo` thunks in both output styles. This requires `@cerios/xml-poto` >= the release adding `TypeRef` support (published together with this change).
  - **`per-type` mode**: classes linked by an `extends` edge inside a reference cycle are now merged into one file (named after the base class), because a cyclic `extends` split across ES modules always leaves an import order that fails. All other classes keep one file each; the barrel re-exports everything as before.
  - **`xs:redefine`**: a type deriving from itself (the redefine pattern; redefines are merged like includes) no longer generates `class X extends X` — the extends clause is dropped with a coverage note.

  Also fixes two further compile errors surfaced by the same schemas:

  - Required properties typed by a named enum no longer get a mis-typed base-type initializer (`status: StatusType = ''`); they are emitted with a definite-assignment assertion (`status!: StatusType`).
  - The same element appearing in multiple `xs:choice` branches no longer generates duplicate class properties; occurrences are merged into one property that is optional unless required in every branch.

- d9a3cce: WSDL support and complete XSD rule coverage in generated classes:

  - **WSDL input**: files with a `<definitions>` root (SOAP/WSDL) are now detected automatically; all XSD schemas embedded in the WSDL `<types>` section are extracted and merged, inheriting `xmlns` declarations from the `<definitions>` root. This fixes "No XSD schema root element found" for `.xsd`/`.wsdl` files that are actually WSDL documents.
  - **Facets are now emitted and enforced**: `length`, `minLength`, `maxLength`, `minInclusive`, `maxInclusive`, `minExclusive`, `maxExclusive`, `totalDigits`, `fractionDigits`, `whiteSpace`, `pattern` (now also on elements and simpleContent, with multiple `xs:pattern` facets ORed together), and `fixed` values — all mapped to the corresponding `@cerios/xml-poto` decorator options instead of a "not enforced" warning.
  - **`xs:list`**: generated as `list` options (with typed items), including facets from the list's `itemType`.
  - **`xs:choice`**: direct choice members now share a generated `choiceGroup` (with `choiceRequired` per the choice's `minOccurs`), enforced at runtime by xml-poto.
  - **Bounded `maxOccurs`**: finite occurs bounds are emitted as `minOccurs`/`maxOccurs` on `@XmlArray`.
  - **`xs:annotation`/`xs:documentation`** becomes JSDoc on generated classes, properties, and enums.
  - **More XSD constructs**: `complexContent` restriction with `choice`/`all`/group refs, `xs:all` with `minOccurs`/nested choices, `use="prohibited"` attributes omitted, `xs:redefine` merged (with warning), `xs:notation` and identity constraints (`xs:key`/`xs:keyref`/`xs:unique`) parsed and reported as coverage notes, and explicit warnings for remote or missing `schemaLocation` references.

  Requires `@cerios/xml-poto` ≥ the release containing the new validation options.

### Patch Changes

- Updated dependencies [d9a3cce]
- Updated dependencies [d9a3cce]
  - @cerios/xml-poto@2.4.0

## 2.0.1

### Patch Changes

- f9d5028: Updated dependencies. Pinned `vitest` to `4.0.18` and kept `tsdown`/`typescript` on their previous stable versions (`^0.21.10`/`^6.0.3`) after `0.22.4`/`7.0.2` were found to break the build (missing `--config-loader bundle` support and stray `.d.ts` files emitted into `src`).
- Updated dependencies [f9d5028]
  - @cerios/xml-poto@2.3.3

## 2.0.0

### Patch Changes

- Updated dependencies [19532c4]
- Updated dependencies [9acd721]
  - @cerios/xml-poto@2.3.0

## 1.0.1

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

- 6b19404: Migrate build tooling from tsup to tsdown (powered by Rolldown).
  Upgrade TypeScript to 6.0.
  Update dev dependencies.
- Updated dependencies [bd53e3b]
- Updated dependencies [bd53e3b]
- Updated dependencies [6b19404]
  - @cerios/xml-poto@2.2.1

## 1.0.0

### Minor Changes

- c4f2ffd: Add `useXmlRoot` config option to control whether root elements get `@XmlRoot` or `@XmlElement`.

  When an XSD represents a subset of a larger schema, root elements should be embeddable rather than standalone. Setting `useXmlRoot: false` causes all root elements to be generated with `@XmlElement` instead of `@XmlRoot`, including all XSD-derivable options (`form`, `isNullable`, `namespace`).

  - **`useXmlRoot: true`** (default) — root elements get `@XmlRoot`, preserving existing behaviour.
  - **`useXmlRoot: false`** — root elements get `@XmlElement` with full option support. The schema's `elementFormDefault` is propagated as the `form` option on the class-level decorator.

  The option is available both globally (`XmlPotoCodegenConfig.useXmlRoot`) and per source (`XsdSource.useXmlRoot`), with per-source taking precedence.

  **Changes:**

  - `XsdSource` / `XmlPotoCodegenConfig` — new `useXmlRoot?: boolean` option.
  - `ConfigLoader.validateConfig()` — validates `useXmlRoot` as boolean on both levels.
  - `ClassGenerator` — accepts `useXmlRoot` and `elementFormDefault`; when `useXmlRoot` is false, root promotion is skipped and `form` is propagated from the schema.
  - `ResolvedType` — new `form?` field for namespace form qualification.
  - `mapClassDecorator()` — emits `form` and `isNullable` on the `@XmlElement` class-level path.

### Patch Changes

- c4f2ffd: Fix `XsdParser` throwing a cryptic tag-mismatch error when the input is not a valid XSD schema (e.g. an HTML page downloaded from a repository browser instead of the raw file).

  **Changes:**

  - `XsdParser.parseString()` now validates up front that the content has a schema root element (`<xs:schema>`, `<xsd:schema>`, `<schema>`, or any namespace-prefixed variant). Invalid input throws a clear, actionable error message instead of a cryptic internal parser error.
  - XML declarations (`<?xml ... ?>`) and XML comments before the root element are stripped before parsing, so schemas with leading comments are now handled correctly.
  - Include/import resolution was extracted into a private `resolveExternalSchemas()` method to keep `parseString` within complexity limits.

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

- Updated dependencies [c4f2ffd]
  - @cerios/xml-poto@2.2.0

## 0.1.1

### Patch Changes

- 577551f: Fixed two issues affecting Windows users using a TypeScript config file.

  **Paths with backslashes no longer appear in generated config files**

  When running `xml-poto-codegen init` on Windows, entering paths with backslashes (e.g. `.\schemas\file.xsd`) would write those backslashes directly into the generated config file. The config would look broken in your editor and could cause problems on other operating systems. You no longer need to type forward slashes manually — any path you enter is automatically normalized before being written.

  **`generate` no longer fails with `Unknown file extension ".ts"`**

  After running `init` with a TypeScript config, running `xml-poto-codegen generate` would immediately fail with `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"`, making the TypeScript config format unusable. This is now fixed — `generate` correctly loads `xml-poto-codegen.config.ts` files.

## 0.1.0

### Minor Changes

- 6cce581: Initial commit of `@cerios/xml-poto-codegen`.

  This first version introduces the XML schema to TypeScript generator for `@cerios/xml-poto`, including:

  - CLI commands (`init`, `generate`) for project setup and generation workflows.
  - JSON and TypeScript config support with per-source overrides.
  - Multi-XSD processing with import resolution across schema files.
  - Decorator-aware output for elements, attributes, arrays, text, and dynamic content.
  - Flexible output styles (`per-type` and `per-xsd`) and enum generation modes (`union`, `enum`, `const-object`).
  - Programmatic APIs for integration in build scripts and tooling.
