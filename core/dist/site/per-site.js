/**
 * Memoizes something derived from a site (a lookup table built from its blocks, a highlighter built from its themes) per site, so code that is handed a
 * `site` builds it once for that site. The result lives as long as the site: nothing is shared between two sites, and nothing is kept for a site that is dropped.
 *
 * ```ts
 * const tablesOf = perSite((site) => new Map(site.BLOCKS.map((block) => [block.name, block])));
 * const byName = tablesOf(site);
 * ```
 */
export function perSite(build) {
    const cache = new WeakMap();
    return (site) => {
        let value = cache.get(site);
        if (value === undefined) {
            value = build(site);
            cache.set(site, value);
        }
        return value;
    };
}
