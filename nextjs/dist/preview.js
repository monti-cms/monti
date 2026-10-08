import { nextHost } from "./auth/host.js";
/**
 * Reads the draft of an entry for the site's preview page (`site.previewPath`), as the signed-in admin: `null` for anyone else. It is `cms.read.getPreview` with
 * the Next request headers attached to the instance first (`cms.attachHost(nextHost)`), so the session (or the dev bypass) can be read even when this is the
 * first thing the server does after a cold start, with no admin request before it. Use it, not `cms.read.getPreview`, in a Next page.
 *
 * ```tsx
 * // app/preview/[locale]/posts/[slug]/page.tsx
 * const entry = await previewEntry(cms, { collection: "post", slug, locale });
 * if (!entry) notFound();
 * ```
 */
export function previewEntry(cms, params) {
    cms.attachHost(nextHost);
    return cms.read.getPreview(params);
}
