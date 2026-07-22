/* eslint-disable typescript/no-explicit-any, typescript/explicit-function-return-type -- Mapping util works with dynamic any types for XML processing */
import {
	XmlArrayItem,
	XmlArrayMetadata,
	XmlAttributeMetadata,
	XmlElementMetadata,
	XmlNamespace,
	XmlValidationMode,
	XmlValidationRule,
	XmlValueFacets,
	XSI_NAMESPACE,
} from "../decorators";
import {
	type Constructor,
	findConstructorByAttributeMetadata,
	findConstructorByName,
	findElementClass,
	findTypeByQualifiedName,
	getMetadata,
} from "../decorators/storage/metadata-storage";
import { resolveMetadataType, resolveTypeRef, type TypeRef } from "../decorators/storage/type-ref";
import { DynamicElement } from "../query/dynamic-element";
import { SerializationOptions } from "../serialization-options";
import { ORDERED_SEQUENCE_KEY } from "../xml-builder";
import { attachChildOrder, getChildOrder } from "../xml-decorator-parser";

import { extendNamespaceScope, findElementKey, type NamespaceScope, splitQName } from "./xml-element-lookup";
import { getOrCreateDefaultElementMetadata } from "./xml-metadata-util";
import { XmlNamespaceUtil } from "./xml-namespace-util";
import { XmlValidationUtil } from "./xml-validation-util";

/** Sentinel value indicating an element was handled inline and should be skipped */
const SKIP_ELEMENT = Symbol("SKIP_ELEMENT");

/** XSD built-ins whose values are JavaScript numbers, for scalar item matching. */
const NUMERIC_DATA_TYPES = new Set([
	"integer",
	"int",
	"long",
	"short",
	"byte",
	"decimal",
	"float",
	"double",
	"nonNegativeInteger",
	"nonPositiveInteger",
	"positiveInteger",
	"negativeInteger",
	"unsignedInt",
	"unsignedLong",
	"unsignedShort",
	"unsignedByte",
]);

/**
 * The `typeof` an `@XmlArray` item's declared `dataType` produces, or undefined
 * when it declares none. Used to pick which alternative a scalar belongs to on
 * write, where the value itself carries no element name.
 */
function scalarKindOf(item: { dataType?: string }): "number" | "boolean" | "string" | undefined {
	if (!item.dataType) return undefined;
	const local = item.dataType.includes(":") ? item.dataType.slice(item.dataType.indexOf(":") + 1) : item.dataType;
	if (NUMERIC_DATA_TYPES.has(local)) return "number";
	if (local === "boolean") return "boolean";
	return "string";
}

/**
 * Utility class for mapping between objects and XML structures.
 */
export class XmlMappingUtil {
	private namespaceUtil: XmlNamespaceUtil;
	private visitedObjects: WeakSet<object>;
	/**
	 * Content objects of nested elements whose type is in NO namespace (neither the
	 * referencing member nor the referenced class declares one). Used to emit
	 * `xmlns=""` when such an element is nested under a default-namespace ancestor,
	 * matching C# XmlSerializer.
	 */
	private namespaceFreeContent: WeakSet<object>;

	constructor(private options: SerializationOptions) {
		this.namespaceUtil = new XmlNamespaceUtil();
		this.visitedObjects = new WeakSet();
		this.namespaceFreeContent = new WeakSet();
	}

	/**
	 * Reset the per-serialization trackers for a new serialization operation.
	 */
	resetVisitedObjects(): void {
		this.visitedObjects = new WeakSet();
		this.namespaceFreeContent = new WeakSet();
	}

	/**
	 * Content objects known to be in no namespace (see {@link namespaceFreeContent}).
	 * Consumed by the namespace dedup pass to emit `xmlns=""` resets.
	 */
	getNamespaceFreeContent(): WeakSet<object> {
		return this.namespaceFreeContent;
	}

	/**
	 * Resolve the validation mode for a specific rule: the serializer's per-rule
	 * override wins, then its global validationMode, then "strict".
	 */
	private modeForRule(rule: XmlValidationRule): XmlValidationMode {
		return this.options.validationModeOverrides?.[rule] ?? this.options.validationMode ?? "strict";
	}

	/**
	 * Report a validation violation according to the effective mode:
	 * strict → throw, warn → console.warn, off → ignore.
	 */
	private reportViolation(message: string, mode: XmlValidationMode): void {
		if (mode === "strict") {
			throw new Error(message);
		}
		if (mode === "warn") {
			console.warn(message);
		}
	}

	/**
	 * Validate a value against a property's XSD facets, handling each violated
	 * rule according to its own effective validation mode.
	 */
	private validateFacetsForProperty(value: any, facets: XmlValueFacets, label: string): void {
		for (const violation of XmlValidationUtil.validateFacets(value, facets)) {
			this.reportViolation(
				`Invalid value '${value}' for ${label}: ${violation.message}`,
				this.modeForRule(violation.rule),
			);
		}
	}

	/**
	 * Validate choice groups: at most one member of a group may be set, and at
	 * least one must be set when any member declares choiceRequired.
	 */
	private validateChoiceGroups(
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		isSet: (propertyKey: string) => boolean,
		contextName: string,
	): void {
		const groups = new Map<string, string[]>();
		const metadataFor = (key: string): XmlElementMetadata | XmlArrayMetadata | undefined =>
			fieldElementMetadata[key] ?? allArrayMetadata[key]?.[0];

		const addMember = (group: string, key: string): void => {
			const members = groups.get(group);
			if (members) {
				if (!members.includes(key)) members.push(key);
			} else {
				groups.set(group, [key]);
			}
		};
		for (const key in fieldElementMetadata) {
			const group = fieldElementMetadata[key].choiceGroup;
			if (group) addMember(group, key);
		}
		for (const key in allArrayMetadata) {
			const group = allArrayMetadata[key]?.[0]?.choiceGroup;
			if (group) addMember(group, key);
		}

		const mode = this.modeForRule("choiceGroup");
		if (mode === "off") return;

		for (const [group, keys] of groups) {
			const setKeys = keys.filter(isSet);
			if (setKeys.length > 1) {
				this.reportViolation(
					`Choice group '${group}' in '${contextName}': only one of [${keys.join(", ")}] may be set, but [${setKeys.join(", ")}] are set`,
					mode,
				);
			}
			const required = keys.some((key) => metadataFor(key)?.choiceRequired);
			if (setKeys.length === 0 && required) {
				this.reportViolation(
					`Choice group '${group}' in '${contextName}': one of [${keys.join(", ")}] must be set`,
					mode,
				);
			}
		}
	}

	/**
	 * Validate array min/maxOccurs item counts, each according to its own rule mode.
	 */
	private validateArrayOccurs(value: any[], metadata: XmlArrayMetadata, contextName: string): void {
		if (metadata.minOccurs === undefined && metadata.maxOccurs === undefined) return;

		const name = metadata.containerName ?? metadata.itemName ?? contextName;
		if (metadata.minOccurs !== undefined && value.length < metadata.minOccurs) {
			this.reportViolation(
				`Array '${name}' has ${value.length} item(s), but minOccurs is ${metadata.minOccurs}`,
				this.modeForRule("minOccurs"),
			);
		}
		if (metadata.maxOccurs !== undefined && value.length > metadata.maxOccurs) {
			this.reportViolation(
				`Array '${name}' has ${value.length} item(s), but maxOccurs is ${metadata.maxOccurs}`,
				this.modeForRule("maxOccurs"),
			);
		}
	}

	/**
	 * Read an xsi:type attribute value from a parsed element object. Handles the
	 * conventional `xsi:` prefix and any other prefix bound to the XSI namespace URI
	 * on this element.
	 */
	private getXsiTypeValue(data: any): string | undefined {
		const direct = data[`@_${XSI_NAMESPACE.prefix}:type`];
		if (typeof direct === "string") return direct;
		for (const key of Object.keys(data)) {
			if (!key.startsWith("@_") || !key.endsWith(":type")) continue;
			const prefix = key.slice(2, -":type".length);
			if (data[`@_xmlns:${prefix}`] === XSI_NAMESPACE.uri && typeof data[key] === "string") {
				return data[key];
			}
		}
		return undefined;
	}

	/**
	 * Resolve the concrete constructor named by an `xsi:type` attribute, if present
	 * and if it names a known subtype of the declared type. Returns undefined when
	 * there is no xsi:type, the type is unknown, or it already equals the declared
	 * type. A resolved type that is NOT a subtype of the declared type is a schema
	 * inconsistency, reported per the effective validation mode and then ignored.
	 */
	private resolveXsiTypeTarget(data: any, declaredType: Constructor): Constructor | undefined {
		if (typeof data !== "object" || data === null) return undefined;
		const xsiType = this.getXsiTypeValue(data);
		if (!xsiType) return undefined;

		const colon = xsiType.indexOf(":");
		const prefix = colon > 0 ? xsiType.slice(0, colon) : "";
		const localName = colon > 0 ? xsiType.slice(colon + 1) : xsiType;

		// Prefer URI-based resolution (prefix-independent) using the xmlns declared on
		// this element; fall back to the prefixed element registry (round-trips of our
		// own output register "prefix:Local"), then the plain type name.
		let ctor: Constructor | undefined;
		const uri = prefix ? data[`@_xmlns:${prefix}`] : data["@_xmlns"];
		if (typeof uri === "string") ctor = findTypeByQualifiedName(uri, localName);
		ctor ??= findElementClass(xsiType, undefined, false);
		ctor ??= findConstructorByName(localName);

		if (!ctor || ctor === declaredType) return undefined;
		if (!this.isSubclassOrSame(ctor, declaredType)) {
			this.reportViolation(
				`xsi:type="${xsiType}" resolves to '${ctor.name}', which is not a subtype of '${declaredType.name}'`,
				this.options.validationMode ?? "strict",
			);
			return undefined;
		}
		return ctor;
	}

	/**
	 * True when `ctor` is the same constructor as `base` or extends it.
	 */
	private isSubclassOrSame(ctor: any, base: any): boolean {
		if (ctor === base) return true;
		return typeof ctor === "function" && typeof base === "function" && ctor.prototype instanceof base;
	}

	/**
	 * Detect an xsi:nil="true" marker on a parsed element object.
	 */
	private isXsiNil(value: any): boolean {
		if (typeof value !== "object" || value === null) return false;
		for (const key of Object.keys(value)) {
			if (key === "@_nil" || key === `@_${XSI_NAMESPACE.prefix}:nil` || /^@_[\w.-]+:nil$/.test(key)) {
				if (value[key] === "true" || value[key] === true) return true;
			}
		}
		return false;
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
	mapToObject<T extends object>(data: any, targetClass: new () => T, parentScope?: NamespaceScope): T {
		// Polymorphic deserialization: an xsi:type attribute naming a known subtype
		// redirects mapping into that concrete class (matching C# XmlSerializer). The
		// redirect is idempotent — mapping into the subtype resolves xsi:type to the
		// same class, so there is no further redirection.
		const concreteType = this.resolveXsiTypeTarget(data, targetClass);
		if (concreteType) {
			return this.mapToObject(data, concreteType as new () => T, parentScope);
		}

		// Namespace bindings visible to this element's children: what it inherited,
		// plus whatever it declares itself.
		const scope = extendNamespaceScope(parentScope, data);

		const instance = new targetClass();
		const metadata = getMetadata(targetClass);

		// An element whose text is interleaved with its children parses to `#mixed`.
		// Unless a member claims that shape wholesale, flatten it into ordinary
		// children so the class's typed members still read — and so nothing named
		// `#mixed` survives to be written back as an element, which is not a legal name.
		data = this.extractMixedText(data, metadata, instance) ?? data;
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

		this.mapAttributes(instance, data, targetClass, attributeMetadata, ignoredProps, foundProperties);
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

		this.handleUnwrappedArrays(instance, data, allArrayMetadata, excludedKeys, foundProperties, scope);
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
			scope,
		);
		this.applyDefaults(instance, fieldElementMetadata, foundProperties);
		this.applyArrayDefaults(instance, allArrayMetadata, foundProperties);
		this.mapDynamicElements(instance, targetClass, data, elementMetadata, propertyMappings, fieldElementMetadata);
		this.checkRequiredElements(data, fieldElementMetadata, targetClass, scope);
		this.checkRequiredArrays(allArrayMetadata, foundProperties, targetClass);
		this.validateChoiceGroups(
			fieldElementMetadata,
			allArrayMetadata,
			(propertyKey) => {
				if (!foundProperties.has(propertyKey)) return false;
				// Empty elements (<tag/>) deserialize to "" and count as absent
				const memberValue = (instance as any)[propertyKey];
				return memberValue !== undefined && memberValue !== null && memberValue !== "";
			},
			targetClass.name || "Unknown",
		);
		this.validateDeserializedArrays(instance, allArrayMetadata, foundProperties);

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
		targetClass: new () => any,
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
			if (value === undefined && attrMetadata.fixedValue !== undefined) {
				value = attrMetadata.fixedValue;
			}
			const isAttrRequired =
				attrMetadata.required || (this.options.requireAllByDefault && !attrMetadata.requiredExplicitlyFalse);
			if (value === undefined && isAttrRequired) {
				const className = targetClass.name || "Unknown";
				throw new Error(`Required attribute '${attributeName}' is missing in element '${className}'`);
			}
			if (value !== undefined) {
				instance[propertyKey] = this.deserializeAttributeValue(
					value,
					attrMetadata,
					instance,
					propertyKey,
					attributeName,
				);
				foundProperties.add(propertyKey);
			}
		}
	}

	/**
	 * Apply converter, whiteSpace, xs:list splitting, facet validation, and type
	 * conversion to a raw attribute value.
	 */
	private deserializeAttributeValue(
		value: any,
		attrMetadata: XmlAttributeMetadata,
		instance: any,
		propertyKey: string,
		attributeName: string,
	): any {
		value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "deserialize");
		if (typeof value === "string" && attrMetadata.whiteSpace) {
			value = XmlValidationUtil.applyWhiteSpace(value, attrMetadata.whiteSpace);
		}
		if (attrMetadata.list && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
			value = XmlValidationUtil.splitList(String(value), attrMetadata.list);
		}
		this.validateFacetsForProperty(value, attrMetadata, `attribute '${attributeName}'`);
		value = XmlValidationUtil.mapEnumDeserialize(value, attrMetadata.enumMap);
		value = XmlValidationUtil.normalizeEnumToken(value, attrMetadata.enumValues);
		let converted = Array.isArray(value)
			? value
			: XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
		if (!Array.isArray(converted) && attrMetadata.dataType && instance[propertyKey] === undefined) {
			converted = XmlValidationUtil.coerceByDataType(converted, attrMetadata.dataType);
		}
		return converted;
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
		// A mixed-text member holds the runs extracted from `#mixed`, which
		// extractMixedText has already assigned; the scalar text path would overwrite
		// them with the element's own (empty) text.
		if (textMetadata.metadata.mixed) return;

		let textValue: any;
		if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
			// Text-only elements parse to a primitive instead of an object
			textValue = data;
		} else if (data.__cdata !== undefined) {
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
			instance[textMetadata.propertyKey] = this.deserializeTextValue(
				textValue,
				textMetadata.metadata,
				instance,
				textMetadata.propertyKey,
			);
		} else if (textMetadata.metadata.fixedValue !== undefined) {
			instance[textMetadata.propertyKey] = textMetadata.metadata.fixedValue;
		} else if (textMetadata.metadata.required) {
			throw new Error(`Required text content is missing`);
		}
	}

	/**
	 * Apply converter, whiteSpace, xs:list splitting, facet validation, and type
	 * conversion to raw text content.
	 */
	private deserializeTextValue(textValue: any, meta: any, instance: any, propertyKey: string): any {
		if (meta.converter) {
			textValue = XmlValidationUtil.applyConverter(textValue, meta.converter, "deserialize");
		}
		if (typeof textValue === "string" && meta.whiteSpace) {
			textValue = XmlValidationUtil.applyWhiteSpace(textValue, meta.whiteSpace);
		}
		if (
			meta.list &&
			(typeof textValue === "string" || typeof textValue === "number" || typeof textValue === "boolean")
		) {
			textValue = XmlValidationUtil.splitList(String(textValue), meta.list);
		}
		this.validateFacetsForProperty(textValue, meta, "text content");
		textValue = XmlValidationUtil.mapEnumDeserialize(textValue, meta.enumMap);
		textValue = XmlValidationUtil.normalizeEnumToken(textValue, meta.enumValues);
		let converted = Array.isArray(textValue)
			? textValue
			: XmlValidationUtil.convertToPropertyType(textValue, instance, propertyKey);
		if (!Array.isArray(converted) && meta.dataType && instance[propertyKey] === undefined) {
			converted = XmlValidationUtil.coerceByDataType(converted, meta.dataType);
		}
		return converted;
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
				this.registerArrayContainerNames(xmlToPropertyMap, propertyKey, xmlName, arrayMetadata[0]);
			} else {
				this.registerElementName(xmlToPropertyMap, propertyKey, xmlName, elementMetadata);
			}
		}
		return xmlToPropertyMap;
	}

	/**
	 * Register array container name(s) in the XML-to-property map, including the prefixed
	 * variant when form is 'qualified'.
	 */
	private registerArrayContainerNames(
		xmlToPropertyMap: Record<string, string>,
		propertyKey: string,
		xmlName: string,
		firstArrayMetadata: XmlArrayMetadata,
	): void {
		const bare = firstArrayMetadata.containerName ?? xmlName;
		xmlToPropertyMap[bare] = propertyKey;
		// Also register the prefixed container name for qualified arrays
		const containerNs = firstArrayMetadata.namespaces?.[0];
		if (containerNs?.prefix && firstArrayMetadata.form === "qualified" && !bare.includes(":")) {
			xmlToPropertyMap[`${containerNs.prefix}:${bare}`] = propertyKey;
		}
		// Local-name fallback for documents using a different prefix (see registerElementName).
		const { localName } = splitQName(bare);
		xmlToPropertyMap[localName] ??= propertyKey;
	}

	/**
	 * Register an element name in the XML-to-property map, including the parent-prefixed
	 * variant for elements that inherit a namespace from their parent.
	 */
	private registerElementName(
		xmlToPropertyMap: Record<string, string>,
		propertyKey: string,
		xmlName: string,
		elementMetadata: XmlElementMetadata | undefined,
	): void {
		xmlToPropertyMap[xmlName] = propertyKey;
		if (elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
			const parentPrefix = elementMetadata.namespaces[0].prefix;
			if (parentPrefix && !xmlName.includes(":")) {
				xmlToPropertyMap[`${parentPrefix}:${xmlName}`] = propertyKey;
			}
		}
		// Register the bare local name too, so a document using a different prefix
		// resolves via the local-name fallback in mapXmlElements. Never overwrite an
		// existing entry: an exact-name match must win over a local-name coincidence.
		const { localName } = splitQName(xmlName);
		xmlToPropertyMap[localName] ??= propertyKey;
	}

	/**
	 * Handle unwrapped arrays where itemName appears directly in data
	 */
	private handleUnwrappedArrays(
		instance: any,
		data: any,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		excludedKeys: Set<string>,
		foundProperties: Set<string>,
		scope: NamespaceScope,
	): void {
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (!metadataArray || metadataArray.length === 0) continue;

			const metadata = metadataArray[0];

			// A multi-alternative collection matches several element names at once and
			// must keep them in document order, so it reads on its own path.
			if (metadata.items && metadata.items.length > 0) {
				this.readItemsArray(instance, data, propertyKey, metadata, excludedKeys, foundProperties, scope);
				continue;
			}

			const itemName = metadata.itemName;
			if (!itemName || metadata.containerName) continue;

			// Serialization writes the item tag through qualifyArrayName, so a qualified
			// array's items appear as `prefix:item`. Resolve namespace-aware — otherwise
			// the lookup misses, the element falls through to the scalar path, and a
			// single item silently deserializes to a bare object instead of a
			// one-element array.
			const qualifiedItemName = this.qualifyArrayName(itemName, metadata);
			const dataKey = this.findDataKey(data, metadata, qualifiedItemName, scope);
			if (dataKey === undefined || data[dataKey] === undefined) continue;

			let items = data[dataKey];
			if (!Array.isArray(items)) items = [items];

			const unwrappedItemType = resolveMetadataType(metadata);
			if (unwrappedItemType) {
				const itemType = unwrappedItemType as new () => object;
				items = items.map((item: any) =>
					typeof item === "object" && item !== null ? this.mapToObject(item, itemType, scope) : item,
				);
			}

			instance[propertyKey] = items;
			// Exclude the key actually consumed (qualified or bare) so the generic
			// element loop does not process it a second time.
			excludedKeys.add(dataKey);
			foundProperties.add(propertyKey);
		}
	}

	/**
	 * Check occurrence bounds and item facets on every array that was actually read.
	 */
	private validateDeserializedArrays(
		instance: any,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		foundProperties: Set<string>,
	): void {
		for (const propertyKey in allArrayMetadata) {
			const arrayMeta = allArrayMetadata[propertyKey]?.[0];
			if (!arrayMeta || !foundProperties.has(propertyKey)) continue;

			const arrayValue = instance[propertyKey];
			if (!Array.isArray(arrayValue)) continue;

			this.validateArrayOccurs(arrayValue, arrayMeta, propertyKey);
			for (const item of arrayValue) {
				if (typeof item === "object" && item !== null) continue;
				this.validateFacetsForProperty(item, arrayMeta, `array '${arrayMeta.containerName ?? propertyKey}' item`);
			}
		}
	}

	/**
	 * Flatten a `#mixed` payload into ordinary grouped children, capturing the text
	 * runs into the class's `@XmlText({ mixed: true })` member when it declares one.
	 *
	 * Returns the rewritten data, or undefined when there is nothing to do — either
	 * the element is not mixed, or a member declares `mixedContent` and wants the raw
	 * `#mixed` array as-is.
	 *
	 * Without this, a mixed complex type read back empty (its typed members never
	 * matched, because the children were buried inside `#mixed`) and then serialized
	 * a `<#mixed>` element, which no parser accepts.
	 */
	private extractMixedText(data: any, metadata: ReturnType<typeof getMetadata>, instance: any): any {
		if (typeof data !== "object" || data === null || !Array.isArray(data["#mixed"])) return undefined;

		// A member with `mixedContent: true` consumes the raw array itself.
		for (const key in metadata.fieldElements) {
			if (metadata.fieldElements[key]?.mixedContent === true) return undefined;
		}

		// Carry the element's own attributes across unchanged.
		const flattened: Record<string, any> = {};
		for (const key of Object.keys(data)) {
			if (key !== "#mixed") flattened[key] = data[key];
		}

		const { childOrder, textRuns } = this.splitMixedNodes(data["#mixed"], flattened);

		if (metadata.textProperty && metadata.textMetadata?.mixed) {
			instance[metadata.textProperty] = textRuns;
		}

		attachChildOrder(flattened, childOrder);
		return flattened;
	}

	/**
	 * Split a `#mixed` run into grouped child elements (written into `flattened`)
	 * and the text runs between them.
	 */
	private splitMixedNodes(nodes: any[], flattened: Record<string, any>): { childOrder: string[]; textRuns: string[] } {
		const childOrder: string[] = [];
		const textRuns: string[] = [];

		for (const node of nodes) {
			if (node?.text !== undefined) {
				textRuns.push(String(node.text));
				continue;
			}
			if (node?.element === undefined) continue;

			const name = String(node.element);
			const value = this.mixedNodeValue(node);
			childOrder.push(name);

			if (name in flattened) {
				if (!Array.isArray(flattened[name])) flattened[name] = [flattened[name]];
				flattened[name].push(value);
			} else {
				flattened[name] = value;
			}
		}

		return { childOrder, textRuns };
	}

	/** The value of one element node inside a `#mixed` run, with its attributes. */
	private mixedNodeValue(node: any): any {
		const attributes = node.attributes ?? {};
		const attributeKeys = Object.keys(attributes);
		if (attributeKeys.length === 0) return node.content;

		const value: Record<string, any> = {};
		for (const attrName of attributeKeys) {
			value[`${this.options.attributeNamePrefix ?? "@_"}${attrName}`] = attributes[attrName];
		}
		if (node.content !== undefined && node.content !== "") {
			value["#text"] = node.content;
		}
		return value;
	}

	/**
	 * Read an `@XmlArray({ items })` collection: several different element names
	 * gathered into one array, in the order the document had them.
	 *
	 * Order is the whole point of this member, and the parsed shape groups children
	 * by tag (`{ note: [a, b], task: [c] }`), which cannot say whether the document
	 * read `note task note` or `note note task`. The parser therefore records the
	 * child sequence separately; this walks that sequence and takes the next unread
	 * value for each name in turn. Without it (a hand-built object, say) the members
	 * still read correctly, just grouped by name.
	 */
	private readItemsArray(
		instance: any,
		data: any,
		propertyKey: string,
		metadata: XmlArrayMetadata,
		excludedKeys: Set<string>,
		foundProperties: Set<string>,
		scope: NamespaceScope,
	): void {
		// Map each alternative to the key it actually occupies in the parsed data,
		// which may be prefixed when the item is namespace-qualified.
		const keyByItem = new Map<string, XmlArrayItem>();
		for (const item of metadata.items ?? []) {
			const qualified = this.qualifyArrayName(item.name, {
				...metadata,
				namespaces: this.itemNamespaces(item, metadata),
			});
			const dataKey = this.findDataKey(data, metadata, qualified, scope);
			if (dataKey !== undefined && data[dataKey] !== undefined) {
				keyByItem.set(dataKey, item);
			}
		}
		if (keyByItem.size === 0) return;

		// Values per key, in document order within that key.
		const pending = new Map<string, any[]>();
		for (const dataKey of keyByItem.keys()) {
			const value = data[dataKey];
			pending.set(dataKey, Array.isArray(value) ? [...value] : [value]);
			excludedKeys.add(dataKey);
		}

		const childOrder = getChildOrder(data);
		const sequence =
			childOrder?.filter((name) => pending.has(name)) ??
			[...pending.keys()].flatMap((key) => Array.from({ length: pending.get(key)?.length ?? 0 }, () => key));

		const result: unknown[] = [];
		for (const dataKey of sequence) {
			const queue = pending.get(dataKey);
			if (!queue || queue.length === 0) continue;
			result.push(this.convertArrayItem(queue.shift(), keyByItem.get(dataKey)!, scope));
		}

		instance[propertyKey] = result;
		foundProperties.add(propertyKey);
	}

	/** Deserialize one `items` entry into the type its alternative declares. */
	private convertArrayItem(raw: any, item: XmlArrayItem, scope: NamespaceScope): unknown {
		const itemType = item.type ? resolveTypeRef(item.type) : undefined;
		if (itemType && typeof raw === "object" && raw !== null) {
			return this.mapToObject(raw, itemType as new () => object, scope);
		}
		return item.dataType ? XmlValidationUtil.coerceByDataType(raw, item.dataType) : raw;
	}

	/** The namespaces an `items` alternative is looked up and written under. */
	private itemNamespaces(item: XmlArrayItem, metadata: XmlArrayMetadata): XmlNamespace[] | undefined {
		return item.namespace ? [item.namespace] : metadata.namespaces;
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
		scope: NamespaceScope,
	): void {
		for (const xmlKey in data) {
			if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata") continue;
			if (excludedKeys.has(xmlKey)) continue;

			let propertyKey = xmlToPropertyMap[xmlKey];
			if (!propertyKey) {
				// The document may spell this element with a different prefix (or none)
				// than we do. Fall back to the local name before giving up and guessing
				// from naming conventions.
				const { localName } = splitQName(xmlKey);
				propertyKey = xmlToPropertyMap[localName] ?? this.findPropertyByNamingConventions(localName, instance);
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
				scope,
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
		scope: NamespaceScope,
	): any {
		let value = rawValue;

		// xsi:nil="true" on a nullable element deserializes to null
		if (fieldElementMetadata[propertyKey]?.isNullable && this.isXsiNil(value)) {
			return null;
		}

		// Normalize empty objects and simple text nodes
		// Pass field metadata so typed complex fields preserve {} instead of collapsing to ""
		value = this.normalizeXmlValue(value, fieldElementMetadata[propertyKey]);

		// Handle #mixed content
		const mixedResult = this.handleMixedContent(value, propertyKey, instance, fieldElementMetadata);
		if (mixedResult !== undefined) return mixedResult;

		// Handle XmlArray metadata
		value = this.handleArrayMetadata(value, propertyKey, targetClass, scope);

		// When the parser encounters multiple elements with the same name,
		// it returns them as an array. Pass arrays through unless they are mixed content.
		// Array items with types should use @XmlArray — @XmlElement does not deserialize array items.
		if (Array.isArray(value)) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (!fieldMetadata?.mixedContent) {
				return value;
			}
		}

		// Handle complex objects (nested deserialization)
		value = this.handleComplexObject(
			value,
			propertyKey,
			xmlKey,
			instance,
			fieldElementMetadata,
			elementMetadata,
			xmlToPropertyMap,
			scope,
		);

		return this.finalizeElementValue(value, fieldElementMetadata[propertyKey]);
	}

	/**
	 * Final deserialization steps for an element value: transform, mixed-content
	 * conversion, and XSD facet handling for primitives.
	 */
	private finalizeElementValue(value: any, fieldMetadata: XmlElementMetadata | undefined): any {
		if (fieldMetadata?.transform?.deserialize && (typeof value === "string" || typeof value === "number")) {
			value = fieldMetadata.transform.deserialize(String(value));
		}

		// Deserialize mixed content arrays
		if (Array.isArray(value) && fieldMetadata?.mixedContent) {
			value = this.deserializeMixedContent(value);
		}

		// Apply XSD facet handling to primitive element values
		if (fieldMetadata && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
			value = this.applyElementValueFacets(value, fieldMetadata);
		}

		return value;
	}

	/**
	 * Apply whiteSpace normalization, xs:list splitting, and facet validation to
	 * a primitive element value during deserialization.
	 */
	private applyElementValueFacets(value: any, fieldMetadata: XmlElementMetadata): any {
		if (typeof value === "string" && fieldMetadata.whiteSpace) {
			value = XmlValidationUtil.applyWhiteSpace(value, fieldMetadata.whiteSpace);
		}
		if (fieldMetadata.list) {
			value = XmlValidationUtil.splitList(String(value), fieldMetadata.list);
		}
		// An empty element on a non-required property represents "absent" —
		// do not apply value facets to it (keeps undefined → <tag/> → back round-trips valid).
		const isAbsentOptional = value === "" && fieldMetadata.required !== true;
		if (!isAbsentOptional) {
			this.validateFacetsForProperty(value, fieldMetadata, `element '${fieldMetadata.name}'`);
		}
		// Translate the XML token back to its in-memory enum member (after validating
		// the wire token). Applied before type conversion so numeric-looking tokens map
		// to their member name rather than being coerced to a number.
		value = XmlValidationUtil.mapEnumDeserialize(value, fieldMetadata.enumMap);
		return XmlValidationUtil.normalizeEnumToken(value, fieldMetadata.enumValues);
	}

	/**
	 * Normalize XML parser output: empty objects become empty strings, simple #text nodes unwrapped.
	 * When fieldMetadata has a `type`, empty elements (both `{}` from self-closing tags and `""`
	 * from explicit empty tags) are converted to `{}` so handleComplexObject can instantiate the
	 * proper typed class instead of silently returning "".
	 */
	private normalizeXmlValue(value: any, fieldMetadata?: XmlElementMetadata): any {
		// Note: `type` may hold an unresolved thunk here — these checks only need truthiness,
		// so resolveMetadataType is deliberately not called.
		if (value !== null && typeof value === "object") {
			if (Object.keys(value).length === 0) {
				// Preserve {} for typed complex fields — handleComplexObject will create the proper instance
				if (fieldMetadata?.type) return value;
				return "";
			}
			if ("#text" in value && Object.keys(value).length === 1) return value["#text"];
		}
		// Explicit empty element (<tag></tag>) produces "". For typed complex fields,
		// convert back to {} so handleComplexObject can instantiate the proper type.
		if (value === "" && fieldMetadata?.type) return {};
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
	private handleArrayMetadata(value: any, propertyKey: string, targetClass: new () => any, scope: NamespaceScope): any {
		const arrayMeta = getMetadata(targetClass).arrays[propertyKey];
		if (!arrayMeta || arrayMeta.length === 0) return value;

		const itemName = arrayMeta[0].itemName;
		if (itemName && typeof value === "object") {
			// Items may be serialized with the array's namespace prefix (form
			// 'qualified') or with a prefix of the peer's choosing; resolve
			// namespace-aware rather than by literal tag.
			const qualifiedItemName = this.qualifyArrayName(itemName, arrayMeta[0]);
			const itemKey = this.findDataKey(value, arrayMeta[0], qualifiedItemName, scope);
			if (itemKey !== undefined) {
				value = Array.isArray(value[itemKey]) ? value[itemKey] : [value[itemKey]];
			}
		}

		const resolvedItemType = resolveMetadataType(arrayMeta[0]);
		if (Array.isArray(value) && resolvedItemType) {
			const arrayItemType = resolvedItemType as new () => object;
			value = value.map((item: any) =>
				typeof item === "object" && item !== null ? this.mapToObject(item, arrayItemType, scope) : item,
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
		scope: NamespaceScope,
	): any {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return value;

		// Only extract __cdata directly when there are no XML attributes present.
		// If the object has @_ attribute keys alongside __cdata, it represents a typed
		// element with CDATA text content and attributes that needs full metadata mapping.
		if (value.__cdata !== undefined && !Object.keys(value).some((k) => k.startsWith("@_"))) {
			return value.__cdata;
		}

		const fieldMetadata = fieldElementMetadata[propertyKey];
		const declaredType = resolveMetadataType(fieldMetadata);
		if (declaredType) {
			return this.mapToObject(value, declaredType as new () => object, scope);
		}

		const propertyValue = instance[propertyKey];
		if (propertyValue && typeof propertyValue === "object" && propertyValue.constructor) {
			return this.mapToObject(value, propertyValue.constructor as new () => object, scope);
		}

		const autoDiscoveryResult = this.tryAutoDiscoveryDeserialization(
			value,
			propertyKey,
			xmlKey,
			elementMetadata,
			xmlToPropertyMap,
			scope,
		);
		if (autoDiscoveryResult !== value) {
			return autoDiscoveryResult;
		}

		// Last resort: if the value has XML attribute keys (@_) and/or text content (#text),
		// search for a registered class whose attribute metadata matches these keys.
		// This handles classes with only @XmlAttribute/@XmlText (no class-level decorator)
		// where name-based auto-discovery couldn't find a match.
		return this.tryAttributeMetadataDiscovery(value, scope);
	}

	/**
	 * Try to find a matching class by comparing the value's @_ attribute keys
	 * against registered classes' attribute metadata.
	 */
	private tryAttributeMetadataDiscovery(value: any, scope: NamespaceScope): any {
		const attrKeys = Object.keys(value).filter((k) => k.startsWith("@_"));
		const hasText = "#text" in value || "__cdata" in value;

		if (attrKeys.length === 0 && !hasText) return value;

		const matchedClass = findConstructorByAttributeMetadata(attrKeys, hasText);
		if (matchedClass) {
			return this.mapToObject(value, matchedClass as new () => object, scope);
		}

		return value;
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
		scope: NamespaceScope,
	): any {
		const hasExplicitMapping = xmlToPropertyMap[xmlKey] !== undefined;
		if (this.options.strictValidation && !hasExplicitMapping) return value;

		const parentNamespacePrefix = elementMetadata?.namespaces?.[0]?.prefix;
		const elementClass = this.findNestedClassByAutoDiscovery(xmlKey, propertyKey, parentNamespacePrefix);
		if (elementClass) {
			return this.mapToObject(value, elementClass, scope);
		}
		return value;
	}

	/**
	 * Convert a deserialized value to its final type
	 */
	private convertFinalValue(value: any, fieldMetadata: any, instance: any, propertyKey: string): any {
		// Preserve explicit null from xsi:nil deserialization
		if (value === null) return null;
		if (value !== undefined && typeof value === "object") return value;

		if (fieldMetadata?.unionTypes && fieldMetadata.unionTypes.length > 0) {
			return XmlValidationUtil.tryConvertToUnionType(value, fieldMetadata.unionTypes);
		}
		let converted = XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
		if (!Array.isArray(converted) && fieldMetadata?.dataType && instance[propertyKey] === undefined) {
			converted = XmlValidationUtil.coerceByDataType(converted, fieldMetadata.dataType);
		}
		return converted;
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
			if (foundProperties.has(propertyKey)) continue;
			if (fieldMetadata.defaultValue !== undefined) {
				instance[propertyKey] = fieldMetadata.defaultValue;
			} else if (fieldMetadata.fixedValue !== undefined) {
				instance[propertyKey] = fieldMetadata.fixedValue;
			}
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
				const elementName = targetClass.name || "Unknown";
				throw new Error(`Required queryable element '${targetName}' is missing in element '${elementName}'`);
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
	private checkRequiredElements(
		data: any,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		targetClass: new () => any,
		scope: NamespaceScope,
	): void {
		const elementName = targetClass.name || "Unknown";
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			const isRequired =
				fieldMetadata.required || (this.options.requireAllByDefault && !fieldMetadata.requiredExplicitlyFalse);
			if (isRequired && fieldMetadata.defaultValue === undefined && fieldMetadata.fixedValue === undefined) {
				const xmlName = this.namespaceUtil.buildElementName(fieldMetadata);
				// Resolve namespace-aware, so a document that spells this element with a
				// different prefix still satisfies the requirement.
				if (this.findDataKey(data, fieldMetadata, xmlName, scope) === undefined) {
					throw new Error(`Required element '${fieldMetadata.name}' is missing in element '${elementName}'`);
				}
			}
		}
	}

	/**
	 * Locate the key in `data` holding the element described by `metadata`, matching
	 * on {namespace-uri, local-name} rather than the literal prefixed string.
	 */
	private findDataKey(
		data: any,
		metadata: { namespaces?: { uri: string }[]; form?: "qualified" | "unqualified" },
		builtName: string,
		scope: NamespaceScope,
	): string | undefined {
		const expectedUri = metadata.form === "unqualified" ? undefined : metadata.namespaces?.[0]?.uri;
		return findElementKey(data, builtName, expectedUri, scope);
	}

	/**
	 * Apply defaultValue for arrays that were absent in the XML data.
	 */
	private applyArrayDefaults(
		instance: any,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		foundProperties: Set<string>,
	): void {
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (!metadataArray || metadataArray.length === 0) continue;
			const metadata = metadataArray[0];
			if (metadata.defaultValue === undefined) continue;
			if (foundProperties.has(propertyKey)) continue;

			instance[propertyKey] = Array.isArray(metadata.defaultValue) ? [...metadata.defaultValue] : metadata.defaultValue;
		}
	}

	/**
	 * Check that required arrays are present after deserialization (accounting for defaultValue).
	 */
	private checkRequiredArrays(
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		foundProperties: Set<string>,
		targetClass: new () => any,
	): void {
		const elementName = targetClass.name || "Unknown";
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (!metadataArray || metadataArray.length === 0) continue;
			const metadata = metadataArray[0];
			const isRequired = metadata.required || (this.options.requireAllByDefault && !metadata.requiredExplicitlyFalse);
			if (!isRequired || metadata.defaultValue !== undefined) continue;

			if (!foundProperties.has(propertyKey)) {
				const name = metadata.containerName ?? metadata.itemName ?? propertyKey;
				throw new Error(`Required array '${name}' is missing in element '${elementName}'`);
			}
		}
	}

	/**
	 * Check that required element properties have non-null/undefined/empty values on the instance after deserialization.
	 * This is a post-deserialization check that complements checkRequiredElements (which checks raw XML data).
	 * Empty string ("") is also rejected because self-closing (<tag/>) and explicitly empty (<tag></tag>) elements
	 * both produce "" for primitive fields, which is not a meaningful value for a required property.
	 */
	private validateRequiredElementValues(instance: any, fieldElementMetadata: Record<string, XmlElementMetadata>): void {
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (!fieldMetadata.required || fieldMetadata.defaultValue !== undefined) continue;

			const value = instance[propertyKey];
			if (value === undefined || value === null || value === "") {
				const reason =
					value === null ? "null" : value === "" ? "an empty string (empty or self-closing XML element)" : "undefined";
				throw new Error(
					`[Strict Validation Error] Required property '${fieldMetadata.name}' has no value after deserialization.\n\n` +
						`The property '${propertyKey}' is marked as required but resolved to ${reason} ` +
						`after parsing the XML.\n` +
						`Ensure the XML contains a valid '${fieldMetadata.name}' element with a non-empty value.`,
				);
			}
		}
	}

	/**
	 * Check that required arrays deserialize to actual arrays.
	 */
	private validateRequiredArrayValues(
		instance: any,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
		targetClass: new () => any,
	): void {
		const elementName = targetClass.name || "Unknown";
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
			if (!metadataArray || metadataArray.length === 0) continue;

			const metadata = metadataArray[0];
			if (!metadata.required || metadata.defaultValue !== undefined) continue;

			const value = instance[propertyKey];
			const name = metadata.containerName ?? metadata.itemName ?? propertyKey;

			if (value === undefined) {
				throw new Error(`Required array '${name}' is missing in element '${elementName}'`);
			}

			if (!Array.isArray(value)) {
				throw new Error(`Required array '${name}' must deserialize to an array in element '${elementName}'`);
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

		this.validateRequiredElementValues(instance, fieldElementMetadata);
		this.validateRequiredArrayValues(instance, allArrayMetadata, targetClass);

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

			if (!value || typeof value !== "object") continue;
			if (dynamicPropertyKeys.has(propertyKey)) continue;

			if (Array.isArray(value)) {
				this.validateArrayItems(propertyKey, fieldElementMetadata, allArrayMetadata);
				continue;
			}

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

		const declaredType = resolveMetadataType(fieldMetadata);
		if (declaredType) {
			const nestedMetadata = getMetadata(declaredType);
			if (nestedMetadata.queryables.length > 0) {
				const expectedTypeName = declaredType.name;
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
	 * Validate array items in strict mode - check that complex items are properly typed.
	 * Arrays must use @XmlArray — @XmlElement should not be used for lists.
	 */
	private validateArrayItems(
		propertyKey: string,
		fieldElementMetadata: Record<string, XmlElementMetadata>,
		allArrayMetadata: Record<string, XmlArrayMetadata[]>,
	): void {
		// Skip arrays that have proper XmlArray metadata
		const arrayMeta = allArrayMetadata[propertyKey];
		if (arrayMeta && arrayMeta.length > 0) return;

		const fieldMetadata = fieldElementMetadata[propertyKey];
		if (fieldMetadata?.mixedContent) return;

		if (fieldMetadata) {
			// A @XmlElement field received an array (multiple XML elements with the same name)
			// but the field is not declared as @XmlArray
			const xmlName = fieldMetadata.name ?? propertyKey;
			throw new Error(
				`[Strict Validation Error] Property '${propertyKey}' received an array but is declared with @XmlElement.\n\n` +
					`The XML contains multiple <${xmlName}> elements, but the property uses @XmlElement which is for single elements.\n` +
					`Use @XmlArray for properties that contain a list of items.\n\n` +
					`To fix this issue:\n` +
					`1. Declare the property as an array: @XmlArray({ itemName: '${xmlName}', type: YourItemClass })\n` +
					`2. Or if it should be a single element, ensure only one <${xmlName}> exists in the XML`,
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
		this.validateChoiceGroups(
			fieldElementMetadata,
			arrayMetadata,
			(propertyKey) => {
				const memberValue = obj[propertyKey];
				return (
					memberValue !== undefined && memberValue !== null && !(Array.isArray(memberValue) && memberValue.length === 0)
				);
			},
			ctor.name ?? "Unknown",
		);
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

			// C# [DefaultValue]: omit a scalar member equal to its declared default.
			if (this.shouldOmitDefaultValue(value, fieldMetadata)) continue;

			const xmlName = this.getPropertyXmlName(
				key,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				isNestedElement,
			);
			this.serializePropertyValue(value, key, xmlName, obj, fieldMetadata, commentsByTarget, result);
		}

		this.interleaveMixedText(obj, result, textMetadata);

		return { [rootElementName]: result };
	}

	/**
	 * Weave a mixed complex type's text runs back in among its child elements.
	 *
	 * The runs were collected in document order on read; here run *i* is placed
	 * before child element *i*, and anything left over follows the last element —
	 * the inverse of how `<Config>lead <Setting>a</Setting> tail</Config>` was taken
	 * apart. Elements and text have to leave as one ordered run, which a keyed object
	 * cannot express, so they go out through ORDERED_SEQUENCE_KEY.
	 */
	private interleaveMixedText(
		obj: any,
		result: any,
		textMetadata: { propertyKey: string; metadata: any } | undefined,
	): void {
		if (!textMetadata?.metadata.mixed) return;

		const runs = obj[textMetadata.propertyKey];
		if (!Array.isArray(runs) || runs.length === 0) return;

		// Everything already written that is an element rather than an attribute,
		// comment marker or text node.
		const elementKeys = Object.keys(result).filter(
			(key) => !key.startsWith("@_") && !key.startsWith("?") && key !== "#text" && key !== ORDERED_SEQUENCE_KEY,
		);

		const sequence: any[] = [];
		let runIndex = 0;

		for (const key of elementKeys) {
			if (runIndex < runs.length) {
				sequence.push({ "#text": String(runs[runIndex++]) });
			}
			const value = result[key];
			for (const entry of Array.isArray(value) ? value : [value]) {
				sequence.push({ [key]: entry });
			}
			delete result[key];
		}

		for (; runIndex < runs.length; runIndex++) {
			sequence.push({ "#text": String(runs[runIndex]) });
		}

		result[ORDERED_SEQUENCE_KEY] = [...((result[ORDERED_SEQUENCE_KEY] as any[]) ?? []), ...sequence];
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
		// A class-level @XmlElement establishes a namespace context whose prefix
		// carries onto unqualified children; @XmlRoot is the document root and is
		// excluded.
		//
		// @XmlType deliberately does NOT establish such a context. It declares the
		// *type's* schema identity (mirroring C# [XmlType]), which is a different
		// thing from the namespace its members are written in. In XSD, whether a
		// local element is namespace-qualified is decided by elementFormDefault /
		// the member's own form — not by the namespace of the type that contains it.
		// Letting @XmlType qualify children prefixed locals of an
		// elementFormDefault="unqualified" schema (the XSD default), producing XML
		// the owning service rejects and that this library could not read back.
		// A member that should be qualified says so with form: 'qualified', which is
		// exactly what the codegen emits for a qualified schema.
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

		// xs:list element: serialize the array as a single space-separated text element
		if (Array.isArray(value) && fieldMetadata?.list) {
			this.validateFacetsForProperty(value, fieldMetadata, `element '${fieldMetadata.name}'`);
			this.serializePrimitiveValue(XmlValidationUtil.joinList(value), xmlName, fieldMetadata, result);
			return;
		}

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
				// A fixed value acts as the default for a missing attribute, so it is
				// applied even when null members are otherwise omitted.
				if (attrMetadata.fixedValue !== undefined) {
					value = attrMetadata.fixedValue;
				} else if (this.options.omitNullValues) {
					continue;
				} else {
					value = "";
				}
			}

			// C# [DefaultValue]: omit an attribute equal to its declared default.
			if (this.shouldOmitDefaultValue(obj[propertyKey], attrMetadata)) continue;

			value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "serialize");
			if (typeof value === "string" && attrMetadata.whiteSpace) {
				value = XmlValidationUtil.applyWhiteSpace(value, attrMetadata.whiteSpace);
			}
			if (typeof value === "boolean") value = value.toString();
			value = XmlValidationUtil.mapEnumSerialize(value, attrMetadata.enumMap);

			this.validateFacetsForProperty(value, attrMetadata, `attribute '${attrMetadata.name}'`);

			if (Array.isArray(value) && attrMetadata.list) {
				value = XmlValidationUtil.joinList(value);
			}

			const attributeName = this.namespaceUtil.buildAttributeName(attrMetadata);
			result[`@_${attributeName}`] = value;

			// Declare the attribute's namespace on its own element (attributes never
			// use the default namespace). The dedup pass removes redundant repeats.
			const qualification = this.namespaceUtil.getAttributeNamespaceQualification(attrMetadata);
			if (qualification) {
				result[`@_xmlns:${qualification.prefix}`] = qualification.uri;
			}
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
		// Mixed text runs are woven in among the child elements after they have all
		// been serialized (see interleaveMixedText), not written as one text node here.
		if (textMetadata.metadata.mixed) return;

		let textValue = obj[textMetadata.propertyKey];
		if (textValue === undefined && textMetadata.metadata.fixedValue !== undefined) {
			textValue = textMetadata.metadata.fixedValue;
		}
		if (textValue !== undefined) {
			const meta = textMetadata.metadata;
			if (meta.converter) {
				textValue = XmlValidationUtil.applyConverter(textValue, meta.converter, "serialize");
			}
			if (typeof textValue === "string" && meta.whiteSpace) {
				textValue = XmlValidationUtil.applyWhiteSpace(textValue, meta.whiteSpace);
			}
			textValue = XmlValidationUtil.mapEnumSerialize(textValue, meta.enumMap);
			this.validateFacetsForProperty(textValue, meta, "text content");
			if (Array.isArray(textValue) && meta.list) {
				textValue = XmlValidationUtil.joinList(textValue);
			}
			if (meta.useCDATA) {
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
	 * Whether a scalar member equal to its declared `defaultValue` should be omitted
	 * from output (C# `[DefaultValue]`). Gated by `omitDefaultValues` (default true);
	 * never applies to null/undefined (handled by null logic), objects/arrays,
	 * required members, or `isNullable` members.
	 */
	private shouldOmitDefaultValue(
		value: any,
		fieldMetadata: { defaultValue?: unknown; required?: boolean; isNullable?: boolean } | undefined,
	): boolean {
		if (!this.options.omitDefaultValues) return false;
		if (!fieldMetadata || fieldMetadata.defaultValue === undefined) return false;
		if (fieldMetadata.required || fieldMetadata.isNullable) return false;
		if (value === null || value === undefined || typeof value === "object") return false;
		return value === fieldMetadata.defaultValue;
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

		// A nullable member emits xsi:nil="true" for an explicit null (must precede
		// the omit logic so nil markers are never silently dropped).
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

		// C# XmlSerializer omits null/undefined non-nullable members. This is the
		// default (omitNullValues: true); setting omitNullValues: false restores the
		// legacy behavior of emitting an empty element.
		if (this.options.omitNullValues) return "skip";

		// Legacy path (omitNullValues: false): skip undefined typed complex fields so
		// an unset sub-object is not emitted as an empty element; null stays as an
		// explicit empty element.
		if (value === undefined && fieldMetadata?.type) return "skip";

		return "nulled";
	}

	/**
	 * Qualify an array container/item name with the array's namespace prefix when
	 * form is 'qualified', without double-prefixing an already-qualified name.
	 * Shared by serialization and deserialization so both agree on the item tag.
	 */
	private qualifyArrayName(name: string, arrayMetadata: XmlArrayMetadata): string {
		const ns = arrayMetadata.namespaces?.[0];
		return ns?.prefix && arrayMetadata.form === "qualified" && !name.includes(":") ? `${ns.prefix}:${name}` : name;
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

		this.validateArrayOccurs(value, firstMetadata, key);
		this.validateArrayItemFacets(value, firstMetadata, key);

		if (firstMetadata.items && firstMetadata.items.length > 0) {
			this.serializeItemsArray(value, key, firstMetadata, result);
			return;
		}

		const rawContainerName = firstMetadata.containerName ?? xmlName;

		// Apply the array's namespace prefix to both the container AND the item names
		// when form is 'qualified' (C# XmlArrayItem elements share the array's
		// namespace), without double-prefixing names that are already qualified.
		const containerName = this.qualifyArrayName(rawContainerName, firstMetadata);
		const itemName = firstMetadata.itemName ? this.qualifyArrayName(firstMetadata.itemName, firstMetadata) : undefined;

		const processedItems = value.map((item: any): any => {
			if (typeof item === "object" && item !== null) {
				const itemType = resolveMetadataType(firstMetadata) ?? item.constructor;
				const itemElementMeta = getOrCreateDefaultElementMetadata(itemType);
				const itemElementName = this.namespaceUtil.buildElementName(itemElementMeta);
				const mappedObject = this.mapFromObject(item, itemElementName, itemElementMeta);
				let itemContent = mappedObject[itemElementName];
				// Declare the item type's namespaces on the item like a nested object;
				// the dedup pass removes any that an ancestor already declares.
				this.addNamespaceDeclarations(itemContent, itemElementMeta);
				// Polymorphic array items: emit xsi:type when the runtime item type
				// differs from the array's declared item type (matching C# XmlArrayItem).
				itemContent = this.addXsiType(itemContent, firstMetadata, item.constructor);
				this.trackNamespaceFree(itemContent, firstMetadata, itemElementMeta);
				return itemContent;
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
	 * Serialize an `@XmlArray({ items })` collection: differently named siblings that
	 * must come out in the order the array holds them.
	 *
	 * A keyed object cannot express that — `{ note: […], task: […] }` writes all the
	 * notes and then all the tasks. The values go out as an ordered sequence instead,
	 * which the builder splices into the parent element (see ORDERED_SEQUENCE_KEY).
	 */
	private serializeItemsArray(value: any[], key: string, metadata: XmlArrayMetadata, result: any): void {
		const sequence: any[] = [];

		for (const item of value) {
			if (item === null || item === undefined) continue;

			const spec = this.findArrayItemSpec(item, metadata, key);
			if (!spec) continue;

			const elementName = this.qualifyArrayName(spec.name, {
				...metadata,
				namespaces: this.itemNamespaces(spec, metadata),
			});

			if (typeof item === "object") {
				const itemElementMeta = getOrCreateDefaultElementMetadata(item.constructor);
				const mapped = this.mapFromObject(item, elementName, itemElementMeta);
				const content = mapped[elementName];
				this.addNamespaceDeclarations(content, itemElementMeta);
				this.trackNamespaceFree(content, metadata, itemElementMeta);
				sequence.push({ [elementName]: content });
			} else {
				sequence.push({ [elementName]: item });
			}
		}

		if (sequence.length > 0) {
			result[ORDERED_SEQUENCE_KEY] = [...((result[ORDERED_SEQUENCE_KEY] as any[]) ?? []), ...sequence];
		}
	}

	/**
	 * Which alternative a value belongs to.
	 *
	 * Matched on the value's constructor, so the element name a value is written
	 * under is decided by what it *is* — the inverse of how it was read. A scalar
	 * falls back to the first alternative that declares no class.
	 */
	private findArrayItemSpec(item: any, metadata: XmlArrayMetadata, key: string): XmlArrayItem | undefined {
		const items = metadata.items ?? [];

		if (typeof item === "object" && item !== null) {
			const match = items.find((candidate) => {
				const candidateType = candidate.type ? resolveTypeRef(candidate.type) : undefined;
				return candidateType !== undefined && item instanceof (candidateType as new () => object);
			});
			if (match) return match;

			this.reportViolation(
				`Array '${key}' holds a ${item.constructor?.name ?? "value"} that matches none of its declared items ` +
					`(${items.map((i) => i.name).join(", ")}); it was omitted.`,
				this.options.validationMode ?? "strict",
			);
			return undefined;
		}

		// A scalar carries nothing that says which alternative it came from, so it is
		// matched on the JavaScript type its `dataType` implies. Alternatives that are
		// indistinguishable that way (two string-valued ones, say) cannot round-trip:
		// the first wins, and the codegen refuses to emit such a set at all.
		const scalars = items.filter((candidate) => !candidate.type);
		const byType = scalars.find((candidate) => scalarKindOf(candidate) === typeof item);
		return byType ?? scalars.find((candidate) => scalarKindOf(candidate) === undefined) ?? scalars[0] ?? items[0];
	}

	/**
	 * Validate primitive array items against the array's XSD facets, handling
	 * each violated rule according to its own effective validation mode.
	 */
	private validateArrayItemFacets(value: any[], metadata: XmlArrayMetadata, key: string): void {
		for (const item of value) {
			if (typeof item === "object" && item !== null) continue;
			for (const violation of XmlValidationUtil.validateFacets(item, metadata)) {
				this.reportViolation(
					`Invalid item '${item}' in array '${metadata.containerName ?? key}': ${violation.message}`,
					this.modeForRule(violation.rule),
				);
			}
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
		this.trackNamespaceFree(elementContent, fieldMetadata, valueElementMetadata);

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
	 * Flag an element's content as namespace-free when neither the referencing
	 * member nor the referenced class declares a namespace, so the dedup pass can
	 * emit `xmlns=""` if it ends up nested under a default-namespace ancestor.
	 */
	private trackNamespaceFree(
		elementContent: any,
		memberMetadata: { namespaces?: unknown[] } | undefined,
		classMetadata: { namespaces?: unknown[] } | undefined,
	): void {
		if (typeof elementContent !== "object" || elementContent === null) return;
		const memberHasNs = !!memberMetadata?.namespaces && memberMetadata.namespaces.length > 0;
		const classHasNs = !!classMetadata?.namespaces && classMetadata.namespaces.length > 0;
		if (!memberHasNs && !classHasNs) {
			this.namespaceFreeContent.add(elementContent);
		}
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
	private addXsiType(elementContent: any, fieldMetadata: { type?: TypeRef } | undefined, valueConstructor: any): any {
		const declaredType = this.options.useXsiType ? resolveMetadataType(fieldMetadata) : undefined;
		if (!this.options.useXsiType || !declaredType || valueConstructor === declaredType) return elementContent;

		// Use the runtime type's SCHEMA name (@XmlType/@XmlRoot/@XmlElement), namespace-
		// qualified with its prefix, matching C# (xsi:type="tns:Derived"). The type's
		// namespace is declared on this element by addNamespaceDeclarations, so the
		// prefix is in scope (deduped afterward).
		const runtimeMetadata = getOrCreateDefaultElementMetadata(valueConstructor);
		const runtimeTypeName = this.namespaceUtil.buildElementName(runtimeMetadata);

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
		// Priority 1: an EXPLICIT property-level @XmlElement name always wins over the
		// referenced type's class-level @XmlElement. This matches C# XmlSerializer
		// ([XmlElement(ElementName=...)] on a property overrides [XmlType]/[XmlRoot])
		// and the parser's getPropertyXmlName. The explicit flag avoids confusing an
		// explicit `name: "foo"` that happens to equal the property key with a
		// defaulted name (which would otherwise mask the user's intent).
		//
		// The property name wins, but when the property gives no namespace of its own
		// the referenced type's namespace fills the gap, so the wrapper is qualified
		// consistently with its (already prefixed) children instead of producing an
		// unqualified wrapper around prefixed content.
		if (fieldMetadata?.nameExplicitlySet) {
			return this.namespaceUtil.buildElementName(
				this.resolveEffectiveElementMetadata(
					fieldMetadata,
					valueElementMetadata,
					this.declaresElementIdentity(valueConstructor),
				),
			);
		}
		// Priority 2: when no explicit field name was given, fall back to the
		// referenced type's class-level @XmlElement/@XmlRoot name (if any).
		if (
			valueElementMetadata &&
			(valueElementMetadata.name !== valueConstructor.name || valueElementMetadata.namespaces)
		) {
			return valueElementName;
		}
		// Priority 3: defaulted property key.
		if (fieldMetadata) {
			return this.namespaceUtil.buildElementName(fieldMetadata);
		}
		return key;
	}

	/**
	 * Does this class declare an *element* identity (@XmlRoot / class-level
	 * @XmlElement) rather than only a *type* identity (@XmlType)?
	 *
	 * A class-level @XmlElement says "wherever I appear, I am this element in this
	 * namespace", so a member pointing at it adopts that namespace. @XmlType only
	 * names the schema type; it says nothing about how members referencing it are
	 * qualified — that is elementFormDefault's job.
	 */
	private declaresElementIdentity(ctor: any): boolean {
		if (!ctor) return false;
		const metadata = getMetadata(ctor);
		return !!metadata.root || !!metadata.element;
	}

	/**
	 * Reconcile property-level and class-level element metadata into one element
	 * decision. The property name and, when present, the property namespace always
	 * win. The referenced class's namespace fills a *missing* one only when either
	 * the member opted into qualification with form: 'qualified' (saying "qualify
	 * me" without repeating the URI), or the class declares an element identity of
	 * its own (see declaresElementIdentity).
	 *
	 * A member with no namespace and no form, pointing at an @XmlType-only class, is
	 * unqualified — per XSD's elementFormDefault default and C# XmlSerializer, which
	 * writes such a member with no namespace regardless of the [XmlType] on the class
	 * it points at.
	 */
	private resolveEffectiveElementMetadata(
		fieldMetadata: XmlElementMetadata,
		classMetadata: XmlElementMetadata | undefined,
		classDeclaresElementIdentity = false,
	): XmlElementMetadata {
		const hasFieldNamespace = !!fieldMetadata.namespaces && fieldMetadata.namespaces.length > 0;
		const inherits = classDeclaresElementIdentity || fieldMetadata.form === "qualified";
		if (!classMetadata || hasFieldNamespace || !inherits) {
			return fieldMetadata;
		}
		return {
			...fieldMetadata,
			namespaces: classMetadata.namespaces,
			form: fieldMetadata.form ?? classMetadata.form,
		};
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
		value = this.prepareValidatedPrimitive(value, fieldMetadata);

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
	 * Apply whiteSpace normalization and facet validation to a primitive value
	 * before it is written to the result.
	 */
	private prepareValidatedPrimitive(value: any, fieldMetadata: XmlElementMetadata | undefined): any {
		if (!fieldMetadata || value === null || value === undefined) return value;

		if (typeof value === "string" && fieldMetadata.whiteSpace) {
			value = XmlValidationUtil.applyWhiteSpace(value, fieldMetadata.whiteSpace);
		}
		// Translate the in-memory enum member to its XML token before validation, so
		// enumValues (when set) validates the wire token (matching C# [XmlEnum]).
		value = XmlValidationUtil.mapEnumSerialize(value, fieldMetadata.enumMap);
		// Joined xs:list values were already validated against the array form
		if (!fieldMetadata.list) {
			this.validateFacetsForProperty(value, fieldMetadata, `element '${fieldMetadata.name}'`);
		}
		return value;
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
			// form: 'qualified' with no namespace of its own means "qualify me with the
			// enclosing class's namespace" — the opt-in that replaces the old implicit
			// @XmlType qualification, and what codegen emits for a qualified schema.
			const inheritsNamespace = isNestedElement === true || fieldMetadata.form === "qualified";
			return this.applyParentNamespace(fieldMetadata.name, elementMetadata, inheritsNamespace);
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
