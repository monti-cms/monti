/**
 * A collection's public address shape (`path`, e.g. `/posts/:slug`): the one place that knows how it is written, checked, filled in with a slug, matched against a
 * path and compared with another shape. The config check, the body links, the new-collection forms of the CLI and the admin all use it, so they accept the same shapes.
 */
/** Where the slug goes in a path pattern. */
export declare const SLUG_TOKEN = ":slug";
/** Why a path pattern cannot be used, or `undefined` when it can: it starts with `/`, holds `:slug` once and nothing else that reads as a parameter, query or fragment. */
export declare function checkPathPattern(path: string): {
    readonly code: "slash" | "slug";
    readonly message: string;
} | undefined;
/** The text before and after the slug (`/posts/:slug.html` -> `["/posts/", ".html"]`). */
export declare function splitPattern(path: string): readonly [prefix: string, suffix: string];
/** The pattern of the entries that live in a folder of the site (`blog` -> `/blog/:slug`). */
export declare const patternUnder: (folder: string) => string;
/** The path of an entry: the pattern with the slug in it. */
export declare function fillPattern(path: string, slug: string): string;
/** The slug (still encoded) a pathname has in this pattern, or `null` when it is not one of its paths. A trailing `/` is allowed. */
export declare function matchPattern(path: string, pathname: string): string | null;
/**
 * Can two shapes produce the same URL? If so, a body link cannot tell which collection it points to.
 * A slug lives within a single `/`-free segment, so the shapes collide when the segment counts match and every segment can match:
 * literal segments must be equal; a slug segment (`prefix:slugsuffix`) matches a literal segment if the literal starts and ends with that prefix and suffix (the slug needs at least one character);
 * two slug segments can match if one prefix starts with the other and one suffix ends with the other.
 */
export declare function patternsOverlap(a: string, b: string): boolean;
