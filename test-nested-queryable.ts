import { QueryableElement, XmlElement, XmlQueryable, XmlRoot, XmlSerializer } from "./src";

@XmlElement("xbrli:xbrl")
class XBRLRootXml {
	@XmlQueryable()
	query!: QueryableElement;

	getDatapoints() {
		console.log("this.query is:", this.query);
		console.log("this.__queryable_builder_query is:", (this as any)["__queryable_builder_query"]);
		if (!this.query) {
			console.log("ERROR: query is undefined!");
			return [];
		}
		console.log("SUCCESS: query is defined!");
		return [];
	}
}

@XmlRoot({ elementName: "envelope" })
class ContentDocumentEnvelopeXml {
	@XmlElement({ name: "extractionResult", type: XBRLRootXml })
	extractionResult: XBRLRootXml = new XBRLRootXml();
}

const xml = `<envelope><extractionResult><xbrli:xbrl></xbrli:xbrl></extractionResult></envelope>`;
const serializer = new XmlSerializer();
const doc = serializer.fromXml(xml, ContentDocumentEnvelopeXml);

console.log("Calling getDatapoints...");
doc.extractionResult.getDatapoints();
