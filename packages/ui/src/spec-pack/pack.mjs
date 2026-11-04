// Monti's settings for the screen spec scripts (`pnpm gen:screen-catalog`, `pnpm check:screens`): what they need to know of Monti
// that the tool does not. Paths are relative to this folder.

export default {
	/** Where this pack's screen specs are: `check:screens` checks every `*.screen.json` in these folders. */
	screens: ["../screens", "../../../admin/src"],
	/** What `gen:screen-catalog` writes and the other scripts read. */
	catalog: "catalog.generated.json",
};
