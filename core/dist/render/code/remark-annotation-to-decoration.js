import { visit } from "unist-util-visit";
import { createAnnotationRegistry, fromCodeFenceToCodeBlockDocument, supportsAnnotationScope } from "../../code-block.js";
import { createAllowedRenderTagsFromConfig } from "./render-policy.js";
const hasClass = (annotation) => "class" in annotation && typeof annotation.class === "string";
const hasRender = (annotation) => "render" in annotation && typeof annotation.render === "string";
const resolveStyleFromRule = (registry, annotation) => {
    if (!registry)
        return;
    const rule = registry.get(annotation.name);
    if (!rule || !supportsAnnotationScope(rule, annotation.scope))
        return;
    if (rule.kind === "class") {
        if (typeof rule.class !== "string")
            return;
        return { class: rule.class };
    }
    if (typeof rule.render !== "string")
        return;
    return { render: rule.render };
};
// Temporary adapter: supports legacy payloads that still carry class/render on annotations.
const resolveStyle = (registry, annotation) => {
    const fromRule = resolveStyleFromRule(registry, annotation);
    if (fromRule)
        return fromRule;
    const fallback = {};
    if (typeof annotation.class === "string")
        fallback.class = annotation.class;
    if (typeof annotation.render === "string")
        fallback.render = annotation.render;
    return fallback.class || fallback.render ? fallback : undefined;
};
const buildInlineDecoration = (lineNumber, annotation, style) => {
    if (annotation.range.start >= annotation.range.end)
        return undefined;
    if (style && hasClass(style)) {
        return {
            start: { line: lineNumber, character: annotation.range.start },
            end: { line: lineNumber, character: annotation.range.end },
            properties: { class: style.class },
        };
    }
    if (style && hasRender(style)) {
        const props = { "data-anno-render": style.render };
        for (const attr of annotation.attributes ?? []) {
            props[`data-anno-${attr.name}`] = JSON.stringify(attr.value);
        }
        return {
            start: { line: lineNumber, character: annotation.range.start },
            end: { line: lineNumber, character: annotation.range.end },
            properties: props,
        };
    }
    return undefined;
};
const toLineDecorationPayload = (annotation, style) => {
    if (!style || !hasClass(style))
        return undefined;
    return {
        scope: annotation.scope,
        name: annotation.name,
        range: annotation.range,
        order: annotation.order,
        class: style.class,
        attributes: annotation.attributes ?? [],
    };
};
const toLineWrapperPayload = (annotation, style) => {
    if (!style || !hasRender(style))
        return undefined;
    return {
        scope: annotation.scope,
        name: annotation.name,
        range: annotation.range,
        order: annotation.order,
        render: style.render,
        attributes: annotation.attributes ?? [],
    };
};
export const fromCodeBlockDocumentToShikiAnnotationPayload = (document, annotationConfig) => {
    const decorations = [];
    const lineDecorations = [];
    const rowWrappers = [];
    const registry = annotationConfig ? createAnnotationRegistry(annotationConfig) : undefined;
    const lineStartOffsets = [];
    let lineStart = 0;
    for (const line of document.lines) {
        lineStartOffsets.push(lineStart);
        lineStart += line.value.length + 1;
    }
    document.lines.forEach((line, lineNumber) => {
        const lineOffset = lineStartOffsets[lineNumber] ?? 0;
        for (const annotation of line.annotations) {
            const style = resolveStyle(registry, annotation);
            const decoration = buildInlineDecoration(lineNumber, {
                ...annotation,
                range: {
                    start: annotation.range.start - lineOffset,
                    end: annotation.range.end - lineOffset,
                },
            }, style);
            if (decoration)
                decorations.push(decoration);
        }
    });
    document.annotations.forEach((annotation) => {
        const style = resolveStyle(registry, annotation);
        const lineDecoration = toLineDecorationPayload(annotation, style);
        if (lineDecoration) {
            lineDecorations.push(lineDecoration);
            return;
        }
        const rowWrapper = toLineWrapperPayload(annotation, style);
        if (rowWrapper) {
            rowWrappers.push(rowWrapper);
        }
    });
    return {
        code: document.lines.map((line) => line.value).join("\n"),
        lang: document.lang,
        meta: document.meta,
        decorations,
        lineDecorations,
        rowWrappers,
    };
};
export function remarkAnnotationToShikiDecoration(annotationConfig) {
    const allowedRenderTags = createAllowedRenderTagsFromConfig(annotationConfig);
    return (tree) => {
        visit(tree, "code", (node) => {
            const document = fromCodeFenceToCodeBlockDocument(node, annotationConfig, { parseLineAnnotations: true });
            const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, annotationConfig);
            node.value = payload.code;
            // `hProperties` is a value read by mdast-util-to-hast, so this package narrows it directly instead of pulling in that type.
            node.data ??= {};
            const data = node.data;
            data.hProperties = {
                ...data.hProperties,
                "data-decorations": JSON.stringify(payload.decorations),
                "data-line-decorations": JSON.stringify(payload.lineDecorations),
                "data-line-wrappers": JSON.stringify(payload.rowWrappers),
                "data-render-tags": JSON.stringify(allowedRenderTags),
                "data-lang": payload.lang,
                "data-meta": JSON.stringify(payload.meta),
            };
        });
    };
}
export const __testable__ = {
    fromCodeBlockDocumentToShikiAnnotationPayload,
    resolveStyleFromRule,
};
