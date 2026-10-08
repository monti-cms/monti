# Strict 404 and 308 under Cache Components

Goal: a post address that does not exist answers a real `404`, and the old address of a renamed post answers a real `308`, even when the app has Next's `cacheComponents` turned on.

You only need this if you care about the status code, and only with `cacheComponents: true`. Most blogs do not need it.

Code: [`examples/recipes/src/strict-status`](../../examples/recipes/src/strict-status). Test: `strict-status.test.ts` in the same folder.

## What you need to know

1. **Normal Next pages are enough with the option off.** A page calls `notFound()` and `permanentRedirect()` (`next/navigation`) and Next sends a real `404` and `308`. Monti ships no proxy and writes no `proxy.ts`.
2. **With `cacheComponents: true`** Next sends the static shell of a page with a `200` before the page runs. `notFound()` then renders a page marked `noindex`, and `permanentRedirect()` redirects in the browser. Search engines keep the `200`, so they may read the page as a soft 404. This is Next's behavior, not Monti's.
3. **A proxy answers before any page runs**, so it can send the real status. Next's docs recommend it for this.
4. **The decision is one small function** that takes a path and asks `cms.read.getEntry`, which answers `found`, `redirect` (an old address) or `not_found`. The proxy only turns the answer into a response.

## The code

The decision, as a function you can test:

<!-- source: examples/recipes/src/strict-status/strict-status.ts -->
```ts
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
```

The `proxy.ts` of your app (next to `app/`, or in `src/`):

```ts
import { type NextRequest, NextResponse } from "next/server";
import { cms } from "./monti.config";
import { strictStatus } from "./strict-status"; // the function above

export async function proxy(request: NextRequest) {
	const answer = await strictStatus(cms, request.nextUrl.pathname);
	if (answer?.status === 308) return NextResponse.redirect(new URL(answer.location, request.url), 308);
	// An unknown post: rewrite to an address no route serves, so Next shows the app's own 404 page with a real 404 status.
	if (answer?.status === 404) return NextResponse.rewrite(new URL("/no-such-page", request.url));
	return NextResponse.next();
}

// Pages only: not Next's own files, the API or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
```

`/no-such-page` must be an address that none of your routes serves; Next answers it with the `not-found` page of your app and a `404` status.

## Costs

A proxy runs on every page request and reads the database once for each post address. The page still checks the same cases, so the site works without the proxy; the proxy only upgrades the status. Delete `proxy.ts` and nothing else changes.

## Testing it

`strictStatus` is tested against the real read API with `testServer()` (a Postgres schema of its own, from `CMS_TEST_DATABASE_URL`): a published post is left to its page, an unknown or malformed address is `404`, a renamed post's old address is `308` with the new path, and the list page, the home page and deeper paths are left alone.
