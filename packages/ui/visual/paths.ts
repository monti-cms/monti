import path from "node:path";

/** The built Storybook (`pnpm build-storybook`) the shots are taken from. `MONTI_STORYBOOK_DIR` points the audit at another build (a branch to compare with). */
export const STORYBOOK_DIR = process.env.MONTI_STORYBOOK_DIR
	? path.resolve(process.env.MONTI_STORYBOOK_DIR)
	: path.resolve(import.meta.dirname, "../storybook-static");

/** The baselines, `{light,dark}/<story id>.png`. `MONTI_VISUAL_BASELINES` points them elsewhere (the Docker run writes them to a mounted folder). */
export const BASELINES_DIR = process.env.MONTI_VISUAL_BASELINES ?? path.join(import.meta.dirname, "baselines");

/** What a comparison leaves behind: the shots that differ, the report of how much, and the list of every shot taken. Emptied at the start of a run. */
export const CHANGED_DIR = process.env.MONTI_VISUAL_CHANGED ?? path.join(import.meta.dirname, "changed");
