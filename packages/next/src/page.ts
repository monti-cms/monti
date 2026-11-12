import type { SiteEntry, SiteReader } from "@monti-cms/core";
import { cookies, draftMode } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { PREVIEW_COOKIE } from "./route";

/** An entry as a page draws it: with the paths of the entries its body links to, and whether this is the working copy of a preview. */
export type PageEntry = SiteEntry & {
	/** `renderDocument`'s `entryPath`: where a link to another entry goes. */
	entryPath: (group: string) => string | undefined;
	/** The working copy, shown to the one who opened the preview; the site shows something else, or nothing yet. */
	preview: boolean;
};

type Where = { collection: string; slug: string; locale?: string };

/** A slug as it is in the address: Next hands a non-ASCII segment over still encoded. */
function decoded(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}

async function read(reader: SiteReader, where: Where) {
	// Draft mode is read without making the page dynamic; the cookie is read only while it is on.
	const draft = (await draftMode()).isEnabled;
	const preview = draft ? (await cookies()).get(PREVIEW_COOKIE)?.value : undefined;
	const locale = where.locale ?? reader.locales().source;
	const found = await reader.entry({ collection: where.collection, slug: decoded(where.slug), locale, preview });
	if (!found || !("entry" in found)) return found;
	const { entry } = found;
	const paths = entry.doc ? await reader.linkPaths(entry.doc, locale) : {};
	// The reader gives the working copy only for a good ticket, and a working copy has no publishing date.
	return {
		entry: {
			...entry,
			entryPath: (group: string) => paths[group],
			preview: preview !== undefined && entry.publishedAt === null,
		},
	};
}

/**
 * The entry of a public page (doc 16): what the site shows, or for the one who opened its preview, the working copy. An address the entry had
 * before goes to where it is now for good, and one with no entry is not found.
 */
export async function entryPage(reader: SiteReader, where: Where): Promise<PageEntry> {
	const found = await read(reader, where);
	if (!found) notFound();
	if ("redirect" in found) permanentRedirect(found.redirect);
	return found.entry;
}

/**
 * The entry of the site's own preview page (a collection's `previewPath`, doc 16): the working copy, only for the one who opened its preview.
 * What is published never shows here: without a good ticket the page is not found.
 */
export async function previewPage(reader: SiteReader, where: Where): Promise<PageEntry> {
	const found = await read(reader, where);
	if (!found || !("entry" in found) || !found.entry.preview) notFound();
	return found.entry;
}
