import type { InitOptions, InitReport } from "./init-types.js";
/**
 * `monti init`: adds Monti to an existing Next app. It reads the app, asks (or takes flags, or defaults), writes Monti's own new files (the config, the schema,
 * the three Next files, `.env.example`), makes the edits Monti needs in the app's own files (`withCms` in `next.config`, `suppressHydrationWarning` on the root
 * layout's `<html>`, `.env.local` and `.monti/` in `.gitignore`) and says exactly what it changed, installs the packages after a confirmation, and ends with a plain
 * summary of what is left, numbered, with exact content to copy. A file whose shape init cannot edit safely is not touched: its step is in that list, with the reason.
 * It writes no `.env.local` and never touches the database.
 *
 * It runs in stages, each its own module: detect (here and `init-detect.ts`), ask (`init-prompts.ts`), plan (`init-plan.ts`), write (`init-writer.ts`), install
 * (`init-install.ts`) and the list of what is left (`init-next-steps.ts`). Nothing is written until every question is answered, so cancelling leaves the project as it
 * was; every write goes through `ProjectWriter`, which refuses a path outside the project, and an existing file is never overwritten unless the person says yes
 * (or passes `overwrite`).
 */
export type { InitOptions, InitReport } from "./init-types.js";
/** Runs the whole of `monti init` in `options.cwd`. Throws {@link Cancelled} when the person cancels, `InitError` when a write fails. */
export declare function initProject(options: InitOptions): Promise<InitReport>;
