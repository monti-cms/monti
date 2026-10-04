import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
export const UNTRANSLATED_MARK_NAME = "untranslated";
/** Positions of translation notice text in the text block containing the cursor (paragraph, heading, list item text, etc.). */
const hintRangesAt = (state, pos, type) => {
    const $pos = state.doc.resolve(pos);
    const block = $pos.parent;
    if (!block.isTextblock)
        return [];
    const start = $pos.start();
    const ranges = [];
    block.forEach((child, offset) => {
        if (child.isText && type.isInSet(child.marks)) {
            ranges.push({ from: start + offset, to: start + offset + child.nodeSize });
        }
    });
    return ranges;
};
/** Transaction that removes all notice text. `null` if there is nothing to remove. */
const clearHints = (state, pos, type) => {
    const ranges = hintRangesAt(state, pos, type);
    if (ranges.length === 0)
        return null;
    const tr = state.tr;
    for (const range of [...ranges].reverse())
        tr.delete(range.from, range.to);
    return tr.removeStoredMark(type);
};
/**
 * Translation notice text. A new translation wraps the source text in this mark. It shows dimmed, and when typing starts in that text block
 * (characters, paste, Korean composition, deletion), all notice text is removed at once before the input. `inclusive` is turned off
 * so that characters typed after the notice text do not become notice text.
 */
export const CmsUntranslatedMark = Mark.create({
    name: UNTRANSLATED_MARK_NAME,
    inclusive: false,
    excludes: "",
    parseHTML() {
        return [{ tag: "span[data-untranslated]" }];
    },
    renderHTML({ HTMLAttributes }) {
        return [
            "span",
            mergeAttributes(HTMLAttributes, {
                "data-untranslated": "",
                // This is source text, so do not show the spellcheck underline for the translation language.
                spellcheck: "false",
                class: "text-cms-muted-foreground/70",
            }),
            0,
        ];
    },
    addProseMirrorPlugins() {
        const type = this.type;
        return [
            new Plugin({
                key: new PluginKey("cmsUntranslated"),
                props: {
                    handleTextInput(view, from, to, text) {
                        const tr = clearHints(view.state, from, type);
                        if (!tr)
                            return false;
                        tr.insertText(text, tr.mapping.map(from, -1), tr.mapping.map(to, 1));
                        view.dispatch(tr.scrollIntoView());
                        return true;
                    },
                    handleKeyDown(view, event) {
                        if (event.key !== "Backspace" && event.key !== "Delete")
                            return false;
                        const tr = clearHints(view.state, view.state.selection.from, type);
                        if (!tr)
                            return false;
                        view.dispatch(tr);
                        return true;
                    },
                    handlePaste(view) {
                        // Remove the notice text first, and leave paste to the editor's default handling.
                        const tr = clearHints(view.state, view.state.selection.from, type);
                        if (tr)
                            view.dispatch(tr);
                        return false;
                    },
                    handleDOMEvents: {
                        // Composition input such as Korean must be removed before composition starts, or the composition breaks.
                        compositionstart(view) {
                            const tr = clearHints(view.state, view.state.selection.from, type);
                            if (tr)
                                view.dispatch(tr);
                            return false;
                        },
                    },
                },
            }),
        ];
    },
});
