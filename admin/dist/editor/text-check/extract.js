import { PLACEHOLDER } from "@monti-cms/core/client";
export { PLACEHOLDER };
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s￼]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}\u0027\u0022’”]+$/;
const LETTER = /\p{L}/u;
const looksLikeUrl = (text) => /^(?:[a-z][a-z0-9+.-]*:|www\.|\/)\S*$/i.test(text.trim());
/** Text nodes that are not sent: inline code and links whose text is the URL itself. */
function isHiddenText(text, marks) {
    for (const mark of marks) {
        if (mark.type.spec.code || mark.type.name === "code")
            return true;
        if (mark.type.name === "link") {
            const href = String(mark.attrs.href ?? "");
            const trimmed = text.trim();
            if (trimmed === href || looksLikeUrl(trimmed))
                return true;
        }
    }
    return false;
}
/** 32-bit FNV-1a (UTF-16 units). The same text always gets the same name. */
function hashText(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}
function push(builder, char, from, to) {
    const last = builder.chars.length - 1;
    // Consecutive placeholders (e.g. inline code split by marks) are merged into one character.
    if (char === PLACEHOLDER && builder.chars[last] === PLACEHOLDER && builder.ends[last] === from) {
        builder.ends[last] = to;
        return;
    }
    builder.chars.push(char);
    builder.starts.push(from);
    builder.ends.push(to);
}
/** Folds a URL written as is in the body into a single placeholder character. */
function collapseUrls(builder) {
    const text = builder.chars.join("");
    const out = { chars: [], starts: [], ends: [] };
    let cursor = 0;
    for (const match of text.matchAll(URL_PATTERN)) {
        const start = match.index ?? 0;
        const end = start + match[0].replace(TRAILING_PUNCTUATION, "").length;
        if (end <= start)
            continue;
        for (let index = cursor; index < start; index++)
            push(out, builder.chars[index] ?? "", builder.starts[index] ?? 0, builder.ends[index] ?? 0);
        push(out, PLACEHOLDER, builder.starts[start] ?? 0, builder.ends[end - 1] ?? 0);
        cursor = end;
    }
    if (cursor === 0)
        return builder;
    for (let index = cursor; index < builder.chars.length; index++)
        push(out, builder.chars[index] ?? "", builder.starts[index] ?? 0, builder.ends[index] ?? 0);
    return out;
}
function buildTextblock(node, pos) {
    const builder = { chars: [], starts: [], ends: [] };
    node.forEach((child, offset) => {
        const at = pos + 1 + offset;
        if (child.isText) {
            const text = child.text ?? "";
            if (isHiddenText(text, child.marks)) {
                push(builder, PLACEHOLDER, at, at + text.length);
                return;
            }
            // ProseMirror text positions are also UTF-16 units, so they map one character at a time.
            for (let index = 0; index < text.length; index++)
                push(builder, text[index] ?? "", at + index, at + index + 1);
            return;
        }
        if (child.type.name === "hardBreak")
            push(builder, "\n", at, at + child.nodeSize);
        else
            push(builder, PLACEHOLDER, at, at + child.nodeSize);
    });
    return collapseUrls(builder);
}
/** Extracts check segments from the document. Blocks without letters are skipped. */
export function extractSegments(doc, { locale, range }) {
    const segments = [];
    const seen = new Map();
    doc.descendants((node, pos) => {
        if (!node.isTextblock)
            return !node.isAtom;
        if (node.type.spec.code)
            return false;
        const built = buildTextblock(node, pos);
        const text = built.chars.join("");
        if (!LETTER.test(text.replaceAll(PLACEHOLDER, "")))
            return false;
        const hash = hashText(text);
        const occurrence = seen.get(hash) ?? 0;
        seen.set(hash, occurrence + 1);
        const from = pos + 1;
        const to = pos + node.nodeSize - 1;
        if (range && (to < range.from || from > range.to))
            return false;
        segments.push({ id: `${hash}-${occurrence}`, text, locale, from, to, starts: built.starts, ends: built.ends });
        return false;
    });
    return segments;
}
/**
 * Paragraph-relative position (UTF-16, `end` exclusive) -> document range. A result covering a placeholder character (spanning code or a URL) is `null`.
 * A zero-length result (e.g. a missing space) is widened to one adjacent character.
 */
export function segmentRangeToDoc(segment, start, end) {
    const length = segment.text.length;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || start > end)
        return null;
    let first = start;
    let last = end;
    if (first === last) {
        if (last < length)
            last += 1;
        else if (first > 0)
            first -= 1;
        else
            return null;
    }
    for (let index = first; index < last; index++)
        if (segment.text[index] === PLACEHOLDER)
            return null;
    const from = segment.starts[first];
    const to = segment.ends[last - 1];
    return from === undefined || to === undefined ? null : { from, to };
}
/** Paragraph-relative position (`[start, end)`) overlapped by a document range. `null` if it does not overlap. */
export function docRangeToSegment(segment, from, to) {
    let start = -1;
    let end = -1;
    for (let index = 0; index < segment.text.length; index++) {
        const charFrom = segment.starts[index] ?? 0;
        const charTo = segment.ends[index] ?? 0;
        if (charTo > from && charFrom < to) {
            if (start < 0)
                start = index;
            end = index + 1;
        }
    }
    return start < 0 ? null : { start, end };
}
