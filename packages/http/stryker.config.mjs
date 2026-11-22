// @ts-check
// Incremental mutation testing for `@monti-cms/http`.
// - `incremental: true` caches results in `.stryker-incremental.json` so unchanged files and tests are reused.
// - `coverageAnalysis: "perTest"` runs only the tests that execute the mutated line.
// - Pass `--mutate "src/<folder>/<file>.ts"` to check a specific stage or folder.

/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
	testRunner: "vitest",
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/__test__/**", "!src/**/types.ts"],
	incremental: true,
	incrementalFile: ".stryker-incremental.json",
	coverageAnalysis: "perTest",
	inPlace: true,
	ignorePatterns: ["/*", "!/src"],
	concurrency: 2,
	timeoutMS: 60_000,
	reporters: ["clear-text", "progress"],
	tempDirName: ".stryker-tmp",
};
