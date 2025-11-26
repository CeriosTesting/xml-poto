module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testEnvironmentOptions: {
		// Disable localStorage to avoid security errors
		localStorage: null,
	},
	testMatch: ["**/tests/**/*.test.ts"],
	collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
	verbose: true,
	clearMocks: true,
	resetMocks: true,
	restoreMocks: true,
};
