/**
 * The part of an address that can be edited on its own: `/posts/:slug` is `posts` between a fixed `/` and a fixed `/:slug`.
 */
export declare function segmentOf(path: string): string;
/** The address a segment makes: `posts` is `/posts/:slug`, nothing is `/:slug`. Spaces and colons cannot be part of it, and the slashes around it are the page's own. */
export declare function pathOfSegment(segment: string): string;
/**
 * Whether the entries have a page on the site and, if they do, the address of it. A collection without an address has no page, so its entries cannot be linked to from a body.
 * `path` is empty for none. `suggested` is the address that is filled in when the page is turned on.
 */
export declare function PublicPathField({ path, suggested, onChange, }: {
    path: string;
    suggested: string;
    onChange: (path: string) => void;
}): import("react").JSX.Element;
