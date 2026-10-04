import { createTranslator } from "@monti-cms/core/client";
import { toast } from "sonner";
import { mediaMessages } from "./messages";

const t = createTranslator(mediaMessages);

/** One item of the media list API. */
export interface MediaItem {
	id: string;
	status: "ready" | "deleting" | "pending" | "failed";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	publicUrl: string | null;
	original: { mimeType: string | null; byteSize: number | null; width: number | null; height: number | null } | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: string;
	referencesCount: number;
	references: { entryId: string; title: string | null; collection: string; state: "working" | "published" }[];
}

/** One post that uses the media. Counts previously tallied separately for the draft being edited and the published post are merged into one per post. */
export interface MediaUsage {
	entryId: string;
	title: string | null;
	collection: string;
	/** Note shown when it is used on one side only. Absent when used in both. */
	note?: "beforePublish" | "publishedOnly";
}

/**
 * Merges usages into one per post. A published post's draft and published version share the same image and are counted twice, but to a person it is one post.
 * If only in the draft (newly added, not yet published), it is labeled "before publishing"; if only in the published version (removed from the draft but still in the public post), "published only".
 */
export function mediaUsages(media: Pick<MediaItem, "references">): MediaUsage[] {
	const byEntry = new Map<string, MediaUsage & { states: Set<"working" | "published"> }>();
	for (const reference of media.references) {
		const current = byEntry.get(reference.entryId);
		if (current) {
			current.states.add(reference.state);
			// If the published side's name is empty, use the draft side's name.
			current.title ||= reference.title;
		} else {
			byEntry.set(reference.entryId, {
				entryId: reference.entryId,
				title: reference.title,
				collection: reference.collection,
				states: new Set([reference.state]),
			});
		}
	}
	return [...byEntry.values()].map(({ states, ...usage }) =>
		states.size === 2 ? usage : { ...usage, note: states.has("working") ? "beforePublish" : "publishedOnly" },
	);
}

/** Usage count. Counted once per post (the server's count when only non-post usages exist, such as templates). */
export const usageCount = (media: MediaItem) => mediaUsages(media).length || media.referencesCount;

/** Usage state shown on lists and tiles. */
export const usageLabel = (media: MediaItem) =>
	media.status === "deleting"
		? t("usage.deleting")
		: media.referencesCount > 0
			? t("usage.count", { count: usageCount(media) })
			: t("usage.none");

/** Text of the usage note (`note`). */
export const usageNoteLabel = (note: NonNullable<MediaUsage["note"]>) =>
	t(note === "beforePublish" ? "usage.note.beforePublish" : "usage.note.publishedOnly");

export async function copyText(text: string, success: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(success);
	} catch {
		toast.error(t("common.copyFailed"));
	}
}

/** Appends the original file's extension to the new name (suggested names come without an extension). If it already has the same extension, leaves it as is. */
export function withExtension(name: string, original: string): string {
	const extension = /\.[A-Za-z0-9]{1,8}$/.exec(original)?.[0]?.toLowerCase() ?? "";
	return extension && !name.toLowerCase().endsWith(extension) ? `${name}${extension}` : name;
}
