import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { getXmlElementMetadata, getXmlRootMetadata, XmlElementMetadata } from "./decorators";
import { DEFAULT_SERIALIZATION_OPTIONS, SerializationOptions } from "./serialization-options";
import { XmlMappingUtil } from "./xml-mapping-util";
import { XmlNamespaceUtil } from "./xml-namespace-util";

/**
 * Main XML serialization class that orchestrates the conversion between
 * typed objects and XML strings using decorator metadata.
 */
export class XmlSerializer {
	private parser: XMLParser;
	private builder: XMLBuilder;
	private options: SerializationOptions;
	private namespaceUtil: XmlNamespaceUtil;
	private mappingUtil: XmlMappingUtil;

	constructor(options: SerializationOptions = {}) {
		// Merge with defaults
		this.options = { ...DEFAULT_SERIALIZATION_OPTIONS, ...options };

		// Initialize utilities
		this.namespaceUtil = new XmlNamespaceUtil();
		this.mappingUtil = new XmlMappingUtil(this.options);

		// Configure fast-xml-parser
		this.parser = new XMLParser({
			ignoreAttributes: this.options.ignoreAttributes,
			attributeNamePrefix: this.options.attributeNamePrefix,
			textNodeName: this.options.textNodeName,
			parseAttributeValue: false, // Keep attribute values as strings to prevent "1.0" -> 1 -> "1" conversion
			parseTagValue: true,
			trimValues: false, // Preserve whitespace in text content
			cdataPropName: "__cdata", // Property name for CDATA sections
		});

		this.builder = new XMLBuilder({
			ignoreAttributes: this.options.ignoreAttributes,
			attributeNamePrefix: this.options.attributeNamePrefix,
			textNodeName: this.options.textNodeName,
			format: true,
			suppressBooleanAttributes: false, // Ensure boolean attributes include values
			cdataPropName: "__cdata", // Property name for CDATA sections
			commentPropName: "?", // Property name for XML comments
		});
	}

	/**
	 * Parse XML string to typed object.
	 */
	fromXml<T>(xmlString: string, targetClass: new () => T): T {
		const parsed = this.parser.parse(xmlString);

		// Check for @XmlRoot first (for root elements), then @XmlElement (for nested elements)
		const rootMetadata = getXmlRootMetadata(targetClass);
		const elementMetadata = rootMetadata
			? ({ name: rootMetadata.elementName, namespace: rootMetadata.namespace } as XmlElementMetadata)
			: getXmlElementMetadata(targetClass);

		if (!elementMetadata) {
			throw new Error(`Class ${targetClass.name} is not decorated with @XmlRoot or @XmlElement`);
		}

		// Handle namespaced element names
		const elementName = this.namespaceUtil.buildElementName(elementMetadata);
		let rootElement = parsed[elementName];
		if (rootElement === undefined) {
			throw new Error(`Root element ${elementName} not found in XML`);
		}

		// Handle empty elements - fast-xml-parser returns "" for <Element></Element>
		// Convert empty string to empty object for proper deserialization
		if (rootElement === "") {
			rootElement = {};
		}

		return this.mappingUtil.mapToObject(rootElement, targetClass);
	}

	/**
	 * Convert typed object to XML string.
	 */
	toXml<T extends object>(obj: T): string {
		// Reset visited objects for circular reference detection
		this.mappingUtil.resetVisitedObjects();

		const ctor = (obj as any).constructor;

		// Check for XmlRoot metadata first, then fall back to XmlElement
		const rootMetadata = getXmlRootMetadata(ctor);
		const elementMetadata = getXmlElementMetadata(ctor);

		if (!rootMetadata && !elementMetadata) {
			throw new Error(`Class ${ctor.name} is not decorated with @XmlRoot or @XmlElement`);
		}

		// Use XmlRoot if available, otherwise use XmlElement
		const effectiveMetadata = rootMetadata
			? ({
					name: rootMetadata.elementName,
					namespace: rootMetadata.namespace,
					required: false,
					dataType: rootMetadata.dataType,
					isNullable: rootMetadata.isNullable,
				} as XmlElementMetadata)
			: (elementMetadata as XmlElementMetadata);

		const elementName = this.namespaceUtil.buildElementName(effectiveMetadata);
		const mappedObj = this.mappingUtil.mapFromObject(obj, elementName, effectiveMetadata);

		// Collect and add all namespace declarations
		const allNamespaces = this.namespaceUtil.collectAllNamespaces(obj);
		if (allNamespaces.size > 0) {
			this.namespaceUtil.addNamespaceDeclarations(mappedObj, elementName, allNamespaces);
		}

		const xmlBody = this.builder.build(mappedObj);

		// Add XML declaration (C#-style)
		if (!this.options.omitXmlDeclaration) {
			const xmlDeclaration = this.generateXmlDeclaration();
			return `${xmlDeclaration}\n${xmlBody}`;
		}

		return xmlBody;
	}

	/**
	 * Generate XML declaration (C#-inspired).
	 */
	private generateXmlDeclaration(): string {
		let declaration = `<?xml version="${this.options.xmlVersion}"`;

		if (this.options.encoding) {
			declaration += ` encoding="${this.options.encoding}"`;
		}

		if (this.options.standalone !== undefined) {
			declaration += ` standalone="${this.options.standalone ? "yes" : "no"}"`;
		}

		declaration += `?>`;
		return declaration;
	}
}
