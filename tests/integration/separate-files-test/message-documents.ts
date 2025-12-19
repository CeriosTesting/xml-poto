import { XmlElement, XmlRoot } from "../../../src";
import { Metadata } from "./metadata";
import { MSG_NAMESPACE } from "./namespaces";

// Re-export for convenience
export { MSG_NAMESPACE };

@XmlRoot({
	name: "message",
	namespace: MSG_NAMESPACE,
})
export class MessageDocument {
	@XmlElement({ type: Metadata })
	metadata!: Metadata;
}
