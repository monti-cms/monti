import type { Site } from "@monti-cms/core/site";
import type { Editor, Range } from "@tiptap/core";
import { addedBlockInsertActions } from "./blocks/added";

/** Opens the library picker (slash menu "Image" and "File"); `detail.kind` is `"image"` or `"file"`. */
export const OPEN_MEDIA_PICKER_EVENT = "cms:open-media-picker";

/** Asks the editor to open the library picker for images or for files. */
export const openMediaPicker = (kind: "image" | "file") =>
	window.dispatchEvent(new CustomEvent(OPEN_MEDIA_PICKER_EVENT, { detail: { kind } }));

export type BlockInsertAction = (editor: Editor, range: Range) => void;

/**
 * Registry mapping a block definition's `editor.nodeView` name (core block) or block name (added block) → slash menu insert action.
 *
 * Among blocks with `editor.insertable === true` and `editor.view === 'node'`, those with an action registered here
 * appear in the slash menu automatically. Insertion of added blocks is built from the definition's `editor.insert`.
 */
export const blockInsertActions = (site: Pick<Site, "ADDED_BLOCKS">): Record<string, BlockInsertAction> => ({
	image: (editor, range) => {
		editor.chain().focus().deleteRange(range).run();
		openMediaPicker("image");
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
	...addedBlockInsertActions(site),
});
