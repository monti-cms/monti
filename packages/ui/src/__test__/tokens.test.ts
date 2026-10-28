// @vitest-environment node
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
	it("are what the generator writes from tokens.json (run `pnpm gen:tokens` after editing it)", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const generated = generate();
		expect(read("styles/tokens.css")).toBe(generated.tokens);
		expect(read("styles/theme.css")).toBe(generated.theme);
		expect(read("src/tokens.generated.ts")).toBe(generated.layout);
		expect(read(".storybook/manager-theme.generated.ts")).toBe(generated.managerTheme);
	});

	it("key the layout options by the design system's names, and name every role of it once, with the monti prefix", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const json = JSON.parse(read("tokens/tokens.json"));
		const { layout, tokens, theme } = generate();
		const steps = json.spacing.tokens.map((token: { name: string }) => token.name.replace("space-", ""));
		for (const step of steps) expect(layout, `gap ${step}`).toContain(`\t${step}: "gap-monti-${step}",`);
		for (const token of json.width.tokens) {
			const role = token.name.replace("width-", "");
			expect(layout, role).toContain(`: "w-monti-${role}",`);
			expect(layout, role).toContain(`: "max-w-monti-${role}",`);
		}
		for (const token of json.radius.tokens)
			expect(layout).toContain(`"rounded-monti-${token.name.replace("radius-", "")}"`);
		for (const token of json.color.tokens) expect(tokens, token.name).toContain(`--monti-${token.name}:`);
		for (const style of json.type.groups.flatMap((group: { styles: { name: string }[] }) => group.styles)) {
			expect(theme, style.name).toContain(`@utility ${style.name.replace("text-", "text-monti-")} {`);
		}
	});

	it("give a sans type role its family through `--monti-family`, which `font-mono` sets on its own element, so mono wins at every width and stays off the children", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const json = JSON.parse(read("tokens/tokens.json"));
		const { theme } = generate();
		for (const group of json.type.groups as { family: string; styles: { name: string }[] }[]) {
			for (const style of group.styles) {
				const role = style.name.replace("text-", "text-monti-");
				const block = new RegExp(`@utility ${role} \\{[^}]*\\}`).exec(theme)?.[0] ?? "";
				// A role that set a fixed sans family would sit after `font-mono` once it is behind a variant (`md:text-monti-body`), and turn every mono value sans.
				if (group.family === "sans")
					expect(block, role).toContain("font-family: var(--monti-family, var(--monti-font-sans))");
				else expect(block, role).toContain(`font-family: var(--monti-font-${group.family})`);
			}
		}
		// `font-mono` sets the property, and the property is not inherited: a sans role inside a mono parent is sans.
		expect(theme).toContain("@utility font-mono {");
		expect(theme).toMatch(/@property --monti-family \{[^}]*inherits: false;/);
	});
});
