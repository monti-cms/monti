/**
 * Definitions of the formatting tools in the toolbar (block shapes, text styles, alignment, lists, block inserts)
 * and the order in which the toolbar places its entries.
 */
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import type { TranslatorFor } from "../translator.js";
import { type EditorAllowance } from "./allowed.js";
import type { editorMessages } from "./messages.js";
import type { ToolbarItem } from "./toolbar-button.js";
import type { ToolbarEntry } from "./toolbar-row.js";
export declare const chain: (editor: Editor) => import("@tiptap/core").ChainedCommands;
/** Block shape dropdown. The current block's shape name becomes the dropdown name. */
export declare const BLOCK_STYLES: (t: TranslatorFor<typeof editorMessages>, allowance?: EditorAllowance) => ToolbarItem[];
export declare const inlineTools: (site: Site, allowance?: EditorAllowance) => import("./inline-marks.js").InlineMarkTool[];
export declare const scriptTools: (site: Site, allowance?: EditorAllowance) => import("./inline-marks.js").InlineMarkTool[];
/** Order in which text-style buttons are hidden (largest first). Marks not listed get 5. Bold and italic are never hidden. */
export declare const INLINE_PRIORITY: Readonly<Record<string, number>>;
export declare const PINNED_INLINE_MARKS: string[];
export declare const ALIGN_TOOLS: (t: TranslatorFor<typeof editorMessages>) => ToolbarItem[];
/** List dropdown. The current block's list type becomes the dropdown name and icon. */
export declare const LIST_STYLES: (t: TranslatorFor<typeof editorMessages>, allowance?: EditorAllowance) => ToolbarItem[];
/** Block insert buttons and the order they are hidden (largest first). Lists are 2, components are 4. */
export declare const INSERT_TOOLS: (t: TranslatorFor<typeof editorMessages>, allowance?: EditorAllowance) => {
    tool: ToolbarItem;
    priority: number;
}[];
/** Inline footnote reference (plus its definition at the end of the page), the same action as the slash command. */
export declare const FOOTNOTE_TOOL: (t: TranslatorFor<typeof editorMessages>) => ToolbarItem;
export declare const DIVIDER_TOOL: (t: TranslatorFor<typeof editorMessages>) => ToolbarItem;
/** Toolbar slot name for a text-style extension (`mark:<block name>`). */
export declare const markToolKey: (group: "format" | "link", name: string) => string;
export declare const orderToolbar: (t: TranslatorFor<typeof editorMessages>, entries: readonly ToolbarEntry[]) => ToolbarEntry[];
