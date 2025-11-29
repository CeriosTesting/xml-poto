/**
 * Lazy dependency resolution module for breaking circular dependencies.
 * This module provides singleton getters for classes that would otherwise create
 * circular import cycles, allowing all modules to load completely before resolving references.
 *
 * This pattern works with both CommonJS and ESM, and is compatible with esbuild.
 * The key is that imports are at the top level (not in functions), but execution
 * is deferred until the getter functions are called.
 */

import { XmlDecoratorSerializer } from "../xml-decorator-serializer";
// These imports will cause circular dependencies, but that's OK because
// we only access them lazily through function calls, not at module initialization time
import { XmlQuery } from "./xml-query";

/**
 * Get XmlQuery class with lazy resolution
 * @internal
 */
export function getXmlQueryClass(): typeof XmlQuery {
	// By the time this function is called, all modules are loaded
	// The circular dependency is resolved because we're not accessing this at import time
	return XmlQuery;
}

/**
 * Get XmlDecoratorSerializer class with lazy resolution
 * @internal
 */
export function getXmlDecoratorSerializerClass(): typeof XmlDecoratorSerializer {
	// By the time this function is called, all modules are loaded
	return XmlDecoratorSerializer;
}
