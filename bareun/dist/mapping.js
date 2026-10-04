import { createActiveTranslator, PLACEHOLDER, } from "@monti-cms/core";
import { bareunMessages } from "./messages.js";
/** Character inserted between paragraphs. Bareun treats it as a sentence boundary. */
export const SEGMENT_SEPARATOR = "\n";
export const joinSegments = (segments) => segments.map((segment) => segment.text).join(SEGMENT_SEPARATOR);
// This is bundled into the module read by the site config file (`index.ts`), so the display language is chosen on every call.
const t = createActiveTranslator(bareunMessages);
/** Bareun category code. The name is `category.<code>` in the message dictionary. */
const KINDS = new Set([
    "TYPO",
    "SPACING",
    "STANDARD",
    "GRAMMER",
    "WORD",
    "FOREIGN_WORD",
    "CONFUSABLE_WORDS",
    "SENTENCE",
    "CONFIRM",
    "THINKING",
    "UNKNOWN",
]);
const labelOf = (kind) => t(KINDS.has(kind) ? `category.${kind}` : "category.CONFIRM");
const CATEGORIES = {
    SPACING: "spacing",
    TYPO: "spelling",
    WORD: "spelling",
    STANDARD: "spelling",
    GRAMMER: "grammar",
    SENTENCE: "style",
    FOREIGN_WORD: "term",
    CONFUSABLE_WORDS: "term",
};
const ERRORS = new Set(["TYPO", "SPACING", "STANDARD", "GRAMMER", "WORD"]);
const MAX_COMMENT = 120;
/** The first sentence of the description. Angle-bracket markup such as emphasis (`<IN>…</IN>`) is removed. */
function shortComment(comment) {
    const text = (comment ?? "")
        .replace(/<\/?[A-Za-z][^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
    if (!text)
        return "";
    const first = text.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? text;
    return first.length > MAX_COMMENT ? `${first.slice(0, MAX_COMMENT - 1).trimEnd()}…` : first;
}
/** The smallest fix unit. Merged blocks are expanded into individual fixes (`nested`). */
function leafBlocks(blocks) {
    return (blocks ?? []).flatMap((block) => block.nested && block.nested.length > 0 ? leafBlocks(block.nested) : [block]);
}
/**
 * Converts a Bareun response into per-paragraph check results. `segments` must be in the same order they were joined in the request.
 * Results that cross a paragraph boundary, touch the hidden placeholder (`￼`), or whose position does not match the original text are dropped.
 */
export function bareunIssues(segments, response) {
    const content = joinSegments(segments);
    const starts = [];
    let offset = 0;
    for (const segment of segments) {
        starts.push(offset);
        offset += segment.text.length + SEGMENT_SEPARATOR.length;
    }
    const helps = response.helps ?? {};
    const seen = new Set();
    const issues = [];
    for (const block of leafBlocks(response.revisedBlocks)) {
        const begin = block.origin?.beginOffset ?? 0;
        const length = block.origin?.length ?? 0;
        const end = begin + length;
        if (!Number.isInteger(begin) || !Number.isInteger(length) || length <= 0 || begin < 0 || end > content.length)
            continue;
        const origin = content.slice(begin, end);
        if (block.origin?.content !== undefined && block.origin.content !== origin)
            continue;
        if (origin.includes(PLACEHOLDER))
            continue;
        // The paragraph containing the start position. If the end goes past that paragraph (crosses a paragraph boundary), drop it.
        let index = starts.length - 1;
        while (index > 0 && (starts[index] ?? 0) > begin)
            index--;
        const segment = segments[index];
        const segmentStart = starts[index] ?? 0;
        if (!segment || end > segmentStart + segment.text.length)
            continue;
        const start = begin - segmentStart;
        const key = `${segment.id}:${start}:${end - segmentStart}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const revisions = block.revisions ?? [];
        const candidates = revisions.length > 0 ? revisions.map((revision) => revision.revised) : [block.revised];
        const suggestions = [
            ...new Set(candidates.filter((text) => typeof text === "string" && text !== origin)),
        ];
        const first = revisions[0];
        const kind = (first?.category ?? "UNKNOWN").toUpperCase();
        const helpId = first?.helpId || undefined;
        const label = labelOf(kind);
        const comment = shortComment(helpId ? helps[helpId]?.comment : undefined);
        const severity = ERRORS.has(kind) ? "error" : "warning";
        issues.push({
            segmentId: segment.id,
            start,
            end: end - segmentStart,
            message: comment ? t("issue.message", { label, comment }) : label,
            suggestions,
            severity,
            ...(helpId ? { ruleId: helpId } : {}),
            category: CATEGORIES[kind] ?? kind.toLowerCase(),
            source: "bareun",
        });
    }
    return issues;
}
