import type { Site } from "@monti-cms/core/client";
/**
 * Browser storage of the admin, kept apart per site. `localStorage` and IndexedDB belong to an origin, so two sites served from one origin (two apps on
 * `localhost:3000` one after the other, or two admins under one domain) would otherwise share their preferences and recovery copies. Every key and database
 * name carries the namespace of the site: its name and its admin path.
 *
 * This is the storage of per-device preferences (a panel width, a view mode). What should follow the person across devices (list columns, sort, page size)
 * lives on the server instead (`/v1/preferences`, `api/preferences.ts`). Screens read these through `usePreference`, not directly.
 */
/** The namespace of a site's browser storage: its name and admin path (`example.dev/admin`). */
export declare const storageNamespace: (site: Site) => string;
/** The `localStorage` key of a preference of this site. */
export declare const preferenceKey: (site: Site, name: string) => string;
/** Calls `listener` when a preference changes, in this tab or in another one. */
export declare function subscribePreferences(listener: () => void): () => void;
/** Reads a remembered preference of this site. `null` when there is none, or when storage is unavailable. */
export declare function readPreference(site: Site, name: string): string | null;
/** Remembers a preference of this site. Does nothing when storage is unavailable: the screen still changes, it just is not remembered. */
export declare function writePreference(site: Site, name: string, value: string): void;
/** Forgets a preference of this site, so its screen falls back to the default. */
export declare function removePreference(site: Site, name: string): void;
