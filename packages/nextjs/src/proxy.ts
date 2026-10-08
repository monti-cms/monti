import type { Cms } from "@monti-cms/core/runtime";
import { type NextRequest, NextResponse } from "next/server";
import { assertCms } from "./assert-cms";

/**
 * The status of the admin and of the draft preview when the site is not set up to sign in. Under Next's Cache Components a page streams after a `200` has been
 * sent, so a page that fails because `AUTH_GITHUB_ID` is not set can only log the error behind a `200`. A proxy answers before any page runs, so it can send the
 * real `503` with a page that says what to do. It only acts in production: under `next dev` you are signed in without the variables.
 *
 * ```ts
 * // proxy.ts
 * import { cmsProxy } from "@monti-cms/nextjs/proxy";
 * import { cms } from "./monti.config";
 * export const proxy = cmsProxy(cms);
 * export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
 * ```
 *
 * An app with its own proxy calls `setupResponse(request, cms)` first and returns what it gives when that is not `undefined`.
 */

/** What is wrong with the login settings, as the server throws it, or `undefined` when the login can start (or this is not production). */
export function loginProblem(
	cms: Pick<Cms, "auth">,
	env: { readonly NODE_ENV?: string } = process.env,
): string | undefined {
	if (env.NODE_ENV !== "production") return undefined;
	try {
		cms.auth();
		return undefined;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

const REPORTED = Symbol.for("monti.setup-response.reported");

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Not set up yet</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:15vh auto;padding:0 1.5rem;color:#222}code{background:#f2f2f2;padding:.1em .35em;border-radius:4px}@media(prefers-color-scheme:dark){body{background:#111;color:#eee}code{background:#222}}</style>
</head>
<body>
<h1>Not set up yet</h1>
<p>The admin and the draft preview of this site are switched off, because sign-in is not set up for production.</p>
<p>If this is your site: the server log says which setting is missing, and <code>monti doctor</code> lists everything that needs fixing and how.</p>
</body>
</html>
`;

/**
 * A `503` page for an address that needs the login (the admin path, the draft preview path), when the login settings are missing in production; `undefined` for
 * every other address and when the settings are fine. The full message goes to the server log, once; the page names no setting.
 */
export function setupResponse(
	request: Pick<NextRequest, "nextUrl">,
	cms: Pick<Cms, "auth" | "site">,
	env: { readonly NODE_ENV?: string } = process.env,
): NextResponse | undefined {
	assertCms(cms, "setupResponse(request, cms)");
	const guarded = [cms.site.ADMIN_PATH, cms.site.config.site?.previewPath].filter(
		(path): path is string => typeof path === "string" && path.length > 1,
	);
	const pathname = request.nextUrl.pathname;
	if (!guarded.some((path) => pathname === path || pathname.startsWith(`${path.replace(/\/$/, "")}/`)))
		return undefined;
	const problem = loginProblem(cms, env);
	if (problem === undefined) return undefined;
	const holder = globalThis as { [REPORTED]?: boolean };
	if (!holder[REPORTED]) {
		holder[REPORTED] = true;
		console.error(`Monti is not set up for production, so ${pathname} answers 503: ${problem}`);
	}
	return new NextResponse(PAGE, {
		status: 503,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			"retry-after": "3600",
			"x-robots-tag": "noindex",
		},
	});
}

/** A proxy for an app that has none: answers {@link setupResponse} and lets every other request through. */
export function cmsProxy(cms: Pick<Cms, "auth" | "site">): (request: NextRequest) => NextResponse {
	return (request) => setupResponse(request, cms) ?? NextResponse.next();
}
