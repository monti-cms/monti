import { entryIdOfMark, withoutBlockIds, } from "@monti-cms/core/document";
import { defineFormat, } from "@monti-cms/core/format";
import { bodyFromMdx, documentToMdx } from "./body.js";
import { NO_SYNTAX } from "./syntax-config.js";
/**
 * The `mdx` format: the stored document written as MDX (CommonMark + GFM + standard MDX JSX, and the syntax extensions it is given) and read back. It is
 * the format a site picks with `format: "mdx"`, the notation of the source panel in the admin and the text the AI plugin's model reads and writes.
 *
 * Both directions are pure functions of their arguments (the site's blocks and rules are the only things they read, from the site in the context core gives
 * them), so the format runs on the server and in the browser alike.
 */
/**
 * The marks of a text with its internal links resolved: a link by id becomes a link to the real path of its target. A link that cannot be resolved is
 * dropped for a reader (the label stays) and kept as its id for a text that will be imported again. Returns `undefined` when no mark changed.
 */
const resolveMarks = (marks, ctx) => {
    let changed = false;
    const next = [];
    for (const mark of marks) {
        const entryId = entryIdOfMark(mark);
        if (!entryId) {
            next.push(mark);
            continue;
        }
        changed = true;
        const link = ctx.link(entryId);
        if (link) {
            next.push({ attrs: { href: link.url }, type: "link" });
            continue;
        }
        ctx.report({ code: "unresolved_internal_link", message: entryId, params: { entryId } });
        // A text to read (a site, a feed) cannot use an id of this database, so the link is dropped and its label stays. A text to import again keeps the id.
        if (ctx.purpose === "sync")
            next.push(mark);
    }
    return changed ? next : undefined;
};
const fileLabel = (node, filename) => typeof node.attrs?.label === "string" && node.attrs.label.trim() ? node.attrs.label : filename;
/** The document as a reader of the text needs it: internal links by address, registered images by URL. */
const resolveNodes = (nodes, ctx) => nodes.map((node) => {
    let next = node;
    if (node.marks) {
        const marks = resolveMarks(node.marks, ctx);
        if (marks)
            next = { ...next, ...(marks.length > 0 ? { marks } : {}) };
        if (marks && marks.length === 0) {
            const { marks: _dropped, ...rest } = next;
            next = rest;
        }
    }
    const mediaId = typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : undefined;
    if (mediaId && ctx.purpose === "read" && (node.type === "image" || node.type === "file")) {
        const media = ctx.media(mediaId);
        if (!media) {
            ctx.report({ code: "unresolved_media", message: mediaId, params: { mediaId } });
        }
        else if (node.type === "image") {
            const { mediaId: _mediaId, ...attrs } = node.attrs ?? {};
            next = { ...next, attrs: { ...attrs, src: media.url } };
        }
        else {
            // An attachment card is drawn by the site's own components; outside it, the file is a link to its URL.
            next = {
                content: [
                    {
                        marks: [{ attrs: { href: media.url }, type: "link" }],
                        text: fileLabel(node, media.filename),
                        type: "text",
                    },
                ],
                type: "paragraph",
            };
        }
    }
    if (next.content) {
        const content = resolveNodes(next.content, ctx);
        next = { ...next, content };
    }
    return next;
});
/** The `mdx` format reading and writing with the given syntax extensions. */
export const createMdxFormat = (options = {}) => {
    const syntax = options.syntax ?? NO_SYNTAX;
    const exportDocument = (doc, ctx) => documentToMdx(ctx.site, { ...doc, content: resolveNodes(doc.content, ctx) }, syntax);
    const importText = (text, ctx) => {
        const body = bodyFromMdx(ctx.site, text, syntax);
        if (body.doc) {
            const { doc } = body;
            const warnings = (body.outOfRange ?? []).map((item) => {
                const blockIndex = doc.content.findIndex((block) => block.id === item.blockId);
                return {
                    code: "code_annotation_out_of_range",
                    message: item.name,
                    params: { name: item.name },
                    ...(blockIndex < 0 ? {} : { blockIndex }),
                };
            });
            // Block ids are core's to give: the ones the parser made are dropped.
            return { ok: true, doc: { ...doc, content: withoutBlockIds(doc.content) }, warnings };
        }
        const { analysis } = body;
        const issues = analysis.errors.map((error) => ({
            code: "mdx_error",
            message: error.message,
            params: { reason: error.code, ...error.params },
            position: { line: error.position.line, column: error.position.column },
        }));
        if (analysis.frontmatter !== null)
            issues.push({ code: "frontmatter_present", position: { line: 1, column: 1 } });
        return { ok: false, issues };
    };
    return defineFormat({
        name: "mdx",
        label: "MDX",
        mimeType: "text/mdx",
        extension: "mdx",
        export: exportDocument,
        import: importText,
    });
};
/** The `mdx` format with no syntax extension (standard MDX). It holds nothing of a site: it reads the site from the context of each call. A site with extensions gets its own from `mdx({ syntax })`. */
export const mdxFormat = createMdxFormat();
export { analyze } from "./analyze.js";
export { bodyDocument, bodyFromDocument, bodyFromMdx, documentToMdx, fromStoredDocument, toStoredDocument, } from "./body.js";
export * from "./directives.js";
export { mdxMessages } from "./messages.js";
export { parseMdxAst } from "./parse.js";
export { jsxRegistryOf, RETIRED_JSX_NAMES } from "./registry.js";
export { remarkFenceBlocksToMdx } from "./remark-fence-blocks.js";
export { serialize } from "./serialize.js";
export { insertSoftBreaks } from "./soft-breaks.js";
export { configuredSyntax, NO_SYNTAX, siteCodeLineEffects, siteSyntaxBlocks, syntaxRemarkPlugins, } from "./syntax-config.js";
export { toDocument } from "./to-document.js";
export { compareMdxStructure, readableMdx } from "./translation-check.js";
