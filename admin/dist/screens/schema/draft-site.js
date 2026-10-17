import { defineCollection, parseSchemaFile } from "@monti-cms/core";
import { createSite } from "@monti-cms/core/site";
import { markSandboxSite } from "../shared/preview-sandbox.js";
/**
 * A site made from the schema being edited (the draft), for a preview that runs the real components: `schemaOf`, the layout, conditional fields, tabs, options
 * and help texts all come from the draft. The rest of the site (blocks, plugins, media, admin texts) is the running site's. A draft that does not parse gives `null`.
 * The site is marked as a sandbox, so the admin's helpers refuse to write for it.
 */
export function draftSiteOf(site, draft, codeCollections) {
    try {
        const file = parseSchemaFile(draft, "draft");
        const fromCode = Object.fromEntries(Object.entries(site.config.collections ?? {}).filter(([name]) => codeCollections.includes(name)));
        const fromFile = Object.fromEntries(Object.entries(file.collections).map(([name, collection]) => [name, defineCollection(collection)]));
        return markSandboxSite(createSite({
            ...site.config,
            collections: { ...fromCode, ...fromFile },
            locales: file.locales,
            defaultLocale: file.defaultLocale,
        }));
    }
    catch {
        return null;
    }
}
