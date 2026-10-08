/**
 * Memoizes something derived from a site (a lookup table built from its blocks, a highlighter built from its themes) per site, so code that is handed a
 * `site` builds it once for that site. The result lives as long as the site: nothing is shared between two sites, and nothing is kept for a site that is dropped.
 *
 * ```ts
 * const tablesOf = perSite((site) => new Map(site.BLOCKS.map((block) => [block.name, block])));
 * const byName = tablesOf(site);
 * ```
 */
export declare function perSite<Site extends object, Value>(build: (site: Site) => Value): (site: Site) => Value;
