import { fileTypeLabel, type ReferenceOccurrence, type Site } from "@monti-cms/core/site";
import { toast } from "@monti-cms/ui";
import type { MediaItem } from "../../api/media";
import type { TranslatorFor } from "../../translator";
import type { mediaMessages } from "./messages";

/** One post that uses the media: what it is, and where in it the media sits (its body, the cover field), each place once. */
export interface MediaUsage {
	entryId: string;
	title: string | null;
	collection: string;
	/** The places, named ("대표 이미지", "본문"), in the order the entry first gives them. Empty when the server says nothing about them. */
	places: string[];
}

/** Names one place of an entry: the body, or the field at a metadata path. */
export type PlaceName = (collection: string, occurrence: ReferenceOccurrence) => string;

/**
 * One usage per post. A published post's draft and published version share the same image and are listed twice by the server, but to a person it is
 * one post; their places are merged, the draft's first.
 */
export function mediaUsages(media: Pick<MediaItem, "references">, placeName?: PlaceName): MediaUsage[] {
	const byEntry = new Map<string, MediaUsage>();
	const ordered = [...media.references].sort((a, b) => (a.state === b.state ? 0 : a.state === "working" ? -1 : 1));
	for (const reference of ordered) {
		const usage = byEntry.get(reference.entryId) ?? {
			entryId: reference.entryId,
			title: reference.title,
			collection: reference.collection,
			places: [],
		};
		// If the published side's name is empty, use the other side's name.
		usage.title ||= reference.title;
		for (const occurrence of placeName ? (reference.occurrences ?? []) : []) {
			const name = placeName?.(reference.collection, occurrence);
			if (name && !usage.places.includes(name)) usage.places.push(name);
		}
		byEntry.set(reference.entryId, usage);
	}
	return [...byEntry.values()];
}

/** Names the places of the site's entries: "본문" for the body, a field's label for a metadata path (its first segment, for a nested value). */
export const placeNamer =
	(site: Site, t: TranslatorFor<typeof mediaMessages>): PlaceName =>
	(collection, occurrence) => {
		if (occurrence.type === "body") return t("usage.place.body");
		const name = occurrence.path.split(".")[0] ?? occurrence.path;
		const field = site.isCollection(collection) ? site.schemaOf(collection).fields[name] : undefined;
		return field?.label ?? name;
	};

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
