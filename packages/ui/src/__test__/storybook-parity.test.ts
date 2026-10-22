// @vitest-environment node
import { readFileSync } from "node:fs";
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
});
