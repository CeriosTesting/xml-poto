import { XmlAttribute, XmlElement } from "../../../src";
import { MSG_NAMESPACE } from "./namespaces";

@XmlElement({ name: "contact", namespace: MSG_NAMESPACE })
export class Contact {
	@XmlAttribute()
	version!: string;

	@XmlElement({ namespace: MSG_NAMESPACE })
	sender!: string;

	@XmlElement({ namespace: MSG_NAMESPACE })
	recipient!: string;
}
