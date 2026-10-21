import { unknownFormatError } from "../../../format/unknown.js";
import { createBodyExporter } from "../../../services/body-export.js";
import { exportTextKey, planExport, } from "../../../services/export-service.js";
/** What an export holds, read from the store: the whole site, or the selection with its translation groups. */
export async function readExportPlan(cms, options) {
    return planExport(await cms.store().readExportSnapshot(), { scope: options.scope, ids: options.ids });
}
/** Fails with `unknown_format` before any work is done if no installed format has that name. */
export async function assertFormatInstalled(cms, format) {
    const registry = await cms.formats();
    if (!registry.get(format))
        throw unknownFormatError(format, registry);
}
const reasonOf = (error) => {
    const code = error?.code;
    return typeof code === "string" ? code : "format_export_failed";
};
/**
 * Writes the bodies of an export as text in a format. The admin archive is a backup, so its texts are written to be imported again (`sync`: links by path,
 * an unresolved link keeps its id, media by id) and resolve links to the current address of any entry. The public archive is for readers: only published
 * entries, links as readers see them (an unpublished target is not a link), images by public URL.
 *
 * A body the format cannot write is not an error of the export: its JSON document stays in the archive, its text file is skipped and it is listed in
 * `notWritten`. Only a format nobody provides fails the export.
 */
export async function exportTexts(cms, plan, scope, format) {
    const exporter = await createBodyExporter(cms, {
        format,
        purpose: scope === "public" ? "read" : "sync",
        source: scope === "public" ? "published" : "working",
    });
    const bodies = new Map();
    const notWritten = [];
    const write = async (id, state, doc, locale) => {
        try {
            bodies.set(exportTextKey(id, state), await exporter.text(doc, locale));
        }
        catch (error) {
            notWritten.push({ id, state, reason: reasonOf(error) });
        }
    };
    const { snapshot } = plan;
    for (const entry of snapshot.entries) {
        if (scope === "public") {
            if (entry.status === "published" && entry.published) {
                await write(entry.id, "published", entry.published.doc, entry.locale);
            }
            continue;
        }
        await write(entry.id, "working", entry.working.doc, entry.locale);
        if (entry.published)
            await write(entry.id, "published", entry.published.doc, entry.locale);
    }
    if (scope === "admin") {
        for (const template of snapshot.templates) {
            await write(template.id, "template", template.doc, cms.site.DEFAULT_LOCALE);
        }
    }
    return { format: exporter.format, bodies, notWritten };
}
