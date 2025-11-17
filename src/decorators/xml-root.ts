import { rootMetadataStorage } from "./storage";
import { XmlRootMetadata, XmlRootOptions } from "./types";

/**
 * XmlRoot decorator for root element control
 * @param options Configuration options for the root element
 * @returns A class decorator function
 */
export function XmlRoot(options: XmlRootOptions = {}) {
	return <T extends abstract new (...args: any) => any>(target: T, context: ClassDecoratorContext<T>): T => {
		const rootMetadata: XmlRootMetadata = {
			elementName: options.elementName || String(context.name),
			namespace: options.namespace,
			dataType: options.dataType,
			isNullable: options.isNullable,
		};

		// Store root metadata
		rootMetadataStorage.set(target, rootMetadata);

		return target;
	};
}
