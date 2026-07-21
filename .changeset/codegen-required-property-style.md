---
"@cerios/xml-poto-codegen": minor
---

Add `requiredPropertyStyle` to control how required properties are declared.

A required member is generated either with a default initializer (`nummer: string = ''`) or with a definite-assignment assertion (`str!: string`). Until now the choice was made per property and followed the schema: the initializer was kept unless the property's own facets rejected it, since a `''` under `minLength="1"` cannot serialize and only turns a missing assignment into a runtime facet error. That means a schema declaring elements against raw built-ins and one restricting them generate differently, which is surprising when both describe the same service.

The new option forces one uniform shape:

- `'schema'` — **default**, today's facet-aware behaviour, so existing output is unchanged
- `'definite'` — always `!`
- `'initialized'` — always an initializer where one is possible

Settable globally or per source, like the other generation options. Enum-typed and abstract-typed members still take `!` under every style: neither has an assignable initializer.
