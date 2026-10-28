// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { loadCsf } from "storybook/internal/csf-tools";
import { describe, expect, it } from "vitest";
import {
	ALLOW_CLIPPED_TAG,
	ALLOW_OVERFLOW_TAG,
	allowedChecks,
	isShot,
	OPT_IN_TAG,
	OPT_OUT_TAG,
	type StoryEntry,
} from "../../visual/stories";

describe("which stories are shot", () => {
	const story = (importPath: string, tags: string[] = []): StoryEntry => ({
		type: "story",
		id: "x--y",
		title: "X",
		name: "Y",
		importPath,
		tags,
	});

	it("takes every story of the ui package's catalog, not the screens of other packages or docs pages", () => {
		expect(isShot(story("./src/button.stories.tsx"))).toBe(true);
		expect(isShot(story("./src/foundations/type.stories.tsx"))).toBe(true);
		expect(isShot(story("../admin/src/screens/entries/entries.stories.tsx"))).toBe(false);
		expect(isShot({ ...story("./src/button.mdx"), type: "docs" })).toBe(false);
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
});

describe("the visual tags of the story files", () => {
	// The story files the catalog loads (`.storybook/main.ts`).
	const root = path.resolve(import.meta.dirname, "../../..");
	const files = ["ui", "admin", "ai", "blocks", "mdx", "seo"].flatMap((name) =>
		readdirSync(path.join(root, name, "src"), { recursive: true, encoding: "utf8" })
			.filter((file) => file.endsWith(".stories.tsx"))
			.map((file) => path.join(name, "src", file)),
	);

	// Storybook reads a story's tags only where they are written out on it: a tag spread in from a shared object, or passed through a helper,
	// never reaches its index, and the story is silently left out of the shots.
	it.each([
		OPT_IN_TAG,
		OPT_OUT_TAG,
		ALLOW_CLIPPED_TAG,
		ALLOW_OVERFLOW_TAG,
	])("reach Storybook's index wherever %s is written", (tag) => {
		expect(files.length).toBeGreaterThan(0);
		const lost = files.flatMap((file) => {
			const source = readFileSync(path.join(root, file), "utf8");
			const written = source.split(`"${tag}"`).length - 1;
			const csf = loadCsf(source, { fileName: file, makeTitle: (title) => title ?? file }).parse();
			if (written === 0 || csf.meta?.tags?.includes(tag)) return [];
			const indexed = csf.indexInputs.filter((story) => story.tags?.includes(tag)).length;
			return indexed === written ? [] : [`${file}: ${tag} written ${written} times, indexed on ${indexed} stories`];
		});
		expect(lost).toEqual([]);
	});
});
