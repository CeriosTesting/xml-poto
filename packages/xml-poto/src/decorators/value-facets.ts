import { XmlValueFacets } from "./types";

/**
 * Copy the shared XSD value facets from decorator options into metadata.
 * Used by the @XmlElement, @XmlAttribute, @XmlText and @XmlArray factories.
 */
export function extractValueFacets(options: XmlValueFacets): XmlValueFacets {
	return {
		pattern: options.pattern,
		enumValues: options.enumValues,
		length: options.length,
		minLength: options.minLength,
		maxLength: options.maxLength,
		minInclusive: options.minInclusive,
		maxInclusive: options.maxInclusive,
		minExclusive: options.minExclusive,
		maxExclusive: options.maxExclusive,
		totalDigits: options.totalDigits,
		fractionDigits: options.fractionDigits,
		whiteSpace: options.whiteSpace,
		fixedValue: options.fixedValue,
	};
}
