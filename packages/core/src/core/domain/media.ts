import { isImageType } from "../media-types";

/**
 * Media file rules. A media file keeps its id and file name when its stored file is replaced, so the new file must be the same kind: an image is replaced by
 * an image (any image format), an attached file only by a file of the same type (the file name keeps an extension that is still right).
 */

/** Why `next` cannot take the place of `current`: the notice key for the person, or `null` when it can. Both are mime types. */
export function replaceMismatch(
	current: string | null,
	next: string | null,
): "media.replace.kind" | "media.replace.type" | null {
	const currentIsImage = isImageType(current);
	if (currentIsImage !== isImageType(next)) return "media.replace.kind";
	return !currentIsImage && current !== next ? "media.replace.type" : null;
}
