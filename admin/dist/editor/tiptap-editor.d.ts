import { type BodyAllowed } from "@monti-cms/core/client";
import { type StoredDocument } from "@monti-cms/core/document";
import type { Editor } from "@tiptap/core";
import { type ReactNode } from "react";
import { type EditorInsertAction, type EditorSelectionAction } from "../admin-components.js";
interface CmsEditorProps {
    /** The body. The editor shows it; a change that did not come from the editor itself replaces what it shows (the blocks keep the ids the document gives them). */
    doc: StoredDocument;
    /** The body as the editor holds it after every change, as a stored document with the editor's block ids. */
    onChange: (doc: StoredDocument) => void;
    /** Title input for the document being edited. Placed below the formatting tools, above the body. */
    titleField?: ReactNode;
    /** Document action menu placed at the end of the formatting tools. */
    toolbarEnd?: ReactNode;
    /** Right end of the toolbar, apart from the formatting tools (view switch, etc.). */
    toolbarAside?: ReactNode;
    /** When given, shown in place of the body (source editing, etc.) and visual editing is paused. The toolbar and title stay as they are. */
    sourceView?: ReactNode;
    onCompositionStart?: () => void;
    onCompositionEnd?: () => void;
    /** False when the state is not editable, such as the trash. */
    editable?: boolean;
    /** Extra actions beside the block handle (e.g. `번역` on a translation). Shown only when usable on that block. */
    blockActions?: readonly BlockAction[];
    /** Called when the editor is created or destroyed (for document-wide actions from outside). */
    onEditor?: (editor: Editor | null) => void;
    /** Actions to add to the selection menu (plugins). */
    selectionActions?: readonly EditorSelectionAction[];
    /** Insert actions to add to the slash menu (plugins). */
    insertActions?: readonly EditorInsertAction[];
    /**
     * The blocks, marks and heading levels the body allows (`body` of the collection in the schema). The editor offers and accepts only these (toolbar, menus,
     * input rules, paste); a body that already holds something else still opens and saves unchanged. Without it, everything is allowed.
     */
    allowed?: BodyAllowed;
}
/** Action beside the block handle. `pos` is the position of the block the handle points to. */
export interface BlockAction {
    id: string;
    label: string;
    icon: ReactNode;
    isAvailable: (editor: Editor, pos: number) => boolean;
    run: (editor: Editor, pos: number) => void;
    /** Whether the action is in progress on that block. */
    isBusy?: (pos: number) => boolean;
}
export declare function CmsEditor({ doc, onChange, titleField, toolbarEnd, toolbarAside, sourceView, onCompositionStart, onCompositionEnd, editable, blockActions, onEditor, selectionActions, insertActions, allowed, }: CmsEditorProps): import("react").JSX.Element | null;
export {};
