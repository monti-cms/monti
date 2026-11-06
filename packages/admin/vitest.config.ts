import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { browserProject } from "../../testing/vitest";

const stub = fileURLToPath(new URL("./.storybook/node-stub.ts", import.meta.url));

// The admin's tests (docs/testing.md): L1 in Node, and L4, whole screens on a site in the browser (PGlite and the core's real operations, as the
// stories run them). `pnpm --filter @monti-cms/admin test` and `test:screen`.
export default defineConfig({
	test: {
		projects: [
			{ test: { name: "admin", include: ["src/**/*.test.{ts,tsx}"], exclude: ["src/**/*.screen.test.tsx"] } },
			browserProject({
				name: "admin (screen)",
				include: ["src/**/*.screen.test.tsx"],
				setupFiles: ["./test/screen-setup.ts"],
				// The core's server-only modules, as in Storybook (.storybook/main.ts).
				resolve: { alias: { pg: stub, "node:fs/promises": stub, "node:path": stub } },
				optimizeDeps: { exclude: ["@electric-sql/pglite"] },
			}),
		],
	},
});
