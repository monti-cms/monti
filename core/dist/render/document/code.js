import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { parseCodeFenceMeta } from "../../annotation/code-block/code-fence-to-document.js";
import { codeBlockDocumentOf } from "../../doc/stored-code-block.js";
import { createAllowedRenderTagsFromConfig, createCodeHighlighter, fromCodeBlockDocumentToShikiAnnotationPayload, showsLineNumbers, siteHighlight, } from "../code/index.js";
const hasHighlighterOptions = (options) => options.langs !== undefined || options.themes !== undefined || options.langAlias !== undefined;
const customHighlighters = new WeakMap();
/** The function that highlights for the given code options: theirs, one built from their languages and themes, or the site's. */
export const highlighterFor = (site, options) => {
    if (!options)
        return siteHighlight(site);
    if (options.highlight)
        return options.highlight;
    if (!hasHighlighterOptions(options))
        return siteHighlight(site);
    let created = customHighlighters.get(options);
    if (!created) {
        created = createCodeHighlighter(options).then((highlighter) => highlighter.highlight);
        customHighlighters.set(options, created);
    }
    return created;
};
// `tabindex` is left out: the MDX frame (`CmsPre`) never set it, so the markup stays the same.
const PRE_PROPERTIES = new Set(["class", "className", "style"]);
const parseNotes = (value) => {
    if (typeof value !== "string")
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
};
const plainPre = (code) => ({
    type: "element",
    tagName: "pre",
    properties: {},
    children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: code }] }],
});
const stringOf = (value) => (typeof value === "string" ? value : "");
/** The language, code, title and annotations a stored code block holds, as plain values. */
export const readCodeBlock = (node) => {
    const attrs = node.attrs ?? {};
    const annotations = attrs.annotations;
    const meta = stringOf(attrs.meta);
    const title = parseCodeFenceMeta(meta).title;
    return {
        language: stringOf(attrs.language),
        code: stringOf(attrs.code),
        meta,
        /** The file name (`title="src/a.ts"` in the fence meta). */
        title: typeof title === "string" ? title : undefined,
        annotations: (annotations && typeof annotations === "object" && !Array.isArray(annotations)
            ? annotations
            : {}),
    };
};
/** Highlights one stored code block. It never throws: code that cannot be annotated or highlighted is shown as plain text. */
export const highlightCodeBlock = (site, node, highlight, options) => {
    const { language, code } = readCodeBlock(node);
    const lang = language || "text";
    try {
        const document = codeBlockDocumentOf(site, node.attrs ?? {});
        const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, site.annotationConfig);
        const title = typeof payload.meta.title === "string" ? payload.meta.title : undefined;
        const numbered = showsLineNumbers(payload.meta);
        const base = { code: payload.code, language: lang, showLineNumbers: numbered, ...(title ? { title } : {}) };
        if (options?.ignoreLang?.(lang))
            return { ...base, pre: plainPre(payload.code), notes: [] };
        const root = highlight(payload.code, lang, payload.meta, {
            decorations: payload.decorations,
            lineDecorations: payload.lineDecorations,
            rowWrappers: payload.rowWrappers,
            allowedRenderTags: createAllowedRenderTagsFromConfig(site.annotationConfig),
        });
        const found = root.children.find((child) => child.type === "element");
        if (!found)
            return { ...base, pre: plainPre(payload.code), notes: [] };
        const properties = {};
        for (const [key, value] of Object.entries(found.properties ?? {})) {
            if (PRE_PROPERTIES.has(key))
                properties[key] = value;
        }
        // CSS draws line numbers whenever the attribute exists. If off, the attribute is not set.
        if (numbered)
            properties["data-show-line-numbers"] = "true";
        const pre = { ...found, properties };
        return { ...base, pre, notes: parseNotes(found.properties?.notes) };
    }
    catch {
        const plain = code;
        return {
            code: plain,
            language: lang,
            showLineNumbers: false,
            pre: plainPre(plain),
            notes: [],
        };
    }
};
const PassThrough = ({ children }) => children;
/** The highlighted `<pre>` as React elements. A render tag without a component shows its text. */
export const codePreElement = (site, pre, tags) => {
    const allowed = createAllowedRenderTagsFromConfig(site.annotationConfig);
    const components = {};
    // Only components (`Tooltip`) can be missing: the lowercase tags are HTML elements, or `fold` and `collapse`, which the core defaults draw.
    for (const tag of allowed)
        if (/^[A-Z]/.test(tag))
            components[tag] = PassThrough;
    Object.assign(components, tags);
    return toJsxRuntime(pre, { Fragment, jsx, jsxs, components });
};
