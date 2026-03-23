/**
 * Fun branding messages for CLI output.
 */
export const ceriosMessages = [
	"Schemas just got Cerios!",
	"Time to get Cerios about XML types!",
	"Cerios codegen mode: enabled.",
	"This is Cerios-ly a great schema setup!",
	"Type generation? We are dead Cerios.",
	"Cerios vibes, strongly typed output.",
	"You are officially Cerios about XSD now.",
	"Cerios business ahead: classes incoming!",
	"Don't take XML too Cerios-ly... unless it's codegen.",
	"Cerios-ly, you are all set!",
] as const;

/**
 * Get a random Cerios message for CLI output.
 */
export function getRandomCeriosMessage(): string {
	return ceriosMessages[Math.floor(Math.random() * ceriosMessages.length)];
}
