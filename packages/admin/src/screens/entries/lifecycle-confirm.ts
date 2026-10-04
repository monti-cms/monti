import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { t } from "./translate";

/** Status transitions of the edit screen. */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** Transitions that ask first. Only archiving and moving to trash, which take a published post down, ask. Unarchive and restore happen right away. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive" | "trash">;

/** Name of the transition. Buttons and the "save first" hint use the same words. */
export const LIFECYCLE_LABEL: Record<LifecycleAction, string> = {
	archive: t("lifecycle.archive"),
	unarchive: t("lifecycle.unarchive"),
	trash: t("lifecycle.trash"),
	restore: t("lifecycle.restore"),
};

/** Text to announce after the transition finishes. */
export const LIFECYCLE_SUCCESS: Record<LifecycleAction, string> = {
	archive: t("lifecycle.success.archive"),
	unarchive: t("lifecycle.success.unarchive"),
	trash: t("lifecycle.success.trash"),
	restore: t("lifecycle.success.restore"),
};

/** Text to announce when the transition fails. */
export const LIFECYCLE_FAILED: Record<LifecycleAction, string> = {
	archive: t("lifecycle.failed.archive"),
	unarchive: t("lifecycle.failed.unarchive"),
	trash: t("lifecycle.failed.trash"),
	restore: t("lifecycle.failed.restore"),
};

/**
 * Confirmation text for transitions that take a published post down. Also tells if the published version is used elsewhere,
 * and that moving the original also moves translations in the same group.
 */
export function lifecycleConfirm(
	action: ConfirmedLifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
): Omit<ConfirmRequest, "onConfirm"> {
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote = publishedUsers > 0 ? t("lifecycle.usage", { count: publishedUsers }) : "";
	const isTranslation = entry !== null && isTranslationEntry(entry);
	const otherLocales =
		entry && !isTranslation
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
