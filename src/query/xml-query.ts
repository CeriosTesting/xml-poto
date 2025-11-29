import { DynamicElement } from "./dynamic-element";
import { AggregationMethods } from "./methods/aggregation-methods";
import { FilterMethods } from "./methods/filter-methods";
import { MutationMethods } from "./methods/mutation-methods";
import { NavigationMethods } from "./methods/navigation-methods";
import { OutputMethods } from "./methods/output-methods";
import { SelectionMethods } from "./methods/selection-methods";

/**
 * Helper function to apply mixins to a class
 * @internal
 */
function applyMixins(derivedCtor: any, constructors: any[]) {
	constructors.forEach(baseCtor => {
		Object.getOwnPropertyNames(baseCtor.prototype).forEach(name => {
			if (name !== "constructor") {
				Object.defineProperty(
					derivedCtor.prototype,
					name,
					Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
				);
			}
		});
	});
}

// Apply mixins using interface merging
// biome-ignore lint/correctness/noUnusedVariables: Interface merging provides type definitions for mixin methods applied at runtime
interface XmlQuery
	extends Omit<SelectionMethods, "elements" | "createQuery">,
		Omit<FilterMethods, "elements" | "createQuery">,
		Omit<NavigationMethods, "elements" | "createQuery">,
		Omit<AggregationMethods, "elements" | "createQuery">,
		Omit<MutationMethods, "elements" | "createQuery">,
		Omit<OutputMethods, "elements" | "createQuery"> {}

/**
 * Fluent query interface for XML elements with comprehensive querying capabilities
 */
class XmlQuery {
	protected elements: DynamicElement[];
	protected createQuery: (elements: DynamicElement[]) => XmlQuery;

	/** @internal */
	constructor(elements: DynamicElement[]) {
		this.elements = elements;
		this.createQuery = (els: DynamicElement[]) => new XmlQuery(els);
	}

	/**
	 * Create a namespace context for easier querying with aliases
	 * Returns an object with methods bound to specific namespace URIs
	 */
	withNamespaces(aliases: Record<string, string>): NamespaceContext {
		return new NamespaceContext(this, aliases);
	}
}

// Apply mixins after class definition
applyMixins(XmlQuery, [
	SelectionMethods,
	FilterMethods,
	NavigationMethods,
	AggregationMethods,
	MutationMethods,
	OutputMethods,
]);

export { XmlQuery };

/**
 * Namespace context for easier querying with namespace aliases
 * Allows defining short aliases for namespace URIs and querying with them
 */
export class NamespaceContext {
	private query: XmlQuery;
	private aliases: Record<string, string>;

	/** @internal */
	constructor(query: XmlQuery, aliases: Record<string, string>) {
		this.query = query;
		this.aliases = aliases;
	}

	/**
	 * Find elements by alias:localName notation
	 * Example: find("soap:Envelope") where soap is an alias
	 */
	find(name: string): XmlQuery {
		const [alias, localName] = this.parseName(name);

		if (!alias) {
			// No prefix, search by local name only
			return this.query.localName(localName);
		}

		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}. Available aliases: ${Object.keys(this.aliases).join(", ")}`);
		}

		return this.query.inNamespace(uri, localName);
	}

	/**
	 * Find first element by alias:localName notation
	 */
	findFirst(name: string): XmlQuery {
		const [alias, localName] = this.parseName(name);

		if (!alias) {
			return this.query.localName(localName).take(1);
		}

		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}`);
		}

		return this.query.inNamespace(uri, localName).take(1);
	}

	/**
	 * Query by alias (all elements in that namespace)
	 */
	namespace(alias: string): XmlQuery {
		const uri = this.aliases[alias];
		if (!uri) {
			throw new Error(`Unknown namespace alias: ${alias}`);
		}
		return this.query.namespaceUri(uri);
	}

	/**
	 * Get namespace URI for an alias
	 */
	resolve(alias: string): string | undefined {
		return this.aliases[alias];
	}

	/**
	 * Get all defined aliases
	 */
	getAliases(): string[] {
		return Object.keys(this.aliases);
	}

	/**
	 * Get the underlying query
	 */
	getQuery(): XmlQuery {
		return this.query;
	}

	/**
	 * Add or update namespace aliases
	 */
	withAlias(alias: string, uri: string): NamespaceContext {
		return new NamespaceContext(this.query, { ...this.aliases, [alias]: uri });
	}

	/**
	 * Remove a namespace alias
	 */
	withoutAlias(alias: string): NamespaceContext {
		const newAliases = { ...this.aliases };
		delete newAliases[alias];
		return new NamespaceContext(this.query, newAliases);
	}

	private parseName(name: string): [string | undefined, string] {
		const parts = name.split(":");
		if (parts.length === 1) {
			return [undefined, parts[0]];
		}
		if (parts.length === 2) {
			return [parts[0], parts[1]];
		}
		throw new Error(`Invalid qualified name: ${name}`);
	}
}
