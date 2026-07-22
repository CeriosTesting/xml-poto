/**
 * Translation of XSD `xs:pattern` regular expressions into JavaScript `RegExp`
 * source.
 *
 * The two flavours mostly agree, but XSD has constructs JavaScript does not.
 * Emitting such a pattern verbatim into generated code is worse than dropping it:
 * `new RegExp` runs while the decorator is being applied, so a pattern JavaScript
 * rejects throws on *import* of the generated module, taking down code that never
 * touched the offending type.
 */

/** Outcome of translating one pattern. */
export interface XsdPatternTranslation {
	/** JavaScript RegExp source, when the pattern could be represented. */
	source?: string;
	/** Why the pattern was dropped, when it could not. */
	unsupported?: string;
}

/**
 * XSD multi-character escapes for XML name characters, which JavaScript lacks.
 *
 * The XSD definitions are Unicode-wide; these expansions cover the ASCII range
 * plus the "any character above ASCII" tail, which is how name characters are
 * used in practice.
 */
const NAME_ESCAPES: Record<string, string> = {
	// \i — a character that may start an XML name
	i: "[A-Za-z_:\\u00C0-\\uFFFF]",
	I: "[^A-Za-z_:\\u00C0-\\uFFFF]",
	// \c — a character that may appear in an XML name
	c: "[-.0-9A-Za-z_:\\u00B7\\u00C0-\\uFFFF]",
	C: "[^-.0-9A-Za-z_:\\u00B7\\u00C0-\\uFFFF]",
};

/**
 * Translate an XSD pattern to JavaScript RegExp source, or report why it cannot
 * be translated.
 */
export function translateXsdPattern(pattern: string): XsdPatternTranslation {
	if (hasClassSubtraction(pattern)) {
		// `[a-z-[aeiou]]` is a set difference in XSD. JavaScript does not throw on it
		// — it silently reads `-[` as two ordinary class members — so it has to be
		// rejected explicitly rather than left to the RegExp constructor.
		return { unsupported: "character-class subtraction ('[a-z-[aeiou]]')" };
	}

	if (/\\[pP]\{/.test(pattern)) {
		// XSD names Unicode blocks as \p{IsGreek}; JavaScript needs the `u` flag and
		// spells its categories differently, so no faithful translation exists.
		return { unsupported: "Unicode block/category escapes ('\\p{…}')" };
	}

	const source = expandNameEscapes(pattern);

	try {
		// The generated code builds this same source; failing here keeps the failure
		// in codegen instead of at import time.
		new RegExp(source);
	} catch (error) {
		return { unsupported: error instanceof Error ? error.message : "not a valid JavaScript regular expression" };
	}

	return { source };
}

/**
 * Replace `\i`, `\I`, `\c` and `\C` with their JavaScript equivalents, leaving
 * escaped backslashes (`\\i` is a literal backslash then an `i`) alone.
 */
function expandNameEscapes(pattern: string): string {
	let result = "";
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		if (char !== "\\" || i + 1 >= pattern.length) {
			result += char;
			continue;
		}

		const next = pattern[i + 1];
		const expansion = NAME_ESCAPES[next];
		result += expansion ?? `\\${next}`;
		i++;
	}
	return result;
}

/** Does any character class in the pattern use XSD's `-[…]` set-difference syntax? */
function hasClassSubtraction(pattern: string): boolean {
	let inClass = false;
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i];
		if (char === "\\") {
			i++;
			continue;
		}
		if (!inClass) {
			if (char === "[") inClass = true;
			continue;
		}
		if (char === "]") {
			inClass = false;
			continue;
		}
		if (char === "-" && pattern[i + 1] === "[") return true;
	}
	return false;
}
