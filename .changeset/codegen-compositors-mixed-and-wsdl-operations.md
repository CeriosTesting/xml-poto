---
"@cerios/xml-poto-codegen": minor
---

Generate WSDL operations, and stop dropping the XSD constructs that used to be flattened.

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
