import type { Editor } from "@tiptap/core";
import type { InlineBubbleTarget } from "./inline-marks.js";
export interface FootnoteFormProps {
    editor: Editor;
    target: Extract<InlineBubbleTarget, {
        kind: "footnote";
    }>;
    onDone: () => void;
}
/** Updates the footnote definition block text for a given label in the editor document. */
export declare function setFootnoteDefinitionText(editor: Editor, label: string, text: string): boolean;
/** Removes a footnote reference chip and its definition block if no other reference uses the label. */
export declare function removeFootnote(editor: Editor, target: {
    from: number;
    to: number;
    label: string;
}): boolean;
export declare function FootnoteForm({ editor, target, onDone }: FootnoteFormProps): import("react").JSX.Element;
