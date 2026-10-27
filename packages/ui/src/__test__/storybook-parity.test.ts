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
 * The catalog has five tiers: Foundations and Primitives hold pages (`Tier/Name`), Controls, Patterns and Monti hold groups (`Tier/Group/Name`). A part
 * without a story would be a part nobody looks at in light and dark, and a story outside the tiers would not be found.
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
		title: /^\s*(?:const meta = \{ )?title: "([A-Za-z]+(?:\/[A-Za-z ]+)+)"/m.exec(readFileSync(file, "utf8"))?.[1],
	}));
	// The sidebar's order, as `storySort` writes it: a tier's name, then the array of its pages or groups.
	const order = new Function(
		`return ${/order: (\[[\s\S]*?\n\t{4}\]),/.exec(read("../../.storybook/preview.tsx"))?.[1]}`,
	)() as (string | string[])[];
	const tiers = order.flatMap((entry, index) =>
		typeof entry === "string" && Array.isArray(order[index + 1])
			? [{ tier: entry, names: order[index + 1] as string[] }]
			: [],
	);

	/** Modules the package exports that draw nothing of their own: helpers, labels, the menu pieces the menu stories show. */
	const NOT_PARTS = ["cn", "closed", "labels", "layout", "menu-parts", "use-mobile"];

	it("has a story file for every part the package exports", () => {
		const modules = [...read("../internal.ts").matchAll(/from "\.\/([\w-]+)"/g)].map((match) => match[1]);
		const missing = modules.filter(
			(name) => !NOT_PARTS.includes(name) && !existsSync(path.join(src, `${name}.stories.tsx`)),
		);
		expect(missing).toEqual([]);
	});

	it("sorts five tiers, smallest part first, then the screens", () => {
		expect(order.filter((entry) => typeof entry === "string")).toEqual([
			"Foundations",
			"Primitives",
			"Controls",
			"Patterns",
			"Monti",
			"Screens",
			"*",
		]);
		expect(tiers.map(({ tier }) => tier)).toEqual(["Foundations", "Primitives", "Controls", "Patterns", "Monti"]);
	});

	it("puts every story in exactly one tier: a page of Foundations or Primitives, or a group of the other tiers", () => {
		const pageTiers = ["Foundations", "Primitives"];
		for (const { file, title } of titles) {
			expect(title, file).toBeDefined();
			const [tierName = "", second, ...rest] = (title ?? "").split("/");
			const where = `${title} (${path.basename(file)})`;
			const tier = tiers.filter(({ tier: name }) => name === tierName);
			expect(tier, where).toHaveLength(1);
			if (pageTiers.includes(tierName)) {
				expect(rest, where).toEqual([]);
			} else {
				expect(tier[0]?.names, where).toContain(second);
				expect(rest, where).toHaveLength(1);
			}
		}
	});

	it("has a story in every group a tier names", () => {
		for (const { tier, names } of tiers.filter(({ tier: name }) => !["Foundations", "Primitives"].includes(name)))
			for (const group of names)
				expect(
					titles.some(({ title }) => title?.startsWith(`${tier}/${group}/`)),
					`${tier}/${group} has no story`,
				).toBe(true);
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
