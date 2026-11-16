import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { browserProject } from "../../testing/vitest";

const stub = fileURLToPath(new URL("../admin/.storybook/node-stub.ts", import.meta.url));

// The blocks' drawing in Node (HTML and the checks), and their looks in a real browser, measured as a reader sees them (`pnpm --filter @monti-cms/blocks test:browser`).
export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "blocks",
					include: ["blocks/**/*.test.ts", "blocks/**/*.test.tsx"],
					exclude: ["blocks/**/*.browser.test.tsx"],
				},
			},
			browserProject({
				name: "blocks (browser)",
				include: ["blocks/**/*.browser.test.tsx"],
				setupFiles: ["./test/browser-setup.ts"],
				// The core's server-only modules, as in the admin's screen tests (its `vitest.config.ts`).
				resolve: { alias: { pg: stub, "node:fs/promises": stub, "node:path": stub, "node:os": stub } },
			}),
		],
	},
});
