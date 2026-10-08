import { setupResponse } from "@monti-cms/nextjs/proxy";
import { type NextRequest, NextResponse } from "next/server";
import { blogTheme } from "./theme.config";

/** A post-like route: the collection and where its list page is mounted, without the language prefix. */
export interface PostRoute {
	collection: string;
	routeBase: string;
}

/**
 * The response for a post address that is not a plain `200`, or `undefined` when the address is fine (or not a post address at all): a real `404` for an
 * unknown, unpublished or foreign-language post, a real `308` for an old address of a renamed post.
 */
export async function postStatus(request: NextRequest, route: PostRoute): Promise<NextResponse | undefined> {
	const { site, read } = blogTheme.cms;
	const { pathname } = request.nextUrl;
	for (const locale of site.LOCALES) {
		const base = `${site.localizePath(locale, route.routeBase)}/`;
		if (!pathname.startsWith(base)) continue;
		const slug = pathname.slice(base.length).replace(/\/$/, "");
		// The list page (`/blog`) is not a post, and neither is anything deeper than one segment.
		if (!slug || slug.includes("/")) continue;
		let decoded: string;
		try {
			decoded = decodeURIComponent(slug);
		} catch {
			return NextResponse.rewrite(new URL("/_monti-not-found", request.url));
		}
		const result = await read.getEntry({
			collection: route.collection as typeof blogTheme.collection,
			slug: decoded,
			locale,
		});
		if (result.status === "not_found") return NextResponse.rewrite(new URL("/_monti-not-found", request.url));
		if (result.status === "redirect")
			return NextResponse.redirect(new URL(result.path ?? result.slug, request.url), 308);
		return undefined;
	}
	return undefined;
}

/**
 * Decides the HTTP status of a blog post address before the page renders. Under Next's Cache Components (`cacheComponents: true`) a page streams after a `200` has
 * been sent, so `notFound()` and `permanentRedirect()` inside it can only produce a `noindex` page and a client-side redirect, which search engines read as a soft
 * 404 and no redirect. Next's docs recommend checking in Proxy for that. The root `proxy.ts` that `monti add blog-theme` writes calls this; the page itself still
 * handles the same cases for an app without it. For other routes of your own, call `postStatus` with their collection and route base.
 */
export async function blogProxy(request: NextRequest) {
	return (
		// In production without the login settings the admin and the draft preview answer 503 with a page that points to `monti doctor`, not a 200 with a logged error.
		setupResponse(request, blogTheme.cms) ??
		(await postStatus(request, { collection: blogTheme.collection, routeBase: blogTheme.routeBase })) ??
		NextResponse.next()
	);
}
