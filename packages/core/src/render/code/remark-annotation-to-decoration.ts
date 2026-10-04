import type { Code, Root } from "mdast";
import type { DecorationItem } from "shiki";
import { visit } from "unist-util-visit";
import type {
	AnnotationConfig,
	AnnotationRegistry,
	CodeBlockAnnotation,
	CodeBlockDocument,
	LineAnnotation,
} from "../../code-block";
import { createAnnotationRegistry, fromCodeFenceToCodeBlockDocument, supportsAnnotationScope } from "../../code-block";
import { createAllowedRenderTagsFromConfig } from "./render-policy";

type HProperties = { hProperties?: Record<string, unknown> };
type AnnotationWithClass = { class: string };
type AnnotationWithRender = { render: string };

const hasClass = (annotation: { class?: string }): annotation is AnnotationWithClass =>
	"class" in annotation && typeof annotation.class === "string";

const hasRender = (annotation: { render?: string }): annotation is AnnotationWithRender =>
	"render" in annotation && typeof annotation.render === "string";

type ResolvedAnnotationStyle = { class?: string; render?: string };

const resolveStyleFromRule = (
	registry: AnnotationRegistry | undefined,
	annotation: Pick<CodeBlockAnnotation, "name" | "scope">,
): ResolvedAnnotationStyle | undefined => {
	if (!registry) return;
	const rule = registry.get(annotation.name);
	if (!rule || !supportsAnnotationScope(rule, annotation.scope)) return;

	if (rule.kind === "class") {
		if (typeof rule.class !== "string") return;
		return { class: rule.class };
	}

	if (typeof rule.render !== "string") return;
	return { render: rule.render };
};

// Temporary adapter: supports legacy payloads that still carry class/render on annotations.
const resolveStyle = (
	registry: AnnotationRegistry | undefined,
	annotation: Pick<CodeBlockAnnotation, "name" | "scope"> & { class?: string; render?: string },
): ResolvedAnnotationStyle | undefined => {
	const fromRule = resolveStyleFromRule(registry, annotation);
	if (fromRule) return fromRule;

	const fallback: ResolvedAnnotationStyle = {};
	if (typeof annotation.class === "string") fallback.class = annotation.class;
	if (typeof annotation.render === "string") fallback.render = annotation.render;
	return fallback.class || fallback.render ? fallback : undefined;
};

const buildInlineDecoration = (
	lineNumber: number,
	annotation: CodeBlockDocument["lines"][number]["annotations"][number],
	style: ResolvedAnnotationStyle | undefined,
): DecorationItem | undefined => {
	if (annotation.range.start >= annotation.range.end) return undefined;

	if (style && hasClass(style)) {
		return {
			start: { line: lineNumber, character: annotation.range.start },
			end: { line: lineNumber, character: annotation.range.end },
			properties: { class: style.class },
		};
	}

	if (style && hasRender(style)) {
		const props: Record<string, string> = { "data-anno-render": style.render };
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

const toLineDecorationPayload = (annotation: LineAnnotation, style: ResolvedAnnotationStyle | undefined) => {
	if (!style || !hasClass(style)) return undefined;

	return {
		scope: annotation.scope,
		name: annotation.name,
		range: annotation.range,
		order: annotation.order,
		class: style.class,
		attributes: annotation.attributes ?? [],
	};
};

const toLineWrapperPayload = (annotation: LineAnnotation, style: ResolvedAnnotationStyle | undefined) => {
	if (!style || !hasRender(style)) return undefined;

	return {
		scope: annotation.scope,
		name: annotation.name,
		range: annotation.range,
		order: annotation.order,
		render: style.render,
		attributes: annotation.attributes ?? [],
	};
};

export type LineDecorationPayload =
	ReturnType<typeof toLineDecorationPayload> extends infer T ? Exclude<T, undefined> : never;
export type LineWrapperPayload =
	ReturnType<typeof toLineWrapperPayload> extends infer T ? Exclude<T, undefined> : never;

export type ShikiAnnotationPayload = {
	code: string;
	lang: CodeBlockDocument["lang"];
	meta: CodeBlockDocument["meta"];
	decorations: DecorationItem[];
	lineDecorations: LineDecorationPayload[];
	rowWrappers: LineWrapperPayload[];
};

export const fromCodeBlockDocumentToShikiAnnotationPayload = (
	document: CodeBlockDocument,
	annotationConfig?: AnnotationConfig,
): ShikiAnnotationPayload => {
	const decorations: DecorationItem[] = [];
	const lineDecorations: LineDecorationPayload[] = [];
	const rowWrappers: LineWrapperPayload[] = [];
	const registry = annotationConfig ? createAnnotationRegistry(annotationConfig) : undefined;
	const lineStartOffsets: number[] = [];
	let lineStart = 0;

	for (const line of document.lines) {
		lineStartOffsets.push(lineStart);
		lineStart += line.value.length + 1;
	}

	document.lines.forEach((line, lineNumber) => {
		const lineOffset = lineStartOffsets[lineNumber] ?? 0;
		for (const annotation of line.annotations) {
			const style = resolveStyle(registry, annotation);
			const decoration = buildInlineDecoration(
				lineNumber,
				{
					...annotation,
					range: {
						start: annotation.range.start - lineOffset,
						end: annotation.range.end - lineOffset,
					},
				},
				style,
			);
			if (decoration) decorations.push(decoration);
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

export function remarkAnnotationToShikiDecoration(annotationConfig: AnnotationConfig) {
	const allowedRenderTags = createAllowedRenderTagsFromConfig(annotationConfig);

	return (tree: Root) => {
		visit(tree, "code", (node: Code) => {
			const document = fromCodeFenceToCodeBlockDocument(node, annotationConfig, { parseLineAnnotations: true });
			const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, annotationConfig);

			node.value = payload.code;
			// `hProperties`는 mdast-util-to-hast가 읽는 값이라, 이 패키지는 그 타입을 끌어오지 않고 직접 좁힌다.
			node.data ??= {};
			const data = node.data as HProperties;
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
