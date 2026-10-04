import { type TextChecker } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { type TextCheckPluginState } from "./plugin.js";
import { type DocTextIssue } from "./run.js";
/** Auto check (`auto: true`) runs once input pauses for this long. */
export declare const AUTO_CHECK_DELAY = 1500;
export interface TextCheckController {
    readonly editor: Editor;
    /** Name tag for this check's underline plugin (separate per check extension). */
    readonly pluginKey: PluginKey<TextCheckPluginState>;
    /** Checkers that check the language of this text. */
    readonly checkers: readonly TextChecker[];
    /** `id` of the checker currently running (a check opened with the button). `null` if none. */
    readonly running: string | null;
    readonly issues: readonly DocTextIssue[];
    /** The open result window. With `focus`, focus moves into the window (when picked from the list). */
    readonly open: {
        readonly key: string;
        readonly focus: boolean;
    } | null;
    /** Checks with one checker (`id`). */
    readonly run: (checkerId: string) => Promise<void>;
    readonly close: () => void;
    readonly jump: (issue: DocTextIssue) => void;
    readonly apply: (issue: DocTextIssue, suggestion: string) => void;
    readonly ignore: (issue: DocTextIssue) => void;
}
/**
 * Spelling and sentence check for the editor. If no checker handles the language of the text, this is `null` and does nothing.
 *
 * - The button (`run`) runs a check. With selected text, only the paragraphs spanning that range are checked; otherwise the whole document.
 * - Only checkers with `auto: true` automatically check changed paragraphs once input pauses.
 * - A paragraph with the same text is not sent again (cache per checker, language and text). Re-checking or closing aborts in-flight requests.
 */
export declare function useTextCheck(editor: Editor | null, { checkers: registered, locale }: {
    checkers: readonly TextChecker[];
    locale: string;
}): TextCheckController | null;
