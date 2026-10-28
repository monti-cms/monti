import type { MediaTrashResult, Site } from "@monti-cms/core/site";
import type { MediaItem } from "../../api/media";
import { deleteMessages } from "../shared/delete.messages";

/**
 * What the toast says after files were sent to the trash, and what its button does. Files something uses stay where they are, so a run can be whole
 * (an undo), partial or empty (a "view" that shows the ones that stayed).
 */
export function mediaTrashNotice(
	site: Site,
	files: readonly Pick<MediaItem, "id" | "filename">[],
	result: MediaTrashResult,
): { message: string; action: "undo" | "view" } {
	const t = site.createTranslator(deleteMessages);
	if (result.trashed.length === 0) return { message: t("media.keptAll"), action: "view" };
	if (result.kept.length > 0) {
		return {
			message: t("media.partial", { moved: result.trashed.length, kept: result.kept.length }),
			action: "view",
		};
	}
	const only = result.trashed.length === 1 ? files.find((file) => file.id === result.trashed[0]) : undefined;
	return {
		message: only
			? t("media.done.one", { name: only.filename })
			: t("media.done.many", { count: result.trashed.length }),
		action: "undo",
	};
}

/**
 * The folder the "view" of a partial trash opens: the folder the files that stayed are in, or the whole library when they are in different ones
 * (the library filters by the files in use there).
 */
export function keptFilesFolder(
	files: readonly Pick<MediaItem, "id" | "folderId">[],
	result: MediaTrashResult,
): string {
	const folders = new Set(files.filter((file) => result.kept.includes(file.id)).map((file) => file.folderId ?? null));
	const [only] = folders;
	return folders.size === 1 && only ? only : "all";
}
