import path from "node:path";
import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "core",
	// A schema file written in a temporary folder imports `defineSchema` from the package by name, as a site's does.
	alias: [{ find: /^@monti-cms\/core$/, replacement: path.resolve(import.meta.dirname, "./src/index.ts") }],
});
