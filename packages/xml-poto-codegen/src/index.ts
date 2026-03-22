// Public API
export type { XmlPotoCodegenConfig as CodegenConfig, EnumStyle, XsdSource } from "./config/config-types";
export { findConfigFile, loadConfig, validateConfig } from "./config/config-loader";
export { ClassGenerator } from "./generator/class-generator";
export type { GeneratedFile } from "./generator/class-generator";
export { collectImports, mapClassDecorator, mapPropertyDecorator } from "./generator/decorator-mapper";
export { writeGeneratedFiles } from "./generator/file-writer";
export { buildDecorator, buildFileHeader, buildImport, buildProperty, toKebabCase } from "./generator/ts-builder";
export { XsdParser } from "./xsd/xsd-parser";
export { toCamelCase, toPascalCase, XsdResolver } from "./xsd/xsd-resolver";
export type {
	ResolvedEnum,
	ResolvedProperty,
	ResolvedRootElement,
	ResolvedSchema,
	ResolvedType,
} from "./xsd/xsd-resolver";
export type {
	XsdAll,
	XsdAny,
	XsdAttribute,
	XsdAttributeGroup,
	XsdAttributeGroupRef,
	XsdChoice,
	XsdComplexContent,
	XsdComplexContentExtension,
	XsdComplexContentRestriction,
	XsdComplexType,
	XsdElement,
	XsdGroup,
	XsdGroupRef,
	XsdImport,
	XsdInclude,
	XsdNamespace,
	XsdRestriction,
	XsdSchema,
	XsdSequence,
	XsdSimpleContent,
	XsdSimpleContentExtension,
	XsdSimpleContentRestriction,
	XsdSimpleType,
} from "./xsd/xsd-types";
