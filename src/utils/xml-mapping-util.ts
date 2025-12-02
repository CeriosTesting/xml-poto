import { XmlElementMetadata, XSI_NAMESPACE } from "../decorators";
import { getMetadata } from "../decorators/storage/metadata-storage";
import { DynamicElement } from "../query/dynamic-element";
import { SerializationOptions } from "../serialization-options";
import { getOrCreateDefaultElementMetadata } from "./xml-metadata-util";
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
		// Use cached metadata
		const metadata = getMetadata(targetClass);
		const fieldElementMetadata = metadata.fieldElements;

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
	mapToObject<T extends object>(data: any, targetClass: new () => T): T {
		const instance = new targetClass();
		// Use single metadata lookup for better performance
		const metadata = getMetadata(targetClass);
		const attributeMetadata = metadata.attributes;
		const textMetadata = metadata.textProperty
			? { propertyKey: metadata.textProperty, metadata: metadata.textMetadata || { required: false } }
			: undefined;
		const propertyMappings = metadata.propertyMappings;
		const elementMetadata = metadata.element;

		// Get ignored properties for this class
		const ignoredProps = metadata.ignoredProperties;

		// Track which properties were found in XML
		const foundProperties = new Set<string>();

		// Map attributes first
		Object.entries(attributeMetadata).forEach(([propertyKey, metadata]) => {
			// Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				return;
			}
			const attributeName = this.namespaceUtil.buildAttributeName(metadata);
			const attributeKey = `@_${attributeName}`;

			let value = data[attributeKey];

			// Apply default value if attribute is missing
			if (value === undefined && metadata.defaultValue !== undefined) {
				value = metadata.defaultValue;
			}

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
				foundProperties.add(propertyKey);
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
			} else if (data["#mixed"] && Array.isArray(data["#mixed"]) && data["#mixed"].length === 1) {
				// Check if #mixed contains a single CDATA node
				const mixedItem = data["#mixed"][0];
				if (mixedItem.__cdata !== undefined) {
					textValue = mixedItem.__cdata;
				}
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
		const allArrayMetadata = getMetadata(targetClass).arrays;
		// Use already-fetched metadata
		const fieldElementMetadata = metadata.fieldElements;

		// Build xmlToPropertyMap from field metadata instead of instance keys
		// This ensures optional properties are included even if not initialized
		const allPropertyKeys = new Set([
			...Object.keys(instance as any),
			...Object.keys(fieldElementMetadata),
			...Object.keys(allArrayMetadata),
		]);

		allPropertyKeys.forEach(propertyKey => {
			const xmlName = this.getPropertyXmlName(
				propertyKey,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				false
			);

			// Check if this property has custom array container name
			const arrayMetadata = allArrayMetadata[propertyKey];
			if (arrayMetadata && arrayMetadata.length > 0) {
				const customName = arrayMetadata[0].containerName;
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
		Object.entries(allArrayMetadata).forEach(([propertyKey, metadataArray]) => {
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

			// Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				return;
			}

			// Only map properties that are NOT attributes or text content
			if (!excludedKeys.has(propertyKey)) {
				if (data[xmlKey] !== undefined) {
					let value = data[xmlKey];

					// Convert empty objects to empty strings (parser returns {} for <element/>)
					if (typeof value === "object" && value !== null && Object.keys(value).length === 0) {
						value = "";
					}

					// Extract #text from simple text nodes (from custom parser)
					// This happens when custom parser is used but field is not mixed content
					if (typeof value === "object" && value !== null && "#text" in value && Object.keys(value).length === 1) {
						value = value["#text"];
					}

					// Check if this value has #mixed content from custom parser
					if (typeof value === "object" && value !== null && "#mixed" in value) {
						// Use already-fetched metadata
						const fieldMeta = fieldElementMetadata[propertyKey];
						if (fieldMeta?.mixedContent) {
							// Assign the mixed content array directly
							(instance as any)[propertyKey] = value["#mixed"];
							return;
						}

						// Check if #mixed contains a single __cdata node (not actually mixed content)
						const mixed = value["#mixed"];
						if (Array.isArray(mixed) && mixed.length === 1 && mixed[0].__cdata !== undefined) {
							// This is CDATA content, not mixed content - extract the string
							value = mixed[0].__cdata;
							// Continue to process as normal value
						}
					} // Check if this is a mixed content field without #mixed key
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

					// Check if this property has XmlArray metadata
					const allArrayMetadata = getMetadata(targetClass).arrays;
					const arrayMetadata = allArrayMetadata[propertyKey];
					if (arrayMetadata && arrayMetadata.length > 0) {
						const itemName = arrayMetadata[0].itemName;
						if (itemName && typeof value === "object" && value[itemName] !== undefined) {
							// This is an array structure, extract the array elements
							value = Array.isArray(value[itemName]) ? value[itemName] : [value[itemName]];
						}

						// Deserialize array items if they have a type specified
						if (Array.isArray(value) && arrayMetadata[0].type) {
							value = value.map((item: any) => {
								if (typeof item === "object" && item !== null) {
									return this.mapToObject(item, arrayMetadata[0].type as any);
								}
								return item;
							});
						}
					}

					// Get field metadata once for this property
					const fieldMetadata = fieldElementMetadata[propertyKey];

					// Check if the value is a complex object that needs deserialization
					if (typeof value === "object" && value !== null && !Array.isArray(value)) {
						// Check if this is CDATA content
						if (value.__cdata !== undefined) {
							// Extract CDATA content
							value = value.__cdata;
						} else {
							// Try to get the type from field metadata first
							if (fieldMetadata?.type) {
								// Use the type from field metadata
								value = this.mapToObject(value, fieldMetadata.type as any);
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

					// Apply deserialize transform if provided (before type conversion)
					// Transform handles strings and numbers (parsed by XML parser)
					if (fieldMetadata?.transform?.deserialize && (typeof value === "string" || typeof value === "number")) {
						value = fieldMetadata.transform.deserialize(String(value));
					}

					// Check for mixed content array deserialization
					if (Array.isArray(value)) {
						if (fieldMetadata?.mixedContent) {
							// Deserialize mixed content array
							value = this.deserializeMixedContent(value);
						}
					}

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
					foundProperties.add(propertyKey);
				}
			}
		}); // Apply default values for elements that were not found in XML
		Object.entries(fieldElementMetadata).forEach(([propertyKey, fieldMetadata]) => {
			// Skip if property was found in XML or if no default is specified
			if (foundProperties.has(propertyKey) || fieldMetadata.defaultValue === undefined) {
				return;
			}

			// Apply the default value
			(instance as any)[propertyKey] = fieldMetadata.defaultValue;
		});

		// Handle dynamic elements with lazy loading (use cached metadata)
		const cachedMetadata = getMetadata(targetClass);
		const dynamicMetadata = cachedMetadata.queryables;

		for (const dynamic of dynamicMetadata) {
			let elementFound = true;
			let elementData: any;
			let elementName: string;

			if (dynamic.targetProperty) {
				// Query a specific nested property
				const targetValue = (instance as any)[dynamic.targetProperty];

				if (targetValue !== undefined && targetValue !== null) {
					// Get the XML name for this property
					const xmlName = this.getPropertyXmlName(
						dynamic.targetProperty,
						elementMetadata,
						propertyMappings,
						fieldElementMetadata,
						false
					);

					// Get the raw XML data for this element
					elementData = data[xmlName];

					if (elementData !== undefined) {
						elementName = xmlName;
					} else {
						// Create empty dynamic element if data not found
						elementData = {};
						elementName = xmlName;
						elementFound = false;
					}
				} else {
					// Property doesn't exist yet, create empty dynamic
					const xmlName = this.getPropertyXmlName(
						dynamic.targetProperty,
						elementMetadata,
						propertyMappings,
						fieldElementMetadata
					);
					elementData = {};
					elementName = xmlName;
					elementFound = false;
				}
			} else {
				// Query the root element (default behavior) - use cached metadata
				const rootMetadata = cachedMetadata.root;
				let rootName: string;

				if (rootMetadata?.name) {
					// This is a @XmlRoot element
					rootName = rootMetadata.name;
				} else {
					// This is a nested @XmlElement - try to get its element metadata
					const classElementMetadata = cachedMetadata.element;
					if (classElementMetadata?.name) {
						rootName = classElementMetadata.name;
					} else {
						// Fallback to class name
						rootName = targetClass.name;
					}
				}

				elementData = data;
				elementName = rootName;
			}

			// Check if lazy loading is enabled (default: true)
			const lazyLoadEnabled = dynamic.lazyLoad !== false;

			if (lazyLoadEnabled) {
				// Store a builder function for lazy initialization using symbols
				// The builder is called only when the queryable property is accessed
				const builderKey = Symbol.for(`dynamic_builder_${targetClass.name}_${dynamic.propertyKey}`);
				const cachedValueKey = Symbol.for(`dynamic_cache_${targetClass.name}_${dynamic.propertyKey}`);

				(instance as any)[builderKey] = () => {
					return this.buildDynamicElement(elementData, elementName, dynamic);
				};

				// Set up property descriptor here since addInitializer doesn't work in some environments
				// Check if descriptor already exists (from initializer)
				const existingDescriptor = Object.getOwnPropertyDescriptor(instance, dynamic.propertyKey);
				if (!existingDescriptor || !existingDescriptor.get) {
					Object.defineProperty(instance, dynamic.propertyKey, {
						get(this: any) {
							const cacheEnabled = dynamic.cache;

							// Return cached value if caching is enabled
							if (cacheEnabled && this[cachedValueKey] !== undefined) {
								return this[cachedValueKey];
							}

							// Build DynamicElement lazily using stored builder function
							if (this[builderKey]) {
								const element = this[builderKey]();

								// Cache the result if caching is enabled
								if (cacheEnabled) {
									this[cachedValueKey] = element;
								}

								return element;
							}

							// Return undefined if no builder is set (not yet initialized)
							return undefined;
						},
						set(this: any, value: any) {
							// Allow manual override of the queryable element
							if (dynamic.cache) {
								this[cachedValueKey] = value;
							}
							// Clear builder if value is set manually
							delete this[builderKey];
						},
						enumerable: true,
						configurable: true,
					});
				}
			} else {
				// Immediate loading mode: build DynamicElement immediately and assign to property
				const dynamicElement = this.buildDynamicElement(elementData, elementName, dynamic);
				(instance as any)[dynamic.propertyKey] = dynamicElement;
			}

			// Validate required queryable elements
			if (dynamic.required && !elementFound) {
				const targetName = dynamic.targetProperty || "root element";
				throw new Error(`Required queryable element '${targetName}' is missing`);
			}
		}

		// Check for missing required elements (skip if they have default values)
		Object.entries(fieldElementMetadata).forEach(([_, fieldMetadata]) => {
			if (fieldMetadata.required && fieldMetadata.defaultValue === undefined) {
				const xmlName = this.namespaceUtil.buildElementName(fieldMetadata);
				const wasFound = data[xmlName] !== undefined;

				if (!wasFound) {
					throw new Error(`Required element '${fieldMetadata.name}' is missing`);
				}
			}
		});

		// Validate nested objects with @XmlDynamic are properly instantiated (when strictQueryableValidation is enabled)
		if (this.options.strictValidation) {
			// Check all properties on the instance
			Object.keys(instance as any).forEach(propertyKey => {
				const value = (instance as any)[propertyKey];

				// Skip if no value, not an object, or is an array
				if (!value || typeof value !== "object" || Array.isArray(value)) {
					return;
				}

				// Check if the value is a plain Object (not properly instantiated)
				if (value.constructor.name === "Object") {
					const metadata = fieldElementMetadata[propertyKey];

					// If type is specified in metadata, check if it has @XmlDynamic
					if (metadata?.type) {
						// Use getMetadata for nested type
						const nestedMetadata = getMetadata(metadata.type as any);
						const nestedQueryables = nestedMetadata.queryables;

						if (nestedQueryables.length > 0) {
							const expectedTypeName = metadata.type.name;
							throw new Error(
								`[Strict Validation Error] Property '${propertyKey}' is not properly instantiated.\n\n` +
									`Expected: ${expectedTypeName} instance\n` +
									`Got: plain Object\n\n` +
									`The class '${expectedTypeName}' has @XmlDynamic decorator(s) which require proper instantiation.\n` +
									`This usually means the type parameter is missing from your @XmlElement decorator.\n\n` +
									`Current decorator: @XmlElement({ name: '${metadata.name}' })\n` +
									`Fix: @XmlElement({ name: '${metadata.name}', type: ${expectedTypeName} })\n\n` +
									`Without the type parameter, the XML parser creates a plain Object instead of a ${expectedTypeName} instance,\n` +
									`which breaks @XmlDynamic functionality and other class-specific behavior.`
							);
						}
					} else {
						// No type specified - warn about plain Object in strict mode
						// Check if this plain Object has nested properties (not just text)
						const valueKeys = Object.keys(value);
						const hasNestedObjects = valueKeys.length > 0;

						if (hasNestedObjects) {
							const xmlName = metadata?.name || propertyKey;
							throw new Error(
								`[Strict Validation Error] Property '${propertyKey}' is not properly instantiated.\n\n` +
									`The property contains a plain Object with nested data, but no type parameter is specified.\n` +
									`This usually indicates missing type information in your decorator.\n\n` +
									`Current decorator: @XmlElement({ name: '${xmlName}' })\n` +
									`Fix: @XmlElement({ name: '${xmlName}', type: YourClassName })\n\n` +
									`This validation catches common configuration errors early. ` +
									`If you need to work with plain objects temporarily, you can disable strict validation:\n` +
									`new XmlDecoratorSerializer({ strictValidation: false })\n\n` +
									`Learn more about type parameters in the documentation.`
							);
						}
					}
				}
			});
		}

		return instance;
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
	 */
	private mapFromObjectInternal(obj: any, rootElementName: string, elementMetadata?: XmlElementMetadata): any {
		const ctor = obj.constructor;
		// Use single metadata lookup for better performance
		const metadata = getMetadata(ctor);
		const attributeMetadata = metadata.attributes;
		const textMetadata = metadata.textProperty
			? { propertyKey: metadata.textProperty, metadata: metadata.textMetadata || { required: false } }
			: undefined;
		const propertyMappings = metadata.propertyMappings;
		const fieldElementMetadata = metadata.fieldElements;
		const result: any = {};

		// Get ignored properties for this class
		const ignoredProps = metadata.ignoredProperties;

		// Determine if this is a nested element with its own namespace context
		// Nested elements (class-level @XmlElement, not @XmlRoot) should propagate namespace to children
		const isNestedElement = !metadata.root && metadata.element && !!elementMetadata?.namespaces;

		// Add xml:space attribute if specified in element metadata
		if (elementMetadata?.xmlSpace) {
			result[`@_xml:space`] = elementMetadata.xmlSpace;
		}

		// Handle attributes first (include all attributes, use empty string for undefined)
		Object.entries(attributeMetadata).forEach(([propertyKey, metadata]) => {
			// Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				return;
			}

			let value = obj[propertyKey];

			// Convert undefined/null to empty string for attributes (unless explicitly omitNullValues)
			if (value === undefined || value === null) {
				if (this.options.omitNullValues) {
					// Skip this attribute entirely
					return;
				} else {
					// Convert null/undefined attributes to empty strings
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

		// Handle XML comments (use already-fetched metadata)
		const commentMetadata = metadata.commentProperty
			? { propertyKey: metadata.commentProperty, metadata: metadata.commentMetadata || { required: false } }
			: undefined;
		if (commentMetadata) {
			const commentValue = obj[commentMetadata.propertyKey];

			if (commentValue !== undefined && commentValue !== null && commentValue !== "") {
				result["?"] = String(commentValue);
			} else if (
				commentMetadata.metadata.required &&
				(commentValue === undefined || commentValue === null || commentValue === "")
			) {
				throw new Error(`Required comment is missing`);
			}
		}

		// Handle element properties (non-attributes, non-text, non-comment) - include undefined as empty
		const excludedKeys = new Set(Object.keys(attributeMetadata));
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}
		if (commentMetadata) {
			excludedKeys.add(commentMetadata.propertyKey);
		}

		// Process ALL properties from the class, not just defined ones
		const allPropertyKeys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

		allPropertyKeys.forEach(key => {
			// Skip ignored properties
			if (ignoredProps.has(key)) {
				return;
			}

			// Only include properties that are NOT attributes or text content
			if (!excludedKeys.has(key)) {
				let value = obj[key];
				const fieldMetadata = fieldElementMetadata[key];

				// Apply serialize transform first (before any other processing)
				// Only transform primitive values and specific types like Date
				// Skip transformation for nested objects that need recursive serialization
				if (
					fieldMetadata?.transform?.serialize &&
					value !== undefined &&
					value !== null &&
					(typeof value !== "object" || value instanceof Date || Array.isArray(value))
				) {
					value = fieldMetadata.transform.serialize(value);
				} // Handle mixed content fields (array of text/element nodes)
				if (fieldMetadata?.mixedContent && Array.isArray(value)) {
					const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);
					// Serialize mixed content to embedded XML elements
					const mixedElements = this.buildMixedContentStructure(value);
					result[xmlName] = mixedElements;
					return;
				}

				// null/undefined handling with xsi:nil support
				if (value === undefined || value === null) {
					if (this.options.omitNullValues) {
						// Skip this element entirely
						return;
					} else if (fieldMetadata?.isNullable && value === null) {
						// Add xsi:nil="true" attribute for nullable elements with null value
						const xmlName = this.getPropertyXmlName(
							key,
							elementMetadata,
							propertyMappings,
							fieldElementMetadata,
							isNestedElement
						);
						result[xmlName] = {
							[`@_${XSI_NAMESPACE.prefix}:nil`]: "true",
						};
						return;
					} else {
						value = null;
					}
				}

				// Get the XML name for this property
				const xmlName = this.getPropertyXmlName(
					key,
					elementMetadata,
					propertyMappings,
					fieldElementMetadata,
					isNestedElement
				); // Check if this is an array with XmlArray metadata
				if (Array.isArray(value)) {
					const allArrayMetadata = getMetadata(obj.constructor).arrays;
					const arrayMetadata = allArrayMetadata[key];
					if (arrayMetadata && arrayMetadata.length > 0) {
						// Use the first XmlArray metadata (typically there's only one per property)
						const firstMetadata = arrayMetadata[0];
						const containerName = firstMetadata.containerName || xmlName;
						const itemName = firstMetadata.itemName;

						// Process each array item with its type information - supports mixed primitive/complex arrays
						const processedItems = value.map((item: any) => {
							if (typeof item === "object" && item !== null) {
								// Try explicit type first, then infer from item's constructor
								const itemType = firstMetadata.type || item.constructor;
								// Get or create metadata for array item class (supports undecorated classes)
								const itemElementMetadata = getOrCreateDefaultElementMetadata(itemType);
								// Get the full mapped object and extract just the content
								const itemElementName = this.namespaceUtil.buildElementName(itemElementMetadata);
								const mappedObject = this.mapFromObject(item, itemElementName, itemElementMetadata);
								// Extract the content from the wrapper
								return mappedObject[itemElementName];
							} else {
								// Handle primitive types (string, number, boolean) in mixed arrays
								// For primitives, we just return the value directly as it will be serialized as text content
								return item;
							}
						}); // Check if this array should be unwrapped (items added directly to parent)
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
							result[containerName] = { [itemName]: processedItems };
						} else {
							// Process each array item even without custom element name - supports mixed primitive/complex arrays
							result[containerName] = processedItems;
						}
					} else {
						// Handle array without XmlArray (current behavior)
						result[xmlName] = value;
					}
				} else {
					// Handle nested objects with circular reference detection
					if (typeof value === "object" && value !== null) {
						// Check if this object has @XmlElement metadata (should be processed recursively)
						const valueConstructor = value.constructor;
						// Get or create metadata for nested class (supports undecorated classes)
						const valueElementMetadata = getOrCreateDefaultElementMetadata(valueConstructor);
						// Process nested object recursively
						const valueElementName = this.namespaceUtil.buildElementName(valueElementMetadata);
						const mappedValue = this.mapFromObject(value, valueElementName, valueElementMetadata);
						// Extract the content from the wrapper
						let elementContent = mappedValue[valueElementName];

						// Add namespace declarations for nested element (C# XmlSerializer style)
						if (valueElementMetadata.namespaces && typeof elementContent === "object" && elementContent !== null) {
							for (const ns of valueElementMetadata.namespaces) {
								if (ns.prefix) {
									elementContent[`@_xmlns:${ns.prefix}`] = ns.uri;
								} else if (ns.isDefault || !ns.prefix) {
									elementContent["@_xmlns"] = ns.uri;
								}
							}
						}

						// Add xml:space from field metadata if specified, or from value's class metadata
						const xmlSpaceToUse = fieldMetadata?.xmlSpace || valueElementMetadata.xmlSpace;
						if (xmlSpaceToUse && typeof elementContent === "object" && elementContent !== null) {
							elementContent[`@_xml:space`] = xmlSpaceToUse;
						}

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

						// Determine final element name with priority order:
						// 1. XmlElement field decorator name with namespace (if explicitly different from property key)
						// 2. XmlElement class decorator name with namespace (if exists on nested class)
						// 3. Property name (field key)
						// 4. Class name (fallback)
						let finalElementName: string;
						if (fieldMetadata && fieldMetadata.name !== key) {
							// Priority 1: Field decorator has custom name - build with field namespace
							finalElementName = this.namespaceUtil.buildElementName(fieldMetadata);
						} else if (
							valueElementMetadata &&
							(valueElementMetadata.name !== valueConstructor.name || valueElementMetadata.namespaces)
						) {
							// Priority 2: Class decorator has custom name or namespace - use pre-built name with namespace
							finalElementName = valueElementName;
						} else {
							// Priority 3: Use property name (key) as default
							finalElementName = key;
						}
						result[finalElementName] = elementContent;
					} else {
						// Primitive value - check if field metadata specifies CDATA or xml:space
						if (fieldMetadata?.useCDATA && value !== null && value !== undefined) {
							// Wrap primitive value in CDATA
							const cdataObj: any = { __cdata: String(value) };
							if (fieldMetadata.xmlSpace) {
								cdataObj[`@_xml:space`] = fieldMetadata.xmlSpace;
							}
							result[xmlName] = cdataObj;
						} else if (fieldMetadata?.xmlSpace && value !== null && value !== undefined) {
							// Wrap primitive value with xml:space attribute
							result[xmlName] = {
								"@_xml:space": fieldMetadata.xmlSpace,
								"#text": value,
							};
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
		elementMetadata?: XmlElementMetadata,
		propertyMappings?: Record<string, string>,
		fieldElementMetadata?: Record<string, XmlElementMetadata>,
		isNestedElement?: boolean
	): string {
		// Check field-level element metadata first
		if (fieldElementMetadata?.[propertyKey]) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			// If field has its own namespace, use it
			if (fieldMetadata.namespaces && fieldMetadata.namespaces.length > 0) {
				return this.namespaceUtil.buildElementName(fieldMetadata);
			}
			// For nested elements, children inherit parent namespace if no explicit namespace
			if (isNestedElement && elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
				const parentNamespace = elementMetadata.namespaces[0];
				if (parentNamespace.prefix) {
					return `${parentNamespace.prefix}:${fieldMetadata.name}`;
				}
			}
			// No namespace to apply, use field name as is
			return fieldMetadata.name;
		}

		// Check property mappings as fallback (from field decorators)
		if (propertyMappings?.[propertyKey]) {
			const mappedName = propertyMappings[propertyKey];
			// For nested elements, children inherit parent namespace if no explicit namespace
			if (isNestedElement && elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
				const parentNamespace = elementMetadata.namespaces[0];
				if (parentNamespace.prefix) {
					return `${parentNamespace.prefix}:${mappedName}`;
				}
			}
			return mappedName;
		}

		// For nested elements, children inherit parent namespace if no explicit metadata
		if (isNestedElement && elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
			const parentNamespace = elementMetadata.namespaces[0];
			if (parentNamespace.prefix) {
				return `${parentNamespace.prefix}:${propertyKey}`;
			}
		}

		// Default to property name
		return propertyKey;
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
		indexInParent: number = 0
	): DynamicElement {
		const attributes: Record<string, string> = {};
		const xmlnsDeclarations: Record<string, string> = {};
		let text: string | undefined;
		let rawText: string | undefined;
		let numericValue: number | undefined;
		let booleanValue: boolean | undefined;

		// Compute path for this element
		const elementPath = path ? `${path}/${name}` : name;

		// Parse text content
		if (typeof data === "string") {
			rawText = data;
			text = options.trimValues !== false ? data.trim() : data;
		} else if (typeof data === "number" || typeof data === "boolean") {
			// Handle primitives converted by parser
			text = String(data);
			rawText = text;
		} else if (typeof data === "object" && data !== null) {
			// Parse attributes
			const attrKeys = Object.keys(data).filter(k => k.startsWith("@_"));
			for (const attrKey of attrKeys) {
				const attrName = attrKey.substring(2);
				const attrValue = String(data[attrKey]);

				// Separate xmlns declarations from regular attributes
				if (attrName.startsWith("xmlns:")) {
					const prefix = attrName.substring(6); // Remove "xmlns:" prefix
					xmlnsDeclarations[prefix] = attrValue;
				} else if (attrName === "xmlns") {
					// Default namespace
					xmlnsDeclarations[""] = attrValue;
				}

				// Keep all attributes (including xmlns) for backwards compatibility
				attributes[attrName] = attrValue;
			}

			// Parse text content from object
			if (data["#text"]) {
				rawText = String(data["#text"]);
				text = options.trimValues !== false ? rawText.trim() : rawText;
			} else if (data.__cdata) {
				rawText = String(data.__cdata);
				text = options.trimValues !== false ? rawText.trim() : rawText;
			}
		}

		// Parse numeric value
		// Don't parse values with leading zeros (except plain "0" or decimals like "0.5")
		// to preserve IDs and codes like "0001234567"
		if (options.parseNumeric !== false && text && /^-?\d+(\.\d+)?$/.test(text) && !/^0\d+/.test(text)) {
			const num = Number(text);
			if (!Number.isNaN(num)) {
				numericValue = num;
			}
		}

		// Parse boolean value
		if (options.parseBoolean !== false && text) {
			const lower = text.toLowerCase();
			if (lower === "true" || lower === "false") {
				booleanValue = lower === "true";
			}
		}

		// Parse children (respect maxDepth option)
		const childElements: DynamicElement[] = [];
		const shouldParseChildren =
			options.parseChildren !== false &&
			typeof data === "object" &&
			data !== null &&
			(options.maxDepth === undefined || depth < options.maxDepth);

		if (shouldParseChildren) {
			for (const [key, value] of Object.entries(data)) {
				// Skip attributes, text, and CDATA
				if (key.startsWith("@_") || key === "#text" || key === "__cdata") continue;

				// Handle both arrays and single values
				const children = Array.isArray(value) ? value : [value];

				for (let i = 0; i < children.length; i++) {
					const childData = children[i];

					// Process the child recursively with updated depth, path, and index
					const child = this.buildDynamicElement(childData, key, options, depth + 1, elementPath, i);
					childElements.push(child);
				}
			}
		}

		// Create DynamicElement instance
		const element = new DynamicElement({
			name, // Use local name without namespace prefix
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
		}); // Update child references after parent element is created
		for (const child of childElements) {
			child.parent = element;
		}

		// Set siblings for all children
		for (let i = 0; i < childElements.length; i++) {
			// Siblings should exclude the element itself
			childElements[i].siblings = childElements.filter((_, index) => index !== i);
			childElements[i].indexAmongAllSiblings = i;
		}

		return element;
	}
}
