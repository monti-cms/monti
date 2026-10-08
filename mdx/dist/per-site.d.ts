/**
 * Memoizes something derived from a site (a lookup table built from its blocks, a parser built from its syntax extensions) per site, so it is built once
 * for each site that is handed to the format. The result lives as long as the site: nothing is shared between two sites.
 */
export declare function perSite<Site extends object, Value>(build: (site: Site) => Value): (site: Site) => Value;
