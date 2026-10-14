import { exportText } from "../format/convert.js";
import { unknownFormatError } from "../format/unknown.js";
import { createExportRefs } from "../read/index.js";
export async function createBodyExporter(cms, options) {
    const registry = await cms.formats();
    const found = registry.get(options.format);
    if (!found)
        throw unknownFormatError(options.format, registry);
    const refsOf = createExportRefs({ site: cms.site, store: cms.store, mediaStore: cms.mediaStore }, options.source ?? "working");
    return {
        format: { name: found.name, extension: found.extension },
        text: async (doc, locale) => (await exportText(cms.site, registry, options.format, doc, {
            locale,
            purpose: options.purpose ?? "sync",
            refs: await refsOf(doc, locale),
        })).text,
    };
}
