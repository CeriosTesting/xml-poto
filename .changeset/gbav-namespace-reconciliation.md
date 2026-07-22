---
"@cerios/xml-poto": minor
---

Reconcile nested namespace handling and add an `@XmlType` decorator (issue #96).

- **Namespace declaration dedup**: nested elements no longer re-declare a namespace prefix/URI pair that an ancestor already declares. `<S:Envelope xmlns:S="…"><S:Body xmlns:S="…">` now serializes as `<S:Envelope xmlns:S="…"><S:Body>`. A prefix rebound to a different URI is preserved (legal namespace rebinding).
- **Property/class metadata reconciliation**: when a property's `@XmlElement` sets a name but no namespace and the referenced type carries a namespace, the wrapper element is now qualified from that namespace instead of producing an unqualified wrapper around prefixed children. The property still overrides the class; the class only fills a missing namespace/form (mirroring C# `XmlSerializer` `[XmlElement]` + `[XmlType]`).
- **New `@XmlType` decorator**: describes a class's XML type identity (schema type name/namespace), distinct from `@XmlRoot` (document root) and the wrapper form of `@XmlElement`. It supplies the class-level name/namespace as a fallback used to qualify nested/array references (and to derive root defaults when no `@XmlRoot`/`@XmlElement` is present). `XmlType` and `XmlTypeOptions` are now exported.
- **Array items qualified consistently**: for `@XmlArray({ form: "qualified" })`, item elements are now prefixed with the array's namespace like the container (previously only the container was prefixed), matching C# `XmlArrayItem`.
- **Attributes are never in the default namespace**: a namespaced attribute without a prefix now gets a synthesized prefix and is declared inline, instead of emitting `xmlns="…"` on the root and hijacking the document default namespace (matching C#). Attributes with an explicit prefix and attributes with no namespace are unchanged.
- **`xmlns=""` reset**: a nested element whose type is in no namespace, nested under a default-namespace ancestor, now emits `xmlns=""` so it is not pulled into the ancestor namespace (matching C#).
- **Namespace-qualified `xsi:type`**: when `useXsiType` is enabled, `xsi:type` now uses the runtime type's schema name (`@XmlType`/`@XmlRoot`/`@XmlElement`) qualified with its namespace prefix (e.g. `xsi:type="tns:Derived"`), instead of the raw class name.

**Behavior change — null handling now matches C#:** null/undefined non-nullable members are **omitted** by default (previously emitted as empty elements). `isNullable` members still emit `xsi:nil="true"` (even when omission is on). The default of `omitNullValues` changed from `false` to `true`; set `omitNullValues: false` to restore the legacy empty-element behavior.

These changes make serialized output more closely match .NET `XmlSerializer` and remove redundant/mixed namespace shapes. Output for documents that previously emitted duplicate declarations, unqualified wrappers, or empty elements for null members will change accordingly.
