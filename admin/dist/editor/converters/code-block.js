import { annotationConfig, charEffectByMark, charEffectByName, checkPattern, clampLineEffects, fromCodeBlockDocumentToCodeFence, fromCodeFenceToCodeBlockDocument, isLineEffectName, lineStarts, modelFingerprint, } from "@monti-cms/core/code-block";
import { asString } from "./shared.js";
const extractCodeBlockValue = (node) => {
    const value = asString(node.attrs?.value);
    if (value != null)
        return value;
    const document = node.attrs?.codeDocument;
    if (document && typeof document === "object" && !Array.isArray(document)) {
        return fromCodeBlockDocumentToCodeFence(document, annotationConfig).value;
    }
    return "";
};
const attrsFrom = (attributes) => Object.fromEntries((attributes ?? []).map((attr) => [attr.name, attr.value]));
const attributesFrom = (attrs) => Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => ({ name, value }));
/** Keeps only the mark attributes of a char effect (tooltip content, collapse starting expanded). */
const spanAttrs = (name, attrs) => name === "Tooltip" ? { content: String(attrs.content ?? "") } : name === "fold" ? { open: attrs.open === true } : {};
const sameAttrs = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Merges the same effect when consecutive. If the same effect overlaps with different attributes it cannot be represented as a mark, so null. */
function mergeSpans(spans) {
    const sorted = [...spans].sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from);
    const merged = [];
    for (const span of sorted) {
        const last = merged[merged.length - 1];
        if (last && last.name === span.name && span.from <= last.to) {
            if (!sameAttrs(last.attrs, span.attrs)) {
                if (span.from < last.to)
                    return null;
                merged.push({ ...span });
                continue;
            }
            last.to = Math.max(last.to, span.to);
            continue;
        }
        merged.push({ ...span });
    }
    return merged;
}
/** Reads char effect ranges from Tiptap code block content (text with marks). */
export function spansFromContent(content) {
    const spans = [];
    let offset = 0;
    for (const child of content ?? []) {
        if (child.type !== "text")
            continue;
        const length = (child.text ?? "").length;
        for (const mark of child.marks ?? []) {
            const effect = charEffectByMark(mark.type);
            if (!effect)
                continue;
            spans.push({
                name: effect.name,
                from: offset,
                to: offset + length,
                attrs: spanAttrs(effect.name, mark.attrs ?? {}),
            });
        }
        offset += length;
    }
    // Text with marks is split per mark combination even when contiguous. Rejoin the same effect.
    const merged = [];
    for (const span of [...spans].sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from)) {
        const last = merged[merged.length - 1];
        if (last && last.name === span.name && last.to === span.from && sameAttrs(last.attrs, span.attrs))
            last.to = span.to;
        else
            merged.push(span);
    }
    return merged;
}
/** Turns char effect ranges into text fragments with marks. */
function contentFromSpans(text, spans) {
    const cuts = new Set([0, text.length]);
    for (const span of spans) {
        cuts.add(span.from);
        cuts.add(span.to);
    }
    const points = [...cuts].filter((point) => point >= 0 && point <= text.length).sort((a, b) => a - b);
    const content = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index] ?? 0;
        const to = points[index + 1] ?? 0;
        if (to <= from)
            continue;
        const marks = spans
            .filter((span) => span.from <= from && to <= span.to)
            .flatMap((span) => {
            const effect = charEffectByName(span.name);
            if (!effect)
                return [];
            const attrs = spanAttrs(span.name, span.attrs);
            return [Object.keys(attrs).length ? { type: effect.mark, attrs } : { type: effect.mark }];
        });
        content.push({ type: "text", text: text.slice(from, to), ...(marks.length ? { marks } : {}) });
    }
    return content;
}
/**
 * Reads a code fence value (including comment lines) into the editor model.
 * null if there are comments the editor cannot represent (unknown line effects, the same effect overlapping with different attributes) - opens in raw editing.
 */
export function parseCodeFence(value, language, meta) {
    let document;
    try {
        document = fromCodeFenceToCodeBlockDocument({ type: "code", lang: language ?? undefined, meta: meta ?? undefined, value }, annotationConfig);
    }
    catch {
        return null;
    }
    const spans = [];
    for (const annotation of document.lines.flatMap((line) => line.annotations)) {
        if (annotation.rule !== undefined)
            continue;
        const effect = charEffectByName(annotation.name);
        if (!effect)
            return null;
        spans.push({
            name: effect.name,
            from: annotation.range.start,
            to: annotation.range.end,
            attrs: spanAttrs(effect.name, attrsFrom(annotation.attributes)),
        });
    }
    const merged = mergeSpans(spans);
    if (!merged)
        return null;
    // IDs are assigned by order. The same source always becomes the same editor document (so load and re-save comparisons stay stable).
    const lineEffects = [];
    for (const annotation of document.annotations) {
        if (!isLineEffectName(annotation.name))
            return null;
        lineEffects.push({
            id: `l${lineEffects.length}`,
            name: annotation.name,
            start: annotation.range.start,
            end: annotation.range.end,
            attrs: attrsFrom(annotation.attributes),
        });
    }
    const rules = [];
    for (const rule of document.rules ?? []) {
        const effect = charEffectByName(rule.name);
        if (!effect)
            return null;
        rules.push({
            id: `r${rules.length}`,
            scope: rule.scope,
            name: effect.name,
            pattern: rule.pattern,
            flags: rule.flags,
            ...(rule.line !== undefined ? { line: rule.line } : {}),
            attrs: attrsFrom(rule.attributes),
        });
    }
    return {
        text: document.lines.map((line) => line.value).join("\n"),
        spans: merged,
        lineEffects: clampLineEffects(lineEffects, document.lines.length),
        rules,
    };
}
/** Writes the editor model as a code fence value (including comment lines). */
export function serializeCodeFence(model, language) {
    const lines = model.text.split("\n");
    const starts = lineStarts(model.text);
    const inline = lines.map(() => []);
    model.spans.forEach((span, order) => {
        // Comment ranges are line-based. An effect spanning several lines is split per line.
        for (let line = 0; line < lines.length; line += 1) {
            const start = starts[line] ?? 0;
            const from = Math.max(span.from, start) - start;
            const to = Math.min(span.to, start + (lines[line]?.length ?? 0)) - start;
            if (to <= from)
                continue;
            inline[line]?.push({
                scope: "char",
                source: "mdx-text",
                name: span.name,
                range: { start: from, end: to },
                order,
                priority: 0,
                attributes: attributesFrom(span.attrs),
            });
        }
    });
    const annotations = clampLineEffects(model.lineEffects, lines.length).map((effect, order) => ({
        scope: "line",
        name: effect.name,
        range: { start: effect.start, end: effect.end },
        order,
        priority: 0,
        attributes: attributesFrom(effect.attrs),
    }));
    const document = {
        lang: language || "text",
        meta: {},
        annotations,
        lines: lines.map((value, index) => ({ value, annotations: inline[index] ?? [] })),
        rules: model.rules
            .filter((rule) => rule.scope === "document" || (rule.line !== undefined && rule.line < lines.length))
            // A regex not yet fully written (invalid) is not saved.
            .filter((rule) => !checkPattern(rule.pattern, rule.flags))
            .map((rule) => ({
            scope: rule.scope,
            name: rule.name,
            pattern: rule.pattern,
            flags: rule.flags,
            ...(rule.scope === "char" ? { line: rule.line } : {}),
            attributes: attributesFrom(rule.attrs),
        })),
    };
    return fromCodeBlockDocumentToCodeFence(document, annotationConfig).value;
}
const fingerprintOf = (language, content, lineEffects, rules) => {
    const text = (content ?? []).map((child) => (child.type === "text" ? (child.text ?? "") : "")).join("");
    return modelFingerprint({ language, text, spans: spansFromContent(content), lineEffects, rules });
};
export const codeBlockConverter = {
    name: "codeBlock",
    cmsTypes: ["codeBlock"],
    tiptapTypes: ["codeBlock"],
    isMappable: () => true,
    toTiptap(node) {
        const language = asString(node.attrs?.language) ?? null;
        const meta = asString(node.attrs?.meta) ?? null;
        const source = extractCodeBlockValue(node);
        const parsed = parseCodeFence(source, language, meta);
        if (!parsed) {
            // If there are comments that cannot be represented, edit as raw text including the comment lines (no data is lost).
            return {
                type: "codeBlock",
                attrs: { language, meta, rawMode: true, source },
                content: source.length > 0 ? [{ type: "text", text: source }] : [],
            };
        }
        const content = contentFromSpans(parsed.text, parsed.spans);
        return {
            type: "codeBlock",
            attrs: {
                language,
                meta,
                lineEffects: parsed.lineEffects,
                rules: parsed.rules,
                source,
                sourceKey: fingerprintOf(language, content, parsed.lineEffects, parsed.rules),
            },
            content,
        };
    },
    toCms(node) {
        const content = node.content ?? [];
        const text = content.map((child) => (child?.type === "text" ? (child.text ?? "") : "")).join("");
        const language = asString(node.attrs?.language) ?? null;
        const meta = asString(node.attrs?.meta) ?? null;
        const attrs = { ...(language ? { language } : {}), ...(meta ? { meta } : {}) };
        if (node.attrs?.rawMode === true)
            return [{ type: "codeBlock", attrs: { ...attrs, value: text } }];
        const lineEffects = Array.isArray(node.attrs?.lineEffects) ? node.attrs.lineEffects : [];
        const rules = Array.isArray(node.attrs?.rules) ? node.attrs.rules : [];
        const source = asString(node.attrs?.source);
        // If nothing changed since loading, save the original text as is (byte-identical, including comment line positions and style).
        if (source != null && fingerprintOf(language, content, lineEffects, rules) === node.attrs?.sourceKey)
            return [{ type: "codeBlock", attrs: { ...attrs, value: source } }];
        const value = serializeCodeFence({ text, spans: spansFromContent(content), lineEffects, rules }, language);
        return [{ type: "codeBlock", attrs: { ...attrs, value } }];
    },
};
