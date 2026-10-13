import { type Site } from "@monti-cms/core/client";
import type { Obj } from "./schema-model.js";
/**
 * A site made from the schema being edited (the draft), for a preview that runs the real components: `schemaOf`, the layout, conditional fields, tabs, options
 * and help texts all come from the draft. The rest of the site (blocks, plugins, media, admin texts) is the running site's. A draft that does not parse gives `null`.
 * The site is marked as a sandbox, so the admin's helpers refuse to write for it.
 */
export declare function draftSiteOf(site: Site, draft: Obj, codeCollections: readonly string[]): Site | null;
