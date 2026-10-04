/**
 * Effect model of the editor code block.
 *
 * - Text effects (bold, italic, strikethrough, underline, tooltip, text folding) are ProseMirror marks on the code text. When edited, marks follow the text.
 * - Line effects (effects in the definition list plus line folding and the body-link label) are line ranges in the node attribute `lineEffects`. Definitions are in `line-effects.ts`.
 * - Regex rules (`{re:/.../}`) are the node attribute `rules`. Stored as the rule itself, not as the found positions.
 *
 * The storage format is the code fence comment syntax (this folder), and the editor conversion is `editor/converters/code-block.ts` in the admin package.
 * This file does not read the site config. The site's line effect list is in `active.ts`.
 */
/** Text effects: comment name ↔ editor mark. */
export declare const CODE_CHAR_EFFECTS: readonly [{
    readonly name: "strong";
    readonly mark: "bold";
    readonly label: string;
}, {
    readonly name: "em";
    readonly mark: "italic";
    readonly label: string;
}, {
    readonly name: "del";
    readonly mark: "strike";
    readonly label: string;
}, {
    readonly name: "u";
    readonly mark: "underline";
    readonly label: string;
}, {
    readonly name: "Tooltip";
    readonly mark: "codeTooltip";
    readonly label: string;
}, {
    readonly name: "fold";
    readonly mark: "codeFold";
    readonly label: string;
}];
export type CodeCharEffectName = (typeof CODE_CHAR_EFFECTS)[number]["name"];
/** Marks allowed inside a code block. */
export declare const CODE_BLOCK_MARKS: string;
export declare const charEffectByName: (name: string) => {
    readonly name: "strong";
    readonly mark: "bold";
    readonly label: string;
} | {
    readonly name: "em";
    readonly mark: "italic";
    readonly label: string;
} | {
    readonly name: "del";
    readonly mark: "strike";
    readonly label: string;
} | {
    readonly name: "u";
    readonly mark: "underline";
    readonly label: string;
} | {
    readonly name: "Tooltip";
    readonly mark: "codeTooltip";
    readonly label: string;
} | {
    readonly name: "fold";
    readonly mark: "codeFold";
    readonly label: string;
} | undefined;
export declare const charEffectByMark: (mark: string) => {
    readonly name: "strong";
    readonly mark: "bold";
    readonly label: string;
} | {
    readonly name: "em";
    readonly mark: "italic";
    readonly label: string;
} | {
    readonly name: "del";
    readonly mark: "strike";
    readonly label: string;
} | {
    readonly name: "u";
    readonly mark: "underline";
    readonly label: string;
} | {
    readonly name: "Tooltip";
    readonly mark: "codeTooltip";
    readonly label: string;
} | {
    readonly name: "fold";
    readonly mark: "codeFold";
    readonly label: string;
} | undefined;
/** Line effect names. The names in the definition list (`CODE_LINE_EFFECTS`, toggled one line at a time), plus `collapse` and `anchor`. */
export type CodeLineEffectName = string;
export declare const COLLAPSE = "collapse";
/** Line label that the body's `:code-ref` points to (`attrs.id`). Moves along with the text, like line effects. */
export declare const ANCHOR = "anchor";
/** One line effect. `start`~`end` are line numbers (0-based, `end` exclusive). */
export interface CodeLineEffect {
    id: string;
    name: CodeLineEffectName;
    start: number;
    end: number;
    /** Carries known attributes (`open`) and unknown attributes through unchanged. */
    attrs: Record<string, unknown>;
}
/** One regex rule. `char` finds only on line `line`; `document` finds across the whole code. */
export interface CodeRule {
    id: string;
    scope: "char" | "document";
    name: CodeCharEffectName;
    pattern: string;
    flags: string;
    line?: number;
    attrs: Record<string, unknown>;
}
/** Range of a text effect over the code text (marks converted to comment names). */
export interface CodeSpan {
    name: CodeCharEffectName;
    from: number;
    to: number;
    attrs: Record<string, unknown>;
}
export declare const newEffectId: () => string;
/** Start offset of each line. There is no line after the last element. */
export declare function lineStarts(text: string): number[];
/** Line number containing `offset`. */
export declare function lineAt(starts: readonly number[], offset: number): number;
/** [start, end) of line `line` — end is before the line break. */
export declare function lineRange(text: string, starts: readonly number[], line: number): {
    from: number;
    to: number;
};
/** Whether the regex is valid. Returns the reason if not. */
export declare function checkPattern(pattern: string, flags: string): string | null;
/** The range a rule found (positions in code text). Found the same way as the public view (empty matches are skipped). */
export declare function ruleMatches(rule: CodeRule, text: string, starts?: number[]): Array<{
    from: number;
    to: number;
}>;
/** A regex that matches the selected text literally. */
export declare const escapePattern: (text: string) => string;
/**
 * Turns one line effect (`name`) on or off for lines `start`~`end`. Ranges of the same effect merge, and turning off cuts them out.
 * Line folding is handled by `addCollapse`.
 */
export declare function setLineEffect(effects: readonly CodeLineEffect[], name: CodeLineEffectName, start: number, end: number, on: boolean): CodeLineEffect[];
/** Whether every line has this effect. */
export declare function hasLineEffect(effects: readonly CodeLineEffect[], name: string, start: number, end: number): boolean;
/**
 * Whether a line fold can be added. Folds must not overlap each other (one must be fully inside the other, or they must be separate).
 * This is because the public view wraps folds in `<details>`.
 */
export declare function canAddCollapse(effects: readonly CodeLineEffect[], start: number, end: number): string | null;
/** Clips ranges to stay within the code after the line count changes. Drops empty ranges. */
export declare function clampLineEffects(effects: readonly CodeLineEffect[], lineCount: number): CodeLineEffect[];
/** Model content that determines the saved result (excluding IDs). Used to save the source as is if nothing changed after loading. */
export declare function modelFingerprint(model: {
    language: string | null;
    text: string;
    spans: readonly CodeSpan[];
    lineEffects: readonly CodeLineEffect[];
    rules: readonly CodeRule[];
}): string;
