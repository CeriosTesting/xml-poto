import { XmlAttribute, XmlElement } from "../../../src";
import { Contact } from "./contact";
import { MSG_NAMESPACE } from "./namespaces";

@XmlElement({ name: "metadata", namespace: MSG_NAMESPACE })
export class Metadata {
	@XmlAttribute()
	version!: string;

	@XmlElement({ namespace: MSG_NAMESPACE })
	id!: string;

	@XmlElement({ name: "creation-time", namespace: MSG_NAMESPACE })
	creationTime!: string;

	@XmlElement({ name: "message-type", namespace: MSG_NAMESPACE })
	messageType!: string;

	@XmlElement({ name: "subtype", namespace: MSG_NAMESPACE })
	subtype!: string;

	@XmlElement({ type: Contact })
	contact!: Contact;
}
