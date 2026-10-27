import { readFileSync } from "node:fs";
import path from "node:path";

/** What a story is in Storybook's `index.json`. */
export interface StoryEntry {
	readonly type: string;
	readonly id: string;
	readonly title: string;
	readonly name: string;
	/** The story file, relative to the package (`./src/button.stories.tsx`). */
	readonly importPath: string;
	readonly tags: readonly string[];
}

/** A story that is not part of the shots even though its file is. Tag it for one that can never look the same twice. */
export const OPT_OUT_TAG = "no-visual";
/** A story outside the ui package (a screen) that belongs in the shots. Screens join one by one, only where the layout is settled. */
export const OPT_IN_TAG = "visual";

/**
 * Tags for a story that shows what the automated checks look for, on purpose: text cut by its box (`overflow: hidden` as the thing on show), a
 * page wider than the window. Each lets one check through for that story; the other checks still run. Keep them rare.
 */
export const ALLOW_CLIPPED_TAG = "visual-allow-clipped";
export const ALLOW_OVERFLOW_TAG = "visual-allow-overflow";

/**
 * The one rule for what is shot: every story of the ui package's own catalog (the story files under `src/`: the foundations and the component groups),
 * and any other story that carries {@link OPT_IN_TAG}. The admin's screen stories live in other packages, so they stay out until they opt in.
 */
export const isShot = (entry: StoryEntry): boolean =>
	entry.type === "story" &&
	!entry.tags.includes(OPT_OUT_TAG) &&
	(entry.importPath.startsWith("./src/") || entry.tags.includes(OPT_IN_TAG));

/** The stories to shoot, in the order of the built Storybook's index. */
export const readShots = (storybookDir: string): StoryEntry[] => {
	const index = JSON.parse(readFileSync(path.join(storybookDir, "index.json"), "utf8")) as {
		entries: Record<string, StoryEntry>;
	};
	return Object.values(index.entries).filter(isShot);
};
