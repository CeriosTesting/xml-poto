---
"@cerios/xml-poto": patch
---

Fix XML that was written or read incorrectly, and expose compact output.

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
