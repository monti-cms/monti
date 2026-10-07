import type { Site } from "@monti-cms/core/client";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import type { ConfirmRequest } from "../shared/confirm-dialog";
import { nounVars } from "../shared/noun.messages";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { entriesMessages } from "./messages";

/** Status transitions of the edit screen. */
export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

/** Transitions that ask first. Only archiving and moving to trash, which take a published entry down, ask. Unarchive and restore happen right away. */
export type ConfirmedLifecycleAction = Extract<LifecycleAction, "archive" | "trash">;

/** Name of the transition. Buttons and the "save first" hint use the same words. */
export const lifecycleLabel = (site: Site): Record<LifecycleAction, string> => {
	const t = site.createTranslator(entriesMessages);
	return {
		archive: t("lifecycle.archive"),
		unarchive: t("lifecycle.unarchive"),
		trash: t("lifecycle.trash"),
		restore: t("lifecycle.restore"),
	};
};

/** Text to announce after the transition finishes. */
export const lifecycleSuccess = (site: Site): Record<LifecycleAction, string> => {
	const t = site.createTranslator(entriesMessages);
	return {
		archive: t("lifecycle.success.archive"),
		unarchive: t("lifecycle.success.unarchive"),
		trash: t("lifecycle.success.trash"),
		restore: t("lifecycle.success.restore"),
	};
};

/** Text to announce when the transition fails. */
export const lifecycleFailed = (site: Site): Record<LifecycleAction, string> => {
	const t = site.createTranslator(entriesMessages);
	return {
		archive: t("lifecycle.failed.archive"),
		unarchive: t("lifecycle.failed.unarchive"),
		trash: t("lifecycle.failed.trash"),
		restore: t("lifecycle.failed.restore"),
	};
};

/**
 * Confirmation text for transitions that take a published entry down. Also tells if the published version is used elsewhere,
 * and that moving the original also moves translations in the same group.
 */
export function lifecycleConfirm(
	site: Site,
	action: ConfirmedLifecycleAction,
	entry: Pick<EntryData, "id" | "translationGroupId" | "translations"> | null,
	incomingReferences: readonly Pick<IncomingReferenceItem, "state">[],
	collection: string,
): Omit<ConfirmRequest, "onConfirm"> {
	const t = site.createTranslator(entriesMessages);
	const label = lifecycleLabel(site);
	const noun = nounVars(site, collection);
	const publishedUsers = incomingReferences.filter((item) => item.state === "published").length;
	const usageNote = publishedUsers > 0 ? t("lifecycle.usage", { count: publishedUsers, ...noun }) : "";
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
				title: label.archive,
				description: `${t("lifecycle.archive.ask", { translation: isTranslation ? 1 : 0, ...noun })}${usageNote}${hasGroup ? t("lifecycle.archive.group") : ""}`,
				confirmLabel: label.archive,
			};
		case "trash":
			return {
				title: label.trash,
				description: `${t("lifecycle.trash.ask", { translation: isTranslation ? 1 : 0, ...noun })}${usageNote}${hasGroup ? t("lifecycle.trash.group", { locales: otherLocales.join("·") }) : ""}`,
				confirmLabel: label.trash,
				destructive: true,
			};
	}
}
