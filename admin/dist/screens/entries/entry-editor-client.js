import { cmsApiUrl } from "@monti-cms/core/client";
import { cmsFetch } from "../admin-api.js";
import { deleteLocalBackup, getLocalBackup, saveLocalBackup } from "./local-backup.js";
import { entriesMessages } from "./messages.js";
/**
 * The admin API (`/v1/entries`).
 *
 * @experimental
 */
export const cmsEntryClient = (site) => {
    const t = site.createTranslator(entriesMessages);
    return {
        get: (id) => cmsFetch(site, cmsApiUrl(`/v1/entries/${id}`), { fallback: t("loadFailed") }),
        create: (input) => cmsFetch(site, cmsApiUrl("/v1/entries"), {
            method: "POST",
            json: input,
            fallback: t("saveFailed"),
        }),
        update: (id, input) => cmsFetch(site, cmsApiUrl(`/v1/entries/${id}`), {
            method: "PATCH",
            json: input,
            fallback: t("saveFailed"),
        }),
        publish: (id, input) => cmsFetch(site, cmsApiUrl(`/v1/entries/${id}/publish`), {
            method: "POST",
            json: input,
            fallback: t("publishFailed"),
        }),
        changeStatus: async (id, action, input) => {
            await cmsFetch(site, cmsApiUrl(`/v1/entries/${id}/${action}`), { method: "POST", json: input });
        },
        duplicate: (id, input) => cmsFetch(site, cmsApiUrl(`/v1/entries/${id}/duplicate`), { method: "POST", json: input }),
        remove: async (id, input) => {
            await cmsFetch(site, cmsApiUrl(`/v1/entries/${id}?expectedVersion=${input.expectedVersion}`), {
                method: "DELETE",
            });
        },
        relations: (id) => cmsFetch(site, cmsApiUrl(`/v1/entries/${id}/relations`)),
    };
};
/**
 * The browser's IndexedDB, in a database of the site's own (two sites on one origin keep their copies apart). Copies the old shared database holds are still found:
 * the first read of one moves it to the site's database.
 *
 * @experimental
 */
export const localRecoveryStoreOf = (site) => ({
    get: (key) => getLocalBackup(key, site),
    put: (record) => saveLocalBackup(record, site),
    delete: (key) => deleteLocalBackup(key, site),
});
