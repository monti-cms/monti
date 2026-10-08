import { createContentLookup } from "@monti-cms/core/plugin/server";
import { AiError } from "../errors.js";
import { runMessages } from "../run.messages.js";
import { siteImageUrl } from "../site-image.js";
/** Image formats and sizes that multimodal models commonly accept. */
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** All published items of other collections (tags, categories, collections, posts). */
async function loadRecords(cms, collection) {
    if (!cms.site.isCollection(collection))
        return [];
    const store = cms.store();
    const options = [];
    for (let page = 1; page <= 20; page++) {
        const result = await store.listEntries({
            collection,
            statuses: ["published"],
            sort: { field: "title", direction: "asc" },
            page,
            pageSize: 100,
        });
        options.push(...result.items.map((item) => ({ value: item.id, label: item.title || item.slug || item.id })));
        if (options.length >= result.total || result.items.length === 0)
            break;
    }
    return options;
}
/** Choice lists of a collection's fields (`select` fields, the picker of conditional fields, and dependent select fields). */
function fieldOptions(site, collection, field) {
    if (!site.isCollection(collection))
        return [];
    const definition = site.schemaOf(collection).fields[field] ?? site.storedField(collection, field)?.field;
    // Conditional fields (policies etc.) use the list of the picker (discriminant).
    const select = definition?.kind === "conditional" ? definition.discriminant : definition;
    return select?.kind === "select"
        ? Object.entries(select.options).map(([value, label]) => ({ value, label: String(label) }))
        : [];
}
async function fetchSiteImage(site, url, signal) {
    const t = site.createTranslator(runMessages);
    const response = await fetch(url, { signal, redirect: "error", cache: "no-store" }).catch(() => null);
    if (!response?.ok)
        return null;
    const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!IMAGE_TYPES.has(mimeType))
        throw new AiError("ai_failed", t("imageType"));
    if (Number(response.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
        throw new AiError("ai_input_too_large", t("imageTooLarge"));
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES)
        throw new AiError("ai_input_too_large", t("imageTooLarge"));
    return {
        mediaType: mimeType,
        data: Buffer.from(bytes).toString("base64"),
    };
}
/**
 * Store connection to pass to the runner. Tags, categories, images and the content lookup of code checks are read directly by the server.
 * `origin` is this site's address. Images outside the media library (site files) are read from here.
 */
export function aiRunDeps(cms, runtime, signal, origin) {
    const store = cms.store();
    const { site } = cms;
    const t = site.createTranslator(runMessages);
    return {
        ...runtime,
        site,
        signal,
        loadRecords: (collection) => loadRecords(cms, collection),
        fieldOptions: (collection, field) => fieldOptions(site, collection, field),
        languageName: site.localeName,
        loadImage: async ({ mediaId, src }) => {
            if (!mediaId) {
                const url = src && origin ? siteImageUrl(src, origin) : null;
                if (!url)
                    throw new AiError("ai_failed", t("siteImageOnly"));
                return fetchSiteImage(site, url, signal);
            }
            const media = await store.getMediaAsset(mediaId);
            if (!media || media.status !== "ready" || !media.storageKey)
                return null;
            if (!media.mimeType || !IMAGE_TYPES.has(media.mimeType)) {
                throw new AiError("ai_failed", t("imageType"));
            }
            if ((media.byteSize ?? 0) > MAX_IMAGE_BYTES) {
                throw new AiError("ai_input_too_large", t("imageTooLarge"));
            }
            const bytes = await cms.mediaStore().readFile({ key: media.storageKey, maxBytes: MAX_IMAGE_BYTES, signal });
            return {
                mediaType: media.mimeType,
                data: Buffer.from(bytes).toString("base64"),
            };
        },
        // The core content lookup that code checks read (the core public API).
        content: createContentLookup(cms),
    };
}
