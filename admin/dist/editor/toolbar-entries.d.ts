/**
 * Assembles the toolbar entries of the visual editor from the tool definitions: which slots exist for the body's allowance,
 * their hide priority, how each renders in the bar and in the "More" menu, and the final placement order.
 */
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import type { commonMessages } from "../lib/common.messages.js";
import type { TranslatorFor } from "../translator.js";
import type { EditorAllowance } from "./allowed.js";
import type { useMarkExtensions } from "./inline-bubble.js";
import { type LinkDraft } from "./link-form.js";
import type { editorMessages } from "./messages.js";
import { type ToolbarItem } from "./toolbar-button.js";
import { type ToolbarEntry } from "./toolbar-row.js";
export interface ToolbarEntryContext {
    editor: Editor;
    site: Site;
    t: TranslatorFor<typeof editorMessages>;
    tc: TranslatorFor<typeof commonMessages>;
    allowance: EditorAllowance;
    canEdit: boolean;
    /** Text-style extensions present in this editor's schema. */
    markExtensions: ReturnType<typeof useMarkExtensions>;
    /** Name of the current block shape (the block dropdown label). */
    blockStyle: string;
    activeList: ToolbarItem | undefined;
    activeAlign: ToolbarItem | undefined;
    linkDraft: LinkDraft | null;
    setLinkDraft: (draft: LinkDraft | null) => void;
    openImageDialog: () => void;
    openFilePicker: () => void;
}
export declare const buildToolbarEntries: ({ editor, site, t, tc, allowance, canEdit, markExtensions, blockStyle, activeList, activeAlign, linkDraft, setLinkDraft, openImageDialog, openFilePicker, }: ToolbarEntryContext) => ToolbarEntry[];
