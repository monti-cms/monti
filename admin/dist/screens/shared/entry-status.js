import { sharedMessages } from "./messages.js";
/** Display name of each status. */
export const statusLabels = (site) => {
    const t = site.createTranslator(sharedMessages);
    return {
        draft: t("status.draft"),
        published: t("status.published"),
        archived: t("status.archived"),
        trashed: t("status.trashed"),
    };
};
/**
 * Status text of list and edit screens. Always written as text so status is not conveyed by color alone.
 * A draft that differs from the public version is "Published · Editing".
 */
export function describeEntryStatus(site, entry) {
    const t = site.createTranslator(sharedMessages);
    let label = statusLabels(site)[entry.status] ?? entry.status;
    if (entry.status === "published" && entry.hasUnpublishedChanges)
        label += ` · ${t("status.editing")}`;
    return label;
}
