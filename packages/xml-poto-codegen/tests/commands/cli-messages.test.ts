import { describe, expect, it } from "vitest";

import { ceriosMessages, getRandomCeriosMessage } from "../../src/commands/cli-messages";

describe("cli-messages", () => {
	it("returns a message from the configured list", () => {
		const message = getRandomCeriosMessage();
		expect(ceriosMessages).toContain(message);
	});

	it("contains at least one branding message", () => {
		expect(ceriosMessages.length).toBeGreaterThan(0);
	});
});
