import path from "node:path";
import { packageTests } from "../../vitest.shared";

/**
 * The core suite as mutation testing runs it (`stryker.config.mjs`). Stryker writes its mutants into the source files, so the two tests that read
 * the source as text cannot pass while it runs: one type-checks a generated project against the sources, one compares `db/database.ts` with the
 * database. They are left out here and nowhere else.
 */
export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	// Every layer: a mutant is caught by whichever test reaches it.
	include: ["src/**/*.{test,spec}.{ts,tsx}"],
	exclude: ["src/cli/__test__/init-typecheck.int.test.ts", "src/adapters/postgres/__test__/database-types.int.test.ts"],
	alias: [{ find: /^@monti-cms\/core$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") }],
});
