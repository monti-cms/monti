import type { Site } from "@monti-cms/core/client";
import type { SyntaxExtension } from "./syntax/types.js";
export type SoftBreakResult = {
    readonly status: "unchanged";
} | {
    readonly status: "changed";
    readonly mdx: string;
    readonly inserted: number;
} | {
    readonly status: "skipped";
    readonly reason: "unparsed" | "unsafe";
    readonly detail?: string;
};
/**
 * Writes `<br />` at each soft line ending inside paragraph text of `mdx` (read with the blocks of `site`). `syntax` is the syntax extensions to read with (none: standard MDX).
 *
 * - `unchanged`: there is no soft line ending (running it again on its own result gives this).
 * - `changed`: the new string. The change was checked: it parses, and the parsed tree differs from the old one only by the added breaks.
 * - `skipped`: the body is left as it is. `unparsed` for a body that does not parse, `unsafe` when the edit could not be made without
 *   touching something else (a line ending that cannot be paired with the source, or a result that does not read the same).
 */
export declare const insertSoftBreaks: (site: Site, mdx: string, syntax?: readonly SyntaxExtension[]) => SoftBreakResult;
