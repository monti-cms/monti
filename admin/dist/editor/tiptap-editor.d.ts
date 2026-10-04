import type { Editor } from "@tiptap/core";
import { type ReactNode } from "react";
import { type EditorInsertAction, type EditorSelectionAction } from "../admin-components.js";
interface CmsEditorProps {
    content: string;
    onChange: (newContent: string) => void;
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
export declare function CmsEditor({ content, onChange, titleField, toolbarEnd, toolbarAside, sourceView, onCompositionStart, onCompositionEnd, editable, blockActions, onEditor, selectionActions, insertActions, }: CmsEditorProps): import("react").JSX.Element | null;
export {};
