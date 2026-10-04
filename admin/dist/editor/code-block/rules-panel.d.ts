import { type CodeRule } from "@monti-cms/core/code-block";
interface RulesPanelProps {
    rules: CodeRule[];
    text: string;
    lineCount: number;
    /** The text picked in this code block now and its line (initial value of a new rule). */
    selection: {
        text: string;
    } | null;
    /** Code language (passed to the placeholder behavior). */
    language?: string | null;
    /** Value pointing to this code block. Even if the panel is closed, the AI result stays on this block. */
    slotScope?: string;
    onChange: (next: CodeRule[]) => void;
}
/**
 * List of regex rules (`// @document fold {re:/.../}`, etc.). Even if the code is edited, rules find and apply the effect again.
 * If text is picked, "Add rule" starts as a rule that finds that text.
 */
export declare function RulesPanel({ rules, text, lineCount, selection, language, slotScope, onChange }: RulesPanelProps): import("react").JSX.Element;
export {};
