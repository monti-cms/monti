/**
 * Browser storage of the admin, kept apart per site. `localStorage` and IndexedDB belong to an origin, so two sites served from one origin (two apps on
 * `localhost:3000` one after the other, or two admins under one domain) would otherwise share their preferences and recovery copies. Every key and database
 * name carries the namespace of the site: its name and its admin path.
 *
 * Keys written before the namespace existed (`cms:editor-width`, the `cms_backup` database) are still read once; see {@link readPreference} and `local-backup.ts`.
 */
/** The namespace of a site's browser storage: its name and admin path (`example.dev/admin`). */
export const storageNamespace = (site) => `${site.SITE_NAME || "site"}${site.ADMIN_PATH}`;
/** The `localStorage` key of a preference of this site. */
export const preferenceKey = (site, name) => `cms:${storageNamespace(site)}:${name}`;
/** The key a preference had before keys carried the namespace. */
export const legacyPreferenceKey = (name) => `cms:${name}`;
/**
 * Reads a remembered preference of this site. A site that has none yet takes the value written under the old key once and keeps it under its own (the old key stays,
 * because another site on the same origin may still read it). `null` when there is none, or when storage is unavailable.
 */
export function readPreference(site, name) {
    try {
        const own = window.localStorage.getItem(preferenceKey(site, name));
        if (own !== null)
            return own;
        const legacy = window.localStorage.getItem(legacyPreferenceKey(name));
        if (legacy !== null)
            writePreference(site, name, legacy);
        return legacy;
    }
    catch {
        return null;
    }
}
/** Remembers a preference of this site. Does nothing when storage is unavailable: the screen still changes, it just is not remembered. */
export function writePreference(site, name, value) {
    try {
        window.localStorage.setItem(preferenceKey(site, name), value);
    }
    catch {
        // Storage is unavailable (private window, blocked site data).
    }
}
