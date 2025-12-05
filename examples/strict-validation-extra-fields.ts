/**
 * Example: Extra Field Validation in Strict Mode
 *
 * This example demonstrates how strict validation catches unmapped XML fields,
 * and how @XmlDynamic allows handling arbitrary XML structures.
 */

import { XmlDynamic, XmlElement, XmlRoot } from "../src/decorators";
import { DynamicElement } from "../src/query/dynamic-element";
import { XmlDecoratorSerializer } from "../src/xml-decorator-serializer";

// Example 1: Strict validation WITHOUT @XmlDynamic
console.log("=== Example 1: Strict Validation (No @XmlDynamic) ===\n");

@XmlRoot({ name: "User" })
class User {
	@XmlElement({ name: "Name" })
	name: string = "";

	@XmlElement({ name: "Email" })
	email: string = "";
}

const userXml = `
<User>
    <Name>John Doe</Name>
    <Email>john@example.com</Email>
    <Age>30</Age>
    <Phone>555-1234</Phone>
</User>`;

const strictSerializer = new XmlDecoratorSerializer({ strictValidation: true });

try {
	strictSerializer.fromXml(userXml, User);
} catch (error: any) {
	console.log("❌ Error caught (as expected):");
	console.log(error.message);
	console.log("\n");
}

// Example 2: Lenient mode (default) - extra fields ignored
console.log("=== Example 2: Lenient Mode (Default) ===\n");

const lenientSerializer = new XmlDecoratorSerializer();
const user = lenientSerializer.fromXml(userXml, User);
console.log("✅ Parsed successfully (extra fields ignored):");
console.log(`Name: ${user.name}`);
console.log(`Email: ${user.email}`);
console.log("\n");

// Example 3: Using @XmlDynamic for flexible schemas
console.log("=== Example 3: Using @XmlDynamic for Flexibility ===\n");

@XmlRoot({ name: "Document" })
class Document {
	@XmlElement({ name: "Title" })
	title: string = "";

	@XmlElement({ name: "Version" })
	version: string = "";

	// @XmlDynamic allows any extra fields
	@XmlDynamic()
	query?: DynamicElement;
}

const documentXml = `
<Document>
    <Title>My Document</Title>
    <Version>1.0</Version>
    <Author>John Doe</Author>
    <Date>2024-01-01</Date>
    <Status>Published</Status>
    <Tags>
        <Tag>important</Tag>
        <Tag>draft</Tag>
    </Tags>
</Document>`;

const doc = strictSerializer.fromXml(documentXml, Document);
console.log("✅ Parsed successfully with @XmlDynamic:");
console.log(`Title: ${doc.title}`);
console.log(`Version: ${doc.version}`);
console.log(`Extra fields captured in query: ${doc.query?.children.length} elements`);

// Access extra fields through query
const author = doc.query?.children.find(c => c.localName === "Author");
console.log(`Author (from query): ${author?.textContent}`);
console.log("\n");

// Example 4: API Version Compatibility
console.log("=== Example 4: API Version Compatibility ===\n");

@XmlRoot({ name: "ApiResponse" })
class ApiResponse {
	@XmlElement({ name: "Status" })
	status: string = "";

	@XmlElement({ name: "Message" })
	message: string = "";

	// Handle future API versions gracefully
	@XmlDynamic()
	query?: DynamicElement;
}

const v1Response = `
<ApiResponse>
    <Status>success</Status>
    <Message>Operation completed</Message>
</ApiResponse>`;

const v2Response = `
<ApiResponse>
    <Status>success</Status>
    <Message>Operation completed</Message>
    <RequestId>abc-123</RequestId>
    <Timestamp>2024-01-01T00:00:00Z</Timestamp>
    <ServerVersion>2.0</ServerVersion>
</ApiResponse>`;

const v1 = strictSerializer.fromXml(v1Response, ApiResponse);
const v2 = strictSerializer.fromXml(v2Response, ApiResponse);

console.log("✅ V1 API Response:");
console.log(`Status: ${v1.status}, Message: ${v1.message}`);
console.log(`Extra fields: ${v1.query?.children.length || 0}`);

console.log("\n✅ V2 API Response (with extra fields):");
console.log(`Status: ${v2.status}, Message: ${v2.message}`);
console.log(`Extra fields: ${v2.query?.children.length || 0}`);

// Access V2-specific fields
const requestId = v2.query?.children.find(c => c.localName === "RequestId");
const timestamp = v2.query?.children.find(c => c.localName === "Timestamp");
console.log(`RequestId: ${requestId?.textContent}`);
console.log(`Timestamp: ${timestamp?.textContent}`);
console.log("\n");

// Example 5: Nested validation
console.log("=== Example 5: Nested Object Validation ===\n");

@XmlElement({ name: "Address" })
class Address {
	@XmlElement({ name: "Street" })
	street: string = "";

	@XmlElement({ name: "City" })
	city: string = "";
}

@XmlRoot({ name: "Person" })
class Person {
	@XmlElement({ name: "Name" })
	name: string = "";

	@XmlElement({ name: "Address", type: Address })
	address: Address = new Address();
}

const personXml = `
<Person>
    <Name>Jane Smith</Name>
    <Address>
        <Street>123 Main St</Street>
        <City>Springfield</City>
        <ZipCode>12345</ZipCode>
    </Address>
</Person>`;

try {
	strictSerializer.fromXml(personXml, Person);
} catch (error: any) {
	console.log("❌ Error caught in nested object:");
	console.log(error.message.split("\n")[0]); // Just show first line
	console.log("(ZipCode is not defined in Address class)");
}

console.log("\n=== Summary ===\n");
console.log("✅ Strict validation helps catch:");
console.log("   - Typos in field names");
console.log("   - API version changes");
console.log("   - Schema mismatches");
console.log("   - Unexpected data");
console.log("\n✅ Use @XmlDynamic when:");
console.log("   - Working with flexible/versioned APIs");
console.log("   - Handling arbitrary XML structures");
console.log("   - Building forward-compatible parsers");
