import type { Site } from "@monti-cms/core/site";
import type { EntryStatusKind } from "@monti-cms/ui";
import { sharedMessages } from "./messages";

export type EntryStatus = "draft" | "published" | "archived" | "trashed";

/** Display name of each status. */
export const statusLabels = (site: Pick<Site, "createTranslator">): Record<EntryStatus, string> => {
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
export function describeEntryStatus(
	site: Pick<Site, "createTranslator">,
	entry: { status: EntryStatus; hasUnpublishedChanges?: boolean },
): string {
	const t = site.createTranslator(sharedMessages);
	let label = statusLabels(site)[entry.status] ?? entry.status;
	if (entry.status === "published" && entry.hasUnpublishedChanges) label += ` · ${t("status.editing")}`;
	return label;
}

/**
 * The mark an entry status wears, shared by the list and the editor header: published is a filled dot (orange while it has unpublished changes),
 * a draft is an empty ring, and archived and trashed entries are a short bar.
 */
export function entryStatusKind(status: EntryStatus, hasUnpublishedChanges = false): EntryStatusKind {
	if (status === "published") return hasUnpublishedChanges ? "editing" : "published";
	if (status === "draft") return "draft";
	return "archived";
}
