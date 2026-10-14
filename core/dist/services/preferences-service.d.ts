import type { PreferencesBody } from "../core/api.js";
import type { ContentStore } from "../core/store/index.js";
import type { Site } from "../site/index.js";
export interface PreferencesService {
    /** The admin's saved settings, in the per-collection shape (unknown or corrupt values are dropped). */
    get(userId: string): Promise<PreferencesBody>;
    /** Merges and saves per collection: collections and keys that are not sent are kept. Returns what is saved. */
    update(userId: string, patch: PreferencesBody): Promise<PreferencesBody>;
}
export declare function createPreferencesService(site: Pick<Site, "COLLECTIONS" | "api">, store: () => Pick<ContentStore, "getPreferences" | "savePreferences">): PreferencesService;
