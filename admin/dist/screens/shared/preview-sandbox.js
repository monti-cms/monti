/**
 * A preview of a screen (the settings screen's preview of the properties panel) runs the real components on a site made from a draft. Such a site is marked
 * here, and the admin's request helpers refuse to write for it, so nothing typed or picked in a preview can reach the server. Reading is unaffected.
 */
const SANDBOX_SITES = new WeakSet();
/** Marks the site as a preview's: writes through the admin's helpers are refused. */
export function markSandboxSite(site) {
    SANDBOX_SITES.add(site);
    return site;
}
export const isSandboxSite = (site) => SANDBOX_SITES.has(site);
/** Whether a request with this method changes something on the server. */
export const isWrite = (method) => !["GET", "HEAD", undefined].includes(method?.toUpperCase());
