import path from "node:path";
import { packageTests } from "../../vitest.shared";

/** The L2 tests of core (`*.int.test.ts`): they need the test database, the file system or a child process. `vitest.config.ts` runs the rest. */
export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	layer: "int",
	// A schema file written in a temporary folder imports `defineSchema` from the package by name, as a site's does.
	alias: [{ find: /^@monti-cms\/core$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") }],
});
