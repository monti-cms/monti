import { annotationConfig } from "../annotation/code-block/active.js";
import { fromCodeBlockDocumentToCodeFence } from "../annotation/code-block/document-to-code-fence.js";
import { ADDED_MARK_BLOCKS } from "../blocks/active.js";
import { DIRECTIVE_BY_COMPONENT, DIRECTIVE_NAMES } from "./directives.js";
import { serializeFrontmatter } from "./frontmatter.js";
import { BLOCK_JSX_NAMES, INLINE_JSX_MARKS, sortMarks } from "./registry.js";
import { formatTableWidths, hasBalancedLabelBrackets, hasNonGfmHeaderLayout, tableHasMergedCells, tableWidths, } from "./table-layout.js";
const usesDirectiveTable = (node) => tableHasMergedCells(node) || hasNonGfmHeaderLayout(node) || formatTableWidths(tableWidths(node)) !== "";
const isIdent = (value) => /^[A-Za-z_][\w]*$/.test(value);
const escapeAttr = (value) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const escapeText = (value, inCode, inLabel = false) => {
    if (inCode)
        return value;
    const escaped = value
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/\[/g, "\\[")
        .replace(/\{/g, "\\{")
        .replace(/</g, "\\<");
    const unbroken = escapeDirectiveColon(escaped);
    // A directive label closes with `]`, so `]` is escaped inside a label (if brackets are unbalanced, the label breaks).
    return inLabel ? unbroken.replace(/\]/g, "\\]") : unbroken;
};
const DIRECTIVE_COLON = /(?<!\\):(?=[A-Za-z0-9_\-가-힣:])/g; // cms-allow-korean: Hangul in a name pattern, not UI text
const DIRECTIVE_RUN = /^[A-Za-z0-9_\-가-힣:]+/; // cms-allow-korean: Hangul in a name pattern, not UI text
/**
 * Escapes a `:` followed by a registered directive name as `\:`.
 * Left as is, it would be read as a directive on re-parse (`:br `, `:u[` etc.). Unregistered names (`:free를`) and
 * colons in times and URLs (`12:30`, `https://`) are left alone. An already escaped `\:` is kept.
 */
const escapeDirectiveColon = (value) => value.replace(DIRECTIVE_COLON, (_match, offset, whole) => {
    const run = DIRECTIVE_RUN.exec(whole.slice(offset + 1))?.[0] ?? "";
    return DIRECTIVE_NAMES.has(run) ? "\\:" : ":";
});
const fenceTicks = (value) => {
    const runs = value.match(/`+/g)?.map((run) => run.length) ?? [];
    return Math.max(3, ...runs.map((size) => size + 1), 3);
};
const serializeFence = (language, meta, value) => {
    const ticks = "`".repeat(fenceTicks(value));
    const info = [language, meta].filter((part) => part.length > 0).join(" ");
    return `${ticks}${info}\n${value}\n${ticks}`;
};
const serializeJsValue = (value) => {
    if (value === null)
        return "null";
    if (typeof value === "boolean")
        return value ? "true" : "false";
    if (typeof value === "number")
        return String(value);
    if (typeof value === "string")
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(serializeJsValue).join(", ")}]`;
    const entries = Object.entries(value).map(([key, item]) => {
        const printedKey = isIdent(key) ? key : JSON.stringify(key);
        return `${printedKey}: ${serializeJsValue(item)}`;
    });
    return `{${entries.join(", ")}}`;
};
const serializeJsxAttribute = (attribute) => {
    if (attribute.spread) {
        const expression = typeof attribute.expression === "string" ? attribute.expression : "...";
        return `{${expression}}`;
    }
    const name = typeof attribute.name === "string" ? attribute.name : "";
    if (!name)
        return "";
    if (attribute.expression != null && attribute.value === undefined) {
        return `${name}={${attribute.expression}}`;
    }
    const value = attribute.value;
    if (value === undefined)
        return name;
    if (typeof value === "string")
        return `${name}="${escapeAttr(value)}"`;
    return `${name}={${serializeJsValue(value)}}`;
};
const reservedAttrKeys = new Set([
    "name",
    "attributes",
    "language",
    "meta",
    "value",
    "codeDocument",
    "frontmatter",
    "level",
    "src",
    "alt",
    "href",
    "title",
    "checked",
    "start",
]);
const serializeJsxAttrs = (node) => {
    const attributes = node.attrs?.attributes;
    const parts = [];
    if (Array.isArray(attributes)) {
        for (const item of attributes) {
            if (!item || typeof item !== "object" || Array.isArray(item))
                continue;
            const printed = serializeJsxAttribute(item);
            if (printed)
                parts.push(printed);
        }
    }
    else if (node.attrs) {
        for (const [key, value] of Object.entries(node.attrs)) {
            if (reservedAttrKeys.has(key))
                continue;
            parts.push(serializeJsxAttribute({ name: key, value }));
        }
    }
    return parts.length > 0 ? ` ${parts.join(" ")}` : "";
};
const jsxName = (node) => {
    if (typeof node.attrs?.name === "string" && node.attrs.name.length > 0)
        return node.attrs.name;
    return node.type;
};
/** Added text decoration (block extension). The mark name is the block name. */
const ADDED_MARKS = new Map(ADDED_MARK_BLOCKS.map((block) => [block.name, block]));
/** Text inside a directive label (`]{…}`) that carries attributes. Escapes the character that closes the label. */
const LABEL_MARKS = new Set(ADDED_MARKS.keys());
/**
 * Attributes of an added text decoration (`{name="value" …}`). Writes the definition's attributes in definition order. Required attributes (`required`) are written even if empty,
 * and the others only when they have a value. A boolean writes only the name when true. If there is no attribute at all, only `]` is written.
 */
const markAttrs = (block, mark) => {
    const parts = Object.entries(block.attributes).flatMap(([name, attribute]) => {
        const value = mark.attrs?.[name];
        if (attribute.type === "boolean")
            return value === true || value === "true" ? [name] : [];
        if (typeof value === "string" && value !== "")
            return [`${name}="${escapeAttr(value)}"`];
        return attribute.required ? [`${name}="${escapeAttr(value == null ? "" : String(value))}"`] : [];
    });
    return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};
const markKey = (mark) => `${mark.type}:${JSON.stringify(mark.attrs ?? null)}`;
const sortedMarks = (marks) => sortMarks(marks ?? []);
const openMark = (mark) => {
    const added = ADDED_MARKS.get(mark.type);
    if (added && added.syntax.kind === "text")
        return `:${added.syntax.directive}[`;
    switch (mark.type) {
        case "untranslated":
            return ":untranslated[";
        case "underline":
            return ":u[";
        case "superscript":
            return ":sup[";
        case "subscript":
            return ":sub[";
        case "bold":
            return "**";
        case "italic":
            return "*";
        case "strike":
            return "~~";
        case "code":
            return "`";
        case "link":
            return "[";
        default:
            return "";
    }
};
const closeMark = (mark) => {
    const added = ADDED_MARKS.get(mark.type);
    if (added)
        return `]${markAttrs(added, mark)}`;
    switch (mark.type) {
        case "underline":
        case "superscript":
        case "subscript":
        case "untranslated":
            return "]";
        case "bold":
            return "**";
        case "italic":
            return "*";
        case "strike":
            return "~~";
        case "code":
            return "`";
        case "link": {
            const href = String(mark.attrs?.href ?? "");
            const title = mark.attrs?.title;
            return typeof title === "string" && title.length > 0 ? `](${href} "${title}")` : `](${href})`;
        }
        default:
            return "";
    }
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** A JSX spread attribute cannot be expressed as a directive → it stays as JSX (no silent loss). */
const hasSpread = (node) => Array.isArray(node.attrs?.attributes) && node.attrs.attributes.some((item) => isRecord(item) && Boolean(item.spread));
/** Decides whether a node is stored as a directive. The name is the component name (`attrs.name` or `type`). */
const directiveFor = (node) => hasSpread(node) ? undefined : DIRECTIVE_BY_COMPONENT.get(jsxName(node));
/**
 * Directive attribute string (`{name="value"}`). Writes attributes in the definition in table order, and does not drop attributes missing from the definition by appending them.
 * A boolean writes only the name when true and is omitted when false.
 */
const serializeDirectiveAttrs = (node, definition) => {
    const attrs = node.attrs ?? {};
    const parts = [];
    const done = new Set();
    const print = (name, value) => {
        if (done.has(name))
            return;
        done.add(name);
        if (definition.attributes[name] === "boolean") {
            // Missing attributes and false are not written. The name is written only when true.
            if (value === undefined || value === null || value === false || value === "false")
                return;
            parts.push(name);
            return;
        }
        if (name === "rotate" && (value === "0" || value === 0 || value === "" || value === undefined || value === null)) {
            return;
        }
        if (name === "crop" && (value === "" || value === "0,0,100,100" || value === undefined || value === null)) {
            return;
        }
        if (name === "title" && (value === "" || value === undefined || value === null)) {
            return;
        }
        if (value === undefined || value === null)
            return;
        parts.push(`${name}="${escapeAttr(String(value))}"`);
    };
    for (const name of Object.keys(definition.attributes))
        print(name, attrs[name]);
    for (const [name, value] of Object.entries(attrs)) {
        if (reservedAttrKeys.has(name))
            continue;
        print(name, value);
    }
    return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};
/** Number of container levels wrapped. The colon count is `3 + levels` — the same formula as the converter. */
const containerDepth = (node) => {
    let max = 0;
    for (const child of node.content ?? []) {
        // A merged table uses 3 colons (row) inside 4 colons (table). The outer container needs at least 5 colons.
        if (child.type === "table" && usesDirectiveTable(child))
            max = Math.max(max, 2);
        const definition = directiveFor(child);
        if (definition?.kind === "container")
            max = Math.max(max, 1 + containerDepth(child));
        max = Math.max(max, containerDepth(child));
    }
    return max;
};
const serializeDirective = (node, definition, indent) => {
    const attrs = serializeDirectiveAttrs(node, definition);
    if (definition.kind === "leaf")
        return `${indent}::${definition.name}${attrs}`;
    if (definition.kind === "text") {
        const label = serializeInlines(node.content ?? [], false, true);
        // `:br` with an empty label is canonical. If the label has content, it is preserved, not dropped.
        return `${indent}:${definition.name}[${definition.name === "br" && label.length === 0 ? "" : label}]${attrs}`;
    }
    const inner = serializeBlocks(node.content ?? [], "");
    const fence = ":".repeat(3 + containerDepth(node));
    if (inner.length === 0)
        return `${indent}${fence}${definition.name}${attrs}\n${indent}${fence}`;
    return `${indent}${fence}${definition.name}${attrs}\n${inner}\n${indent}${fence}`;
};
const serializeImage = (node) => {
    const mediaId = node.attrs?.mediaId;
    const src = node.attrs?.src ? String(node.attrs.src) : "";
    const alt = node.attrs?.alt ? String(node.attrs.alt) : "";
    const width = node.attrs?.width ? String(node.attrs.width) : undefined;
    const align = node.attrs?.align ? String(node.attrs.align) : undefined;
    const caption = node.attrs?.caption ? String(node.attrs.caption) : undefined;
    const crop = node.attrs?.crop ? String(node.attrs.crop) : undefined;
    const hasCrop = crop && crop !== "0,0,100,100";
    const rotate = node.attrs?.rotate ? String(node.attrs.rotate) : undefined;
    const hasRotate = rotate && rotate !== "0";
    const decorative = node.attrs?.decorative === true || node.attrs?.decorative === "true";
    // If there is a media reference, size, alignment, caption or decorative flag, it is stored as an `image` leaf; otherwise as a Markdown image.
    if (mediaId || width || align || caption || decorative || hasCrop || hasRotate) {
        const definition = DIRECTIVE_BY_COMPONENT.get("Image");
        if (definition)
            return `::image${serializeDirectiveAttrs(node, definition)}`;
    }
    const title = node.attrs?.title;
    if (typeof title === "string" && title.length > 0)
        return `![${alt}](${src} "${title}")`;
    return `![${alt}](${src})`;
};
const encodeLeadingSpaces = (value, inCode, inLabel = false) => {
    const match = /^[ \t]+/.exec(value);
    if (!match)
        return escapeText(value, inCode, inLabel);
    return `${"&#x20;".repeat(match[0].replace(/\t/g, " ").length)}${escapeText(value.slice(match[0].length), inCode, inLabel)}`;
};
const EMPHASIS_MARKS = new Set(["bold", "italic", "strike"]);
/**
 * CommonMark emphasis delimiters do not open or close if the first/last inner character is whitespace or punctuation
 * (`**정적(Static)**과` is not emphasis; the asterisks stay as text). Only in that case is JSX written.
 */
const EMPHASIS_UNSAFE_EDGE = /^[\s\p{P}\p{S}]|[\s\p{P}\p{S}]$/u;
const jsxOpenMark = (mark) => {
    switch (mark.type) {
        case "bold":
            return "<strong>";
        case "italic":
            return "<em>";
        case "strike":
            return "<del>";
        default:
            return openMark(mark);
    }
};
const jsxCloseMark = (mark) => {
    switch (mark.type) {
        case "bold":
            return "</strong>";
        case "italic":
            return "</em>";
        case "strike":
            return "</del>";
        default:
            return closeMark(mark);
    }
};
const serializeInlines = (nodes, asParagraph = false, inLabel = false) => {
    const out = [];
    // For each open mark, remember the position of the opening delimiter's piece and the position of the piece where the content starts.
    // On closing, look at the characters around the content to decide whether Markdown emphasis holds.
    const active = [];
    let atLineStart = asParagraph;
    const closeEntry = (entry) => {
        if (EMPHASIS_MARKS.has(entry.mark.type)) {
            const content = out.slice(entry.contentIndex).join("");
            if (content.length === 0 || EMPHASIS_UNSAFE_EDGE.test(content)) {
                out[entry.openIndex] = jsxOpenMark(entry.mark);
                out.push(jsxCloseMark(entry.mark));
                return;
            }
        }
        out.push(closeMark(entry.mark));
    };
    const closeTo = (index) => {
        while (active.length > index) {
            const entry = active.pop();
            if (entry)
                closeEntry(entry);
        }
    };
    for (const node of nodes) {
        if (node.type === "hardBreak") {
            // A hard line break is written only as `:br[]`. `\` + newline creates a raw newline, and `remark-breaks` would
            // emit an unintended `<br>`, so it is not used.
            closeTo(0);
            out.push(":br[]");
            atLineStart = false;
            continue;
        }
        if (node.type === "image") {
            closeTo(0);
            out.push(serializeImage(node));
            continue;
        }
        const directive = directiveFor(node);
        if (directive) {
            closeTo(0);
            out.push(serializeDirective(node, directive, ""));
            continue;
        }
        if (node.type === "mdxJsx" || BLOCK_JSX_NAMES.has(node.type) || INLINE_JSX_MARKS[node.type]) {
            closeTo(0);
            out.push(serializeJsx(node));
            continue;
        }
        if (node.type === "mdxExpression") {
            closeTo(0);
            out.push(`{${String(node.attrs?.value ?? "")}}`);
            continue;
        }
        if (node.type !== "text") {
            closeTo(0);
            if (node.content)
                out.push(serializeInlines(node.content, false, inLabel));
            else if (node.text)
                out.push(escapeText(node.text, false, inLabel));
            continue;
        }
        const wanted = sortedMarks(node.marks);
        let same = 0;
        while (same < active.length &&
            same < wanted.length &&
            markKey(active[same]?.mark ?? { type: "" }) === markKey(wanted[same] ?? { type: "" })) {
            same += 1;
        }
        closeTo(same);
        for (let index = same; index < wanted.length; index += 1) {
            const mark = wanted[index];
            if (!mark)
                continue;
            const openIndex = out.length;
            out.push(openMark(mark));
            active.push({ mark, openIndex, contentIndex: openIndex + 1 });
        }
        const inCode = wanted.some((mark) => mark.type === "code");
        const text = node.text ?? "";
        out.push(atLineStart && !inCode
            ? encodeLeadingSpaces(text, inCode, inLabel || wanted.some((mark) => LABEL_MARKS.has(mark.type)))
            : escapeText(text, inCode, inLabel || wanted.some((mark) => LABEL_MARKS.has(mark.type))));
        atLineStart = false;
    }
    closeTo(0);
    const result = out.join("");
    if (!asParagraph)
        return result;
    // If a paragraph starts with `1. `, it is read as an ordered list on re-parse, so the list marker is escaped.
    // However, the backslash goes before the period, not the digit (`1\. `). `\1. ` escapes the digit and stays literal.
    const withEscapedListMarker = result.replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3");
    return withEscapedListMarker.replace(/^(\s*)([>#]|-{1,3}\s|\*{1,3}\s|```)/, "$1\\$2");
};
const serializeCodeBlock = (node, indent) => {
    const attrs = node.attrs ?? {};
    let language = typeof attrs.language === "string" ? attrs.language : "";
    let meta = typeof attrs.meta === "string" ? attrs.meta : "";
    let value = typeof attrs.value === "string" ? attrs.value : "";
    if (value.length === 0 && attrs.codeDocument && typeof attrs.codeDocument === "object") {
        const fence = fromCodeBlockDocumentToCodeFence(attrs.codeDocument, annotationConfig);
        language = fence.lang ?? language;
        meta = fence.meta ?? meta;
        value = fence.value;
    }
    const fence = serializeFence(language, meta, value);
    if (!indent)
        return fence;
    return fence
        .split("\n")
        .map((line) => indent + line)
        .join("\n");
};
const serializeJsx = (node, indent = "") => {
    const name = jsxName(node);
    const attrs = serializeJsxAttrs(node);
    const inner = serializeBlocks(node.content ?? [], "");
    if (!inner)
        return `${indent}<${name}${attrs} />`;
    return `${indent}<${name}${attrs}>\n\n${inner}\n\n${indent}</${name}>`;
};
const serializeList = (node, indent, ordered) => {
    const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
    return (node.content ?? [])
        .map((item, index) => {
        const checked = item.attrs?.checked;
        const task = typeof checked === "boolean" ? `[${checked ? "x" : " "}] ` : "";
        const marker = ordered ? `${start + index}. ${task}` : `- ${task}`;
        return serializeListItem(item, marker, indent);
    })
        .join("\n");
};
const serializeListItem = (item, marker, indent) => {
    const blocks = item.content ?? [];
    const innerIndent = indent + " ".repeat(Math.max(marker.length, 2));
    if (blocks.length === 0)
        return `${indent}${marker}`.trimEnd();
    const [first, ...rest] = blocks;
    let head = `${indent}${marker}`;
    if (first?.type === "paragraph") {
        head += serializeInlines(first.content ?? [], true);
    }
    else if (first) {
        head += `\n${serializeBlock(first, innerIndent)}`;
    }
    const extra = rest.map((block) => {
        if (block.type === "paragraph")
            return `${innerIndent}${serializeInlines(block.content ?? [], true)}`;
        return serializeBlock(block, innerIndent);
    });
    // If a listItem has several blocks (loose list), they must be separated by blank lines to keep paragraph boundaries.
    // Joining them on one line would merge them into one paragraph on re-parse and lose the paragraph structure.
    return [head, ...extra].join("\n\n");
};
const serializeGfmTable = (node) => {
    const rows = node.content ?? [];
    const serializedRows = rows.map((row) => {
        const cells = (row.content ?? []).map((cell) => serializeInlines(cell.content ?? []).replace(/\|/g, "\\|"));
        return `| ${cells.join(" | ")} |`;
    });
    if (serializedRows.length === 0)
        return "";
    const columnCount = rows[0]?.content?.length ?? 1;
    const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
    const rule = (value) => value === "left" ? ":--" : value === "center" ? ":-:" : value === "right" ? "--:" : "---";
    const separator = `| ${Array.from({ length: columnCount }, (_, index) => rule(align[index])).join(" | ")} |`;
    const [header, ...body] = serializedRows;
    return [header, separator, ...body].join("\n");
};
const tableCellAttrs = (cell) => {
    const attrs = [];
    if (cell.attrs?.header === true || cell.attrs?.header === "true")
        attrs.push("header");
    const colspan = Number(cell.attrs?.colspan ?? 1);
    if (colspan > 1)
        attrs.push(`colspan=${colspan}`);
    const rowspan = Number(cell.attrs?.rowspan ?? 1);
    if (rowspan > 1)
        attrs.push(`rowspan=${rowspan}`);
    return attrs;
};
/** Collects table attributes (`align`, `widths`) in storage order. */
const tableAttrs = (node) => {
    const attrs = [];
    const align = tableAlign(node);
    if (align)
        attrs.push(["align", align]);
    const widths = formatTableWidths(tableWidths(node));
    if (widths)
        attrs.push(["widths", widths]);
    return attrs;
};
const tableAlign = (node) => {
    const align = Array.isArray(node.attrs?.align) ? node.attrs.align : [];
    const value = align.map((v) => v ?? "").join(",");
    return value.replace(/,/g, "").length > 0 ? value : "";
};
// If directive label brackets are unbalanced, the parser loses cells, so it is stored as a JSX table with the same meaning.
const serializeJsxTable = (node, rows) => {
    const attrs = tableAttrs(node).map(([name, value]) => ` ${name}="${escapeAttr(value)}"`);
    const lines = [`<Table${attrs.join("")}>`];
    (node.content ?? []).forEach((row, rowIndex) => {
        lines.push("<TableRow>");
        (row.content ?? []).forEach((cell, cellIndex) => {
            const attrs = tableCellAttrs(cell).map((attr) => attr.replace(/=(\d+)$/, '="$1"'));
            lines.push(`<TableCell${attrs.length ? ` ${attrs.join(" ")}` : ""}>${rows[rowIndex]?.[cellIndex] ?? ""}</TableCell>`);
        });
        lines.push("</TableRow>");
    });
    lines.push("</Table>");
    return lines.join("\n");
};
const serializeDirectiveTable = (node) => {
    const rows = node.content ?? [];
    const labels = rows.map((row) => (row.content ?? []).map((cell) => serializeInlines(cell.content ?? [], false, true)));
    if (labels.some((row) => row.some((label) => !hasBalancedLabelBrackets(label)))) {
        return serializeJsxTable(node, labels);
    }
    const attrs = tableAttrs(node).map(([name, value]) => `${name}="${value}"`);
    const lines = [`::::table${attrs.length ? `{${attrs.join(" ")}}` : ""}`];
    rows.forEach((row, rowIndex) => {
        lines.push(":::row");
        (row.content ?? []).forEach((cell, cellIndex) => {
            const cellAttrs = tableCellAttrs(cell);
            const attrStr = cellAttrs.length > 0 ? `{${cellAttrs.join(" ")}}` : "";
            lines.push(`::cell[${labels[rowIndex]?.[cellIndex] ?? ""}]${attrStr}`);
        });
        lines.push(":::");
    });
    lines.push("::::");
    return lines.join("\n");
};
const serializeTable = (node) => {
    if (usesDirectiveTable(node)) {
        return serializeDirectiveTable(node);
    }
    return serializeGfmTable(node);
};
const serializeBlock = (node, indent = "") => {
    const definition = directiveFor(node);
    if (definition)
        return serializeDirective(node, definition, indent);
    switch (node.type) {
        case "paragraph":
            return indent + serializeInlines(node.content ?? [], true);
        case "heading": {
            const level = typeof node.attrs?.level === "number" ? node.attrs.level : 2;
            return `${indent}${"#".repeat(level)} ${serializeInlines(node.content ?? [])}`;
        }
        case "codeBlock":
            return serializeCodeBlock(node, indent);
        case "math":
            return `${indent}$$\n${String(node.attrs?.value ?? "")}\n$$`;
        case "bulletList":
            return serializeList(node, indent, false);
        case "orderedList":
            return serializeList(node, indent, true);
        case "table":
            return serializeTable(node)
                .split("\n")
                .map((line) => indent + line)
                .join("\n");
        case "blockquote":
            return serializeBlocks(node.content ?? [], "")
                .split("\n")
                .map((line) => `${indent}>${line ? ` ${line}` : ""}`)
                .join("\n");
        case "horizontalRule":
            return `${indent}---`;
        case "image":
            return indent + serializeImage(node);
        case "html":
            // Multi-line source (turned-back unregistered directive etc.) must be indented on every line so it is read back as the same block inside a list.
            return String(node.attrs?.value ?? "")
                .split("\n")
                .map((line) => (line ? indent + line : line))
                .join("\n");
        case "mdxEsm":
            return indent + String(node.attrs?.value ?? "");
        case "mdxExpression":
            return `${indent}{${String(node.attrs?.value ?? "")}}`;
        case "doc":
            return serializeBlocks(node.content ?? [], indent);
        default:
            if (BLOCK_JSX_NAMES.has(node.type) || node.type === "mdxJsx" || INLINE_JSX_MARKS[node.type]) {
                return serializeJsx(node, indent);
            }
            if (node.content)
                return serializeBlocks(node.content, indent);
            return "";
    }
};
const serializeBlocks = (nodes, indent = "") => nodes
    .map((node) => serializeBlock(node, indent))
    .filter((block) => block.length > 0)
    .join("\n\n");
export const serialize = (doc) => {
    const node = doc;
    const body = serializeBlocks(node.type === "doc" ? (node.content ?? []) : [node]).trimEnd();
    const frontmatter = node.attrs?.frontmatter;
    if (frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)) {
        return `${serializeFrontmatter(frontmatter)}\n${body}\n`;
    }
    return body.length > 0 ? `${body}\n` : "";
};
