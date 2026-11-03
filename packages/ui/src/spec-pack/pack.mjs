// Monti's settings for the screen spec scripts (`pnpm gen:screen-catalog`, `pnpm check:screens`, `pnpm convert:board`): what they need to know of Monti
// that the tool does not. Paths are relative to this folder.

export default {
	/** Where this pack's screen specs are: `check:screens` checks every `*.screen.json` in these folders. */
	screens: ["../screens", "../../../admin/src"],
	/** What `gen:screen-catalog` writes and the other scripts read. */
	catalog: "catalog.generated.json",
	/** HTML boards: the classes file loaded before the adapter, the element the board is drawn in, and the window it is drawn at. */
	board: { classes: "html-board.js", root: ".mt", viewport: { width: 1440, height: 900 } },
	/**
	 * Modules a dictionary imports that the scripts stand in for: `defineMessages` only returns what it is given, and `josa` is used only by texts that
	 * are functions, which a board's words are never matched against.
	 */
	stubs: {
		"@monti-cms/core": "export const defineMessages = (namespace, messages) => ({ namespace, messages });",
		"@monti-cms/core/site": "export const josa = (word, withFinal) => `${word}${withFinal}`;",
	},
	/** A dictionary module's texts in the board's language, each with its key: the boards are drawn in Korean. */
	dictionary(module) {
		const bundle = Object.values(module).find((value) => value?.messages?.ko);
		return Object.fromEntries(
			Object.entries(bundle?.messages.ko ?? {})
				.filter(([, text]) => typeof text === "string")
				.map(([key, text]) => [text, key]),
		);
	},
};
