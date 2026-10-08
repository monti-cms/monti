import { type Site } from "@monti-cms/core/client";
import type { InternalLinkItem } from "./internal-link.js";
/**
 * Finds the entries a `[[` link can point to. Only collections that have a public path are searched. A translation is found through its source.
 * A failed request is thrown as the admin API error ({@link cmsFetch}) instead of turning into an empty list.
 */
export declare function searchLinkTargets(site: Site, query: string): Promise<InternalLinkItem[]>;
