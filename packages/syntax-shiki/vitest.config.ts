import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "syntax-shiki",
	// Tests that need the extension in the site config run in `vitest.configured.config.ts`.
	exclude: ["src/**/*.configured.test.{ts,tsx}"],
});
