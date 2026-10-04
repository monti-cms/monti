import { isTranslationEntry } from "./entry-form.js";
import { t } from "./translate.js";
/** Name of the transition. Buttons and the "save first" hint use the same words. */
export const LIFECYCLE_LABEL = {
    archive: t("lifecycle.archive"),
    unarchive: t("lifecycle.unarchive"),
    trash: t("lifecycle.trash"),
    restore: t("lifecycle.restore"),
};
/** Text to announce after the transition finishes. */
export const LIFECYCLE_SUCCESS = {
    archive: t("lifecycle.success.archive"),
    unarchive: t("lifecycle.success.unarchive"),
    trash: t("lifecycle.success.trash"),
    restore: t("lifecycle.success.restore"),
};
/** Text to announce when the transition fails. */
export const LIFECYCLE_FAILED = {
    archive: t("lifecycle.failed.archive"),
    unarchive: t("lifecycle.failed.unarchive"),
    trash: t("lifecycle.failed.trash"),
    restore: t("lifecycle.failed.restore"),
};
/**
 * Confirmation text for transitions that take a published post down. Also tells if the published version is used elsewhere,
 * and that moving the original also moves translations in the same group.
 */
export function lifecycleConfirm(action, entry, incomingReferences) {
    const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
    const usageNote = publishedUsers > 0 ? t("lifecycle.usage", { count: publishedUsers }) : "";
    const isTranslation = entry !== null && isTranslationEntry(entry);
    const otherLocales = entry && !isTranslation
        ? (entry.translations ?? [])
            .filter((member) => member.id !== entry.id && member.status !== "trashed")
            .map((member) => member.locale.toUpperCase())
        : [];
    const hasGroup = otherLocales.length > 0;
    switch (action) {
        case "archive":
            return {
                title: LIFECYCLE_LABEL.archive,
                description: `${t("lifecycle.archive.ask", { translation: isTranslation ? 1 : 0 })}${usageNote}${hasGroup ? t("lifecycle.archive.group") : ""}`,
                confirmLabel: LIFECYCLE_LABEL.archive,
            };
        case "trash":
            return {
                title: LIFECYCLE_LABEL.trash,
                description: `${t("lifecycle.trash.ask", { translation: isTranslation ? 1 : 0 })}${usageNote}${hasGroup ? t("lifecycle.trash.group", { locales: otherLocales.join("·") }) : ""}`,
                confirmLabel: LIFECYCLE_LABEL.trash,
                destructive: true,
            };
    }
}
