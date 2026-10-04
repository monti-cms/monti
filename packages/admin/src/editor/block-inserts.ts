import type { Editor, Range } from "@tiptap/core";
import { ADDED_BLOCK_INSERT_ACTIONS } from "./blocks/added";

export const OPEN_IMAGE_DIALOG_EVENT = "cms:open-image-dialog";
/** Opens the attachment picker (slash menu "File"). */
export const OPEN_FILE_PICKER_EVENT = "cms:open-file-picker";

export type BlockInsertAction = (editor: Editor, range: Range) => void;

/**
 * Registry mapping a block definition's `editor.nodeView` name (core block) or block name (added block) → slash menu insert action.
 *
 * Among blocks with `editor.insertable === true` and `editor.view === 'node'`, those with an action registered here
 * appear in the slash menu automatically. Insertion of added blocks is built from the definition's `editor.insert`.
 */
export const BLOCK_INSERT_ACTIONS: Record<string, BlockInsertAction> = {
	image: (editor, range) => {
		editor.chain().focus().deleteRange(range).run();
		window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
	},
	math: (editor, range) => {
		editor
			.chain()
			.focus()
			.deleteRange(range)
			.insertContent({
				type: "cmsMath",
				attrs: {
					value: "E = mc^2",
				},
			})
			.run();
	},
	// Blocks added by block extensions and the site config (block name).
	...ADDED_BLOCK_INSERT_ACTIONS,
};
