import type { Site } from "@monti-cms/core/client";
import type { InternalLinkItem } from "./internal-link.js";
/** Query key of the `[[` link search for typed text. */
export declare const linkSearchKey: (query: string) => readonly ["cms", "entries", "link-search", string];
/**
 * Finds the entries a `[[` link can point to. Only collections that have a public path are searched. A translation is found through its source.
 * A failed request is thrown as the admin API error ({@link listEntries}) instead of turning into an empty list.
 */
export declare function searchLinkTargets(site: Site, query: string): Promise<InternalLinkItem[]>;
