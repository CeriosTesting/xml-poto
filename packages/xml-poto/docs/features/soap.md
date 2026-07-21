# SOAP Envelopes

`SoapSerializer` reads and writes SOAP envelopes so your payload classes stay free of
`Envelope`/`Body` wrapper types. You generate classes from a WSDL, hand a payload to `toXml`,
and get a complete SOAP request back.

```ts
import { SoapSerializer } from "@cerios/xml-poto";

const soap = new SoapSerializer();

const xml = soap.toXml(vraag);
// <?xml version="1.0" encoding="UTF-8"?>
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
//   <soapenv:Body>
//     <tns:gbavVraag xmlns:tns="http://www.competent.nl/gbav/v1">
//       <identificatie><indicatie>AFN</indicatie></identificatie>
//     </tns:gbavVraag>
//   </soapenv:Body>
// </soapenv:Envelope>

const antwoord = soap.fromXml(response, GbavAntwoord);
```

`SoapSerializer` extends `XmlDecoratorSerializer`, so every
serialization option — `omitXmlDeclaration`, `validationMode`, `omitNullValues`, `useXsiType`,
… — works exactly the same. Only the envelope handling is added.

## Reading is prefix-independent

XML identifies an element by `{namespace-uri, local-name}`; the prefix is just a
document-local alias. `SoapSerializer` matches the envelope on its **namespace URI**, so every
one of these is understood without configuration:

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Envelope   xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<S:Envelope      xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
<Envelope        xmlns="http://schemas.xmlsoap.org/soap/envelope/">
```

The same applies to the payload inside the `Body`. This matters in practice because JAX-WS
(and most Java stacks) hoist every namespace onto the `Envelope` and use their own prefixes:

```xml
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"
            xmlns:ns2="http://www.competent.nl/gbav/v1">
  <S:Body>
    <ns2:gbavAntwoord>…</ns2:gbavAntwoord>   <!-- prefix bound two levels up -->
  </S:Body>
</S:Envelope>
```

## SOAP 1.1 and 1.2

Writing uses the configured version; **reading auto-detects it** from the envelope namespace,
so a 1.2 response parses on a 1.1-configured serializer.

```ts
const soap = new SoapSerializer({ soapVersion: "1.2" }); // default: "1.1"
```

|                           | SOAP 1.1                                    | SOAP 1.2                                  |
| ------------------------- | ------------------------------------------- | ----------------------------------------- |
| Envelope namespace        | `http://schemas.xmlsoap.org/soap/envelope/` | `http://www.w3.org/2003/05/soap-envelope` |
| Fault code                | `<faultcode>`                               | `<Code><Value>`                           |
| Fault reason              | `<faultstring>`                             | `<Reason><Text>`                          |
| Fault detail              | `<detail>`                                  | `<Detail>`                                |
| Fault children namespaced | **no**                                      | **yes**                                   |

That last row is the one that trips up hand-rolled parsers: in SOAP 1.1 the `Fault`'s own
children are in _no_ namespace, even though `Fault` itself is in the envelope namespace.

## Faults

A `<Fault>` in the response body throws a `SoapFaultError`. A fault is a valid SOAP response,
but it is never the type you asked for — throwing means it can't be silently mistaken for a
success.

```ts
import { SoapFaultError, SoapSerializer } from "@cerios/xml-poto";

const soap = new SoapSerializer({
	faultDetailTypes: { gbavFout: GbavFout }, // detail element name → class
});

try {
	const antwoord = soap.fromXml(response, GbavAntwoord);
} catch (error) {
	if (error instanceof SoapFaultError) {
		error.faultCode; // 'S:Server'
		error.faultString; // 'Onbekende afnemer'
		error.faultActor; // faultactor (1.1) / Role (1.2)
		error.detail; // GbavFout instance, thanks to faultDetailTypes
		error.detailName; // 'gbavFout'
		error.rawDetail; // the detail exactly as parsed
		error.version; // '1.1'
	}
	throw error;
}
```

`faultDetailTypes` maps a detail element's **local name** to the class it should deserialize
into. Without it, `detail` is the raw parsed object — nothing is lost either way, since
`rawDetail` always holds the original.

## Headers

Pass any decorated objects as headers; each is serialized with its own element name and
namespace, exactly as it would be as a root. No `<Header>` is emitted when there are none.

```ts
@XmlRoot({ name: "Security", namespace: { uri: WSSE_NS, prefix: "wsse" } })
class Security {
	@XmlElement({ name: "Username" }) username: string = "";
}

const security = new Security();
security.username = "xmlbevr";

const xml = soap.toXml(vraag, { headers: [security] });
// <soapenv:Envelope …>
//   <soapenv:Header>
//     <wsse:Security xmlns:wsse="…"><Username>xmlbevr</Username></wsse:Security>
//   </soapenv:Header>
//   <soapenv:Body>…</soapenv:Body>
// </soapenv:Envelope>
```

### Control attributes

Wrap a header to set the SOAP control attributes a peer may require. The names differ between
versions — 1.1 says `actor` and spells `mustUnderstand` as `1`/`0`, 1.2 says `role` and
`true`/`false` — and are resolved from the version you are writing:

```ts
soap.toXml(vraag, {
	headers: [{ value: security, mustUnderstand: true, actor: "http://example.com/router" }],
});
// <wsse:Security … soapenv:mustUnderstand="1" soapenv:actor="http://example.com/router">
```

`relay` is also accepted, and written only for SOAP 1.2, which is the only version that defines
it. A bare object (no wrapper) writes no control attributes at all.

`fromXml` returns just the body, which is what you usually want. Use `fromEnvelope` when you
also need headers back — they come back positionally, `undefined` where absent:

```ts
const { body, headers } = soap.fromEnvelope(response, {
	body: GbavAntwoord,
	headers: [Security],
});

body.identificatie.indicatie;
(headers[0] as Security | undefined)?.username;
```

## Options

| Option             | Default     | Description                                               |
| ------------------ | ----------- | --------------------------------------------------------- |
| `soapVersion`      | `'1.1'`     | Version used when **writing**. Reading auto-detects.      |
| `soapPrefix`       | `'soapenv'` | Prefix bound to the envelope namespace when writing.      |
| `faultDetailTypes` | `{}`        | Detail element local name → class to deserialize it into. |

Plus everything in `SerializationOptions`.

## Errors

| Condition                       | Result                                                     |
| ------------------------------- | ---------------------------------------------------------- |
| Body contains a `<Fault>`       | throws `SoapFaultError`                                    |
| Document has no SOAP `Envelope` | throws — lists both envelope namespaces                    |
| Envelope has no `Body`          | throws `SOAP <version> Body element not found in envelope` |
| Body has no matching payload    | throws `Root element <name> not found in XML`              |

## Not covered

The codegen reads a WSDL's `<message>`, `<portType>` and `<binding>` and emits an
`operations.ts` describing each operation — see
[Generated operations](#generated-operations) below. It does **not** generate a client:
`SoapSerializer` handles the envelope, and issuing the HTTP request stays yours.

Also out of scope:

- **RPC/encoded messaging** (`soap:encodingStyle`, `href`/`id` multiref graphs). Document/literal
  — what modern stacks emit — is what is supported; an `rpc` or `encoded` operation is reported
  and skipped rather than half-generated.
- **Multi-part messages.** Only a single-part document/literal message maps to one class.
- **WS-Security and other header protocols.** They are ordinary decorated classes as far as this
  library is concerned — pass them through `headers`.

## Generated operations

A WSDL source additionally produces `operations.ts`, pairing each operation's `soapAction` with
the classes it exchanges:

```ts
export const CompetentPortOperations = {
	stelGbavVraag: {
		soapAction: "stelGbavVraag",
		input: GbavVraag,
		output: GbavAntwoord,
		faults: { gbavException: GbavFout },
	},
} as const;
```

It is plain data, not a client, so it composes with whatever transport you use:

```ts
import { CompetentPortOperations } from "./generated/operations";

const op = CompetentPortOperations.stelGbavVraag;
const soap = new SoapSerializer({ faultDetailTypes: { gbavFout: op.faults.gbavException } });

const response = await post(endpoint, soap.toXml(vraag), { SOAPAction: op.soapAction });
const antwoord = soap.fromXml(response, op.output);
```

`operations.ts` is deliberately left out of the generated barrel `index.ts`, which it imports
from — import it directly.
