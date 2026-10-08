import type { BlogCms } from "../read-posts/cms";

/** What a post address needs besides a plain `200`: a real `404`, or a real `308` to the new address. */
export type StatusAnswer = { readonly status: 404 } | { readonly status: 308; readonly location: string };

/**
 * The status of a post address, decided before any page runs: `404` for an unknown, unpublished or foreign-language post, `308` for the old address of a renamed
 * post, `undefined` for every other address (the page answers). It takes a path, not a request, so it is the same in a Next `proxy.ts` and in a test.
 * The list page (`/posts`) is not a post, and neither is anything deeper than one segment.
 */
export async function strictStatus(cms: BlogCms, pathname: string): Promise<StatusAnswer | undefined> {
	for (const locale of cms.site.LOCALES) {
		const base = `${cms.site.localizePath(locale, "/posts")}/`;
		if (!pathname.startsWith(base)) continue;
		const slug = pathname.slice(base.length).replace(/\/$/, "");
		if (!slug || slug.includes("/")) continue;
		let decoded: string;
		try {
			decoded = decodeURIComponent(slug);
		} catch {
			return { status: 404 };
		}
		const result = await cms.read.getEntry({ collection: "post", slug: decoded, locale });
		if (result.status === "not_found") return { status: 404 };
		if (result.status === "redirect") return { status: 308, location: result.path ?? result.slug };
		return undefined;
	}
	return undefined;
}
