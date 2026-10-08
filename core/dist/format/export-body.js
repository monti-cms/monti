import { createExportRefs } from "../read/index.js";
import { exportText } from "./convert.js";
/**
 * Writes a stored document as text in a format, the way the admin API and the admin export do (`purpose: "sync"`): the text is written to be imported again, links
 * are the real path of their target (an unresolved link keeps its id) and registered media stay by id. For a plugin that keeps bodies somewhere else (git-sync).
 * An unknown format fails with a `ServiceError` coded `unknown_format`.
 */
export async function exportBodyText(cms, params) {
    const registry = await cms.formats();
    const refsOf = createExportRefs({ site: cms.site, store: cms.store, mediaStore: cms.mediaStore }, params.scope ?? "published");
    return exportText(cms.site, registry, params.format, params.doc, {
        locale: params.locale,
        purpose: "sync",
        refs: await refsOf(params.doc, params.locale),
    });
}
