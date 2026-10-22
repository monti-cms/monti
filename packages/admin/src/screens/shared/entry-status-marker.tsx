import type { StatusShape, StatusTone } from "@monti-cms/ui";
import type { EntryStatus } from "./entry-status";

/**
 * The monochrome marker of an entry status, shared by the list and the editor header: published is a filled dot (half filled while it has
 * unpublished changes, in the warning color), a draft is a hollow ring, archived is a muted filled dot and trashed a muted minus.
 */
export function entryStatusMarker(
	status: EntryStatus,
	hasUnpublishedChanges = false,
): { tone: StatusTone; shape: StatusShape } {
	if (status === "published") {
		return hasUnpublishedChanges ? { tone: "warning", shape: "half" } : { tone: "strong", shape: "dot" };
	}
	if (status === "archived") return { tone: "neutral", shape: "dot" };
	if (status === "trashed") return { tone: "neutral", shape: "minus" };
	return { tone: "strong", shape: "ring" };
}
