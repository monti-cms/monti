import path from "node:path";

/** The built Storybook (`pnpm build-storybook`) the shots are taken from. `MONTI_STORYBOOK_DIR` points the audit at another build (a branch to compare with). */
export const STORYBOOK_DIR = process.env.MONTI_STORYBOOK_DIR
	? path.resolve(process.env.MONTI_STORYBOOK_DIR)
	: path.resolve(import.meta.dirname, "../storybook-static");
