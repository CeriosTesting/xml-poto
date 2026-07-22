---
"@cerios/xml-poto": minor
---

Add `SoapSerializer`: read and write SOAP envelopes without hand-written wrapper classes.

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
