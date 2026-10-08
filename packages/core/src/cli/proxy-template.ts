/**
 * The `proxy.ts` that `monti init` writes for an app that has none: in production without the login settings, the admin answers `503` with a page that points to
 * `monti doctor` (a page cannot send that status itself under Next's Cache Components, since it streams after a `200`). The same text every time, so
 * `monti add blog-theme`, whose own `proxy.ts` does this and the blog routes too, knows the file is the one init wrote and replaces it without asking.
 */
export const INIT_PROXY_TEMPLATE = `import { cmsProxy } from "@monti-cms/nextjs/proxy";
import { cms } from "./monti.config";

// In production without the login settings (AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, MONTI_SECRET) the admin answers 503 with a page that points to \`monti doctor\`,
// not a 200 with an error in the server log. Next runs this before any page. Under \`next dev\` it does nothing. If you add a proxy of your own, call
// setupResponse(request, cms) from "@monti-cms/nextjs/proxy" first and return what it gives when that is not undefined.
export const proxy = cmsProxy(cms);

// Pages only: not Next's own files, the API or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\\\..*).*)"] };
`;

/** The folders a Next proxy or middleware file may be in, and its names. */
export const PROXY_FILES = ["proxy.ts", "proxy.js", "middleware.ts", "middleware.js"] as const;
