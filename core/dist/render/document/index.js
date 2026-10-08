import katex from "katex";
import { imageResolverFromRefs } from "../../doc/document-refs.js";
import { readStoredDocument } from "../../doc/stored-document.js";
import { DEFAULT_LABELS } from "../labels.js";
import { renderModules } from "../plugin-render.js";
import { analyzeDocument, DEFAULT_TOC_RANGE, tocOf } from "./analyze.js";
import { highlightCodeBlock, highlighterFor, readCodeBlock } from "./code.js";
import { defaultDocumentComponents } from "./defaults.js";
import { renderDocumentTree } from "./render.js";
/**
 * JSON renderer (`renderDocument`, `CmsContent`, `tableOfContents`): renders a stored document with React, with no MDX compile and no code execution.
 *
 * Two phases. First an async pre-pass reads the whole document once: heading anchors and the table of contents, footnote numbers, Shiki highlighting of
 * every code block and KaTeX output of every formula. Then a synchronous, pure render turns nodes into elements, so the result is a plain React tree that
 * works in server components and in `renderToStaticMarkup` tests.
 *
 * It never throws on content. An unknown node, mark or block, a block without a component and a node with malformed attributes go through the
 * `fallback` component and are listed in `unknown` (`strict: true` throws instead, for tests and the preview page). Components are layered core defaults →
 * block extensions (`documentComponents` of a plugin's render module) → the site's `components`.
 */
const LAYERED = ["marks", "blocks", "codeTags"];
/** Layers component tables: later ones win, and `marks`, `blocks` and `codeTags` merge by name. */
export const mergeDocumentComponents = (base, ...layers) => {
    const out = { ...base };
    for (const layer of layers) {
        if (!layer)
            continue;
        for (const [key, value] of Object.entries(layer)) {
            if (value === undefined)
                continue;
            out[key] = LAYERED.includes(key)
                ? { ...out[key], ...value }
                : value;
        }
    }
    return out;
};
const resolveComponents = async (options, showFoldedCode) => {
    const context = { locale: options.locale, imageResolver: options.imageResolver };
    const fromPlugins = await Promise.all((await renderModules(options.site)).map(async (module) => typeof module.documentComponents === "function"
        ? (await module.documentComponents(context))
        : undefined));
    return mergeDocumentComponents(defaultDocumentComponents(showFoldedCode), ...fromPlugins, options.components);
};
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** KaTeX output for a block formula (`htmlAndMathml`). A formula KaTeX cannot read still renders (as `rehype-katex` did) and never throws. */
const renderMath = (value) => {
    const settings = { displayMode: true, output: "htmlAndMathml" };
    try {
        return katex.renderToString(value, { ...settings, throwOnError: true });
    }
    catch (error) {
        if (error instanceof Error && error.name === "ParseError") {
            return katex.renderToString(value, { ...settings, strict: "ignore", throwOnError: false });
        }
        return `<span class="katex-error" style="color:#cc0000" title="${escapeHtml(String(error))}">${escapeHtml(value)}</span>`;
    }
};
const collect = (site, nodes, into) => {
    for (const node of nodes) {
        if (node.type === "codeBlock") {
            // A code fence of a block (`mermaid`, `chart`) goes to that block's component, not to the highlighter.
            if (!site.fenceBlockOf(readCodeBlock(node).language))
                into.code.push(node);
        }
        else if (node.type === "math")
            into.math.push(node);
        if (node.content)
            collect(site, node.content, into);
    }
};
const EMPTY = { content: null, toc: [], unknown: [] };
/**
 * Renders a stored document. The result is `content` (a React tree) and `toc`, plus `unknown`: the nodes that reached the fallback (`renderMdx` of `@monti-cms/mdx/render` returns the same).
 * A value that is not a stored document of a known version renders as an empty body (and is logged), never as an error.
 */
export async function renderDocument(input, given) {
    // Images and files are drawn from `refs` unless the site brought its own resolver.
    const options = {
        ...given,
        imageResolver: given.imageResolver ?? (given.refs ? imageResolverFromRefs(given.refs) : undefined),
    };
    const { site } = given;
    const doc = readStoredDocument(input, site);
    if (!doc) {
        console.error("renderDocument: the value is not a stored document of a known version; rendering an empty body");
        return EMPTY;
    }
    const labels = { ...DEFAULT_LABELS, ...options.labels };
    const components = await resolveComponents(options, labels.showFoldedCode);
    const analysis = analyzeDocument(doc);
    // Pre-pass: highlight every code block and render every formula, once.
    const found = { code: [], math: [] };
    collect(site, doc.content, found);
    const highlighted = new Map();
    if (found.code.length > 0) {
        const highlight = await highlighterFor(site, options.code);
        await Promise.all(found.code.map(async (node) => {
            highlighted.set(node, highlightCodeBlock(site, node, highlight, options.code));
        }));
    }
    const math = new Map(found.math.map((node) => [node, renderMath(String(node.attrs?.value ?? ""))]));
    const { content, unknown } = renderDocumentTree(doc.content, {
        analysis,
        highlighted,
        math,
        components,
        ctx: { locale: options.locale, labels },
        options,
        site,
    });
    return { content, toc: tocOf(analysis), unknown };
}
/**
 * The body of an entry as a server component: `<CmsContent cms={cms} entry={entry} />` (the document, its media from `entry.refs`, the language from
 * `entry.locale`, the blocks and code settings of `cms.site`), or `<CmsContent cms={cms} doc={doc} />` for a document on its own. The rest are the options of `renderDocument`, which win over the entry's.
 * An entry without a document renders nothing. The table of contents is not available here; call `renderDocument` or `tableOfContents` for it.
 */
export async function CmsContent({ cms, entry, doc, ...options }) {
    const source = entry ?? { doc };
    if (!source.doc)
        return null;
    return (await renderDocument(source.doc, {
        ...options,
        site: cms.site,
        refs: options.refs ?? source.refs,
        locale: options.locale ?? source.locale,
    })).content;
}
/**
 * The headings of a document with their anchors (pure, no React). `range` is the levels to list; the default is `h2` and `h3`.
 * A missing document (`entry.doc` of a list read without a body) has none.
 */
export function tableOfContents(doc, range = DEFAULT_TOC_RANGE) {
    if (!doc)
        return [];
    const stored = readStoredDocument(doc);
    return stored ? tocOf(analyzeDocument(stored), range) : [];
}
export { collectRefs, imageResolverFromRefs } from "../../doc/document-refs.js";
export { readCodeBlock } from "./code.js";
