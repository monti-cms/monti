/** Turns a site path (`/images/a.png`) into this site's absolute URL. Other sites' URLs become `null` (the server does not call other people's URLs). */
export function siteImageUrl(src, origin) {
    const trimmed = src.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\"))
        return null;
    const url = new URL(trimmed, origin);
    return url.origin === new URL(origin).origin ? url : null;
}
