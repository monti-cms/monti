import { describe, expect, it } from "vitest";
import { allowedChecks, isShot, type StoryEntry } from "../../visual/stories";

describe("which stories are shot", () => {
	const story = (importPath: string, tags: string[] = []): StoryEntry => ({
		type: "story",
		id: "x--y",
		title: "X",
		name: "Y",
		importPath,
		tags,
	});

	it("UI-T3 takes every story of the ui package's catalog, not the screens of other packages or docs pages", () => {
		expect(isShot(story("./src/button.stories.tsx"))).toBe(true);
		expect(isShot(story("./src/foundations/type.stories.tsx"))).toBe(true);
		expect(isShot(story("../admin/src/screens/entries/entries.stories.tsx"))).toBe(false);
		expect(isShot({ ...story("./src/button.mdx"), type: "docs" })).toBe(false);
	});

	it("UI-T3 lets a screen story in with the `visual` tag, and a catalog story out with `no-visual`", () => {
		expect(isShot(story("../admin/src/screens/entries/entries.stories.tsx", ["visual"]))).toBe(true);
		expect(isShot(story("./src/button.stories.tsx", ["no-visual"]))).toBe(false);
	});

	it("UI-T3 lets a story through only the checks its tags name", () => {
		expect(allowedChecks(story("./src/box.stories.tsx", ["visual-allow-clipped"]))).toEqual(["clipped"]);
		expect(allowedChecks(story("./src/box.stories.tsx", ["visual-allow-overflow", "visual-allow-clipped"]))).toEqual([
			"clipped",
			"overflow",
		]);
		expect(allowedChecks(story("./src/box.stories.tsx"))).toEqual([]);
	});
});
