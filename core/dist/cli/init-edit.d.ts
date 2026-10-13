/**
 * The two edits `monti init` makes to files the app owns: wrap the export of `next.config` in `withCms(...)`, and put `suppressHydrationWarning` on the `<html>` of the
 * root layout. Both work on the text of the file and decide first whether they can do it safely: a file whose shape is not one of the few simple ones is not touched, and
 * the result says why, so the step can be listed for the person to do by hand. Nothing here reads or writes a file.
 */
/** What an edit decided. */
export type TextEdit = 
/** The file now reads `text`; `change` says what changed, in one line. */
{
    readonly status: "edit";
    readonly text: string;
    readonly change: string;
}
/** The file already has it. */
 | {
    readonly status: "present";
}
/** The file is not in a shape the edit can change safely; `reason` says why, in plain words. */
 | {
    readonly status: "manual";
    readonly reason: string;
};
export declare const NEXT_CONFIG_IMPORT = "import { withCms } from \"@monti-cms/nextjs/config\";";
/**
 * Wraps the default export of a `next.config` file in `withCms(...)` and adds the import. It knows three shapes of the export, as long as it is the last thing in the
 * file: an identifier (`export default nextConfig`), an object (`export default { ... }`) and a call (`export default defineConfig({ ... })`). Anything else (a function,
 * `module.exports`, a `satisfies` or `as` suffix, more than one default export) is left alone and the reason is returned.
 */
export declare function wrapNextConfig(file: string, text: string): TextEdit;
/**
 * Adds `suppressHydrationWarning` to the `<html>` tag of a root layout, after its other attributes. A layout that has it already is left as it is; a layout without an
 * `<html>` tag, with a tag init cannot read to its end (a `>` inside an attribute expression), or with `suppressHydrationWarning={false}`, is not touched.
 */
export declare function addSuppressHydrationWarning(file: string, text: string): TextEdit;
/**
 * Adds what Monti needs kept out of git to the text of a `.gitignore` (`undefined`: there is none, so it is created): `.env.local` (it holds the secrets) and
 * `.monti/` (where `monti db:migrate` writes its logs). A line that already covers one is left alone; with both covered nothing changes.
 */
export declare function ignoreForMonti(text: string | undefined): TextEdit;
