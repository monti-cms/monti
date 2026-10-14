import { cmsApiUrl } from "@monti-cms/core/client";
import { commonMessages } from "../lib/common.messages.js";
import { bulkBarMessages } from "../screens/entries/bulk-bar.messages.js";
import { entriesMessages } from "../screens/entries/messages.js";
import { cmsFetch } from "./client.js";
/** Query keys. Everything under `all` is refetched after a write; the trash badge count and the other list-wide numbers sit under it too. */
export const entriesKeys = {
    all: ["cms", "entries"],
    list: (query) => [...entriesKeys.all, "list", query],
    detail: (id) => [...entriesKeys.all, "detail", id],
    relations: (id) => [...entriesKeys.all, "relations", id],
    search: (query) => [...entriesKeys.all, "search", query],
    taxonomy: (collection) => collection === undefined
        ? [...entriesKeys.all, "taxonomy"]
        : [...entriesKeys.all, "taxonomy", collection],
    trashCount: () => [...entriesKeys.all, "trash-count"],
};
const entryUrl = (id) => cmsApiUrl(`/v1/entries/${encodeURIComponent(id)}`);
export const getEntry = (site, id, signal, fallback) => cmsFetch(site, entryUrl(id), { signal, fallback });
/** `GET /v1/entries?<query>` (the list screen, taxonomy options, counts, the editor's internal-link search). */
export const listEntries = (site, query, signal, fallback) => cmsFetch(site, cmsApiUrl(`/v1/entries?${query.toString()}`), { signal, fallback });
/** `GET /v1/entries/search?<query>` (relation pickers: title search, or lookup by `id`). */
export const searchEntries = (site, query, signal) => cmsFetch(site, cmsApiUrl(`/v1/entries/search?${query.toString()}`), { signal });
/** `POST /v1/entries` */
export const createEntry = (site, input, fallback) => cmsFetch(site, cmsApiUrl("/v1/entries"), { method: "POST", json: input, fallback });
/** `PATCH /v1/entries/:id` */
export const updateEntry = (site, id, input, fallback) => cmsFetch(site, entryUrl(id), { method: "PATCH", json: input, fallback });
/** `POST /v1/entries/:id/publish` */
export const publishEntry = (site, id, input, fallback) => cmsFetch(site, `${entryUrl(id)}/publish`, { method: "POST", json: input, fallback });
/** `POST /v1/entries/:id/{archive,unarchive,trash,restore}` */
export const changeEntryStatus = async (site, id, action, input, fallback) => {
    await cmsFetch(site, `${entryUrl(id)}/${action}`, { method: "POST", json: input, fallback });
};
/** `POST /v1/entries/:id/duplicate` */
export const duplicateEntry = (site, id, input, fallback) => cmsFetch(site, `${entryUrl(id)}/duplicate`, { method: "POST", json: input, fallback });
/** `DELETE /v1/entries/:id?expectedVersion=n` (permanent). */
export const removeEntry = async (site, id, input, fallback) => {
    await cmsFetch(site, `${entryUrl(id)}?${new URLSearchParams({ expectedVersion: String(input.expectedVersion) })}`, {
        method: "DELETE",
        fallback,
    });
};
/** `GET /v1/entries/:id/relations` (what points at this entry). */
export const getEntryRelations = (site, id, signal) => cmsFetch(site, `${entryUrl(id)}/relations`, { signal });
/** `POST /v1/entries/:id/translations` (a draft translation of the entry in `locale`). */
export const createEntryTranslation = (site, id, locale, fallback) => cmsFetch(site, `${entryUrl(id)}/translations`, {
    method: "POST",
    json: { locale },
    fallback,
});
/** `POST /v1/bulk`: one answer per item. */
export async function bulkEntries(site, op, items, params = {}) {
    const data = await cmsFetch(site, cmsApiUrl("/v1/bulk"), {
        method: "POST",
        json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
        fallback: site.createTranslator(bulkBarMessages)("requestFailed"),
    });
    return data.results;
}
/**
 * The admin API (`/v1/entries`).
 *
 * @experimental
 */
export const cmsEntryClient = (site) => {
    const t = site.createTranslator(entriesMessages);
    const saveFailed = site.createTranslator(commonMessages)("saveFailed");
    return {
        get: (id) => getEntry(site, id, undefined, t("loadFailed")),
        create: (input) => createEntry(site, input, saveFailed),
        update: (id, input) => updateEntry(site, id, input, saveFailed),
        publish: (id, input) => publishEntry(site, id, input, t("publishFailed")),
        changeStatus: (id, action, input) => changeEntryStatus(site, id, action, input),
        duplicate: (id, input) => duplicateEntry(site, id, input),
        remove: (id, input) => removeEntry(site, id, input),
        relations: (id) => getEntryRelations(site, id),
    };
};
