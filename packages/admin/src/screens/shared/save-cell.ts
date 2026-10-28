import type { SaveStatus } from "../entries/entry-editor-types";

/** What the save cell does when it is pressed: save again, go to sign-in, or nothing (it only states the state). */
export type SaveCellAction = "save" | "sign-in" | null;

/**
 * How the save cell looks and what it does for each state of the entry. The dot marks changes that are not on the server yet (unsaved, or only in
 * this browser); a state that is broken is red text with no dot, and one that is not saved only because nothing has been written yet is plain.
 */
export function saveCell(status: SaveStatus): {
	tone: "warning" | "danger" | undefined;
	dot: boolean;
	action: SaveCellAction;
} {
	switch (status) {
		case "saved":
		case "saving":
		case "new":
			return { tone: undefined, dot: false, action: status === "new" ? "save" : null };
		case "dirty":
		case "local-only":
			return { tone: "warning", dot: true, action: "save" };
		case "failed":
		case "conflict":
			return { tone: "danger", dot: false, action: "save" };
		case "session-expired":
			return { tone: "danger", dot: false, action: "sign-in" };
	}
}
