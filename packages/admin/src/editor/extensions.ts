import StarterKit from "@tiptap/starter-kit";
import { ADDED_MARKS, createAddedMark, type EditorMarkSpec } from "./added-marks";
import { CmsBlockKeymap } from "./block-commands";
import { CmsBlockIds } from "./block-ids";
import { BLOCK_NODE_VIEWS } from "./block-views";
import { ADDED_BLOCK_NODES } from "./blocks/added";
import { CodeTextStyleKeys } from "./code-block/text-style-keys";
import { CmsBlockDrag } from "./drag";
import { CMS_SCHEMA_EXTENSIONS } from "./tiptap-schema";

/**
 * Editor extension assembly. Feature extensions (key handling, drag, plugins) are added to this list.
 * Schema nodes go in `tiptap-schema.ts`, block nodes with dedicated edit UI in `block-views.ts`,
 * and CmsNode ↔ Tiptap conversion in `converters/`. The look of added text styles (`marks`) is provided by the admin extension (`CmsAdminComponents.marks`).
 */
export function buildEditorExtensions(marks: Readonly<Record<string, EditorMarkSpec>> = {}) {
	return [
		StarterKit.configure({
			// Body insertion starts at H2, but H1, H5, and H6 in older posts are shown at their original level too.
			heading: { levels: [1, 2, 3, 4, 5, 6] },
			// Use CmsCodeBlock, which preserves `meta` (CMS_SCHEMA_EXTENSIONS).
			codeBlock: false,
			link: { openOnClick: false },
		}),
		...CMS_SCHEMA_EXTENSIONS,
		...Object.values(BLOCK_NODE_VIEWS),
		// Blocks added by block extensions or site config (`editor.view: "node"`).
		...ADDED_BLOCK_NODES,
		// Text styles added by block extensions or site config. The look is provided by the extension (`marks`, block name → look).
		...[...ADDED_MARKS.values()].map((block) => createAddedMark(block, marks[block.name])),
		CmsBlockKeymap,
		// Before the text style extensions above, so it can swallow their shortcuts inside code.
		CodeTextStyleKeys,
		CmsBlockDrag,
		// Last, so its global attribute reaches every block node above.
		CmsBlockIds,
	];
}
