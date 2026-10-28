import type { Site } from "@monti-cms/core/site";
import type { EntryStatusKind } from "@monti-cms/ui";
import { documentKey } from "../../editor/document-key";
import type { EntryData } from "../entries/entry-form";
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

/** The name of an entry's status for the mark `entryStatusKind` gives it: a published entry with changes not published yet is "editing". */
export const statusName = (
	site: Pick<Site, "createTranslator">,
	status: EntryStatus,
	hasUnpublishedChanges = false,
): string =>
	status === "published" && hasUnpublishedChanges
		? site.createTranslator(sharedMessages)("status.editing")
		: statusLabels(site)[status];

/**
 * The mark an entry status wears, shared by the list and the editor header: published is a filled dot (orange while it has unpublished changes),
 * a draft is an empty ring, and archived and trashed entries are a short bar.
 */
export function entryStatusKind(status: EntryStatus, hasUnpublishedChanges = false): EntryStatusKind {
	if (status === "published") return hasUnpublishedChanges ? "editing" : "published";
	if (status === "draft") return "draft";
	return "archived";
}

/** What of an entry decides whether it has something to publish. */
type Publishable = Pick<EntryData, "status" | "working" | "workingSlug" | "publishedSlug" | "published">;

/** The same value as text whatever the key order inside it (the database may reorder keys). */
const stable = (value: unknown): string => {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
		.join(",")}}`;
};

/**
 * Whether a published entry has changes the public page does not show: the saved draft differs from the published version (body, properties or address),
 * or the editor holds changes that are not saved yet. Anything that is not published has none (it is a draft, or it cannot be published).
 */
export function hasUnpublishedChanges(
	site: Pick<Site, "sortMarks">,
	entry: Publishable | null,
	unsaved: boolean,
): boolean {
	if (!entry || entry.status !== "published") return false;
	if (unsaved) return true;
	const published = entry.published;
	if (!published) return false;
	return (
		entry.workingSlug !== entry.publishedSlug ||
		stable(entry.working.metadata) !== stable(published.metadata) ||
		documentKey(site, entry.working.doc) !== documentKey(site, published.doc)
	);
}
