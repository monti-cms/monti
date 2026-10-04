import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";
import { createCodeHighlighter, highlight as defaultHighlight, } from "./code-highlighter.js";
const hasHighlighterOptions = (options) => options.langs !== undefined || options.themes !== undefined || options.langAlias !== undefined;
function findCodeChild(pre) {
    const child = pre.children?.find((c) => c?.type === "element" && c.tagName === "code");
    return child ?? null;
}
function getLangFromCodeEl(codeEl) {
    const cn = codeEl.properties?.className;
    const classes = Array.isArray(cn) ? cn : cn ? [cn] : [];
    const lang = classes
        .map(String)
        .find((c) => c.startsWith("language-"))
        ?.slice("language-".length);
    return lang || "text";
}
export function rehypeShikiDecorationRender(options = {}) {
    // Create a new highlighter only when languages or themes were changed (once). Otherwise use the default highlighter as is.
    const customHighlight = options.highlight || !hasHighlighterOptions(options)
        ? null
        : createCodeHighlighter(options).then((highlighter) => highlighter.highlight);
    return async (tree) => {
        const highlight = options.highlight ?? (await customHighlight) ?? defaultHighlight;
        visit(tree, "element", (node, index, parent) => {
            if (!parent || index == null)
                return;
            if (node.tagName !== "pre")
                return;
            const pre = node;
            const codeEl = findCodeChild(pre);
            if (!codeEl)
                return;
            let code = hastToString(codeEl);
            code = code.replace(/\r?\n$/, "");
            const lang = getLangFromCodeEl(codeEl);
            if (options.ignoreLang?.(lang))
                return;
            const metaStr = (pre.properties?.["data-meta"] ?? codeEl.properties?.["data-meta"]);
            const decoratonStr = (pre.properties?.["data-decorations"] ?? codeEl.properties?.["data-decorations"]);
            const lineDecorationStr = (pre.properties?.["data-line-decorations"] ??
                codeEl.properties?.["data-line-decorations"]);
            const rowWrapperStr = (pre.properties?.["data-line-wrappers"] ?? codeEl.properties?.["data-line-wrappers"]);
            const renderTagsStr = (pre.properties?.["data-render-tags"] ?? codeEl.properties?.["data-render-tags"]);
            const meta = metaStr ? JSON.parse(metaStr) : {};
            const decorations = decoratonStr ? JSON.parse(decoratonStr) : [];
            const lineDecorations = lineDecorationStr ? JSON.parse(lineDecorationStr) : [];
            const rowWrappers = rowWrapperStr ? JSON.parse(rowWrapperStr) : [];
            const allowedRenderTags = renderTagsStr ? JSON.parse(renderTagsStr) : [];
            const hast = highlight(code, lang, meta, {
                decorations,
                lineDecorations,
                rowWrappers,
                allowedRenderTags,
            });
            // The codeToHast result is a Root (fragment). Usually the first element is the <pre>
            const newPre = hast.children.find((n) => n.type === "element");
            // Replace the existing <pre> with the new <pre>
            parent.children[index] = newPre;
        });
    };
}
