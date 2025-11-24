const { XmlRoot, XmlElement, XmlQueryable, XmlSerializer } = require("./src");

@XmlElement("xbrli:xbrl")
class XBRLRootXml {
	@XmlQueryable()
	query;

	getDatapoints() {
		console.log("this.query is:", this.query);
		console.log("this.__queryable_builder_query is:", this["__queryable_builder_query"]);
		if (!this.query) return [];
		return [];
	}
}

@XmlRoot({ elementName: "envelope" })
class ContentDocumentEnvelopeXml {
	@XmlElement({ name: "extractionResult", type: XBRLRootXml })
	extractionResult = new XBRLRootXml();
}

const xml = `<envelope><extractionResult><xbrli:xbrl></xbrli:xbrl></extractionResult></envelope>`;
const serializer = new XmlSerializer();
const doc = serializer.fromXml(xml, ContentDocumentEnvelopeXml);

console.log("Calling getDatapoints...");
doc.extractionResult.getDatapoints();
