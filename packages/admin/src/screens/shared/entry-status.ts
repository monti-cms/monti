import type { Site } from "@monti-cms/core/client";
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
 * A draft that differs from the public version is `발행됨 · 수정 중`.
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
