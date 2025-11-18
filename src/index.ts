export type {
	XmlArrayItemOptions,
	XmlAttributeOptions,
	XmlCommentOptions,
	XmlElementOptions,
	XmlNamespace,
	XmlRootOptions,
	XmlTextOptions,
} from "./decorators/types";

export { XmlArrayItem } from "./decorators/xml-array-item";
export { XmlAttribute } from "./decorators/xml-attribute";
export { XmlComment } from "./decorators/xml-comment";
export { XmlElement } from "./decorators/xml-element";
export { XmlRoot } from "./decorators/xml-root";
export { XmlText } from "./decorators/xml-text";

export type { SerializationOptions } from "./serialization-options";
export { XmlSerializer } from "./xml-serializer";
