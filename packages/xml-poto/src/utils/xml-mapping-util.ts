/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Mapping util works with dynamic any types for XML processing */
import { XmlArrayMetadata, XmlAttributeMetadata, XmlElementMetadata, XSI_NAMESPACE } from "../decorators";
import { findConstructorByName, findElementClass, getMetadata } from "../decorators/storage/metadata-storage";
import { DynamicElement } from "../query/dynamic-element";
import { SerializationOptions } from "../serialization-options";

import { getOrCreateDefaultElementMetadata } from "./xml-metadata-util";
import { XmlNamespaceUtil } from "./xml-namespace-util";
import { XmlValidationUtil } from "./xml-validation-util";

/** Sentinel value indicating an element was handled inline and should be skipped */
const SKIP_ELEMENT = Symbol("SKIP_ELEMENT");

/**
 * Utility class for mapping between objects and XML structures.
 */
export class XmlMappingUtil {
	private namespaceUtil: XmlNamespaceUtil;
	private visitedObjects: WeakSet<object>;

	constructor(private options: SerializationOptions) {
		this.namespaceUtil = new XmlNamespaceUtil();
		this.visitedObjects = new WeakSet();
	}

	/**
	 * Reset the visited objects tracker for a new serialization operation.
	 */
	resetVisitedObjects(): void {
		this.visitedObjects = new WeakSet();
	}

	/**
	 * Check if a class has any fields marked with mixedContent: true
	 * Optimized with for-in loop and early return
	 */
	hasMixedContentFields(targetClass: new () => any): boolean {
		// Use cached metadata
		const fieldElementMetadata = getMetadata(targetClass).fieldElements;

		// Check if any field has mixedContent flag set
		for (const key in fieldElementMetadata) {
			if (fieldElementMetadata[key]?.mixedContent === true) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Find a property on an instance by trying multiple naming conventions
	 * Converts XML element names to common JavaScript property naming patterns
	 * @param xmlLocalName - XML element name (without namespace prefix)
	 * @param instance - Object instance to search for property
	 * @returns Property name if found, otherwise the original xmlLocalName
	 */
	private findPropertyByNamingConventions(xmlLocalName: string, instance: any): string {
		// Try exact match first
		if (xmlLocalName in instance) {
			return xmlLocalName;
		}

		// Generate naming convention variants
		const variants = [
			xmlLocalName, // Exact match (already tried, but included for completeness)
			this.toCamelCase(xmlLocalName), // Publication_MarketDocument -> publicationMarketDocument
			this.toPascalCase(xmlLocalName), // publication_marketDocument -> PublicationMarketDocument
			this.removeSpecialChars(xmlLocalName), // Publication_MarketDocument -> PublicationMarketDocument
		];

		// Try each variant
		for (const variant of variants) {
			if (variant !== xmlLocalName && variant in instance) {
				return variant;
			}
		}

		// No match found - return original
		return xmlLocalName;
	}

	/**
	 * Convert string to camelCase
	 * Examples: "Publication_MarketDocument" -> "publicationMarketDocument"
	 */
	private toCamelCase(str: string): string {
		return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^[A-Z]/, (char) => char.toLowerCase());
	}

	/**
	 * Convert string to PascalCase
	 * Examples: "publication_marketDocument" -> "PublicationMarketDocument"
	 */
	private toPascalCase(str: string): string {
		return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^[a-z]/, (char) => char.toUpperCase());
	}

	/**
	 * Remove special characters (underscores, hyphens)
	 * Examples: "Publication_MarketDocument" -> "PublicationMarketDocument"
	 */
	private removeSpecialChars(str: string): string {
		return str.replace(/[-_]/g, "");
	}

	/**
	 * Find nested class constructor using auto-discovery with multiple strategies
	 * @param xmlKey - Full XML element name (may include namespace prefix)
	 * @param propertyKey - Property name on parent object
	 * @param parentNamespace - Parent element's namespace prefix (if any)
	 * @returns Class constructor if found, undefined otherwise
	 */
	private findNestedClassByAutoDiscovery(
		xmlKey: string,
		propertyKey: string,
		parentNamespace?: string,
	): (new () => any) | undefined {
		// Strategy 1: Try exact match with full xmlKey (including namespace prefix)
		let elementClass = findElementClass(xmlKey, undefined, false);
		if (elementClass) return elementClass as new () => any;

		// Strategy 2: Try prepending parent namespace prefix if xmlKey doesn't have one
		if (parentNamespace && !xmlKey.includes(":")) {
			elementClass = findElementClass(`${parentNamespace}:${xmlKey}`, undefined, false);
			if (elementClass) return elementClass as new () => any;
		}

		// Strategy 3: Strip existing namespace prefix and try local name
		const localName = xmlKey.includes(":") ? xmlKey.substring(xmlKey.indexOf(":") + 1) : xmlKey;
		if (localName !== xmlKey) {
			elementClass = findElementClass(localName, undefined, false);
			if (elementClass) return elementClass as new () => any;
		}

		// Strategy 4: Try constructor name match
		return (
			this.findByConstructorNames(localName, propertyKey) ??
			this.findByDottedName(localName) ??
			this.findByNamingVariants(localName, propertyKey) ??
			undefined
		);
	}

	/**
	 * Try finding a class by constructor name using local name and property key
	 */
	private findByConstructorNames(localName: string, propertyKey: string): (new () => any) | undefined {
		let elementClass = findConstructorByName(localName);
		if (elementClass) return elementClass as new () => any;

		elementClass = findConstructorByName(propertyKey);
		if (elementClass) return elementClass as new () => any;

		const pascalPropertyName = this.toPascalCase(propertyKey);
		if (pascalPropertyName !== propertyKey) {
			elementClass = findConstructorByName(pascalPropertyName);
			if (elementClass) return elementClass as new () => any;
		}

		return undefined;
	}

	/**
	 * Handle dotted names (e.g., "sender_MarketParticipant.mRID")
	 */
	private findByDottedName(localName: string): (new () => any) | undefined {
		if (!localName.includes(".")) return undefined;
		const lastPart = localName.split(".").pop();
		if (!lastPart) return undefined;

		const elementClass = findElementClass(lastPart, undefined, false) ?? findConstructorByName(lastPart);
		return elementClass ? (elementClass as new () => any) : undefined;
	}

	/**
	 * Try naming convention variants on local name and property key
	 */
	private findByNamingVariants(localName: string, propertyKey: string): (new () => any) | undefined {
		const variants = [this.toCamelCase(localName), this.toPascalCase(localName), this.removeSpecialChars(localName)];

		for (const variant of variants) {
			if (variant !== localName) {
				const found = this.tryFindClass(variant);
				if (found) return found;
			}
		}

		const propertyVariants = [
			this.toCamelCase(propertyKey),
			this.toPascalCase(propertyKey),
			this.removeSpecialChars(propertyKey),
		];

		for (const variant of propertyVariants) {
			if (variant !== propertyKey) {
				const found = this.tryFindClass(variant);
				if (found) return found;
			}
		}

		return undefined;
	}

	/**
	 * Try finding a class by name in element registry and constructor registry
	 */
	private tryFindClass(name: string): (new () => any) | undefined {
		const elementClass = findElementClass(name, undefined, false) ?? findConstructorByName(name);
		return elementClass ? (elementClass as new () => any) : undefined;
	}

	/**
	 * Map XML data to a typed object instance.
	 * Complex due to handling: attributes, text/CDATA, comments, arrays, mixed content, nested objects,
	 * auto-discovery, lazy loading, and comprehensive validation. Simplification would require architectural changes.
	 */
	mapToObject<T extends object>(data: any, targetClass: new () => T): T {
		const instance = new targetClass();
		const metadata = getMetadata(targetClass);
		const {
			attributes: attributeMetadata,
			textProperty,
			textMetadata: rawTextMetadata,
			propertyMappings,
			element: elementMetadata,
			ignoredProperties: ignoredProps,
			fieldElements: fieldElementMetadata,
			arrays: allArrayMetadata,
		} = metadata;
		const textMetadata = textProperty
			? { propertyKey: textProperty, metadata: rawTextMetadata ?? { required: false } }
			: undefined;

		const foundProperties = new Set<string>();

		this.mapAttributes(instance, data, attributeMetadata, ignoredProps, foundProperties);
		this.mapTextContent(instance, data, textMetadata);
		this.mapComments(
			instance,
			targetClass,
			data,
			elementMetadata,
			propertyMappings,
			fieldElementMetadata,
			foundProperties,
		);

		const excludedKeys = this.buildExcludedKeys(attributeMetadata, textMetadata);
		const xmlToPropertyMap = this.buildXmlToPropertyMap(
			instance,
			fieldElementMetadata,
			allArrayMetadata,
			elementMetadata,
			propertyMappings,
		);

		this.handleUnwrappedArrays(instance, data, allArrayMetadata, excludedKeys);
		this.mapXmlElements(
			instance,
			data,
			targetClass,
			xmlToPropertyMap,
			excludedKeys,
			ignoredProps,
			fieldElementMetadata,
			elementMetadata,
			foundProperties,
		);
		this.applyDefaults(instance, fieldElementMetadata, foundProperties);
		this.mapDynamicElements(instance, targetClass, data, elementMetadata, propertyMappings, fieldElementMetadata);
		this.checkRequiredElements(data, fieldElementMetadata);

		if (this.options.strictValidation) {
			this.performStrictValidation(
				instance,
				targetClass,
				data,
				metadata,
				fieldElementMetadata,
				allArrayMetadata,
				xmlToPropertyMap,
			);
		}

		return instance;
	}

	/**
	 * Map XML attributes to instance properties
	 */
	private mapAttributes(
		instance: any,
		data: any,
		attributeMetadata: Record<string, XmlAttributeMetadata>,
		ignoredProps: Set<string>,
		foundProperties: Set<string>,
	): void {
		for (const propertyKey in attributeMetadata) {
			const attrMetadata = attributeMetadata[propertyKey];
			if (ignoredProps.has(propertyKey)) continue;

			const attributeName = this.namespaceUtil.buildAttributeName(attrMetadata);
			const attributeKey = `@_${attributeName}`;
			let value = data[attributeKey];

			if (value === undefined && attrMetadata.defaultValue !== undefined) {
				value = attrMetadata.defaultValue;
			}
			if (value === undefined && attrMetadata.required) {
				throw new Error(`Required attribute '${attributeName}' is missing`);
			}
			if (value !== undefined) {
				value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "deserialize");
				if (!XmlValidationUtil.validateValue(value, attrMetadata)) {
					throw new Error(`Invalid value '${value}' for attribute '${attributeName}'`);
				}
				instance[propertyKey] = XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
				foundProperties.add(propertyKey);
			}
		}
	}

	/**
	 * Map XML text content (including CDATA) to instance
	 */
	private mapTextContent(
		instance: any,
		data: any,
		textMetadata: { propertyKey: string; metadata: any } | undefined,
	): void {
		if (!textMetadata) return;

		let textValue: any;
		if (data.__cdata !== undefined) {
			textValue = data.__cdata;
		} else if (data["#text"] !== undefined) {
			textValue = data["#text"];
		} else if (data["#mixed"] && Array.isArray(data["#mixed"]) && data["#mixed"].length === 1) {
			const mixedItem = data["#mixed"][0];
			if (mixedItem.__cdata !== undefined) {
				textValue = mixedItem.__cdata;
			}
		}

		if (textValue !== undefined) {
			if (textMetadata.metadata.converter) {
				textValue = XmlValidationUtil.applyConverter(textValue, textMetadata.metadata.converter, "deserialize");
			}
			instance[textMetadata.propertyKey] = XmlValidationUtil.convertToPropertyType(
				textValue,
				instance,
				textMetadata.propertyKey,
			);
		} else if (textMetadata.metadata.required) {
			throw new Error(`Required text content is missing`);
		}
	}

	/**
	 * Map XML comments to instance properties
	 */
	private mapComments(
		instance: any,
		targetClass: new () => any,
		data: any,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		foundProperties: Set<string>,
	): void {
		const commentsMetadata = getMetadata(targetClass).comments;
		for (const commentMeta of commentsMetadata) {
			const targetXmlName = this.getPropertyXmlName(
				commentMeta.targetProperty,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				false,
			);
			const commentKey = `?_${targetXmlName}`;

			if (data[commentKey] !== undefined) {
				this.assignCommentValue(instance, commentMeta, data[commentKey]);
				foundProperties.add(commentMeta.propertyKey);
			} else if (commentMeta.required) {
				throw new Error(`Required comment for '${commentMeta.targetProperty}' is missing`);
			}
		}
	}

	/**
	 * Assign a comment value to an instance property, handling string vs array types
	 */
	private assignCommentValue(instance: any, commentMeta: any, commentValue: any): void {
		const currentValue = instance[commentMeta.propertyKey];
		const isArray = Array.isArray(currentValue);

		if (isArray) {
			instance[commentMeta.propertyKey] =
				typeof commentValue === "string" ? commentValue.split("\n") : [String(commentValue)];
		} else {
			instance[commentMeta.propertyKey] = typeof commentValue === "string" ? commentValue : String(commentValue);
		}
	}

	/**
	 * Build excluded keys set (attributes and text properties)
	 */
	private buildExcludedKeys(
		attributeMetadata: Record<string, XmlAttributeMetadata>,
		textMetadata: { propertyKey: string; metadata: any } | undefined,
	): Set<string> {
		const excludedKeys = new Set<string>();
		for (const key in attributeMetadata) {
			excludedKeys.add(key);
		}
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}
		return excludedKeys;
	}

	/**
	 * Build reverse mapping from XML element names to property names
	 */
	private buildXmlToPropertyMap(
		instance: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
	): Record<string, string> {
		const xmlToPropertyMap: Record<string, string> = {};
		const allPropertyKeys = new Set<string>();

		for (const key in instance) {
			if (Object.prototype.hasOwnProperty.call(instance, key)) allPropertyKeys.add(key);
		}
		for (const key in fieldElementMetadata) {
			allPropertyKeys.add(key);
		}
		for (const key in allArrayMetadata) {
			allPropertyKeys.add(key);
		}

		for (const propertyKey of allPropertyKeys) {
			const xmlName = this.getPropertyXmlName(
				propertyKey,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				true,
			);
			const arrayMetadata = allArrayMetadata[propertyKey];

			if (arrayMetadata && arrayMetadata.length > 0) {
				const customName = arrayMetadata[0].containerName;
				xmlToPropertyMap[customName ?? xmlName] = propertyKey;
			} else {
				xmlToPropertyMap[xmlName] = propertyKey;
				if (elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
					const parentPrefix = elementMetadata.namespaces[0].prefix;
					if (parentPrefix && !xmlName.includes(":")) {
						xmlToPropertyMap[`${parentPrefix}:${xmlName}`] = propertyKey;
					}
				}
			}
		}
		return xmlToPropertyMap;
	}

	/**
	 * Handle unwrapped arrays where itemName appears directly in data
	 */
	private handleUnwrappedArrays(
		instance: any,
		data: any,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		excludedKeys: Set<string>,
	): void {
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (!metadataArray || metadataArray.length === 0) continue;

			const metadata = metadataArray[0];
			const itemName = metadata.itemName;
			if (!itemName || metadata.containerName || data[itemName] === undefined) continue;

			let items = data[itemName];
			if (!Array.isArray(items)) items = [items];

			if (metadata.type) {
				const itemType = metadata.type as new () => object;
				items = items.map((item: any) =>
					typeof item === "object" && item !== null ? this.mapToObject(item, itemType) : item,
				);
			}

			instance[propertyKey] = items;
			excludedKeys.add(itemName);
		}
	}

	/**
	 * Map XML elements to instance properties (main deserialization loop)
	 */
	private mapXmlElements(
		instance: any,
		data: any,
		targetClass: new () => any,
		xmlToPropertyMap: Record<string, string>,
		excludedKeys: Set<string>,
		ignoredProps: Set<string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		elementMetadata: XmlElementMetadata | undefined,
		foundProperties: Set<string>,
	): void {
		for (const xmlKey in data) {
			if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata") continue;
			if (excludedKeys.has(xmlKey)) continue;

			let propertyKey = xmlToPropertyMap[xmlKey];
			if (!propertyKey) {
				const colonIndex = xmlKey.indexOf(":");
				const localName = colonIndex > 0 ? xmlKey.substring(colonIndex + 1) : xmlKey;
				propertyKey = this.findPropertyByNamingConventions(localName, instance);
			}
			if (ignoredProps.has(propertyKey)) continue;
			if (excludedKeys.has(propertyKey)) continue;
			if (data[xmlKey] === undefined) continue;

			const value = this.deserializeElementValue(
				data[xmlKey],
				propertyKey,
				xmlKey,
				instance,
				targetClass,
				fieldElementMetadata,
				elementMetadata,
				xmlToPropertyMap,
			);
			if (value === SKIP_ELEMENT) continue;

			const finalValue = this.convertFinalValue(value, fieldElementMetadata[propertyKey], instance, propertyKey);
			instance[propertyKey] = finalValue;
			foundProperties.add(propertyKey);
		}
	}

	/**
	 * Deserialize a single XML element value, handling mixed content, arrays, nested objects, etc.
	 * Returns SKIP_ELEMENT sentinel if the element was handled inline (e.g., mixed content assigned directly).
	 */
	private deserializeElementValue(
		rawValue: any,
		propertyKey: string,
		xmlKey: string,
		instance: any,
		targetClass: new () => any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		elementMetadata: XmlElementMetadata | undefined,
		xmlToPropertyMap: Record<string, string>,
	): any {
		let value = rawValue;

		// Normalize empty objects and simple text nodes
		value = this.normalizeXmlValue(value);

		// Handle #mixed content
		const mixedResult = this.handleMixedContent(value, propertyKey, instance, fieldElementMetadata);
		if (mixedResult !== undefined) return mixedResult;

		// Handle XmlArray metadata
		value = this.handleArrayMetadata(value, propertyKey, targetClass);

		// Handle complex objects (nested deserialization)
		value = this.handleComplexObject(
			value,
			propertyKey,
			xmlKey,
			instance,
			fieldElementMetadata,
			elementMetadata,
			xmlToPropertyMap,
		);

		// Apply deserialize transform
		const fieldMetadata = fieldElementMetadata[propertyKey];
		if (fieldMetadata?.transform?.deserialize && (typeof value === "string" || typeof value === "number")) {
			value = fieldMetadata.transform.deserialize(String(value));
		}

		// Deserialize mixed content arrays
		if (Array.isArray(value) && fieldMetadata?.mixedContent) {
			value = this.deserializeMixedContent(value);
		}

		return value;
	}

	/**
	 * Normalize XML parser output: empty objects become empty strings, simple #text nodes unwrapped
	 */
	private normalizeXmlValue(value: any): any {
		if (value !== null && typeof value === "object") {
			if (Object.keys(value).length === 0) return "";
			if ("#text" in value && Object.keys(value).length === 1) return value["#text"];
		}
		return value;
	}

	/**
	 * Handle #mixed content in XML values. Returns SKIP_ELEMENT if handled, undefined otherwise.
	 */
	private handleMixedContent(
		value: any,
		propertyKey: string,
		instance: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
	): any {
		if (typeof value !== "object" || value === null || !("#mixed" in value)) {
			// Check for mixed content field without #mixed key
			const fieldMeta = fieldElementMetadata[propertyKey];
			if (fieldMeta?.mixedContent && typeof value === "object" && value !== null && !Array.isArray(value)) {
				instance[propertyKey] = this.convertObjectToMixedArray(value);
				return SKIP_ELEMENT;
			}
			return undefined;
		}

		const fieldMeta = fieldElementMetadata[propertyKey];
		if (fieldMeta?.mixedContent) {
			instance[propertyKey] = value["#mixed"];
			return SKIP_ELEMENT;
		}

		// Check if #mixed contains a single __cdata node
		const mixed = value["#mixed"];
		if (Array.isArray(mixed) && mixed.length === 1 && mixed[0].__cdata !== undefined) {
			return mixed[0].__cdata;
		}
		return undefined;
	}

	/**
	 * Convert an object to mixed content array format
	 */
	private convertObjectToMixedArray(value: any): any[] {
		const mixedArray: any[] = [];
		for (const key in value) {
			if (key === "#text" || key === "@_" || key.startsWith("@_")) continue;

			const val = value[key];
			const attributes: Record<string, string> = {};
			let content = "";

			if (typeof val === "object" && val !== null) {
				for (const attrKey in val) {
					if (attrKey.startsWith("@_")) {
						attributes[attrKey.substring(2)] = String(val[attrKey]);
					} else if (attrKey === "#text") {
						content = String(val[attrKey]);
					}
				}
			} else {
				content = String(val);
			}

			mixedArray.push({
				element: key,
				content,
				attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
			});
		}
		return mixedArray;
	}

	/**
	 * Handle XmlArray metadata: extract and deserialize array items
	 */
	private handleArrayMetadata(value: any, propertyKey: string, targetClass: new () => any): any {
		const arrayMeta = getMetadata(targetClass).arrays[propertyKey];
		if (!arrayMeta || arrayMeta.length === 0) return value;

		const itemName = arrayMeta[0].itemName;
		if (itemName && typeof value === "object" && value[itemName] !== undefined) {
			value = Array.isArray(value[itemName]) ? value[itemName] : [value[itemName]];
		}

		if (Array.isArray(value) && arrayMeta[0].type) {
			const arrayItemType = arrayMeta[0].type as new () => object;
			value = value.map((item: any) =>
				typeof item === "object" && item !== null ? this.mapToObject(item, arrayItemType) : item,
			);
		}
		return value;
	}

	/**
	 * Handle complex objects that need nested deserialization
	 */
	private handleComplexObject(
		value: any,
		propertyKey: string,
		xmlKey: string,
		instance: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		elementMetadata: XmlElementMetadata | undefined,
		xmlToPropertyMap: Record<string, string>,
	): any {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return value;

		if (value.__cdata !== undefined) return value.__cdata;

		const fieldMetadata = fieldElementMetadata[propertyKey];
		if (fieldMetadata?.type) {
			return this.mapToObject(value, fieldMetadata.type as new () => object);
		}

		const propertyValue = instance[propertyKey];
		if (propertyValue && typeof propertyValue === "object" && propertyValue.constructor) {
			return this.mapToObject(value, propertyValue.constructor as new () => object);
		}

		return this.tryAutoDiscoveryDeserialization(value, propertyKey, xmlKey, elementMetadata, xmlToPropertyMap);
	}

	/**
	 * Attempt auto-discovery deserialization for untyped nested objects
	 */
	private tryAutoDiscoveryDeserialization(
		value: any,
		propertyKey: string,
		xmlKey: string,
		elementMetadata: XmlElementMetadata | undefined,
		xmlToPropertyMap: Record<string, string>,
	): any {
		const hasExplicitMapping = xmlToPropertyMap[xmlKey] !== undefined;
		if (this.options.strictValidation && !hasExplicitMapping) return value;

		const parentNamespacePrefix = elementMetadata?.namespaces?.[0]?.prefix;
		const elementClass = this.findNestedClassByAutoDiscovery(xmlKey, propertyKey, parentNamespacePrefix);
		if (elementClass) {
			return this.mapToObject(value, elementClass as new () => any);
		}
		return value;
	}

	/**
	 * Convert a deserialized value to its final type
	 */
	private convertFinalValue(value: any, fieldMetadata: any, instance: any, propertyKey: string): any {
		if (value !== undefined && typeof value === "object" && value !== null) return value;

		if (fieldMetadata?.unionTypes && fieldMetadata.unionTypes.length > 0) {
			return XmlValidationUtil.tryConvertToUnionType(value, fieldMetadata.unionTypes);
		}
		return XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
	}

	/**
	 * Apply default values for elements not found in XML
	 */
	private applyDefaults(
		instance: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		foundProperties: Set<string>,
	): void {
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (foundProperties.has(propertyKey) || fieldMetadata.defaultValue === undefined) continue;
			instance[propertyKey] = fieldMetadata.defaultValue;
		}
	}

	/**
	 * Handle dynamic elements with lazy loading or immediate loading
	 */
	private mapDynamicElements(
		instance: any,
		targetClass: new () => any,
		data: any,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
	): void {
		const cachedMetadata = getMetadata(targetClass);
		const dynamicMetadata = cachedMetadata.queryables;

		for (const dynamic of dynamicMetadata) {
			const { elementData, elementName, elementFound } = this.resolveDynamicElementData(
				instance,
				dynamic,
				cachedMetadata,
				data,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
			);

			if (dynamic.lazyLoad !== false) {
				this.setupLazyDynamicProperty(instance, targetClass, dynamic, elementData, elementName);
			} else {
				instance[dynamic.propertyKey] = this.buildDynamicElement(elementData, elementName, dynamic);
			}

			if (dynamic.required && !elementFound) {
				const targetName = dynamic.targetProperty ?? "root element";
				throw new Error(`Required queryable element '${targetName}' is missing`);
			}
		}
	}

	/**
	 * Resolve the element data and name for a dynamic metadata entry
	 */
	private resolveDynamicElementData(
		instance: any,
		dynamic: any,
		cachedMetadata: ReturnType<typeof getMetadata>,
		data: any,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
	): { elementData: any; elementName: string; elementFound: boolean } {
		if (dynamic.targetProperty) {
			return this.resolveDynamicTargetProperty(
				instance,
				dynamic,
				data,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
			);
		}

		// Query the root element (default behavior)
		const rootMetadata = cachedMetadata.root;
		const classElementMetadata = cachedMetadata.element;
		const elementName = rootMetadata?.name ?? classElementMetadata?.name ?? dynamic.targetProperty ?? "root element";
		return { elementData: data, elementName, elementFound: true };
	}

	/**
	 * Resolve dynamic element data when targeting a specific nested property
	 */
	private resolveDynamicTargetProperty(
		instance: any,
		dynamic: any,
		data: any,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
	): { elementData: any; elementName: string; elementFound: boolean } {
		const targetValue = instance[dynamic.targetProperty];
		const xmlName = this.getPropertyXmlName(
			dynamic.targetProperty,
			elementMetadata,
			propertyMappings,
			fieldElementMetadata,
			targetValue === undefined || targetValue === null,
		);

		if (targetValue !== undefined && targetValue !== null) {
			const elementData = data[xmlName];
			if (elementData !== undefined) {
				return { elementData, elementName: xmlName, elementFound: true };
			}
			return { elementData: {}, elementName: xmlName, elementFound: false };
		}

		return { elementData: {}, elementName: xmlName, elementFound: false };
	}

	/**
	 * Set up lazy loading property descriptor for a dynamic element
	 */
	private setupLazyDynamicProperty(
		instance: any,
		targetClass: new () => any,
		dynamic: any,
		elementData: any,
		elementName: string,
	): void {
		const builderKey = Symbol.for(`dynamic_builder_${targetClass.name}_${dynamic.propertyKey}`);
		const cachedValueKey = Symbol.for(`dynamic_cache_${targetClass.name}_${dynamic.propertyKey}`);

		instance[builderKey] = () => {
			return this.buildDynamicElement(elementData, elementName, dynamic);
		};

		const existingDescriptor = Object.getOwnPropertyDescriptor(instance, dynamic.propertyKey);
		if (!existingDescriptor || !existingDescriptor.get) {
			Object.defineProperty(instance, dynamic.propertyKey, {
				get(this: any) {
					const cacheEnabled = dynamic.cache;
					if (cacheEnabled && this[cachedValueKey] !== undefined) {
						return this[cachedValueKey];
					}
					if (this[builderKey]) {
						const element = this[builderKey]();
						if (cacheEnabled) {
							this[cachedValueKey] = element;
						}
						return element;
					}
					return undefined;
				},
				set(this: any, value: any) {
					if (dynamic.cache) {
						this[cachedValueKey] = value;
					}
					delete this[builderKey];
				},
				enumerable: true,
				configurable: true,
			});
		}
	}

	/**
	 * Check for missing required elements (skip if they have default values)
	 */
	private checkRequiredElements(data: any, fieldElementMetadata: Record<string, XmlElementMetadata>): void {
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (fieldMetadata.required && fieldMetadata.defaultValue === undefined) {
				const xmlName = this.namespaceUtil.buildElementName(fieldMetadata);
				if (data[xmlName] === undefined) {
					throw new Error(`Required element '${fieldMetadata.name}' is missing`);
				}
			}
		}
	}

	/**
	 * Perform strict validation of the deserialized instance
	 */
	private performStrictValidation(
		instance: any,
		targetClass: new () => any,
		data: any,
		metadata: ReturnType<typeof getMetadata>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		xmlToPropertyMap: Record<string, string>,
	): void {
		const queryables = metadata.queryables || [];
		const hasDynamicElement = queryables.length > 0;

		const dynamicPropertyKeys = new Set<string>();
		for (const q of queryables) {
			dynamicPropertyKeys.add(q.propertyKey);
		}

		if (!hasDynamicElement) {
			this.validateExtraFields(targetClass, data, fieldElementMetadata, allArrayMetadata, xmlToPropertyMap);
		}

		this.validatePropertyInstantiation(
			instance,
			fieldElementMetadata,
			allArrayMetadata,
			dynamicPropertyKeys,
			hasDynamicElement,
		);
	}

	/**
	 * Validate that no extra/unexpected fields exist in the XML data
	 */
	private validateExtraFields(
		targetClass: new () => any,
		data: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		xmlToPropertyMap: Record<string, string>,
	): void {
		const validXmlNames = this.buildValidXmlNames(fieldElementMetadata, allArrayMetadata, xmlToPropertyMap);

		// Check for mixed content fields
		for (const propertyKey in fieldElementMetadata) {
			if (fieldElementMetadata[propertyKey]?.mixedContent === true) return;
		}

		const extraFields: string[] = [];
		for (const xmlKey in data) {
			if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata" || xmlKey === "#mixed") continue;
			if (!validXmlNames.has(xmlKey) && xmlToPropertyMap[xmlKey] === undefined) {
				extraFields.push(xmlKey);
			}
		}

		if (extraFields.length > 0) {
			this.throwExtraFieldsError(targetClass, extraFields, validXmlNames);
		}
	}

	/**
	 * Build a set of all valid XML element names
	 */
	private buildValidXmlNames(
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		xmlToPropertyMap: Record<string, string>,
	): Set<string> {
		const validXmlNames = new Set<string>();

		for (const propertyKey in fieldElementMetadata) {
			validXmlNames.add(this.namespaceUtil.buildElementName(fieldElementMetadata[propertyKey]));
		}
		for (const xmlName in xmlToPropertyMap) {
			validXmlNames.add(xmlName);
		}
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (metadataArray?.[0]) {
				if (metadataArray[0].itemName) validXmlNames.add(metadataArray[0].itemName);
				if (metadataArray[0].containerName) validXmlNames.add(metadataArray[0].containerName);
			}
		}

		return validXmlNames;
	}

	/**
	 * Throw an error for extra fields found during strict validation
	 */
	private throwExtraFieldsError(targetClass: new () => any, extraFields: string[], validXmlNames: Set<string>): never {
		const className = targetClass.name || "Unknown";
		const extraFieldsList = extraFields.map((f) => `  - <${f}>`).join("\n");
		const definedFieldsList = Array.from(validXmlNames)
			.map((f) => `  - <${f}>`)
			.join("\n");

		throw new Error(
			`[Strict Validation Error] Unexpected XML element(s) found in '${className}'.\n\n` +
				`The following XML elements are not defined in the class model:\n${extraFieldsList}\n\n` +
				`Defined elements in ${className}:\n${definedFieldsList}\n\n` +
				`To fix this issue when using fromXml with strictValidation:\n` +
				`1. Add @XmlElement() decorator to each property in your class\n` +
				`2. For nested objects, use @XmlElement({ type: NestedClass }) to specify the type\n` +
				`3. For arrays, use @XmlArray({ itemName: "item", type: ItemClass })\n` +
				`4. Use @XmlDynamic to handle arbitrary/dynamic XML content\n\n` +
				`Important: ALL properties that should be deserialized from XML must have decorators.\n` +
				`TypeScript type annotations alone are not sufficient - decorators are required.\n\n` +
				`Note: If you're splitting classes into separate files and reusing namespace constants,\n` +
				`export the namespace from a dedicated file (e.g., namespaces.ts) to avoid circular\n` +
				`dependencies. Import this namespace file in all classes that need it, rather than\n` +
				`exporting the namespace from your root document file.`,
		);
	}

	/**
	 * Validate that all object properties are properly instantiated (not plain Objects)
	 */
	private validatePropertyInstantiation(
		instance: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		dynamicPropertyKeys: Set<string>,
		hasDynamicElement: boolean,
	): void {
		for (const propertyKey in instance) {
			if (!Object.prototype.hasOwnProperty.call(instance, propertyKey)) continue;
			const value = instance[propertyKey];

			if (!value || Array.isArray(value) || typeof value !== "object") continue;
			if (dynamicPropertyKeys.has(propertyKey)) continue;

			if (value.constructor.name === "Object") {
				this.validatePlainObject(propertyKey, value, fieldElementMetadata, allArrayMetadata, hasDynamicElement);
			}
		}
	}

	/**
	 * Validate a plain Object property in strict mode
	 */
	private validatePlainObject(
		propertyKey: string,
		value: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		hasDynamicElement: boolean,
	): void {
		const fieldMetadata = fieldElementMetadata[propertyKey];

		if (!fieldMetadata && !allArrayMetadata[propertyKey] && hasDynamicElement) return;

		if (fieldMetadata?.type) {
			const nestedMetadata = getMetadata(fieldMetadata.type);
			if (nestedMetadata.queryables.length > 0) {
				const expectedTypeName = fieldMetadata.type.name;
				throw new Error(
					`[Strict Validation Error] Property '${propertyKey}' is not properly instantiated.\n\n` +
						`Expected: ${expectedTypeName} instance\n` +
						`Got: plain Object\n\n` +
						`The class '${expectedTypeName}' has @XmlDynamic decorator(s) which require proper instantiation.\n` +
						`This usually means the type parameter is missing from your @XmlElement decorator.\n\n` +
						`Current decorator: @XmlElement({ name: '${fieldMetadata.name}' })\n` +
						`Fix: @XmlElement({ name: '${fieldMetadata.name}', type: ${expectedTypeName} })\n\n` +
						`Without the type parameter, the XML parser creates a plain Object instead of a ${expectedTypeName} instance,\n` +
						`which breaks @XmlDynamic functionality and other class-specific behavior.`,
				);
			}
		} else if (Object.keys(value).length > 0) {
			const xmlName = fieldMetadata?.name ?? propertyKey;
			throw new Error(
				`[Strict Validation Error] Property '${propertyKey}' is not properly instantiated.\n\n` +
					`The property contains a plain Object with nested data, but no type parameter is specified.\n` +
					`This usually indicates missing type information in your decorator.\n\n` +
					`Current decorator: @XmlElement({ name: '${xmlName}' })\n` +
					`Fix: @XmlElement({ name: '${xmlName}', type: YourClassName })\n\n` +
					`This validation catches common configuration errors early. ` +
					`If you need to work with plain objects temporarily, you can disable strict validation:\n` +
					`new XmlDecoratorSerializer({ strictValidation: false })\n\n` +
					`Learn more about type parameters in the documentation.`,
			);
		}
	}

	/**
	 * Map an object to XML structure.
	 */
	mapFromObject(obj: any, rootElementName: string, elementMetadata?: XmlElementMetadata): any {
		// Check for circular references (only for objects currently in the traversal path)
		// Note: We track the path, not all visited objects, to allow the same object to be used multiple times
		if (this.isCircularReference(obj)) {
			// Return a placeholder for circular reference
			return { "#text": "[Circular Reference]" };
		}

		// Track complex objects for circular reference detection
		if (this.shouldTrackObject(obj)) {
			return this.mapFromObjectWithTracking(obj, rootElementName, elementMetadata);
		}

		// Primitive values don't need tracking
		return this.mapFromObjectInternal(obj, rootElementName, elementMetadata);
	}

	/**
	 * Check if an object is currently in the traversal path (circular reference).
	 */
	private isCircularReference(obj: any): boolean {
		return typeof obj === "object" && obj !== null && this.visitedObjects.has(obj);
	}

	/**
	 * Check if an object should be tracked for circular reference detection.
	 */
	private shouldTrackObject(obj: any): boolean {
		return typeof obj === "object" && obj !== null;
	}

	/**
	 * Map an object to XML structure with circular reference tracking.
	 */
	private mapFromObjectWithTracking(obj: any, rootElementName: string, elementMetadata?: XmlElementMetadata): any {
		this.visitedObjects.add(obj);

		try {
			return this.mapFromObjectInternal(obj, rootElementName, elementMetadata);
		} finally {
			// Remove from path after processing to allow reuse in sibling branches
			this.visitedObjects.delete(obj);
		}
	}

	/**
	 * Internal implementation of mapFromObject.
	 * Complex due to handling: attributes, text/CDATA, comments, arrays, mixed content, nested objects,
	 * namespace declarations, xsi:type attributes, and recursive serialization with circular reference tracking.
	 * Simplification would require separating into multiple pass operations or introducing intermediate representations.
	 */
	private mapFromObjectInternal(obj: any, rootElementName: string, elementMetadata?: XmlElementMetadata): any {
		const ctor = obj.constructor;
		const metadata = getMetadata(ctor);
		const {
			attributes: attributeMetadata,
			propertyMappings,
			fieldElements: fieldElementMetadata,
			arrays: arrayMetadata,
			queryables: dynamicMetadata,
			comments: commentsMetadata,
			ignoredProperties: ignoredProps,
		} = metadata;
		const textMetadata = this.buildSerializationTextMetadata(metadata);
		const result: any = {};
		const isNestedElement = this.isNestedElementContext(metadata, elementMetadata);

		if (elementMetadata?.xmlSpace) {
			result[`@_xml:space`] = elementMetadata.xmlSpace;
		}

		this.serializeAttributes(obj, result, attributeMetadata, ignoredProps);
		this.serializeTextContent(obj, result, textMetadata);
		const commentsByTarget = this.buildCommentsByTarget(obj, commentsMetadata);

		const excludedKeys = this.buildSerializationExcludedKeys(attributeMetadata, textMetadata, commentsMetadata);
		const allPropertyKeys = this.sortSerializablePropertyKeys(
			XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings),
			fieldElementMetadata,
			arrayMetadata,
			dynamicMetadata,
		);

		for (const key of allPropertyKeys) {
			if (ignoredProps.has(key) || excludedKeys.has(key)) continue;

			const fieldMetadata = fieldElementMetadata[key];
			let value = this.applySerializeTransform(obj[key], fieldMetadata);

			if (
				this.serializeMixedContent(
					value,
					key,
					fieldMetadata,
					elementMetadata,
					propertyMappings,
					fieldElementMetadata,
					result,
				)
			)
				continue;
			const nullResult = this.handleNullValue(
				value,
				key,
				fieldMetadata,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				isNestedElement,
				result,
			);
			if (nullResult === "skip") continue;
			if (nullResult === "nulled") value = null;

			const xmlName = this.getPropertyXmlName(
				key,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				isNestedElement,
			);
			this.serializePropertyValue(value, key, xmlName, obj, fieldMetadata, commentsByTarget, result);
		}

		return { [rootElementName]: result };
	}

	/**
	 * Sort serializable property keys by explicit metadata order while preserving
	 * stable declaration/enumeration order for ties and unordered properties.
	 */
	private sortSerializablePropertyKeys(
		allPropertyKeys: string[],
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		arrayMetadata: Record<string, XmlArrayMetadata[]>,
		dynamicMetadata: Array<{ propertyKey: string; order?: number }>,
	): string[] {
		const dynamicOrderByProperty = new Map<string, number>();

		for (const dynamic of dynamicMetadata) {
			if (typeof dynamic.order === "number" && Number.isFinite(dynamic.order)) {
				const existing = dynamicOrderByProperty.get(dynamic.propertyKey);
				if (existing === undefined || dynamic.order < existing) {
					dynamicOrderByProperty.set(dynamic.propertyKey, dynamic.order);
				}
			}
		}

		return allPropertyKeys
			.map((key, index) => ({
				key,
				index,
				order: this.resolvePropertyOrder(key, fieldElementMetadata, arrayMetadata, dynamicOrderByProperty),
			}))
			.sort((left, right) => {
				const leftOrdered = left.order !== undefined;
				const rightOrdered = right.order !== undefined;

				if (leftOrdered && rightOrdered && left.order !== right.order) {
					return (left.order as number) - (right.order as number);
				}
				if (leftOrdered !== rightOrdered) {
					return leftOrdered ? -1 : 1;
				}

				return left.index - right.index;
			})
			.map((entry) => entry.key);
	}

	/**
	 * Resolve the effective order for a property across supported decorator metadata.
	 */
	private resolvePropertyOrder(
		propertyKey: string,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		arrayMetadata: Record<string, XmlArrayMetadata[]>,
		dynamicOrderByProperty: Map<string, number>,
	): number | undefined {
		const candidates: number[] = [];

		const elementOrder = fieldElementMetadata[propertyKey]?.order;
		if (typeof elementOrder === "number" && Number.isFinite(elementOrder)) {
			candidates.push(elementOrder);
		}

		const propertyArrayMetadata = arrayMetadata[propertyKey];
		if (propertyArrayMetadata && propertyArrayMetadata.length > 0) {
			for (const arrayEntry of propertyArrayMetadata) {
				if (typeof arrayEntry.order === "number" && Number.isFinite(arrayEntry.order)) {
					candidates.push(arrayEntry.order);
				}
			}
		}

		const dynamicOrder = dynamicOrderByProperty.get(propertyKey);
		if (dynamicOrder !== undefined) {
			candidates.push(dynamicOrder);
		}

		if (candidates.length === 0) {
			return undefined;
		}

		return Math.min(...candidates);
	}

	/**
	 * Build text metadata for serialization
	 */
	private buildSerializationTextMetadata(
		metadata: ReturnType<typeof getMetadata>,
	): { propertyKey: string; metadata: any } | undefined {
		if (!metadata.textProperty) return undefined;
		return { propertyKey: metadata.textProperty, metadata: metadata.textMetadata ?? { required: false } };
	}

	/**
	 * Check if this is a nested element with its own namespace context
	 */
	private isNestedElementContext(
		metadata: ReturnType<typeof getMetadata>,
		elementMetadata?: XmlElementMetadata,
	): boolean {
		return !metadata.root && !!metadata.element && !!elementMetadata?.namespaces;
	}

	/**
	 * Serialize a property value (array, object, or primitive) into the result
	 */
	private serializePropertyValue(
		value: any,
		key: string,
		xmlName: string,
		obj: any,
		fieldMetadata: XmlElementMetadata | undefined,
		commentsByTarget: Map<string, string>,
		result: any,
	): void {
		const comment = commentsByTarget.get(key);
		if (comment) result[`?_${xmlName}`] = comment;

		if (Array.isArray(value)) {
			this.serializeArrayValue(value, key, xmlName, obj, result);
		} else if (typeof value === "object" && value !== null) {
			this.serializeNestedObject(value, key, fieldMetadata, result);
		} else {
			this.serializePrimitiveValue(value, xmlName, fieldMetadata, result);
		}
	}

	/**
	 * Serialize object attributes to the result
	 */
	private serializeAttributes(
		obj: any,
		result: any,
		attributeMetadata: Record<string, XmlAttributeMetadata>,
		ignoredProps: Set<string>,
	): void {
		for (const propertyKey in attributeMetadata) {
			const attrMetadata = attributeMetadata[propertyKey];
			if (ignoredProps.has(propertyKey)) continue;

			let value = obj[propertyKey];
			if (value === null || value === undefined) {
				if (this.options.omitNullValues) continue;
				value = "";
			}

			value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "serialize");
			if (typeof value === "boolean") value = value.toString();

			if (!XmlValidationUtil.validateValue(value, attrMetadata)) {
				throw new Error(`Invalid value '${value}' for attribute '${attrMetadata.name}'`);
			}

			const attributeName = this.namespaceUtil.buildAttributeName(attrMetadata);
			result[`@_${attributeName}`] = value;
		}
	}

	/**
	 * Serialize text content to the result
	 */
	private serializeTextContent(
		obj: any,
		result: any,
		textMetadata: { propertyKey: string; metadata: any } | undefined,
	): void {
		if (!textMetadata) return;

		let textValue = obj[textMetadata.propertyKey];
		if (textValue !== undefined) {
			if (textMetadata.metadata.converter) {
				textValue = XmlValidationUtil.applyConverter(textValue, textMetadata.metadata.converter, "serialize");
			}
			if (textMetadata.metadata.useCDATA) {
				result.__cdata = textValue;
			} else {
				result["#text"] = textValue;
			}
		} else if (textMetadata.metadata.required) {
			throw new Error(`Required text content is missing`);
		}
	}

	/**
	 * Build a map of targetProperty -> comment string for serialization
	 */
	private buildCommentsByTarget(obj: any, commentsMetadata: any[]): Map<string, string> {
		const commentsByTarget = new Map<string, string>();
		for (const commentMeta of commentsMetadata) {
			const commentValue = obj[commentMeta.propertyKey];

			if (commentMeta.required && this.isEmptyComment(commentValue)) {
				throw new Error(`Required comment for '${commentMeta.targetProperty}' is missing`);
			}
			if (commentValue === undefined || commentValue === null) continue;

			if (Array.isArray(commentValue)) {
				if (commentValue.length > 0) {
					const joined = commentValue.join("\n");
					if (joined !== "") commentsByTarget.set(commentMeta.targetProperty, joined);
				}
			} else if (commentValue !== "") {
				commentsByTarget.set(commentMeta.targetProperty, String(commentValue));
			}
		}
		return commentsByTarget;
	}

	/**
	 * Check if a comment value is empty (undefined, null, empty string, or empty array)
	 */
	private isEmptyComment(value: any): boolean {
		return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
	}

	/**
	 * Build excluded keys set for serialization (attributes, text, comments)
	 */
	private buildSerializationExcludedKeys(
		attributeMetadata: Record<string, XmlAttributeMetadata>,
		textMetadata: { propertyKey: string; metadata: any } | undefined,
		commentsMetadata: any[],
	): Set<string> {
		const excludedKeys = new Set<string>();
		for (const key in attributeMetadata) excludedKeys.add(key);
		if (textMetadata) excludedKeys.add(textMetadata.propertyKey);
		for (const commentMeta of commentsMetadata) excludedKeys.add(commentMeta.propertyKey);
		return excludedKeys;
	}

	/**
	 * Apply serialize transform to a value if applicable
	 */
	private applySerializeTransform(value: any, fieldMetadata: XmlElementMetadata | undefined): any {
		if (
			fieldMetadata?.transform?.serialize &&
			value !== undefined &&
			value !== null &&
			(typeof value !== "object" || value instanceof Date || Array.isArray(value))
		) {
			return fieldMetadata.transform.serialize(value);
		}
		return value;
	}

	/**
	 * Serialize mixed content if applicable. Returns true if handled.
	 */
	private serializeMixedContent(
		value: any,
		key: string,
		fieldMetadata: XmlElementMetadata | undefined,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		result: any,
	): boolean {
		if (!fieldMetadata?.mixedContent || !Array.isArray(value)) return false;
		const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);
		result[xmlName] = this.buildMixedContentStructure(value);
		return true;
	}

	/**
	 * Handle null/undefined values during serialization. Returns "skip" to skip, "nulled" if value was set to null, or undefined to continue.
	 */
	private handleNullValue(
		value: any,
		key: string,
		fieldMetadata: XmlElementMetadata | undefined,
		elementMetadata: XmlElementMetadata | undefined,
		propertyMappings: Record<string, string>,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		isNestedElement: boolean | undefined,
		result: any,
	): "skip" | "nulled" | undefined {
		if (value !== undefined && value !== null) return undefined;

		if (this.options.omitNullValues) return "skip";

		if (fieldMetadata?.isNullable && value === null) {
			const xmlName = this.getPropertyXmlName(
				key,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				isNestedElement,
			);
			result[xmlName] = { [`@_${XSI_NAMESPACE.prefix}:nil`]: "true" };
			return "skip";
		}
		return "nulled";
	}

	/**
	 * Serialize an array value to the result
	 */
	private serializeArrayValue(value: any[], key: string, xmlName: string, obj: any, result: any): void {
		const allArrayMeta = getMetadata(obj.constructor).arrays;
		const arrayMetadata = allArrayMeta[key];

		if (!arrayMetadata || arrayMetadata.length === 0) {
			result[xmlName] = value;
			return;
		}

		const firstMetadata = arrayMetadata[0];
		const containerName = firstMetadata.containerName ?? xmlName;
		const itemName = firstMetadata.itemName;

		const processedItems = value.map((item: any): any => {
			if (typeof item === "object" && item !== null) {
				const itemType = firstMetadata.type ?? item.constructor;
				const itemElementMeta = getOrCreateDefaultElementMetadata(itemType);
				const itemElementName = this.namespaceUtil.buildElementName(itemElementMeta);
				const mappedObject = this.mapFromObject(item, itemElementName, itemElementMeta);
				return mappedObject[itemElementName];
			}
			return item;
		});

		if (firstMetadata.unwrapped) {
			this.addUnwrappedArrayItems(result, itemName ?? containerName, processedItems);
		} else if (itemName && itemName !== containerName) {
			result[containerName] = { [itemName]: processedItems };
		} else {
			result[containerName] = processedItems;
		}
	}

	/**
	 * Add unwrapped array items directly to the result
	 */
	private addUnwrappedArrayItems(result: any, targetElementName: string, processedItems: any[]): void {
		for (const item of processedItems) {
			result[targetElementName] ??= [];
			if (!Array.isArray(result[targetElementName])) {
				result[targetElementName] = [result[targetElementName]];
			}
			result[targetElementName].push(item);
		}
	}

	/**
	 * Serialize a nested object value to the result
	 */
	private serializeNestedObject(
		value: any,
		key: string,
		fieldMetadata: XmlElementMetadata | undefined,
		result: any,
	): void {
		const valueConstructor = value.constructor;
		const valueElementMetadata = getOrCreateDefaultElementMetadata(valueConstructor);
		const valueElementName = this.namespaceUtil.buildElementName(valueElementMetadata);
		const mappedValue = this.mapFromObject(value, valueElementName, valueElementMetadata);
		let elementContent = mappedValue[valueElementName];

		this.addNamespaceDeclarations(elementContent, valueElementMetadata);
		this.addXmlSpaceAttribute(elementContent, fieldMetadata, valueElementMetadata);
		elementContent = this.addXsiType(elementContent, fieldMetadata, valueConstructor);

		const finalElementName = this.resolveElementName(
			key,
			fieldMetadata,
			valueElementMetadata,
			valueElementName,
			valueConstructor,
		);
		result[finalElementName] = elementContent;
	}

	/**
	 * Add namespace declarations to an element content object
	 */
	private addNamespaceDeclarations(elementContent: any, valueElementMetadata: XmlElementMetadata): void {
		if (!valueElementMetadata.namespaces || typeof elementContent !== "object" || elementContent === null) return;
		for (const ns of valueElementMetadata.namespaces) {
			if (ns.prefix) {
				elementContent[`@_xmlns:${ns.prefix}`] = ns.uri;
			} else {
				elementContent["@_xmlns"] = ns.uri;
			}
		}
	}

	/**
	 * Add xml:space attribute to element content if applicable
	 */
	private addXmlSpaceAttribute(
		elementContent: any,
		fieldMetadata: XmlElementMetadata | undefined,
		valueElementMetadata: XmlElementMetadata,
	): void {
		const xmlSpaceToUse = fieldMetadata?.xmlSpace ?? valueElementMetadata.xmlSpace;
		if (xmlSpaceToUse && typeof elementContent === "object" && elementContent !== null) {
			elementContent[`@_xml:space`] = xmlSpaceToUse;
		}
	}

	/**
	 * Add xsi:type attribute if enabled and runtime type differs from declared type
	 */
	private addXsiType(elementContent: any, fieldMetadata: XmlElementMetadata | undefined, valueConstructor: any): any {
		if (!this.options.useXsiType || !fieldMetadata?.type || valueConstructor === fieldMetadata.type)
			return elementContent;

		const runtimeTypeName = valueConstructor.name;
		if (typeof elementContent === "object" && elementContent !== null) {
			elementContent[`@_${XSI_NAMESPACE.prefix}:type`] = runtimeTypeName;
			return elementContent;
		}
		return { [`@_${XSI_NAMESPACE.prefix}:type`]: runtimeTypeName, "#text": elementContent };
	}

	/**
	 * Resolve the final element name for a nested object with proper priority
	 */
	private resolveElementName(
		key: string,
		fieldMetadata: XmlElementMetadata | undefined,
		valueElementMetadata: XmlElementMetadata,
		valueElementName: string,
		valueConstructor: any,
	): string {
		if (fieldMetadata && fieldMetadata.name !== key) {
			return this.namespaceUtil.buildElementName(fieldMetadata);
		}
		if (
			valueElementMetadata &&
			(valueElementMetadata.name !== valueConstructor.name || valueElementMetadata.namespaces)
		) {
			return valueElementName;
		}
		return key;
	}

	/**
	 * Serialize a primitive value to the result, handling CDATA and xml:space
	 */
	private serializePrimitiveValue(
		value: any,
		xmlName: string,
		fieldMetadata: XmlElementMetadata | undefined,
		result: any,
	): void {
		if (fieldMetadata?.useCDATA && value !== null && value !== undefined) {
			const cdataObj: any = { __cdata: String(value) };
			if (fieldMetadata.xmlSpace) cdataObj[`@_xml:space`] = fieldMetadata.xmlSpace;
			result[xmlName] = cdataObj;
		} else if (fieldMetadata?.xmlSpace && value !== null && value !== undefined) {
			result[xmlName] = { "@_xml:space": fieldMetadata.xmlSpace, "#text": value };
		} else {
			result[xmlName] = value;
		}
	}

	/**
	 * Get the XML element name for a property, considering mappings and field-level element metadata.
	 */
	private getPropertyXmlName(
		propertyKey: string,
		elementMetadata?: XmlElementMetadata,
		propertyMappings?: Record<string, string>,
		fieldElementMetadata?: Record<string, XmlElementMetadata>,
		isNestedElement?: boolean,
	): string {
		// Check field-level element metadata first
		if (fieldElementMetadata?.[propertyKey]) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (fieldMetadata.namespaces && fieldMetadata.namespaces.length > 0) {
				return this.namespaceUtil.buildElementName(fieldMetadata);
			}
			return this.applyParentNamespace(fieldMetadata.name, elementMetadata, isNestedElement);
		}

		// Check property mappings as fallback (from field decorators)
		if (propertyMappings?.[propertyKey]) {
			return this.applyParentNamespace(propertyMappings[propertyKey], elementMetadata, isNestedElement);
		}

		// Default to property name with optional parent namespace
		return this.applyParentNamespace(propertyKey, elementMetadata, isNestedElement);
	}

	/**
	 * Apply parent namespace prefix to a name if applicable
	 */
	private applyParentNamespace(name: string, elementMetadata?: XmlElementMetadata, isNestedElement?: boolean): string {
		if (isNestedElement && elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
			const prefix = elementMetadata.namespaces[0].prefix;
			if (prefix) {
				return `${prefix}:${name}`;
			}
		}
		return name;
	}

	/**
	 * Build mixed content structure.
	 * Converts mixed content array to a structure that combines text and elements.
	 * Mixed content format: [{ text: "..." }, { element: "em", content: "..." }]
	 */
	private buildMixedContentStructure(mixedArray: any[]): any {
		// Handle empty array - return empty string to create empty element
		if (mixedArray.length === 0) {
			return "";
		}

		const elements: any[] = [];
		let currentText = "";

		for (const node of mixedArray) {
			if (node.text !== undefined) {
				// Accumulate text nodes
				currentText += node.text;
			} else if (node.element !== undefined) {
				// If we have accumulated text, add it first
				if (currentText) {
					if (elements.length === 0) {
						// First item, use #text
						elements.push({ "#text": currentText });
					} else {
						elements.push({ "#text": currentText });
					}
					currentText = "";
				}

				// Add element
				const elementName = node.element;
				const content = node.content;
				const attrs = node.attributes ?? {};

				const elementObj: any = {};

				// Add attributes
				for (const attrName in attrs) {
					elementObj[`@_${attrName}`] = attrs[attrName];
				}

				// Add content
				if (typeof content === "string") {
					elementObj["#text"] = content;
				} else if (Array.isArray(content)) {
					// Nested mixed content
					const nested = this.buildMixedContentStructure(content);
					Object.assign(elementObj, nested);
				}

				elements.push({ [elementName]: elementObj });
			}
		}

		// Add any remaining text
		if (currentText) {
			elements.push({ "#text": currentText });
		}

		// If only one element, return it directly; otherwise return array
		if (elements.length === 1) {
			return elements[0];
		}
		return elements;
	}

	/**
	 * Deserialize mixed content from XML array format back to structured array.
	 * Converts format back to: [{ text: "..." }, { element: "em", content: "..." }]
	 */
	private deserializeMixedContent(xmlArray: any[]): any[] {
		const result: any[] = [];

		for (const item of xmlArray) {
			if (typeof item === "string") {
				// Text node
				result.push({ text: item });
			} else if (typeof item === "object" && item !== null) {
				// Element node - extract element name and content
				const elementNames = Object.keys(item).filter((k) => !k.startsWith("@_") && k !== "#text");

				if (elementNames.length > 0) {
					const elementName = elementNames[0];
					const elementData = item[elementName];

					// Extract attributes (keys starting with @_)
					const attributes: any = {};
					let content: any;

					if (typeof elementData === "object" && elementData !== null) {
						// Extract attributes
						for (const key in elementData) {
							if (key.startsWith("@_")) {
								attributes[key.substring(2)] = elementData[key];
							}
						}

						// Extract content
						if (elementData["#text"] !== undefined) {
							content = elementData["#text"];
						} else if (Array.isArray(elementData)) {
							// Nested mixed content array
							content = this.deserializeMixedContent(elementData);
						} else {
							// Complex object or nested elements
							const contentKeys = Object.keys(elementData).filter((k) => !k.startsWith("@_") && k !== "#text");
							if (contentKeys.length > 0) {
								content = elementData;
							} else {
								content = "";
							}
						}
					} else {
						// Simple text content
						content = elementData;
					}

					const node: any = { element: elementName, content };
					if (Object.keys(attributes).length > 0) {
						node.attributes = attributes;
					}
					result.push(node);
				} else if (item["#text"]) {
					// Direct text node
					result.push({ text: item["#text"] });
				}
			}
		}

		return result;
	}

	/**
	 * Build a DynamicElement from parsed XML data
	 */
	private buildDynamicElement(
		data: any,
		name: string,
		options: {
			parseChildren?: boolean;
			parseNumeric?: boolean;
			parseBoolean?: boolean;
			trimValues?: boolean;
			preserveRawText?: boolean;
			maxDepth?: number;
		},
		depth: number = 0,
		path: string = "",
		indexInParent: number = 0,
	): DynamicElement {
		// eslint-disable-next-line typescript/restrict-template-expressions -- name parameter is always a string
		const elementPath = path ? `${path}/${name}` : name;

		const { attributes, xmlnsDeclarations, text, rawText } = this.parseDynamicElementData(data, options);
		const numericValue = this.parseNumericValue(text, options);
		const booleanValue = this.parseBooleanValue(text, options);
		const childElements = this.parseDynamicChildren(data, options, depth, elementPath);

		const element = new DynamicElement({
			name,
			attributes,
			xmlnsDeclarations: Object.keys(xmlnsDeclarations).length > 0 ? xmlnsDeclarations : undefined,
			children: childElements,
			text,
			rawText: options.preserveRawText ? rawText : undefined,
			numericValue,
			booleanValue,
			depth,
			path: elementPath,
			indexInParent,
			hasChildren: childElements.length > 0,
			isLeaf: childElements.length === 0,
		});

		for (const child of childElements) {
			child.parent = element;
		}
		for (let i = 0; i < childElements.length; i++) {
			childElements[i].siblings = childElements.filter((_, index) => index !== i);
			childElements[i].indexAmongAllSiblings = i;
		}

		return element;
	}

	/**
	 * Parse data into attributes, xmlns declarations, text, and rawText for building a DynamicElement
	 */
	private parseDynamicElementData(
		data: any,
		options: { trimValues?: boolean },
	): {
		attributes: Record<string, string>;
		xmlnsDeclarations: Record<string, string>;
		text: string | undefined;
		rawText: string | undefined;
	} {
		const attributes: Record<string, string> = {};
		const xmlnsDeclarations: Record<string, string> = {};
		let text: string | undefined;
		let rawText: string | undefined;

		if (typeof data === "string") {
			rawText = data;
			text = options.trimValues !== false ? data.trim() : data;
		} else if (typeof data === "number" || typeof data === "boolean") {
			text = String(data);
			rawText = text;
		} else if (typeof data === "object" && data !== null) {
			this.extractAttributes(data, attributes, xmlnsDeclarations);

			if (data["#text"]) {
				rawText = String(data["#text"]);
				text = options.trimValues !== false ? rawText.trim() : rawText;
			} else if (data.__cdata) {
				rawText = String(data.__cdata);
				text = options.trimValues !== false ? rawText.trim() : rawText;
			}
		}

		return { attributes, xmlnsDeclarations, text, rawText };
	}

	/**
	 * Extract attributes and xmlns declarations from data object
	 */
	private extractAttributes(
		data: any,
		attributes: Record<string, string>,
		xmlnsDeclarations: Record<string, string>,
	): void {
		const attrKeys = Object.keys(data).filter((k) => k.startsWith("@_"));
		for (const attrKey of attrKeys) {
			const attrName = attrKey.substring(2);
			const attrValue = String(data[attrKey]);

			if (attrName.startsWith("xmlns:")) {
				xmlnsDeclarations[attrName.substring(6)] = attrValue;
			} else if (attrName === "xmlns") {
				xmlnsDeclarations[""] = attrValue;
			}

			attributes[attrName] = attrValue;
		}
	}

	/**
	 * Parse numeric value from text
	 */
	private parseNumericValue(text: string | undefined, options: { parseNumeric?: boolean }): number | undefined {
		if (options.parseNumeric === false || !text) return undefined;
		if (!/^-?\d+(\.\d+)?$/.test(text) || /^0\d+/.test(text)) return undefined;
		const num = Number(text);
		return !Number.isNaN(num) ? num : undefined;
	}

	/**
	 * Parse boolean value from text
	 */
	private parseBooleanValue(text: string | undefined, options: { parseBoolean?: boolean }): boolean | undefined {
		if (options.parseBoolean === false || !text) return undefined;
		const lower = text.toLowerCase();
		if (lower === "true" || lower === "false") return lower === "true";
		return undefined;
	}

	/**
	 * Parse child elements for a DynamicElement
	 */
	private parseDynamicChildren(
		data: any,
		options: {
			parseChildren?: boolean;
			parseNumeric?: boolean;
			parseBoolean?: boolean;
			trimValues?: boolean;
			preserveRawText?: boolean;
			maxDepth?: number;
		},
		depth: number,
		elementPath: string,
	): DynamicElement[] {
		const childElements: DynamicElement[] = [];
		const shouldParseChildren =
			options.parseChildren !== false &&
			typeof data === "object" &&
			data !== null &&
			(options.maxDepth === undefined || depth < options.maxDepth);

		if (!shouldParseChildren) return childElements;

		for (const [key, value] of Object.entries(data)) {
			if (key.startsWith("@_") || key === "#text" || key === "__cdata") continue;

			const children = Array.isArray(value) ? value : [value];
			for (let i = 0; i < children.length; i++) {
				childElements.push(this.buildDynamicElement(children[i], key, options, depth + 1, elementPath, i));
			}
		}

		return childElements;
	}
}
