// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allowedChecks, isShot, type StoryEntry } from "../../visual/stories";

const root = path.resolve(__dirname, "../../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

/**
 * The visual regression's baselines are made in Playwright's Linux image and compared in it, so the image has to be the one of the installed
 * Playwright, wherever it is named. And what gets a shot is one rule, kept in one place.
 */
describe("visual regression setup", () => {
	it("runs CI in the image of the installed Playwright version", () => {
		const version = JSON.parse(read("packages/ui/package.json")).devDependencies["@playwright/test"];
		// An exact version: a range would let the browser change under the baselines without anyone choosing it.
		expect(version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(read(".github/workflows/ci.yml")).toContain(`image: mcr.microsoft.com/playwright:v${version}-noble`);
		// The local Docker run derives the same tag from the same version.
		const script = read("scripts/visual-docker.mjs");
		expect(script).toContain('devDependencies["@playwright/test"]');
		expect(script).toContain("-noble");
	});

	describe("which stories are shot", () => {
		const story = (importPath: string, tags: string[] = []): StoryEntry => ({
			type: "story",
			id: "x--y",
			title: "X",
			name: "Y",
			importPath,
			tags,
		});

		it("takes every story of the ui package's catalog, not the screens of other packages", () => {
			expect(isShot(story("./src/button.stories.tsx"))).toBe(true);
			expect(isShot(story("./src/foundations/type.stories.tsx"))).toBe(true);
			expect(isShot(story("../admin/src/screens/entries/entries.stories.tsx"))).toBe(false);
		});

		it("lets a screen story in with the `visual` tag, and a catalog story out with `no-visual`", () => {
			expect(isShot(story("../admin/src/screens/entries/entries.stories.tsx", ["visual"]))).toBe(true);
			expect(isShot(story("./src/button.stories.tsx", ["no-visual"]))).toBe(false);
		});

		it("lets a story through only the checks its tags name", () => {
			expect(allowedChecks(story("./src/box.stories.tsx", ["visual-allow-clipped"]))).toEqual(["clipped"]);
			expect(allowedChecks(story("./src/box.stories.tsx", ["visual-allow-overflow", "visual-allow-clipped"]))).toEqual([
				"clipped",
				"overflow",
			]);
			expect(allowedChecks(story("./src/box.stories.tsx"))).toEqual([]);
		});

		it("leaves out docs pages", () => {
			expect(isShot({ ...story("./src/button.mdx"), type: "docs" })).toBe(false);
		});
	});
});
