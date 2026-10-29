// @ts-check
import base from "./stryker.config.mjs";

/**
 * The mutation score of all of core (`pnpm --filter @monti-cms/core test:mutation:score`), fast enough for a night: a mutant stops at the first
 * test that kills it, so the report says whether each mutant was caught but not by how many tests, and mutants of module-level code (which
 * every test runs, so each would run the whole suite) are left out. That leaves out some catches too: on `plugin-storage.ts` this gives 73%
 * where `stryker.config.mjs` gives 83%. Compare scores of this config with scores of this config only.
 *
 * `scripts/test-metrics/core-mutation-score.mjs` runs it one source folder at a time, so a stopped run can go on where it was.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	...base,
	mutate: ["src/**/*.ts", "!src/**/__test__/**", "!src/**/*.test.ts", "!src/**/*.d.ts"],
	disableBail: false,
	ignoreStatic: true,
	concurrency: 6,
	reporters: ["clear-text", "progress", "html", "json"],
	htmlReporter: { fileName: "reports/mutation/score/index.html" },
	jsonReporter: { fileName: "reports/mutation/score/mutation.json" },
};
