import { type EditorState, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { DocTextIssue } from "./run.js";
/**
 * ProseMirror plugin that draws check results as wavy underlines (decorations). Results follow their positions as the document changes,
 * and editing inside a result range (including touching edges) removes that result.
 */
export interface TextCheckPluginState {
    readonly issues: readonly DocTextIssue[];
    readonly decorations: DecorationSet;
}
export type TextCheckMeta = 
/** Replaces the results of `checkerIds` that span `ranges` with `issues`. */
{
    readonly type: "replace";
    readonly checkerIds: readonly string[];
    readonly ranges: readonly {
        readonly from: number;
        readonly to: number;
    }[];
    readonly issues: readonly DocTextIssue[];
} | {
    readonly type: "remove";
    readonly keys: readonly string[];
} | {
    readonly type: "clear";
};
/** Default plugin name tag. Created separately per check extension (`new PluginKey`) so they do not collide. */
export declare const textCheckPluginKey: PluginKey<TextCheckPluginState>;
/** Moves result positions along with document changes. Results that overlap or touch the changed range are dropped. */
export declare function mapIssues(issues: readonly DocTextIssue[], tr: Transaction): readonly DocTextIssue[];
/** The result covering that position (the shortest one). */
export declare function issueAt(state: EditorState, pos: number, key?: PluginKey<TextCheckPluginState>): DocTextIssue | null;
export declare function createTextCheckPlugin({ key, onIssueClick, }?: {
    key?: PluginKey<TextCheckPluginState>;
    onIssueClick?: (issue: DocTextIssue, view: EditorView) => void;
}): Plugin<TextCheckPluginState>;
export declare const textCheckIssues: (state: EditorState, key?: PluginKey<TextCheckPluginState>) => readonly DocTextIssue[];
