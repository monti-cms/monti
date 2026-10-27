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
	});

	it("key the layout options by the design system's names, once, and write each class out whole", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const json = JSON.parse(read("tokens/tokens.json"));
		const { layout } = generate();
		const steps = json.spacing.tokens.map((token: { name: string }) => token.name.replace("space-", ""));
		for (const step of steps) expect(layout, `gap ${step}`).toContain(`\t${step}: "gap-monti-${step}",`);
		for (const token of json.width.tokens) {
			const role = token.name.replace("width-", "");
			expect(layout, role).toContain(`: "w-monti-${role}",`);
			expect(layout, role).toContain(`: "max-w-monti-${role}",`);
		}
		for (const token of json.radius.tokens)
			expect(layout).toContain(`"rounded-monti-${token.name.replace("radius-", "")}"`);
		expect(layout).toContain('page: "bg-monti-page"');
		expect(layout).not.toMatch(/\b(surface|overlay|inset|neutral|accent|condensed|comfortable|spacious)\b/);
	});

	it("name every role of the design system once, with the monti prefix", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const json = JSON.parse(read("tokens/tokens.json"));
		const { tokens, theme } = generate();
		for (const token of json.color.tokens) expect(tokens, token.name).toContain(`--monti-${token.name}:`);
		for (const style of json.type.groups.flatMap((group: { styles: { name: string }[] }) => group.styles)) {
			expect(theme, style.name).toContain(`@utility ${style.name.replace("text-", "text-monti-")} {`);
		}
		expect(theme).toContain("--background-color-monti-tool:");
		expect(theme).toContain("--spacing-monti-12:");
		expect(theme).not.toMatch(/--[\w-]+-monti-(accent|surface|inset|hair|tight|condensed)\b/);
	});

	it("resolve references to the scale, and keep one declaration for a role that is the same in both modes", async () => {
		const { generate } = await import(/* @vite-ignore */ script);
		const { tokens } = generate();
		const dark = tokens.slice(tokens.indexOf(":where(html:is("));
		expect(tokens).toContain("--monti-bg-page: var(--monti-gray-1);");
		expect(dark).toContain("--monti-bg-page: var(--monti-gray-2);");
		expect(dark).not.toContain("--monti-fg-default");
	});
});
