// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Storybook must look like the admin. Its stylesheet loads what the admin bundle compiles, in the same layers: a missing `admin.css` once left
 * every border black (Tailwind's reset falls back to the text color), and an unlayered reset beat the admin's gray default.
 */
const read = (file: string) => readFileSync(path.resolve(__dirname, file), "utf8");
const storybook = read("../../.storybook/storybook.css");
const admin = read("../../../admin/styles/index.css");

describe("storybook styles", () => {
	it("load the design system and the admin's own rules, as the admin bundle does", () => {
		for (const file of ["theme.css", "tokens.css", "admin.css"]) expect(storybook).toContain(`/${file}"`);
		expect(admin).toContain('@import "./admin.css"');
	});

	it("use the admin bundle's layer order, so the reset stays below the admin's rules", () => {
		const layers = (css: string) => css.match(/@layer [\w, ]+;/)?.[0];
		expect(layers(storybook)).toBe(layers(admin));
		expect(storybook).toMatch(/preflight\.css" layer\(base\)/);
		expect(storybook).toMatch(/utilities\.css" layer\(utilities\)/);
	});

	it("take the theme and the fonts from the design system, not from values of their own", () => {
		const main = read("../../.storybook/main.ts");
		const preview = read("../../.storybook/preview.tsx");
		const manager = read("../../.storybook/manager.ts");
		// The admin's own font registration, under the names the font tokens read.
		expect(main).toContain("bundledFonts");
		// The dark switch is the tokens' selector (`.dark` on `html`), and the canvas is the page role.
		expect(preview).toContain('parentSelector: "html"');
		expect(preview).toContain("bg-monti-page");
		// Storybook's own chrome reads the generated values (`pnpm gen:tokens`), never colors typed in the file.
		expect(manager).toContain("MANAGER_THEME");
		expect(manager).toContain('brandTitle: "Monti Admin"');
		for (const [name, source] of Object.entries({ storybook, main, preview, manager }))
			expect(source, `${name} has a literal color`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch)a?\(/);
	});
});

/**
 * The catalog follows the design system's component groups (`Foundations`, `Button`, `Field` ...). A part without a story would be a part nobody
 * looks at in light and dark, and a story outside the groups would not be found.
 */
describe("storybook catalog", () => {
	const src = path.resolve(__dirname, "..");
	const stories = (dir: string): string[] =>
		readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory() && entry.name !== "__test__"
				? stories(path.join(dir, entry.name))
				: entry.name.endsWith(".stories.tsx")
					? [path.join(dir, entry.name)]
					: [],
		);
	const titles = stories(src).map((file) => ({
		file,
		title: /^\s*(?:const meta = \{ )?title: "([A-Za-z]+\/[A-Za-z ]+)"/m.exec(readFileSync(file, "utf8"))?.[1],
	}));
	const groups = [...read("../../.storybook/preview.tsx").matchAll(/^\t+"([A-Za-z]+)",$/gm)].map((match) => match[1]);

	/** Modules the package exports that draw nothing of their own: helpers, labels, the menu pieces the menu stories show. */
	const NOT_PARTS = ["cn", "closed", "labels", "layout", "menu-parts", "use-mobile"];

	it("has a story file for every part the package exports", () => {
		const modules = [...read("../internal.ts").matchAll(/from "\.\/([\w-]+)"/g)].map((match) => match[1]);
		const missing = modules.filter(
			(name) => !NOT_PARTS.includes(name) && !existsSync(path.join(src, `${name}.stories.tsx`)),
		);
		expect(missing).toEqual([]);
	});

	it("puts every story under one of the design system's groups, in the sidebar's order", () => {
		for (const { file, title } of titles) {
			expect(title, file).toBeDefined();
			expect(groups, `${title} (${path.basename(file)})`).toContain(title?.split("/")[0]);
			expect(title?.split("/").length, file).toBe(2);
		}
	});

	it("draws the tokens on the Foundations pages", () => {
		const foundations = titles.filter(({ title }) => title?.startsWith("Foundations/")).map(({ title }) => title);
		expect(foundations).toEqual(
			expect.arrayContaining(
				["Colors", "Type", "Spacing", "Radius", "Sizes", "Shadows"].map((page) => `Foundations/${page}`),
			),
		);
	});
});
