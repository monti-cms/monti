import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createElement } from "react";
import { CmsCodeCollapse, CmsCodeFold } from "../components/code-lines.js";
import { CmsCopyButton } from "../components/copy-button.js";
import { CmsFile } from "../components/file.js";
import { CmsImage } from "../components/image.js";
import { CmsLink } from "../components/link.js";
import { CmsTextAlign } from "../components/text-align.js";
/**
 * The core default components of the JSON renderer. Their markup is what the MDX chain produced (`remark-gfm`, `rehype-slug`,
 * `rehype-autolink-headings`, `rehype-katex` and the `Cms*` components), so the page looks the same and `render.css` keeps working.
 */
const Paragraph = ({ children }) => _jsx("p", { children: children });
/**
 * The link on a heading. It is hidden from assistive technology (the heading is the name) and the icon is drawn by CSS. It is made with `createElement`
 * because the accessibility lint for links with no text does not know that.
 */
const HeadingAnchor = ({ id }) => createElement("a", { href: `#${id}`, "aria-hidden": "true", tabIndex: -1 }, createElement("span", { className: "icon icon-link" }));
const Heading = ({ level, id, children }) => {
    const Tag = `h${level}`;
    return (_jsxs(Tag, { id: id, children: [id ? _jsx(HeadingAnchor, { id: id }) : null, children] }));
};
const List = ({ ordered, start, tasks, children }) => ordered ? (_jsx("ol", { start: start !== undefined && start !== 1 ? start : undefined, children: children })) : (_jsx("ul", { className: tasks ? "contains-task-list" : undefined, children: children }));
const ListItem = ({ checked, children }) => (_jsx("li", { className: checked === undefined ? undefined : "task-list-item", children: children }));
const Blockquote = ({ children }) => _jsx("blockquote", { children: children });
const HorizontalRule = (_) => _jsx("hr", {});
const HardBreak = (_) => _jsx("br", {});
const CodeBlock = ({ title, code, notes, children, ctx }) => {
    const path = title?.trim().split("/").filter(Boolean) ?? [];
    return (_jsxs("div", { className: "cms-code", children: [path.length > 0 ? (_jsx("div", { className: "cms-code-title", "data-title": title, children: path.map((part, index) => (_jsxs("span", { className: index === path.length - 1 ? "cms-code-title-file" : undefined, children: [part, index < path.length - 1 ? " / " : ""] }, `${index}-${part}`))) })) : null, children, code ? _jsx(CmsCopyButton, { text: code, label: ctx.labels.copyCode, copiedLabel: ctx.labels.copied }) : null, notes.length > 0 ? (_jsx("ol", { className: "cms-code-notes", "aria-label": ctx.labels.codeNotes, children: notes.map((note, index) => (_jsxs("li", { children: [_jsx("span", { className: "cms-code-note-number", children: index + 1 }), _jsx("span", { children: note })] }, index))) })) : null] }));
};
const Image = ({ src, alt, title, caption, decorative, align, width, crop, rotate, intrinsic, failure, plain, inline, node, ctx, }) => {
    if (plain && src) {
        // A Markdown image: just the picture (a block of its own sits in a paragraph, as Markdown makes it).
        // biome-ignore lint/performance/noImgElement: public addresses differ per site, so next/image is not used
        const image = _jsx("img", { src: src, alt: alt, title: title });
        return inline ? image : _jsx("p", { children: image });
    }
    const result = src
        ? { url: src, width: intrinsic?.width, height: intrinsic?.height }
        : { failure: failure ?? "unresolved" };
    return (_jsx(CmsImage, { src: src, alt: alt, width: width, align: align, caption: caption, decorative: decorative, crop: crop, rotate: rotate, title: title, resolve: () => result, unavailableLabel: ctx.labels.imageUnavailable, mediaId: typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : undefined }));
};
const File = ({ mediaId, label, url, filename, byteSize, mimeType, failure, ctx }) => {
    const result = url
        ? { url, file: { filename: filename ?? label, byteSize: byteSize ?? null, mimeType: mimeType ?? null } }
        : { failure: failure ?? "unresolved" };
    return (_jsx(CmsFile, { mediaId: mediaId ?? "", label: label, resolve: () => result, downloadLabel: ctx.labels.download, unavailableLabel: ctx.labels.fileUnavailable }));
};
const TextAlign = ({ align, children }) => _jsx(CmsTextAlign, { align: align, children: children });
const Table = ({ columns, widths, hasHead, head, body }) => {
    // Same as the editor (prosemirror-tables): if all column widths are known, use the total width; if only some, use a minimum width.
    const known = Array.from({ length: columns }, (_, index) => widths[index] ?? null);
    const total = known.reduce((sum, width) => sum + (width ?? 0), 0);
    const style = widths.length === 0 || columns === 0
        ? undefined
        : known.every((width) => width !== null)
            ? { width: total, maxWidth: "none" }
            : { minWidth: total };
    // No border or background is set separately. It takes the same prose table style as a default (GFM) table.
    return (_jsx("div", { className: "cms-table-scroll", children: _jsxs("table", { className: ["cms-table", style?.width ? null : "cms-table-full"].filter(Boolean).join(" "), style: style, children: [widths.length > 0 && columns > 0 ? (_jsx("colgroup", { children: known.map((width, index) => (_jsx("col", { style: width ? { width } : undefined }, index))) })) : null, hasHead ? _jsx("thead", { children: head }) : null, _jsx("tbody", { children: body })] }) }));
};
const TableRow = ({ children }) => _jsx("tr", { children: children });
const TableCell = ({ as: Tag, scope, colSpan, rowSpan, align, firstColumn, lastColumn, inHead, children, }) => {
    const classes = [
        "cms-table-cell",
        inHead && "cms-table-cell-head",
        firstColumn && "cms-table-cell-first",
        lastColumn && "cms-table-cell-last",
        Tag === "th" && "cms-table-cell-header",
        align ? `cms-align-${align}` : null,
    ]
        .filter(Boolean)
        .join(" ");
    return (_jsx(Tag, { colSpan: colSpan > 1 ? colSpan : undefined, rowSpan: rowSpan > 1 ? rowSpan : undefined, scope: Tag === "th" ? scope : undefined, className: classes, children: children }));
};
// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output (`katex.renderToString`) is the only HTML the renderer injects
const MathBlock = ({ html }) => _jsx("div", { className: "cms-math", dangerouslySetInnerHTML: { __html: html } });
const FootnoteRef = ({ index, refId, targetId }) => (_jsx("sup", { children: _jsx("a", { href: `#${targetId}`, id: refId, "data-footnote-ref": "true", "aria-describedby": "footnote-label", children: index }) }));
const Footnotes = ({ items, ctx }) => (_jsxs("section", { "data-footnotes": "true", className: "footnotes", children: [_jsx("h2", { className: "sr-only", id: "footnote-label", children: ctx.labels.footnotes }), _jsx("ol", { children: items.map((item) => (_jsx("li", { id: item.id, children: item.children }, item.id))) })] }));
const Link = ({ href, title, entryId, children }) => 
// An entry link whose target cannot be reached (not published, or gone) is plain text.
entryId !== undefined && !href ? (_jsx(_Fragment, { children: children })) : (_jsx(CmsLink, { href: href ?? "", title: title, children: children }));
const mark = (Tag) => {
    const Component = ({ children }) => _jsx(Tag, { children: children });
    Component.displayName = `Cms${Tag}`;
    return Component;
};
/** Translation note text is not shown on the public page (the pre-publish check blocks publishing while it remains). */
const Untranslated = (_) => null;
/** What an unknown node renders to: its content (a container) or nothing (a leaf). In development it leaves a hidden marker. */
const Fallback = ({ node, children }) => (_jsxs(_Fragment, { children: [process.env.NODE_ENV !== "production" ? _jsx("span", { "data-cms-unknown": node.type, hidden: true }) : null, children ?? null] }));
const marks = {
    link: Link,
    bold: mark("strong"),
    italic: mark("em"),
    strike: mark("del"),
    underline: mark("u"),
    superscript: mark("sup"),
    subscript: mark("sub"),
    code: mark("code"),
    untranslated: Untranslated,
};
/** The core default components. `fold` needs the label, so the table is made per render. */
export const defaultDocumentComponents = (showFoldedCode) => ({
    paragraph: Paragraph,
    heading: Heading,
    list: List,
    listItem: ListItem,
    blockquote: Blockquote,
    horizontalRule: HorizontalRule,
    hardBreak: HardBreak,
    codeBlock: CodeBlock,
    image: Image,
    file: File,
    textAlign: TextAlign,
    table: Table,
    tableRow: TableRow,
    tableCell: TableCell,
    math: MathBlock,
    footnoteRef: FootnoteRef,
    footnotes: Footnotes,
    marks,
    blocks: {},
    codeTags: {
        collapse: CmsCodeCollapse,
        fold: ({ children, open }) => (_jsx(CmsCodeFold, { open: open, label: showFoldedCode, children: children })),
    },
    fallback: Fallback,
});
