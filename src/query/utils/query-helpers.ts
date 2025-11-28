import type { DynamicElement } from "../dynamic-element";

/**
 * Internal helper utilities for XmlQuery
 * @internal
 */

/**
 * Recursively find elements matching a predicate
 */
export function findRecursive(
	element: DynamicElement,
	predicate: (el: DynamicElement) => boolean,
	results: DynamicElement[]
): void {
	if (predicate(element)) {
		results.push(element);
	}
	for (const child of element.children) {
		findRecursive(child, predicate, results);
	}
}

/**
 * Collect all descendants recursively
 */
export function collectDescendants(element: DynamicElement, results: DynamicElement[]): void {
	for (const child of element.children) {
		results.push(child);
		collectDescendants(child, results);
	}
}

/**
 * Convert wildcard pattern to regex
 */
export function patternToRegex(pattern: string): RegExp {
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
	return new RegExp(`^${escaped}$`, "i");
}

/**
 * Get nested property from object using dot notation
 */
export function getNestedProperty(obj: any, path: string): any {
	const parts = path.split(".");
	let current = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		current = current[part];
	}

	return current;
}

/**
 * Get all text content recursively from element and descendants
 */
export function getAllTextRecursive(element: DynamicElement): string {
	let text = element.text || "";

	// Add text from all text nodes if available
	if (element.textNodes && element.textNodes.length > 0) {
		text = element.textNodes.join("");
	}

	// Recursively get text from children
	for (const child of element.children) {
		const childText = getAllTextRecursive(child);
		if (childText) {
			text += childText;
		}
	}

	return text;
}
