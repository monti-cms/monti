import { defineConfig } from "vitest/config";
import { browserProject } from "../../testing/vitest";

// L3 (docs/testing.md): one part with its providers, in a real browser. `pnpm --filter @monti-cms/ui test:browser`.
export default defineConfig({
	test: {
		projects: [
			browserProject({
				name: "ui (browser)",
				include: ["src/**/*.browser.test.tsx"],
				setupFiles: ["./test/browser-setup.ts"],
			}),
		],
	},
});
