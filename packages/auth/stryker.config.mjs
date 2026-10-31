// @ts-check

/**
 * Mutation testing of one auth file (`pnpm --filter @monti-cms/auth test:mutation --mutate src/<file>.ts`), the same way as core
 * (`packages/core/stryker.config.mjs`, which explains each setting). It is used only on the code of the features rated 🔴 in
 * `docs/testing/features.md`.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	testRunner: "vitest",
	vitest: { configFile: "vitest.config.ts" },
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: ["src/password.ts"],
	coverageAnalysis: "perTest",
	disableBail: true,
	inPlace: true,
	ignorePatterns: ["/*", "!/src"],
	concurrency: 4,
	timeoutMS: 60_000,
	reporters: ["clear-text", "progress", "html", "json"],
	htmlReporter: { fileName: "reports/mutation/index.html" },
	jsonReporter: { fileName: "reports/mutation/mutation.json" },
	tempDirName: ".stryker-tmp",
};
