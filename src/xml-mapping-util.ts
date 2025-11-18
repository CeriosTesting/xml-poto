import {
	getXmlArrayItemMetadata,
	getXmlAttributeMetadata,
	getXmlCommentMetadata,
	getXmlElementMetadata,
	getXmlFieldElementMetadata,
	getXmlPropertyMappings,
	getXmlTextMetadata,
	XmlElementMetadata,
	XSI_NAMESPACE,
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
	 * Check if a class has any fields marked with mixedContent: true
	 */
	hasMixedContentFields(targetClass: new () => any): boolean {
		const fieldElementMetadata = getXmlFieldElementMetadata(targetClass);

		// Check if any field has mixedContent flag set
		for (const metadata of Object.values(fieldElementMetadata)) {
			if (metadata?.mixedContent === true) {
				return true;
			}
		}

		return false;
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

					// Extract #text from simple text nodes (from custom parser)
					// This happens when custom parser is used but field is not mixed content
					if (typeof value === "object" && value !== null && "#text" in value && Object.keys(value).length === 1) {
						value = value["#text"];
					}

					// Check if this value has #mixed content from custom parser
					if (typeof value === "object" && value !== null && "#mixed" in value) {
						const fieldMeta = fieldElementMetadata[propertyKey];
						if (fieldMeta?.mixedContent) {
							// Assign the mixed content array directly
							(instance as any)[propertyKey] = value["#mixed"];
							return;
						}
					}

					// Check if this is a mixed content field without #mixed key
					// (happens when fast-xml-parser parses element-only mixed content)
					const fieldMeta = fieldElementMetadata[propertyKey];
					if (fieldMeta?.mixedContent && typeof value === "object" && value !== null && !Array.isArray(value)) {
						// Convert object to mixed content array format
						// The object contains element(s) that should be wrapped in mixed content structure
						const mixedArray: any[] = [];
						for (const [key, val] of Object.entries(value)) {
							if (key !== "#text" && key !== "@_" && !key.startsWith("@_")) {
								// This is an element
								const attributes: Record<string, string> = {};
								let content = "";

								if (typeof val === "object" && val !== null) {
									// Extract attributes
									for (const [attrKey, attrVal] of Object.entries(val)) {
										if (attrKey.startsWith("@_")) {
											attributes[attrKey.substring(2)] = String(attrVal);
										} else if (attrKey === "#text") {
											content = String(attrVal);
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
						}
						(instance as any)[propertyKey] = mixedArray;
						return;
					}

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
							// Try to get the type from field metadata first
							const fieldMeta = fieldElementMetadata[propertyKey];
							if (fieldMeta?.type) {
								// Use the type from field metadata
								value = this.mapToObject(value, fieldMeta.type as any);
							} else {
								// Get the property type from the instance
								const propertyValue = (instance as any)[propertyKey];
								if (propertyValue && typeof propertyValue === "object" && propertyValue.constructor) {
									// Recursively deserialize nested object
									value = this.mapToObject(value, propertyValue.constructor);
								}
							}
						}
					}

					// Check for mixed content array deserialization
					if (Array.isArray(value)) {
						const fieldMeta = fieldElementMetadata[propertyKey];
						if (fieldMeta?.mixedContent) {
							// Deserialize mixed content array
							value = this.deserializeMixedContent(value);
						}
					}

					// Get field metadata for union type conversion
					const fieldMetadata = fieldElementMetadata[propertyKey];

					// Convert and set the value with proper typing
					let finalValue: any;
					if (value !== undefined && typeof value === "object" && value !== null) {
						finalValue = value;
					} else {
						// Apply union type conversion if specified (before normal type conversion)
						if (fieldMetadata?.unionTypes && fieldMetadata.unionTypes.length > 0) {
							finalValue = XmlValidationUtil.tryConvertToUnionType(value, fieldMetadata.unionTypes);
						} else {
							finalValue = XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
						}
					}

					(instance as any)[propertyKey] = finalValue;
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
				const fieldMetadata = fieldElementMetadata[key];

				// Handle mixed content fields (array of text/element nodes)
				if (fieldMetadata?.mixedContent && Array.isArray(value)) {
					const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);
					// Serialize mixed content to embedded XML elements
					const mixedElements = this.buildMixedContentStructure(value);
					result[xmlName] = mixedElements;
					return;
				}

				// C#-style null/undefined handling with xsi:nil support
				if (value === undefined || value === null) {
					if (this.options.omitNullValues) {
						// Skip this element entirely
						return;
					} else if (fieldMetadata?.isNullable && value === null) {
						// Add xsi:nil="true" attribute for nullable elements with null value
						const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);
						result[xmlName] = {
							[`@_${XSI_NAMESPACE.prefix}:nil`]: "true",
						};
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
							let elementContent = mappedValue[valueElementName];

							// Add xsi:type if enabled and runtime type differs from declared type
							if (this.options.useXsiType && fieldMetadata?.type && valueConstructor !== fieldMetadata.type) {
								// Add xsi:type attribute with the runtime type name
								const runtimeTypeName = valueConstructor.name;
								if (typeof elementContent === "object" && elementContent !== null) {
									elementContent[`@_${XSI_NAMESPACE.prefix}:type`] = runtimeTypeName;
								} else {
									// Wrap primitive in object with xsi:type
									elementContent = {
										[`@_${XSI_NAMESPACE.prefix}:type`]: runtimeTypeName,
										"#text": elementContent,
									};
								}
							}

							result[xmlName] = elementContent;
						} else {
							// No metadata, treat as raw object (let fast-xml-parser handle it)
							result[xmlName] = value;
						}
					} else {
						// Primitive value - check if field metadata specifies CDATA
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

	/**
	 * Build mixed content structure for fast-xml-parser.
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
				const attrs = node.attributes || {};

				const elementObj: any = {};

				// Add attributes
				Object.entries(attrs).forEach(([attrName, attrValue]) => {
					elementObj[`@_${attrName}`] = attrValue;
				});

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
	 * Converts fast-xml-parser format back to: [{ text: "..." }, { element: "em", content: "..." }]
	 */
	private deserializeMixedContent(xmlArray: any[]): any[] {
		const result: any[] = [];

		for (const item of xmlArray) {
			if (typeof item === "string") {
				// Text node
				result.push({ text: item });
			} else if (typeof item === "object" && item !== null) {
				// Element node - extract element name and content
				const elementNames = Object.keys(item).filter(k => !k.startsWith("@_") && k !== "#text");

				if (elementNames.length > 0) {
					const elementName = elementNames[0];
					const elementData = item[elementName];

					// Extract attributes (keys starting with @_)
					const attributes: any = {};
					let content: any;

					if (typeof elementData === "object" && elementData !== null) {
						// Extract attributes
						Object.entries(elementData).forEach(([key, value]) => {
							if (key.startsWith("@_")) {
								attributes[key.substring(2)] = value;
							}
						});

						// Extract content
						if (elementData["#text"] !== undefined) {
							content = elementData["#text"];
						} else if (Array.isArray(elementData)) {
							// Nested mixed content array
							content = this.deserializeMixedContent(elementData);
						} else {
							// Complex object or nested elements
							const contentKeys = Object.keys(elementData).filter(k => !k.startsWith("@_") && k !== "#text");
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
}
