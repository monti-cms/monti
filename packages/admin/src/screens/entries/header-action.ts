import type { Site } from "@monti-cms/core/site";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";
import type { EntryEditor } from "./entry-editor-types";
import type { EntryData } from "./entry-form";
import { lifecycleLabel } from "./lifecycle-confirm";

/** The main button of the entry editor's header: one transition at once (restore, unarchive, publish), or publish with its date options (`split`). */
export interface PrimaryLifecycleAction {
	readonly action: "restore" | "unarchive" | "publish" | "split";
	readonly label: string;
	readonly disabled: boolean;
}

/**
 * Which main button the header shows for the entry. A trashed entry is brought back, an archived one unarchived; an entry that was never published
 * is published, and one with a publish date gets the split button, which reads "published" and is dimmed while nothing changed since.
 */
export function primaryLifecycleAction(
	site: Site,
	{
		status,
		hasPublishDate,
		unpublished,
		busy,
		publishing,
		submitting,
	}: {
		/** Absent on a new entry. */
		readonly status: EntryData["status"] | undefined;
		readonly hasPublishDate: boolean;
		/** The entry has changes the public site does not have yet. */
		readonly unpublished: boolean;
		readonly busy: EntryEditor["busy"];
		readonly publishing: boolean;
		readonly submitting: boolean;
	},
): PrimaryLifecycleAction {
	const t = site.createTranslator(entryEditorShellMessages);
	if (status === "trashed") {
		return {
			action: "restore",
			label: busy === "status" ? t("restoring") : lifecycleLabel(site).restore,
			disabled: submitting,
		};
	}
	if (status === "archived") {
		return {
			action: "unarchive",
			label: busy === "status" ? t("unarchiving") : lifecycleLabel(site).unarchive,
			disabled: submitting,
		};
	}
	if (!hasPublishDate) {
		return { action: "publish", label: publishing ? t("publishing") : t("publish"), disabled: submitting };
	}
	const upToDate = status === "published" && !unpublished;
	return {
		action: "split",
		label: publishing ? t("publishing") : upToDate ? t("publishedState") : t("publish"),
		disabled: submitting || upToDate,
	};
}
