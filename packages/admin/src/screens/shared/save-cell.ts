import type { SaveStatus } from "../entries/entry-editor-types";

/** What the save cell does when it is pressed: save again, go to sign-in, or nothing (it only states the state). */
export type SaveCellAction = "save" | "sign-in" | null;

/** How the save cell looks and what it does for each state of the entry. */
export function saveCell(status: SaveStatus): { tone: "warning" | "danger" | undefined; action: SaveCellAction } {
	switch (status) {
		case "saved":
		case "saving":
			return { tone: undefined, action: null };
		case "new":
		case "dirty":
		case "local-only":
			return { tone: "warning", action: "save" };
		case "failed":
		case "conflict":
			return { tone: "danger", action: "save" };
		case "session-expired":
			return { tone: "danger", action: "sign-in" };
	}
}
