import { type Site } from "@monti-cms/core/client";
import type { InternalLinkItem } from "./internal-link.js";
/**
 * Where an internal link goes. A link in a stored document holds the id of its entry only (the id of the translation group, which is the source entry), so the
 * editor looks the entry up to show the reader of the body its title and address: in the link bubble and the link form.
 */
/** The entry a link points to, as the editor shows it. */
export interface LinkTarget {
    /** The id the link holds. */
    readonly id: string;
    readonly collection: string;
    /** The title of the entry, empty when it has none. */
    readonly title: string;
    /** The entry's public path as readers see it, with the locale prefix the site uses (`localePrefix`), or `null` when its collection has no public path or it has no address. */
    readonly path: string | null;
    /** Whether the entry is published: only then does its public path work. */
    readonly published: boolean;
    /** Where opening the link goes: the page on the site when the entry is published, otherwise the entry in the admin. */
    readonly href: string;
}
export type LinkTargetState = {
    readonly status: "loading";
} | {
    readonly status: "ready";
    readonly target: LinkTarget;
}
/** No entry has this id (it was deleted). */
 | {
    readonly status: "missing";
}
/** The lookup failed (offline, signed out). It is tried again later. */
 | {
    readonly status: "error";
};
/** Remembers an entry the editor already knows (the one just picked for a link), so its bubble shows it without a lookup. */
export declare function rememberLinkTarget(site: Site, item: InternalLinkItem): void;
/** The path of the entry a link points to, once it is known (`null` while it is being looked up, or when it has none). */
export declare function linkPathOf(site: Site, id: string): string | null;
/** Looks the entries up and re-renders when what is known changes. Gives the paths known now. */
export declare function useLinkPaths(ids: readonly string[]): (id: string) => string | null;
/** Forgets every lookup of the site. For tests, which share the module. */
export declare function resetLinkTargets(site: Site): void;
/** Looks the entry up when it is not known yet or the lookup is old. Safe to call often: a lookup in progress is not repeated. */
export declare function requestLinkTarget(site: Site, id: string): void;
/**
 * Where the link to this entry goes, looked up on first use and kept for the session. `null` for a link that is not to an entry.
 */
export declare function useLinkTarget(entryId: string | null | undefined): LinkTargetState | null;
