import { fileTypeLabel } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import type { MediaItem } from "../../api/media";
import type { TranslatorFor } from "../../translator";
import type { mediaMessages } from "./messages";

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
export const usageLabel = (t: TranslatorFor<typeof mediaMessages>, media: MediaItem) =>
	media.status === "deleting"
		? t("usage.deleting")
		: media.referencesCount > 0
			? t("usage.count", { count: usageCount(media) })
			: t("usage.none");

/** The format of a file as the list writes it: "JPEG" for a picture, "PDF" or the extension for any other file. */
export const formatLabel = (media: Pick<MediaItem, "filename" | "mimeType">, isImage: boolean): string =>
	isImage
		? (media.mimeType
				?.replace(/^image\//, "")
				.replace(/\+.*$/, "")
				.toUpperCase() ?? "—")
		: fileTypeLabel(media.filename, media.mimeType);

/** The kind of a file in words: "JPEG image", "PDF document". */
export const kindName = (
	t: TranslatorFor<typeof mediaMessages>,
	media: Pick<MediaItem, "filename" | "mimeType">,
	isImage: boolean,
): string => {
	const format = formatLabel(media, isImage);
	if (isImage) return t("format.image", { format });
	return media.mimeType === "application/pdf" ? t("format.pdf") : t("format.file", { format });
};

/** Text of the usage note (`note`). */
export const usageNoteLabel = (t: TranslatorFor<typeof mediaMessages>, note: NonNullable<MediaUsage["note"]>) =>
	t(note === "beforePublish" ? "usage.note.beforePublish" : "usage.note.publishedOnly");

export async function copyText(text: string, success: string, failure: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast(success);
	} catch {
		toast.error(failure);
	}
}

/** The extension of a file name (with the dot, as written), or an empty string. The server reads the extension the same way. */
const extensionOf = (filename: string) => /\.[^./\\]{1,16}$/.exec(filename)?.[0] ?? "";

/** A file name as its editable stem and its extension, which a rename keeps. */
export function splitFilename(filename: string): { stem: string; extension: string } {
	const extension = extensionOf(filename);
	return { stem: filename.slice(0, filename.length - extension.length), extension };
}

/** Why a stem cannot be a file name, or `null`. The server checks the same rules. */
export function stemProblem(stem: string): "empty" | "invalid" | null {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this rejects
	if (/[/\\\u0000-\u001f\u007f]/.test(stem) || stem.trim() === "." || stem.trim() === "..") return "invalid";
	return stem.trim() === "" ? "empty" : null;
}
