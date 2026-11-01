import path from "node:path";
import { packageTests } from "../../vitest.shared";

/**
 * The core suite as mutation testing runs it (`stryker.config.mjs`). Stryker writes its mutants into the source files, so the test that type-checks
 * a generated project against the sources cannot pass while it runs. It is left out here and nowhere else.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	// Every layer: a mutant is caught by whichever test reaches it.
	include: ["src/**/*.{test,spec}.{ts,tsx}"],
	exclude: ["src/cli/__test__/init-typecheck.int.test.ts"],
	alias: [{ find: /^@monti-cms\/core$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") }],
});
