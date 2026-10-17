const loadedBySite = new WeakMap();
/**
 * Loads the admin side of a site's plugins (`site.plugins`, the instance's real site, not the browser's snapshot: the loaders are server code). On success it is
 * read once per site and reused. If loading fails, nothing is remembered so the next call retries, and the error is thrown as is. Page paths are the plugins'
 * `nav` paths, which the site config already checks for collisions.
 */
export function loadAdminPlugins(site) {
    const known = loadedBySite.get(site);
    if (known)
        return known;
    const loaded = Promise.all(site.plugins.map(async (plugin) => ({
        name: plugin.name,
        plugin: (await plugin.admin?.())?.default,
    }))).catch((error) => {
        loadedBySite.delete(site);
        console.error("[@monti-cms/admin] failed to load admin plugins", error);
        throw error;
    });
    loadedBySite.set(site, loaded);
    return loaded;
}
