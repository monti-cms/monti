import type { Site } from "@monti-cms/core/client";
import StarterKit from "@tiptap/starter-kit";
import { addedMarksOf, createAddedMark, type EditorMarkSpec } from "./added-marks";
import { CmsBlockKeymap } from "./block-commands";
import { CmsBlockIds } from "./block-ids";
import { BLOCK_NODES } from "./block-views";
import { addedBlockNodes } from "./blocks/added";
import { codeTextStyleKeys } from "./code-block/text-style-keys";
import { CmsBlockDrag } from "./drag";
import { CmsLinkEntryId } from "./link-entry-id";
import { cmsSchemaExtensions } from "./tiptap-schema";

/**
 * Editor extension assembly. Feature extensions (key handling, drag, plugins) are added to this list.
 * Schema nodes go in `tiptap-schema.ts`, core block nodes (image, file, math) in `block-views.ts`,
 * and CmsNode ↔ Tiptap conversion in `converters/`. The look of added text styles (`marks`) is provided by the admin extension (`CmsAdminComponents.marks`).
 */
export function buildEditorExtensions(site: Site, marks: Readonly<Record<string, EditorMarkSpec>> = {}) {
	return [
		StarterKit.configure({
			// Body insertion starts at H2, but H1, H5, and H6 in older posts are shown at their original level too.
			heading: { levels: [1, 2, 3, 4, 5, 6] },
			// Use CmsCodeBlock, which preserves `meta` (`cmsSchemaExtensions`).
			codeBlock: false,
			link: { openOnClick: false },
		}),
		CmsLinkEntryId,
		...cmsSchemaExtensions(site),
		...Object.values(BLOCK_NODES),
		// Blocks added by block extensions or site config (`editor.view: "node"`).
		...addedBlockNodes(site),
		// Text styles added by block extensions or site config. The look is provided by the extension (`marks`, block name → look).
		...[...addedMarksOf(site).values()].map((block) => createAddedMark(block, marks[block.name])),
		CmsBlockKeymap,
		// Before the text style extensions above, so it can swallow their shortcuts inside code.
		codeTextStyleKeys(site),
		CmsBlockDrag,
		// Last, so its global attribute reaches every block node above.
		CmsBlockIds,
	];
}
