import path from "node:path";

/** The built Storybook (`pnpm build-storybook`) the shots are taken from. */
export const STORYBOOK_DIR = path.resolve(import.meta.dirname, "../storybook-static");
