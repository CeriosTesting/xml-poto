import {
	getXmlArrayItemMetadata,
	getXmlAttributeMetadata,
	getXmlCommentMetadata,
	getXmlElementMetadata,
	getXmlFieldElementMetadata,
	getXmlPropertyMappings,
	getXmlTextMetadata,
	XmlElementMetadata,
} from "./decorators";
import { SerializationOptions } from "./serialization-options";
import { XmlNamespaceUtil } from "./xml-namespace-util";
import { XmlValidationUtil } from "./xml-validation-util";

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
	 * Map XML data to a typed object instance.
	 */
	mapToObject<T>(data: any, targetClass: new () => T): T {
		const instance = new targetClass();
		const attributeMetadata = getXmlAttributeMetadata(targetClass);
		const textMetadata = getXmlTextMetadata(targetClass);
		const propertyMappings = getXmlPropertyMappings(targetClass);
		const elementMetadata = getXmlElementMetadata(targetClass);

		// Map attributes first
		Object.entries(attributeMetadata).forEach(([propertyKey, metadata]) => {
			const attributeName = this.namespaceUtil.buildAttributeName(metadata);
			const attributeKey = `@_${attributeName}`;

			let value = data[attributeKey];

			// Check required constraint
			if (value === undefined && metadata.required) {
				throw new Error(`Required attribute '${attributeName}' is missing`);
			}

			if (value !== undefined) {
				// Apply custom converter
				value = XmlValidationUtil.applyConverter(value, metadata.converter, "deserialize");

				// Validate value
				if (!XmlValidationUtil.validateValue(value, metadata)) {
					throw new Error(`Invalid value '${value}' for attribute '${attributeName}'`);
				}

				// Convert and set the value with proper typing
				(instance as any)[propertyKey] = XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
			}
		});

		// Map text content if present (check both regular text and CDATA)
		if (textMetadata) {
			let textValue: any;

			// Check for CDATA first, then regular text
			if (data.__cdata !== undefined) {
				textValue = data.__cdata;
			} else if (data["#text"] !== undefined) {
				textValue = data["#text"];
			}

			if (textValue !== undefined) {
				// Apply custom converter for text
				if (textMetadata.metadata.converter) {
					textValue = XmlValidationUtil.applyConverter(textValue, textMetadata.metadata.converter, "deserialize");
				}

				(instance as any)[textMetadata.propertyKey] = XmlValidationUtil.convertToPropertyType(
					textValue,
					instance,
					textMetadata.propertyKey
				);
			} else if (textMetadata.metadata.required) {
				throw new Error(`Required text content is missing`);
			}
		}

		// Map element properties (non-attributes, non-text)
		const excludedKeys = new Set(Object.keys(attributeMetadata));
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}

		// Create reverse mapping from XML name to property name
		const xmlToPropertyMap: Record<string, string> = {};
		const allArrayItemMetadata = getXmlArrayItemMetadata(targetClass);
		const fieldElementMetadata = getXmlFieldElementMetadata(targetClass);

		Object.keys(instance as any).forEach(propertyKey => {
			const xmlName = this.getPropertyXmlName(propertyKey, elementMetadata, propertyMappings, fieldElementMetadata);

			// Check if this property has custom array container name
			const arrayItemMetadata = allArrayItemMetadata[propertyKey];
			if (arrayItemMetadata && arrayItemMetadata.length > 0) {
				const customName = arrayItemMetadata[0].containerName;
				if (customName) {
					// Use custom array container name
					xmlToPropertyMap[customName] = propertyKey;
				} else {
					// Use default property name
					xmlToPropertyMap[xmlName] = propertyKey;
				}
			} else {
				// Use default property name for non-array properties
				xmlToPropertyMap[xmlName] = propertyKey;
			}
		});

		// First pass: Handle unwrapped arrays (where itemName appears directly in data)
		Object.entries(allArrayItemMetadata).forEach(([propertyKey, metadataArray]) => {
			if (metadataArray && metadataArray.length > 0) {
				const metadata = metadataArray[0];
				const itemName = metadata.itemName;

				// Check if this is an unwrapped array (no containerName)
				if (itemName && !metadata.containerName && data[itemName] !== undefined) {
					// The items appear directly in the data with itemName as the key
					let items = data[itemName];

					// Ensure it's an array (parser returns single item as object)
					if (!Array.isArray(items)) {
						items = [items];
					}

					// Deserialize array items if they have a type specified
					if (metadata.type) {
						items = items.map((item: any) => {
							if (typeof item === "object" && item !== null) {
								return this.mapToObject(item, metadata.type as any);
							}
							return item;
						});
					}

					// Set the array on the instance
					(instance as any)[propertyKey] = items;

					// Mark this key as processed so we don't process it again
					excludedKeys.add(itemName);
				}
			}
		});

		Object.keys(data).forEach(xmlKey => {
			// Skip attribute, text, and CDATA keys
			if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata") {
				return;
			}

			// Skip keys already processed as unwrapped arrays
			if (excludedKeys.has(xmlKey)) {
				return;
			}

			// Find the corresponding property key
			const propertyKey = xmlToPropertyMap[xmlKey] || xmlKey;

			// Only map properties that are NOT attributes or text content
			if (!excludedKeys.has(propertyKey)) {
				if (data[xmlKey] !== undefined) {
					let value = data[xmlKey];

					// Check if this property has XmlArrayItem metadata
					const allArrayItemMetadata = getXmlArrayItemMetadata(targetClass);
					const arrayItemMetadata = allArrayItemMetadata[propertyKey];
					if (arrayItemMetadata && arrayItemMetadata.length > 0) {
						const itemName = arrayItemMetadata[0].itemName;
						if (itemName && typeof value === "object" && value[itemName] !== undefined) {
							// This is an array structure, extract the array elements
							value = Array.isArray(value[itemName]) ? value[itemName] : [value[itemName]];
						}

						// Deserialize array items if they have a type specified
						if (Array.isArray(value) && arrayItemMetadata[0].type) {
							value = value.map((item: any) => {
								if (typeof item === "object" && item !== null) {
									return this.mapToObject(item, arrayItemMetadata[0].type as any);
								}
								return item;
							});
						}
					}

					// Check if the value is a complex object that needs deserialization
					if (typeof value === "object" && value !== null && !Array.isArray(value)) {
						// Check if this is CDATA content
						if (value.__cdata !== undefined) {
							// Extract CDATA content
							value = value.__cdata;
						} else {
							// Get the property type from the instance
							const propertyValue = (instance as any)[propertyKey];
							if (propertyValue && typeof propertyValue === "object" && propertyValue.constructor) {
								// Recursively deserialize nested object
								value = this.mapToObject(value, propertyValue.constructor);
							}
						}
					}

					// Convert and set the value with proper typing
					(instance as any)[propertyKey] =
						value !== undefined && typeof value === "object" && value !== null
							? value
							: XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
				}
			}
		});

		// Check for missing required elements
		Object.entries(fieldElementMetadata).forEach(([_, metadata]) => {
			if (metadata.required) {
				const xmlName = this.namespaceUtil.buildElementName(metadata);
				const wasFound = data[xmlName] !== undefined;

				if (!wasFound) {
					throw new Error(`Required element '${metadata.name}' is missing`);
				}
			}
		});

		return instance;
	}

	/**
	 * Map an object to XML structure.
	 */
	mapFromObject(obj: any, rootElementName: string, elementMetadata?: XmlElementMetadata): any {
		// Check for circular references
		if (typeof obj === "object" && obj !== null) {
			if (this.visitedObjects.has(obj)) {
				// Return a placeholder for circular reference
				return { "#text": "[Circular Reference]" };
			}
			this.visitedObjects.add(obj);
		}

		const ctor = obj.constructor;
		const attributeMetadata = getXmlAttributeMetadata(ctor);
		const textMetadata = getXmlTextMetadata(ctor);
		const propertyMappings = getXmlPropertyMappings(ctor);
		const fieldElementMetadata = getXmlFieldElementMetadata(ctor);
		const result: any = {};

		// Handle attributes first (C#-style: include all attributes, use empty string for undefined)
		Object.entries(attributeMetadata).forEach(([propertyKey, metadata]) => {
			let value = obj[propertyKey];

			// C#-style: Convert undefined/null to empty string for attributes (unless explicitly omitNullValues)
			if (value === undefined || value === null) {
				if (this.options.omitNullValues) {
					// Skip this attribute entirely
					return;
				} else {
					// C# behavior: null/undefined attributes become empty strings
					value = "";
				}
			}

			// Apply custom converter
			value = XmlValidationUtil.applyConverter(value, metadata.converter, "serialize");

			// Ensure boolean values are converted to strings for XML attributes
			if (typeof value === "boolean") {
				value = value.toString();
			}

			// Validate value
			if (!XmlValidationUtil.validateValue(value, metadata)) {
				throw new Error(`Invalid value '${value}' for attribute '${metadata.name}'`);
			}

			const attributeName = this.namespaceUtil.buildAttributeName(metadata);
			result[`@_${attributeName}`] = value;
		});

		// Handle text content
		if (textMetadata) {
			let textValue = obj[textMetadata.propertyKey];

			if (textValue !== undefined) {
				// Apply custom converter for text
				if (textMetadata.metadata.converter) {
					textValue = XmlValidationUtil.applyConverter(textValue, textMetadata.metadata.converter, "serialize");
				}

				// Wrap in CDATA if requested
				if (textMetadata.metadata.useCDATA) {
					result.__cdata = textValue;
				} else {
					result["#text"] = textValue;
				}
			} else if (textMetadata.metadata.required) {
				throw new Error(`Required text content is missing`);
			}
		}

		// Handle XML comments
		const commentMetadata = getXmlCommentMetadata(obj.constructor);
		if (commentMetadata) {
			const commentValue = obj[commentMetadata.propertyKey];

			if (commentValue !== undefined && commentValue !== null && commentValue !== "") {
				// Add comment as a special property for fast-xml-parser
				result["?"] = String(commentValue);
			} else if (
				commentMetadata.metadata.required &&
				(commentValue === undefined || commentValue === null || commentValue === "")
			) {
				throw new Error(`Required comment is missing`);
			}
		}

		// Handle element properties (non-attributes, non-text, non-comment) - C#-style: include undefined as empty
		const excludedKeys = new Set(Object.keys(attributeMetadata));
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}
		if (commentMetadata) {
			excludedKeys.add(commentMetadata.propertyKey);
		}

		// C#-style: Process ALL properties from the class, not just defined ones
		const allPropertyKeys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);
		allPropertyKeys.forEach(key => {
			// Only include properties that are NOT attributes or text content
			if (!excludedKeys.has(key)) {
				let value = obj[key];

				// C#-style null/undefined handling
				if (value === undefined || value === null) {
					if (this.options.omitNullValues) {
						// Skip this element entirely
						return;
					} else {
						// C# behavior: null/undefined elements become empty self-closing tags
						value = null; // fast-xml-parser will create <element /> for null
					}
				}

				// Get the XML name for this property
				const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);

				// Check if this is an array with XmlArrayItem metadata
				if (Array.isArray(value)) {
					const allArrayItemMetadata = getXmlArrayItemMetadata(obj.constructor);
					const arrayItemMetadata = allArrayItemMetadata[key];
					if (arrayItemMetadata && arrayItemMetadata.length > 0) {
						// Use the first XmlArrayItem metadata (typically there's only one per property)
						const firstMetadata = arrayItemMetadata[0];
						const containerName = firstMetadata.containerName || xmlName;
						const itemName = firstMetadata.itemName;

						// Process each array item with its type information - supports mixed primitive/complex arrays
						const processedItems = value.map((item: any) => {
							if (typeof item === "object" && item !== null) {
								// Try explicit type first, then infer from item's constructor
								const itemType = firstMetadata.type || item.constructor;
								const itemElementMetadata = getXmlElementMetadata(itemType);
								if (itemElementMetadata) {
									// Get the full mapped object and extract just the content
									const itemElementName = this.namespaceUtil.buildElementName(itemElementMetadata);
									const mappedObject = this.mapFromObject(item, itemElementName, itemElementMetadata);
									// Extract the content from the wrapper
									return mappedObject[itemElementName];
								} else {
									// Fallback: return the raw object (will be processed by fast-xml-parser)
									return item;
								}
							} else {
								// Handle primitive types (string, number, boolean) in mixed arrays
								// For primitives, we just return the value directly as it will be serialized as text content
								return item;
							}
						});

						// Check if this array should be unwrapped (items added directly to parent)
						if (firstMetadata.unwrapped) {
							// Add each item directly to the result with the element name
							const targetElementName = itemName || containerName;
							processedItems.forEach((item: any) => {
								// For unwrapped arrays, we need to add each item individually
								if (!result[targetElementName]) {
									result[targetElementName] = [];
								}
								if (!Array.isArray(result[targetElementName])) {
									result[targetElementName] = [result[targetElementName]];
								}
								result[targetElementName].push(item);
							});
						} else if (itemName && itemName !== containerName) {
							// Transform the array to use custom element names
							// For fast-xml-parser, we need structure like: { customContainer: { Book: [val1, val2, val3] } }
							result[containerName] = { [itemName]: processedItems };
						} else {
							// Process each array item even without custom element name - supports mixed primitive/complex arrays
							result[containerName] = processedItems;
						}
					} else {
						// Handle array without XmlArrayItem (current behavior)
						result[xmlName] = value;
					}
				} else {
					// Handle nested objects with circular reference detection
					if (typeof value === "object" && value !== null) {
						// Check if this object has @XmlElement metadata (should be processed recursively)
						const valueConstructor = value.constructor;
						const valueElementMetadata = getXmlElementMetadata(valueConstructor);
						if (valueElementMetadata) {
							// Process nested object recursively
							const valueElementName = this.namespaceUtil.buildElementName(valueElementMetadata);
							const mappedValue = this.mapFromObject(value, valueElementName, valueElementMetadata);
							// Extract the content from the wrapper
							result[xmlName] = mappedValue[valueElementName];
						} else {
							// No metadata, treat as raw object (let fast-xml-parser handle it)
							result[xmlName] = value;
						}
					} else {
						// Primitive value - check if field metadata specifies CDATA
						const fieldMetadata = fieldElementMetadata[key];
						if (fieldMetadata?.useCDATA && value !== null && value !== undefined) {
							// Wrap primitive value in CDATA
							result[xmlName] = { __cdata: String(value) };
						} else {
							// Normal primitive value
							result[xmlName] = value;
						}
					}
				}
			}
		});

		return { [rootElementName]: result };
	}

	/**
	 * Get the XML element name for a property, considering mappings and field-level element metadata.
	 */
	private getPropertyXmlName(
		propertyKey: string,
		_elementMetadata?: XmlElementMetadata,
		propertyMappings?: Record<string, string>,
		fieldElementMetadata?: Record<string, XmlElementMetadata>
	): string {
		// Check field-level element metadata first (includes namespace)
		if (fieldElementMetadata?.[propertyKey]) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			return this.namespaceUtil.buildElementName(fieldMetadata);
		}

		// Check property mappings as fallback (from field decorators)
		if (propertyMappings?.[propertyKey]) {
			return propertyMappings[propertyKey];
		}

		// Default to property name
		return propertyKey;
	}
}
