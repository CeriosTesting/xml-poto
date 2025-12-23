import { XmlElementMetadata, XSI_NAMESPACE } from "../decorators";
import { findConstructorByName, findElementClass, getMetadata } from "../decorators/storage/metadata-storage";
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
		return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^[A-Z]/, char => char.toLowerCase());
	}

	/**
	 * Convert string to PascalCase
	 * Examples: "publication_marketDocument" -> "PublicationMarketDocument"
	 */
	private toPascalCase(str: string): string {
		return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^[a-z]/, char => char.toUpperCase());
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
		parentNamespace?: string
	): (new () => any) | undefined {
		// Auto-discovery uses global registry only (no context-awareness)
		// This maintains backward compatibility for cases without explicit types

		// Strategy 1: Try exact match with full xmlKey (including namespace prefix)
		let elementClass = findElementClass(xmlKey, undefined, false);
		if (elementClass) return elementClass as new () => any;

		// Strategy 2: Try prepending parent namespace prefix if xmlKey doesn't have one
		if (parentNamespace && !xmlKey.includes(":")) {
			const withParentPrefix = `${parentNamespace}:${xmlKey}`;
			elementClass = findElementClass(withParentPrefix, undefined, false);
			if (elementClass) return elementClass as new () => any;
		}

		// Strategy 3: Strip existing namespace prefix and try local name
		let localName = xmlKey;
		if (xmlKey.includes(":")) {
			const colonIndex = xmlKey.indexOf(":");
			localName = xmlKey.substring(colonIndex + 1);
			elementClass = findElementClass(localName, undefined, false);
			if (elementClass) return elementClass as new () => any;
		}

		// Strategy 4: Try constructor name match for undecorated classes
		// First try the local name
		elementClass = findConstructorByName(localName);
		if (elementClass) return elementClass as new () => any;

		// Try property name as class name
		elementClass = findConstructorByName(propertyKey);
		if (elementClass) return elementClass as new () => any;

		// Try Pascal case variant of property name
		const pascalPropertyName = this.toPascalCase(propertyKey);
		if (pascalPropertyName !== propertyKey) {
			elementClass = findConstructorByName(pascalPropertyName);
			if (elementClass) return elementClass as new () => any;
		}

		// Strategy 5: Handle dotted names (e.g., "sender_MarketParticipant.mRID")
		if (localName.includes(".")) {
			const parts = localName.split(".");
			const lastPart = parts[parts.length - 1];
			if (lastPart) {
				// Try last part in element registry
				elementClass = findElementClass(lastPart, undefined, false);
				if (elementClass) return elementClass as new () => any;

				// Try last part as constructor name
				elementClass = findConstructorByName(lastPart);
				if (elementClass) return elementClass as new () => any;
			}
		}

		// Strategy 6: Naming convention variants on xmlKey/localName
		const variants = [this.toCamelCase(localName), this.toPascalCase(localName), this.removeSpecialChars(localName)];

		for (const variant of variants) {
			if (variant !== localName) {
				// Try in element registry
				elementClass = findElementClass(variant, undefined, false);
				if (elementClass) return elementClass as new () => any;

				// Try as constructor name
				elementClass = findConstructorByName(variant);
				if (elementClass) return elementClass as new () => any;
			}
		}

		// Strategy 7: Property name variants
		const propertyVariants = [
			this.toCamelCase(propertyKey),
			this.toPascalCase(propertyKey),
			this.removeSpecialChars(propertyKey),
		];

		for (const variant of propertyVariants) {
			if (variant !== propertyKey) {
				elementClass = findElementClass(variant, undefined, false);
				if (elementClass) return elementClass as new () => any;

				elementClass = findConstructorByName(variant);
				if (elementClass) return elementClass as new () => any;
			}
		}

		return undefined;
	}

	/**
	 * Map XML data to a typed object instance.
	 */
	mapToObject<T extends object>(data: any, targetClass: new () => T): T {
		const instance = new targetClass();
		// Use single metadata lookup with destructuring for better performance
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
			? { propertyKey: textProperty, metadata: rawTextMetadata || { required: false } }
			: undefined;

		// Track which properties were found in XML
		const foundProperties = new Set<string>();

		// Map attributes first
		for (const propertyKey in attributeMetadata) {
			const attrMetadata = attributeMetadata[propertyKey];
			// Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				continue;
			}
			const attributeName = this.namespaceUtil.buildAttributeName(attrMetadata);
			const attributeKey = `@_${attributeName}`;

			let value = data[attributeKey];

			// Apply default value if attribute is missing
			if (value === undefined && attrMetadata.defaultValue !== undefined) {
				value = attrMetadata.defaultValue;
			}

			// Check required constraint
			if (value === undefined && attrMetadata.required) {
				throw new Error(`Required attribute '${attributeName}' is missing`);
			}

			if (value !== undefined) {
				// Apply custom converter
				value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "deserialize");

				// Validate value
				if (!XmlValidationUtil.validateValue(value, attrMetadata)) {
					throw new Error(`Invalid value '${value}' for attribute '${attributeName}'`);
				}

				// Convert and set the value with proper typing
				(instance as any)[propertyKey] = XmlValidationUtil.convertToPropertyType(value, instance, propertyKey);
				foundProperties.add(propertyKey);
			}
		}

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

		// Map comments from XML to properties
		const commentsMetadata = getMetadata(targetClass).comments;
		for (const commentMeta of commentsMetadata) {
			// Get the XML name for the target property
			const targetXmlName = this.getPropertyXmlName(
				commentMeta.targetProperty,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				false
			);

			// Look for comment with format "?_xmlName"
			const commentKey = `?_${targetXmlName}`;
			if (data[commentKey] !== undefined) {
				const commentValue = data[commentKey];

				// Check if property type is array by checking the instance
				const currentValue = (instance as any)[commentMeta.propertyKey];
				const isArray = Array.isArray(currentValue);

				if (isArray) {
					// Property is string[], split multi-line comments or wrap single line
					if (typeof commentValue === "string") {
						const lines = commentValue.split("\n");
						(instance as any)[commentMeta.propertyKey] = lines;
					} else {
						(instance as any)[commentMeta.propertyKey] = [String(commentValue)];
					}
				} else {
					// Property is string, join multi-line comments or use as-is
					if (typeof commentValue === "string") {
						(instance as any)[commentMeta.propertyKey] = commentValue;
					} else {
						(instance as any)[commentMeta.propertyKey] = String(commentValue);
					}
				}
				foundProperties.add(commentMeta.propertyKey);
			} else if (commentMeta.required) {
				throw new Error(`Required comment for '${commentMeta.targetProperty}' is missing`);
			}
		}

		// Map element properties (non-attributes, non-text)
		const excludedKeys = new Set<string>();
		for (const key in attributeMetadata) {
			excludedKeys.add(key);
		}
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}

		// Create reverse mapping from XML name to property name
		const xmlToPropertyMap: Record<string, string> = {};

		// Build xmlToPropertyMap from field metadata instead of instance keys
		// This ensures optional properties are included even if not initialized
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
		// For properties without decorators, we'll discover them dynamically from XML data

		for (const propertyKey of allPropertyKeys) {
			const xmlName = this.getPropertyXmlName(
				propertyKey,
				elementMetadata,
				propertyMappings,
				fieldElementMetadata,
				true // Enable namespace inheritance for nested elements
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

				// Add namespace-prefixed variant if parent has namespace
				if (elementMetadata?.namespaces && elementMetadata.namespaces.length > 0) {
					const parentPrefix = elementMetadata.namespaces[0].prefix;
					if (parentPrefix && !xmlName.includes(":")) {
						const prefixedName = `${parentPrefix}:${xmlName}`;
						xmlToPropertyMap[prefixedName] = propertyKey;
					}
				}
			}
		}

		// First pass: Handle unwrapped arrays (where itemName appears directly in data)
		for (const propertyKey in allArrayMetadata) {
			const metadataArray = allArrayMetadata[propertyKey];
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
		}

		for (const xmlKey in data) {
			// Skip attribute, text, and CDATA keys
			if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata") {
				continue;
			}

			// Skip keys already processed as unwrapped arrays
			if (excludedKeys.has(xmlKey)) {
				continue;
			}

			// Find the corresponding property key
			let propertyKey = xmlToPropertyMap[xmlKey];
			if (!propertyKey) {
				// No mapping found - try stripping namespace prefix and applying naming conventions
				const colonIndex = xmlKey.indexOf(":");
				const localName = colonIndex > 0 ? xmlKey.substring(colonIndex + 1) : xmlKey;

				// Try multiple naming convention conversions to find matching property
				propertyKey = this.findPropertyByNamingConventions(localName, instance);
			} // Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				continue;
			} // Only map properties that are NOT attributes or text content
			if (!excludedKeys.has(propertyKey)) {
				if (data[xmlKey] !== undefined) {
					let value = data[xmlKey];

					// Reordered checks for performance: null check first, then typeof
					// Convert empty objects to empty strings (parser returns {} for <element/>)
					if (value !== null && typeof value === "object" && Object.keys(value).length === 0) {
						value = "";
					}

					// Extract #text from simple text nodes (from custom parser)
					// This happens when custom parser is used but field is not mixed content
					if (value !== null && typeof value === "object" && "#text" in value && Object.keys(value).length === 1) {
						value = value["#text"];
					} // Check if this value has #mixed content from custom parser
					if (typeof value === "object" && value !== null && "#mixed" in value) {
						// Use already-fetched metadata
						const fieldMeta = fieldElementMetadata[propertyKey];
						if (fieldMeta?.mixedContent) {
							// Assign the mixed content array directly
							(instance as any)[propertyKey] = value["#mixed"];
							continue;
						} // Check if #mixed contains a single __cdata node (not actually mixed content)
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
						for (const key in value) {
							if (key !== "#text" && key !== "@_" && !key.startsWith("@_")) {
								// This is an element
								const attributes: Record<string, string> = {};
								let content = "";
								const val = value[key];

								if (typeof val === "object" && val !== null) {
									// Extract attributes
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
						}
						(instance as any)[propertyKey] = mixedArray;
						continue;
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
								} else {
									// In strict mode, only use auto-discovery if there's an explicit field mapping
									// If no field mapping exists, let strict validation catch it as unexpected element
									const hasExplicitMapping = xmlToPropertyMap[xmlKey] !== undefined;

									if (!this.options.strictValidation || hasExplicitMapping) {
										// Fallback to auto-discovery: find class by XML element name
										const parentNamespacePrefix = elementMetadata?.namespaces?.[0]?.prefix;
										const elementClass = this.findNestedClassByAutoDiscovery(
											xmlKey,
											propertyKey,
											parentNamespacePrefix
										);

										if (elementClass) {
											value = this.mapToObject(value, elementClass as new () => any);
										}
									}
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
		}
		// Apply default values for elements that were not found in XML
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			// Skip if property was found in XML or if no default is specified
			if (foundProperties.has(propertyKey) || fieldMetadata.defaultValue === undefined) {
				continue;
			}

			// Apply the default value
			(instance as any)[propertyKey] = fieldMetadata.defaultValue;
		}

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
		for (const propertyKey in fieldElementMetadata) {
			const fieldMetadata = fieldElementMetadata[propertyKey];
			if (fieldMetadata.required && fieldMetadata.defaultValue === undefined) {
				const xmlName = this.namespaceUtil.buildElementName(fieldMetadata);
				const wasFound = data[xmlName] !== undefined;

				if (!wasFound) {
					throw new Error(`Required element '${fieldMetadata.name}' is missing`);
				}
			}
		}

		// Validate nested objects with @XmlDynamic are properly instantiated (when strictQueryableValidation is enabled)
		if (this.options.strictValidation) {
			// First, check for extra fields in XML that don't match the data model
			// Only validate if the class doesn't have @XmlDynamic decorators
			const queryables = metadata.queryables || [];
			const hasDynamicElement = queryables.length > 0;

			// Create a set of property keys that have @XmlDynamic decorator
			// These properties should be excluded from strict validation as they intentionally contain plain objects
			const dynamicPropertyKeys = new Set<string>();
			for (const q of queryables) {
				dynamicPropertyKeys.add(q.propertyKey);
			}

			if (!hasDynamicElement) {
				// Build a set of all valid XML element names that can appear in the data
				const validXmlNames = new Set<string>();

				// Add all field element names
				for (const propertyKey in fieldElementMetadata) {
					const fieldMetadata = fieldElementMetadata[propertyKey];
					const xmlName = this.namespaceUtil.buildElementName(fieldMetadata);
					validXmlNames.add(xmlName);
				}

				// Add all names from xmlToPropertyMap (includes properties without decorators)
				for (const xmlName in xmlToPropertyMap) {
					validXmlNames.add(xmlName);
				}

				// Add all array item names and container names
				for (const propertyKey in allArrayMetadata) {
					const metadataArray = allArrayMetadata[propertyKey];
					if (metadataArray && metadataArray.length > 0) {
						const arrayMetadata = metadataArray[0];
						if (arrayMetadata.itemName) {
							validXmlNames.add(arrayMetadata.itemName);
						}
						if (arrayMetadata.containerName) {
							validXmlNames.add(arrayMetadata.containerName);
						}
					}
				}

				// Check for fields with mixedContent enabled (they accept arbitrary content)
				let hasMixedContent = false;
				for (const propertyKey in fieldElementMetadata) {
					if (fieldElementMetadata[propertyKey]?.mixedContent === true) {
						hasMixedContent = true;
						break;
					}
				}

				// Only validate extra fields if there's no mixed content support
				if (!hasMixedContent) {
					// Check all keys in the data object
					const extraFields: string[] = [];
					for (const xmlKey in data) {
						// Skip special keys (attributes, text, CDATA, mixed content)
						if (xmlKey.startsWith("@_") || xmlKey === "#text" || xmlKey === "__cdata" || xmlKey === "#mixed") {
							continue;
						}

						// In strict validation mode, elements are only valid if explicitly declared in the model
						// This prevents auto-discovery from masking validation errors
						// Check if this key is valid:
						// 1. Explicitly defined in validXmlNames (has decorator)
						// 2. Can be mapped to a property via xmlToPropertyMap (includes namespace-prefixed properties)
						const isValid = validXmlNames.has(xmlKey) || xmlToPropertyMap[xmlKey] !== undefined;

						if (!isValid) {
							extraFields.push(xmlKey);
						}
					}

					// Throw error if extra fields were found
					if (extraFields.length > 0) {
						const className = targetClass.name || "Unknown";
						const extraFieldsList = extraFields.map(f => `  - <${f}>`).join("\n");
						const definedFieldsList = Array.from(validXmlNames)
							.map(f => `  - <${f}>`)
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
								`exporting the namespace from your root document file.`
						);
					}
				}
			}

			// Then check all properties on the instance for proper instantiation
			for (const propertyKey in instance) {
				if (!Object.prototype.hasOwnProperty.call(instance, propertyKey)) continue;
				const value = (instance as any)[propertyKey];

				// Skip if no value, not an object, or is an array (reordered for performance)
				if (!value || Array.isArray(value) || typeof value !== "object") {
					continue;
				}

				// Skip properties decorated with @XmlDynamic - they intentionally contain plain objects
				// with dynamic content that should not be validated
				if (dynamicPropertyKeys.has(propertyKey)) {
					continue;
				}

				// Check if the value is a plain Object (not properly instantiated)
				if (value.constructor.name === "Object") {
					const fieldMetadata = fieldElementMetadata[propertyKey];

					// Skip validation for unmapped XML elements on classes with @XmlDynamic
					// These are XML elements that don't correspond to decorated properties
					// and should only be accessible through the dynamic element
					if (!fieldMetadata && !allArrayMetadata[propertyKey] && hasDynamicElement) {
						// This property was likely set from an unmapped XML element
						// Skip validation since it's expected for classes with @XmlDynamic
						continue;
					}

					// If type is specified in metadata, check if it has @XmlDynamic
					if (fieldMetadata?.type) {
						// Use getMetadata for nested type
						const nestedMetadata = getMetadata(fieldMetadata.type as any);
						const nestedQueryables = nestedMetadata.queryables;

						if (nestedQueryables.length > 0) {
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
									`which breaks @XmlDynamic functionality and other class-specific behavior.`
							);
						}
					} else {
						// No type specified - warn about plain Object in strict mode
						// Check if this plain Object has nested properties (not just text)
						const valueKeys = Object.keys(value);
						const hasNestedObjects = valueKeys.length > 0;

						if (hasNestedObjects) {
							const xmlName = fieldMetadata?.name || propertyKey;
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
			}
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
		// Use single metadata lookup for better performance with destructuring
		const metadata = getMetadata(ctor);
		const {
			attributes: attributeMetadata,
			textProperty,
			textMetadata: rawTextMetadata,
			propertyMappings,
			fieldElements: fieldElementMetadata,
			comments: commentsMetadata,
			ignoredProperties: ignoredProps,
		} = metadata;
		const textMetadata = textProperty
			? { propertyKey: textProperty, metadata: rawTextMetadata || { required: false } }
			: undefined;
		const result: any = {};

		// Determine if this is a nested element with its own namespace context
		// Nested elements (class-level @XmlElement, not @XmlRoot) should propagate namespace to children
		const isNestedElement = !metadata.root && metadata.element && !!elementMetadata?.namespaces;

		// Add xml:space attribute if specified in element metadata
		if (elementMetadata?.xmlSpace) {
			result[`@_xml:space`] = elementMetadata.xmlSpace;
		}

		// Handle attributes first (include all attributes, use empty string for undefined)
		for (const propertyKey in attributeMetadata) {
			const attrMetadata = attributeMetadata[propertyKey];
			// Skip ignored properties
			if (ignoredProps.has(propertyKey)) {
				continue;
			}

			let value = obj[propertyKey];

			// Convert undefined/null to empty string for attributes (unless explicitly omitNullValues)
			// Reordered for performance: check null first (cheaper than options lookup)
			if (value === null || value === undefined) {
				if (this.options.omitNullValues) {
					// Skip this attribute entirely
					continue;
				}
				value = "";
			}

			// Apply custom converter
			value = XmlValidationUtil.applyConverter(value, attrMetadata.converter, "serialize");

			// Ensure boolean values are converted to strings for XML attributes
			if (typeof value === "boolean") {
				value = value.toString();
			}

			// Validate value
			if (!XmlValidationUtil.validateValue(value, attrMetadata)) {
				throw new Error(`Invalid value '${value}' for attribute '${attrMetadata.name}'`);
			}

			const attributeName = this.namespaceUtil.buildAttributeName(attrMetadata);
			result[`@_${attributeName}`] = value;
		}

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

		// Build a map of targetProperty -> comment for quick lookup
		const commentsByTarget = new Map<string, string>();
		for (const commentMeta of commentsMetadata) {
			const commentValue = obj[commentMeta.propertyKey];

			// Validate required comments
			if (
				commentMeta.required &&
				(commentValue === undefined ||
					commentValue === null ||
					commentValue === "" ||
					(Array.isArray(commentValue) && commentValue.length === 0))
			) {
				throw new Error(`Required comment for '${commentMeta.targetProperty}' is missing`);
			}

			// Store comment if it has a value
			if (commentValue !== undefined && commentValue !== null) {
				if (Array.isArray(commentValue)) {
					// string[] - join with newlines for single-line comment output
					if (commentValue.length > 0) {
						const joinedComment = commentValue.join("\n");
						if (joinedComment !== "") {
							commentsByTarget.set(commentMeta.targetProperty, joinedComment);
						}
					}
				} else if (commentValue !== "") {
					// string - use as-is (may contain \n for multi-line)
					commentsByTarget.set(commentMeta.targetProperty, String(commentValue));
				}
			}
		}

		// Handle element properties (non-attributes, non-text, non-comment) - include undefined as empty
		const excludedKeys = new Set<string>();
		for (const key in attributeMetadata) {
			excludedKeys.add(key);
		}
		if (textMetadata) {
			excludedKeys.add(textMetadata.propertyKey);
		}
		// Exclude all comment properties
		for (const commentMeta of commentsMetadata) {
			excludedKeys.add(commentMeta.propertyKey);
		}

		// Process ALL properties from the class, not just defined ones
		const allPropertyKeys = XmlValidationUtil.getAllPropertyKeys(obj, propertyMappings);

		for (const key of allPropertyKeys) {
			// Skip ignored properties
			if (ignoredProps.has(key)) {
				continue;
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
				}
				// Handle mixed content fields (array of text/element nodes)
				if (fieldMetadata?.mixedContent && Array.isArray(value)) {
					const xmlName = this.getPropertyXmlName(key, elementMetadata, propertyMappings, fieldElementMetadata);
					// Serialize mixed content to embedded XML elements
					const mixedElements = this.buildMixedContentStructure(value);
					result[xmlName] = mixedElements;
					continue;
				}

				// null/undefined handling with xsi:nil support
				if (value === undefined || value === null) {
					if (this.options.omitNullValues) {
						// Skip this element entirely
						continue;
					}
					if (fieldMetadata?.isNullable && value === null) {
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
						continue;
					}
					value = null;
				}

				// Get the XML name for this property
				const xmlName = this.getPropertyXmlName(
					key,
					elementMetadata,
					propertyMappings,
					fieldElementMetadata,
					isNestedElement
				);

				// Add comment before this element if one exists
				const comment = commentsByTarget.get(key);
				if (comment) {
					// Use a special key format: "?_propertyKey" to associate comment with element
					result[`?_${xmlName}`] = comment;
				}

				// Check if this is an array with XmlArray metadata
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

						// Add namespace declarations for nested element
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
		}

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
				const elementNames = Object.keys(item).filter(k => !k.startsWith("@_") && k !== "#text");

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
