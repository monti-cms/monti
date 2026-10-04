import { createTranslator } from "@monti-cms/core/client";
import { sharedMessages } from "./messages.js";
const t = createTranslator(sharedMessages);
export const STATUS_LABELS = {
    draft: t("status.draft"),
    published: t("status.published"),
    archived: t("status.archived"),
    trashed: t("status.trashed"),
};
/**
 * Status text of list and edit screens. Always written as text so status is not conveyed by color alone.
 * A draft that differs from the public version is `발행됨 · 수정 중`.
 */
export function describeEntryStatus(entry) {
    let label = STATUS_LABELS[entry.status] ?? entry.status;
    if (entry.status === "published" && entry.hasUnpublishedChanges)
        label += ` · ${t("status.editing")}`;
    return label;
}
