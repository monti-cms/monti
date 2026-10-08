import type { CmsJsonValue, CmsMark, CmsNode } from "./types.js";
/**
 * Links in a stored document. An internal link is `{ entryId }`: the id of the translation group of the entry it points to (the source entry's id, the same
 * id a relation holds), so the link follows the reader's language and falls back to the source. An external link is `{ href, title? }`. A link never
 * holds both: the address of an internal link is looked up when the document is read, so renaming a slug changes nothing in the document.
 */
/** How a text notation (MDX) writes an entry link: `[text](entry:<id>)`. The id is the only thing it carries. */
export declare const ENTRY_LINK_PREFIX = "entry:";
/** The text-notation address of an entry link. */
export declare const entryLinkHref: (entryId: string) => string;
/** The entry id an address in the form `entry:<id>` names, or `undefined` for any other address. */
export declare const entryIdOfHref: (href: string) => string | undefined;
/** The entry id a link mark points to, or `undefined` for an external link (or one with an empty id). */
export declare const entryIdOfMark: (mark: CmsMark) => string | undefined;
/** The attributes a link is stored with: only `entryId` for an internal link, `href` and `title` (when there is one) for an external one. */
export declare const linkAttrs: (attrs: Readonly<Record<string, CmsJsonValue>> | undefined) => Record<string, CmsJsonValue>;
/** The attributes of the link a text notation wrote with this address and title: an `entry:<id>` address is an entry link, any other is an `href`. */
export declare const linkMarkAttrs: (href: string, title?: string | null) => Record<string, CmsJsonValue>;
/** The mark in its stored form: a link mark gets `linkAttrs`, any other mark is returned as it is. */
export declare const normalizedLinkMark: (mark: CmsMark) => CmsMark;
/** Applies `change` to the attributes of every link mark of `nodes`. Returns the same array when no link changed. */
export declare const mapLinkAttrs: (nodes: readonly CmsNode[], change: (attrs: Readonly<Record<string, CmsJsonValue>>) => Record<string, CmsJsonValue> | undefined) => readonly CmsNode[];
/** The distinct entry ids the link marks of `nodes` point to, in document order. */
export declare const entryLinkIds: (nodes: readonly CmsNode[] | undefined) => string[];
