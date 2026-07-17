---
"@cerios/xml-poto": minor
---

Add lazy type references: the `type` option on `@XmlElement`, `@XmlAttribute`, and `@XmlArray` now accepts a `() => Constructor` thunk (new `TypeRef` type, exported along with `resolveTypeRef`/`isTypeThunk`) in addition to a plain constructor.

Thunks make forward, circular, and self references safe. With standard TC39 decorators, an option object like `{ type: Section }` is evaluated while the referenced class may still be in its temporal dead zone (self-recursive types, mutually referencing types, or classes declared later in the same module) and throws a `ReferenceError`. A thunk (`{ type: () => Section }`) defers the lookup until (de)serialization:

```ts
@XmlElement({ name: "Section" })
class Section {
	@XmlArray({ itemName: "Section", type: () => Section })
	children?: Section[];
}
```

Resolution is lazy with write-back caching, and registry registration (auto-discovery) for thunk-referenced classes is deferred to the first registry lookup. Plain constructor usage is unchanged. `unionTypes` intentionally still takes plain constructors (it is only used for primitive wrapper types).
