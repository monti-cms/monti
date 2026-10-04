import { CODE_BLOCK_MARKS } from "@monti-cms/core/code-block";
import { CodeBlock } from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockView } from "./code-block-view.js";
import { createCodeEffectsPlugin } from "./effects-plugin.js";
import { createCodeBlockHighlightPlugin } from "./highlight-plugin.js";
import { createCodeBlockKeysPlugin } from "./keys.js";
const hidden = (value) => ({ default: value, rendered: false });
/**
 * CMS code block. Allows text effect marks on the code text (`CODE_BLOCK_MARKS`); line effects and regex rules live in attributes (model.ts).
 * `source`/`sourceKey` are the loaded source and the model fingerprint at that time. If unchanged, the source is saved as is.
 * With `rawMode`, the code has annotations the editor cannot display, so even annotation lines are edited as source.
 */
export const CmsCodeBlock = CodeBlock.extend({
    name: "codeBlock",
    marks: CODE_BLOCK_MARKS,
    addAttributes() {
        return {
            ...this.parent?.(),
            meta: hidden(null),
            lineEffects: hidden([]),
            rules: hidden([]),
            source: hidden(null),
            sourceKey: hidden(null),
            rawMode: hidden(false),
        };
    },
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockView, {
            // Presses and drags on the header tools, line number column, and line menu are not handled by the editor (selection, block selection).
            stopEvent: ({ event }) => event.target instanceof Element && event.target.closest("[data-code-ui]") !== null,
        });
    },
    addProseMirrorPlugins() {
        return [
            ...(this.parent?.() ?? []),
            createCodeBlockKeysPlugin(),
            createCodeBlockHighlightPlugin(),
            createCodeEffectsPlugin(),
        ];
    },
});
