/** Turns a site path (`/images/a.png`) into this site's absolute URL. Other sites' URLs become `null` (the server does not call other people's URLs). */
export declare function siteImageUrl(src: string, origin: string): URL | null;
