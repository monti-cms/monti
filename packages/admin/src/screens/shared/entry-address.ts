import type { Site } from "@monti-cms/core/site";
import { withBasePath } from "@monti-cms/core/site";

/** The slug the header shows for an address that is not made yet. */
const NO_SLUG = "…";

/** What of an entry its addresses are made from. */
interface Addressed {
	readonly collection: string;
	readonly locale?: string;
	readonly workingSlug: string | null;
	readonly publishedSlug: string | null;
}

type AddressSite = Pick<Site, "contentPath" | "localizePath" | "DEFAULT_LOCALE">;

/**
 * The address of an entry on the public site (`/posts/first-post`, with the language's prefix for a translation), or `null` for a collection that has no
 * public page. `slug` is the draft's unless told otherwise; an entry without one shows `…` where it will be.
 */
export function entryPath(site: AddressSite, entry: Addressed, slug: string | null = entry.workingSlug): string | null {
	const path = site.contentPath(entry.collection, slug || NO_SLUG);
	return path === null ? null : site.localizePath(entry.locale ?? site.DEFAULT_LOCALE, path);
}

/**
 * Where "View" opens a published entry: its public address, ready for a link. `null` for a collection with no public page and for an entry that has
 * never been published.
 */
export function publicHref(site: AddressSite, entry: Addressed): string | null {
	if (!entry.publishedSlug) return null;
	const path = entryPath(site, entry, entry.publishedSlug);
	return path === null ? null : withBasePath(path);
}
