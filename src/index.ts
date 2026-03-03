/**
 * Exports are ordered by usage frequency for better IntelliSense performance
 * TypeScript loads and caches types incrementally, so frequently used types come first
 */

export type { Constructor } from "./decorators/storage/metadata-storage";

export type {
	DecoratorKeys,
	DeepReadonly,
	// eslint-disable-next-line typescript/no-deprecated
	XmlArrayItemOptions,
	XmlArrayOptions,
	XmlAttributeOptions,
	XmlCommentOptions,
	XmlDynamicOptions,
	XmlElementOptions,
	XmlNamespace,
	// eslint-disable-next-line typescript/no-deprecated
	XmlQueryableOptions,
	XmlRootOptions,
	XmlTextOptions,
} from "./decorators/types";
// eslint-disable-next-line typescript/no-deprecated
export { XmlArray, XmlArrayItem } from "./decorators/xml-array";
export { XmlAttribute } from "./decorators/xml-attribute";
export { XmlComment } from "./decorators/xml-comment";
// eslint-disable-next-line typescript/no-deprecated
export { XmlDynamic, XmlQueryable } from "./decorators/xml-dynamic";
export { XmlElement } from "./decorators/xml-element";
export { XmlIgnore } from "./decorators/xml-ignore";
export { XmlRoot } from "./decorators/xml-root";
export { XmlText } from "./decorators/xml-text";
// eslint-disable-next-line typescript/no-deprecated
export { DynamicElement, QueryableElement } from "./query/dynamic-element";
export { XmlQuery } from "./query/xml-query";
export { XmlQueryParser, XmlQueryParserOptions } from "./query/xml-query-parser";
export type { SerializationOptions } from "./serialization-options";
export { XmlBuilder } from "./xml-builder";
export { XmlDecoratorParser, XmlDecoratorParser as XmlParser } from "./xml-decorator-parser";
export { XmlDecoratorSerializer, XmlDecoratorSerializer as XmlSerializer } from "./xml-decorator-serializer";
