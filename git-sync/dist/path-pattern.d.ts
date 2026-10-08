import type { ResolvedTarget } from "./options.js";
/** What a file path says about the entry it holds. A part the pattern has no placeholder for is absent. */
export interface PathParts {
    readonly collection?: string;
    readonly slug?: string;
    readonly locale?: string;
    readonly id?: string;
}
/** What a path is built from. */
export interface PathValues {
    readonly collection: string;
    readonly slug: string;
    readonly locale: string;
    readonly id: string;
}
export interface PathPattern {
    /** The repo-relative path of an entry (the folder in front). */
    render(values: PathValues): string;
    /** The parts a repo path says, or `null` when the path is not one this pattern produces (outside the folder, other extension, unknown collection or language). */
    parse(path: string): PathParts | null;
}
export interface PathPatternOptions {
    readonly target: Pick<ResolvedTarget, "folder" | "path" | "collections">;
    /** Language codes of the site. */
    readonly locales: readonly string[];
    /** The format's file extension, without the dot. */
    readonly extension: string;
}
/** Compiles the path pattern of a target. `render` and `parse` are inverses for every path the pattern produces. */
export declare function createPathPattern({ target, locales, extension }: PathPatternOptions): PathPattern;
