/**
 * Exports are ordered by usage frequency for better IntelliSense performance
 * TypeScript loads and caches types incrementally, so frequently used types come first
 */

export type { Constructor } from "./decorators/storage/metadata-storage";
export { isTypeThunk, resolveTypeRef, type TypeRef } from "./decorators/storage/type-ref";

export type {
	DecoratorKeys,
	DeepReadonly,
	XmlArrayItem,
	XmlArrayOptions,
	XmlAttributeOptions,
	XmlCommentOptions,
	XmlDynamicOptions,
	XmlElementOptions,
	XmlNamespace,
	XmlRootOptions,
	XmlTextOptions,
	XmlTypeOptions,
} from "./decorators/types";
export { XmlArray } from "./decorators/xml-array";
export { XmlAttribute } from "./decorators/xml-attribute";
export { XmlComment } from "./decorators/xml-comment";
export { XmlDynamic } from "./decorators/xml-dynamic";
export { XmlElement } from "./decorators/xml-element";
export { XmlIgnore } from "./decorators/xml-ignore";
export { XmlInclude } from "./decorators/xml-include";
export { XmlRoot } from "./decorators/xml-root";
export { XmlText } from "./decorators/xml-text";
export { XmlType } from "./decorators/xml-type";
export { DynamicElement } from "./query/dynamic-element";
export {
	DEFAULT_SOAP_PREFIX,
	type FaultDetailTypes,
	SOAP_1_1_NAMESPACE,
	SOAP_1_2_NAMESPACE,
	type SoapEnvelopeResult,
	type SoapFault,
	SoapFaultError,
	type SoapReadSpec,
	SoapSerializer,
	type SoapSerializerOptions,
	type SoapVersion,
	type SoapHeaderSpec,
	type SoapWriteOptions,
} from "./soap";
export { XmlQuery } from "./query/xml-query";
export { XmlQueryParser, type XmlQueryParserOptions } from "./query/xml-query-parser";
export type { SerializationOptions } from "./serialization-options";
export { XmlBuilder } from "./xml-builder";
export { XmlDecoratorParser, XmlDecoratorParser as XmlParser } from "./xml-decorator-parser";
export { XmlDecoratorSerializer, XmlDecoratorSerializer as XmlSerializer } from "./xml-decorator-serializer";
