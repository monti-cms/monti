import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `styles/tokens.css` and the token block of `styles/theme.css` are generated from `tokens/tokens.json` by `scripts/gen-tokens.mjs`
 * (`pnpm gen:tokens`). Editing either by hand, or editing the JSON without running the script, fails here.
 */
const packageDir = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(packageDir, file), "utf8");
const script = pathToFileURL(path.resolve(packageDir, "../../scripts/gen-tokens.mjs")).href;

describe("design tokens", () => {
	it("UI-T2 are what the generator writes from tokens.json (run `pnpm gen:tokens` after editing it)", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const generated = generate();
		expect(read("styles/tokens.css")).toBe(generated.tokens);
		expect(read("styles/theme.css")).toBe(generated.theme);
		expect(read("src/tokens.generated.ts")).toBe(generated.layout);
		expect(read(".storybook/manager-theme.generated.ts")).toBe(generated.managerTheme);
	});
});
