import type { BlogCms } from "./monti.config";

type StatusAnswer = { status: 404 } | { status: 308; location: string };

export async function strictStatus(cms: BlogCms, pathname: string): Promise<StatusAnswer | undefined> {
	for (const locale of cms.site.LOCALES) {
		const base = `${cms.site.localizePath(locale, "/posts")}/`;
		if (!pathname.startsWith(base)) continue;
		const slug = pathname.slice(base.length).replace(/\/$/, "");
		if (!slug || slug.includes("/")) continue; // the list page and deeper paths are not posts
		let decoded: string;
		try {
			decoded = decodeURIComponent(slug);
		} catch {
			return { status: 404 };
		}
		const result = await cms.read.getEntry({ collection: "post", slug: decoded, locale });
		if (result.status === "not_found") return { status: 404 };
		if (result.status === "redirect") return { status: 308, location: result.path ?? result.slug };
		return undefined; // found: the page answers
	}
	return undefined;
}
