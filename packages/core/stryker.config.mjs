// @ts-check

/**
 * Mutation testing of one core file (`pnpm --filter @monti-cms/core test:mutation --mutate src/<file>.ts`): Stryker changes the source one small
 * edit at a time (a mutant) and runs the tests that cover that line; a mutant no test fails on is a defect the suite would let through. It is
 * used only on the code of the features rated 🔴 in `docs/testing/features.md`, to see that the tests notice when it breaks; there is no score
 * of all of core to keep (`docs/testing.md`).
 *
 * - `inPlace`: the package's tests import `../../vitest.shared` and pnpm keeps each package's dependencies in its own `node_modules`, so a sandbox
 *   copy of the package would resolve neither. The mutants are written into the files themselves and put back when the run ends.
 * - `ignorePatterns`: in place, Stryker writes back every file it counts as the project's, which resets their file modes (`bin/monti.mjs` lost its
 *   executable bit). Only `src`, where no file is executable, is the project here; its files still get new timestamps after a run.
 * - `disableBail`: every test that covers a mutant runs, not only up to the first that fails, so the report lists every test that kills each
 *   mutant. That full list is what a test's own contribution (the mutants only it kills) is computed from. It is slow: a few seconds a
 *   mutant, so it is run on the file whose tests are being sorted out (`--mutate`), not on all of core.
 * - Per-test coverage picks the tests that ran a line. A store method is defined when the store is created, so a mutant that empties a whole
 *   method can be reported as surviving although the tests that call it fail on it: run such a mutant by hand before counting it.
 * - `vitest.mutation.config.ts`: the suite without the two tests that read the source as text.
 *
 * `mutate` is set per run (`--mutate`); the default is the pilot module.
 * @type {import("@stryker-mutator/api/core").PartialStrykerOptions}
 */
export default {
	testRunner: "vitest",
	vitest: { configFile: "vitest.mutation.config.ts" },
	plugins: ["@stryker-mutator/vitest-runner"],
	mutate: ["src/core/domain/lifecycle.ts"],
	coverageAnalysis: "perTest",
	disableBail: true,
	inPlace: true,
	ignorePatterns: ["/*", "!/src"],
	// The suite has Postgres tests that share one test database; fewer runners keep them from crowding it.
	concurrency: 4,
	timeoutMS: 60_000,
	reporters: ["clear-text", "progress", "html", "json"],
	htmlReporter: { fileName: "reports/mutation/index.html" },
	jsonReporter: { fileName: "reports/mutation/mutation.json" },
	tempDirName: ".stryker-tmp",
};
