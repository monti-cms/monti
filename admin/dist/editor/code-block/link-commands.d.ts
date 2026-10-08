import type { Site } from "@monti-cms/core/client";
import type { Node as PmNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
export interface AnchorInfo {
    id: string;
    blockPos: number;
    start: number;
    end: number;
    title: string;
}
/** Code lines that have a label `id`. */
export declare function findAnchor(doc: PmNode, id: string): AnchorInfo | null;
/** A name not yet used (`c1`, `c2`, ...). Avoids names used by both labels and body links. */
export declare function nextAnchorId(site: Site, doc: PmNode): string;
/** Starts linking by picking body text (from~to) first. Then pick a code line in the line number column. */
export declare const startLinkFromText: (view: EditorView, from: number, to: number) => void;
/** Starts linking by picking a code line first. Then drag to pick body text. */
export declare const startLinkFromLines: (view: EditorView, blockPos: number, start: number, end: number) => void;
export declare const cancelLink: (view: EditorView) => void;
/** Body-side range. The text picked first, otherwise the currently picked text (outside code blocks, a non-empty selection). */
export declare function linkTextRange(view: EditorView): {
    from: number;
    to: number;
} | null;
/** Code-side line. The line picked first, otherwise the line currently picked in the line number column. */
export declare function linkLines(view: EditorView): {
    blockPos: number;
    start: number;
    end: number;
} | null;
/** Links the picked body text to the code line. Reuses the label if the same line already has one. */
export declare function commitLink(site: Site, view: EditorView): boolean;
/** Removes a body link (from~to). Also removes line labels no link points to anymore. */
export declare function unlinkRef(site: Site, view: EditorView, from: number, to: number): void;
