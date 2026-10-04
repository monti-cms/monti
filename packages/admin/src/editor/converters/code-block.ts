import type { AnnotationAttr, CodeBlockDocument, InlineAnnotation, LineAnnotation } from "@monti-cms/core/code-block";
import {
	annotationConfig,
	type CodeLineEffect,
	type CodeRule,
	type CodeSpan,
	charEffectByMark,
	charEffectByName,
	checkPattern,
	clampLineEffects,
	fromCodeBlockDocumentToCodeFence,
	fromCodeFenceToCodeBlockDocument,
	isLineEffectName,
	lineStarts,
	modelFingerprint,
} from "@monti-cms/core/code-block";
import type { CmsNode } from "@monti-cms/core/mdx";
import type { JSONContent } from "@tiptap/core";
import { asString } from "./shared";
import type { BlockConverter } from "./types";

const extractCodeBlockValue = (node: CmsNode): string => {
	const value = asString(node.attrs?.value);
	if (value != null) return value;
	const document = node.attrs?.codeDocument;
	if (document && typeof document === "object" && !Array.isArray(document)) {
		return fromCodeBlockDocumentToCodeFence(document as unknown as CodeBlockDocument, annotationConfig).value;
	}
	return "";
};

const attrsFrom = (attributes: AnnotationAttr[] | undefined): Record<string, unknown> =>
	Object.fromEntries((attributes ?? []).map((attr) => [attr.name, attr.value]));

const attributesFrom = (attrs: Record<string, unknown>): AnnotationAttr[] =>
	Object.entries(attrs)
		.filter(([, value]) => value !== undefined && value !== null && value !== false)
		.map(([name, value]) => ({ name, value }));

/** 글자 효과의 마크 속성만 남긴다(툴팁 설명, 접기의 처음부터 펼침). */
const spanAttrs = (name: string, attrs: Record<string, unknown>): Record<string, unknown> =>
	name === "Tooltip" ? { content: String(attrs.content ?? "") } : name === "fold" ? { open: attrs.open === true } : {};

const sameAttrs = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b);

/** 같은 효과가 이어지면 하나로 합친다. 같은 효과가 속성만 달리 겹치면 마크로 나타낼 수 없어 null이다. */
function mergeSpans(spans: CodeSpan[]): CodeSpan[] | null {
	const sorted = [...spans].sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from);
	const merged: CodeSpan[] = [];
	for (const span of sorted) {
		const last = merged[merged.length - 1];
		if (last && last.name === span.name && span.from <= last.to) {
			if (!sameAttrs(last.attrs, span.attrs)) {
				if (span.from < last.to) return null;
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

/** Tiptap 코드 블록 내용(마크 달린 텍스트)에서 글자 효과 범위를 읽는다. */
export function spansFromContent(content: JSONContent[] | undefined): CodeSpan[] {
	const spans: CodeSpan[] = [];
	let offset = 0;
	for (const child of content ?? []) {
		if (child.type !== "text") continue;
		const length = (child.text ?? "").length;
		for (const mark of child.marks ?? []) {
			const effect = charEffectByMark(mark.type);
			if (!effect) continue;
			spans.push({
				name: effect.name,
				from: offset,
				to: offset + length,
				attrs: spanAttrs(effect.name, mark.attrs ?? {}),
			});
		}
		offset += length;
	}
	// 마크가 붙은 텍스트는 이어져 있어도 마크 조합마다 나뉜다. 같은 효과를 다시 잇는다.
	const merged: CodeSpan[] = [];
	for (const span of [...spans].sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from)) {
		const last = merged[merged.length - 1];
		if (last && last.name === span.name && last.to === span.from && sameAttrs(last.attrs, span.attrs))
			last.to = span.to;
		else merged.push(span);
	}
	return merged;
}

/** 글자 효과 범위를 마크 달린 텍스트 조각으로 바꾼다. */
function contentFromSpans(text: string, spans: readonly CodeSpan[]): JSONContent[] {
	const cuts = new Set([0, text.length]);
	for (const span of spans) {
		cuts.add(span.from);
		cuts.add(span.to);
	}
	const points = [...cuts].filter((point) => point >= 0 && point <= text.length).sort((a, b) => a - b);
	const content: JSONContent[] = [];
	for (let index = 0; index < points.length - 1; index += 1) {
		const from = points[index] ?? 0;
		const to = points[index + 1] ?? 0;
		if (to <= from) continue;
		const marks = spans
			.filter((span) => span.from <= from && to <= span.to)
			.flatMap((span) => {
				const effect = charEffectByName(span.name);
				if (!effect) return [];
				const attrs = spanAttrs(span.name, span.attrs);
				return [Object.keys(attrs).length ? { type: effect.mark, attrs } : { type: effect.mark }];
			});
		content.push({ type: "text", text: text.slice(from, to), ...(marks.length ? { marks } : {}) });
	}
	return content;
}

export interface ParsedCodeFence {
	text: string;
	spans: CodeSpan[];
	lineEffects: CodeLineEffect[];
	rules: CodeRule[];
}

/**
 * 코드 펜스 값(주석 줄 포함)을 에디터 모델로 읽는다.
 * 에디터가 나타낼 수 없는 주석(알 수 없는 줄 효과, 같은 효과가 속성만 달리 겹침)이 있으면 null — 원문 편집으로 연다.
 */
export function parseCodeFence(value: string, language: string | null, meta: string | null): ParsedCodeFence | null {
	let document: CodeBlockDocument;
	try {
		document = fromCodeFenceToCodeBlockDocument(
			{ type: "code", lang: language ?? undefined, meta: meta ?? undefined, value },
			annotationConfig,
		);
	} catch {
		return null;
	}

	const spans: CodeSpan[] = [];
	for (const annotation of document.lines.flatMap((line) => line.annotations)) {
		if (annotation.rule !== undefined) continue;
		const effect = charEffectByName(annotation.name);
		if (!effect) return null;
		spans.push({
			name: effect.name,
			from: annotation.range.start,
			to: annotation.range.end,
			attrs: spanAttrs(effect.name, attrsFrom(annotation.attributes)),
		});
	}
	const merged = mergeSpans(spans);
	if (!merged) return null;

	// 아이디는 순서로 정한다. 같은 원문은 늘 같은 에디터 문서가 된다(불러오기·다시 저장 비교가 흔들리지 않게).
	const lineEffects: CodeLineEffect[] = [];
	for (const annotation of document.annotations) {
		if (!isLineEffectName(annotation.name)) return null;
		lineEffects.push({
			id: `l${lineEffects.length}`,
			name: annotation.name,
			start: annotation.range.start,
			end: annotation.range.end,
			attrs: attrsFrom(annotation.attributes),
		});
	}

	const rules: CodeRule[] = [];
	for (const rule of document.rules ?? []) {
		const effect = charEffectByName(rule.name);
		if (!effect) return null;
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

/** 에디터 모델을 코드 펜스 값(주석 줄 포함)으로 쓴다. */
export function serializeCodeFence(model: ParsedCodeFence, language: string | null): string {
	const lines = model.text.split("\n");
	const starts = lineStarts(model.text);
	const inline: InlineAnnotation[][] = lines.map(() => []);
	model.spans.forEach((span, order) => {
		// 주석 범위는 줄 기준이다. 여러 줄에 걸친 효과는 줄마다 나눈다.
		for (let line = 0; line < lines.length; line += 1) {
			const start = starts[line] ?? 0;
			const from = Math.max(span.from, start) - start;
			const to = Math.min(span.to, start + (lines[line]?.length ?? 0)) - start;
			if (to <= from) continue;
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

	const annotations: LineAnnotation[] = clampLineEffects(model.lineEffects, lines.length).map((effect, order) => ({
		scope: "line",
		name: effect.name,
		range: { start: effect.start, end: effect.end },
		order,
		priority: 0,
		attributes: attributesFrom(effect.attrs),
	}));

	const document: CodeBlockDocument = {
		lang: language || "text",
		meta: {},
		annotations,
		lines: lines.map((value, index) => ({ value, annotations: inline[index] ?? [] })),
		rules: model.rules
			.filter((rule) => rule.scope === "document" || (rule.line !== undefined && rule.line < lines.length))
			// 아직 다 쓰지 않은(틀린) 정규식은 저장하지 않는다.
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

const fingerprintOf = (
	language: string | null,
	content: JSONContent[] | undefined,
	lineEffects: CodeLineEffect[],
	rules: CodeRule[],
) => {
	const text = (content ?? []).map((child) => (child.type === "text" ? (child.text ?? "") : "")).join("");
	return modelFingerprint({ language, text, spans: spansFromContent(content), lineEffects, rules });
};

export const codeBlockConverter: BlockConverter = {
	name: "codeBlock",
	cmsTypes: ["codeBlock"],
	tiptapTypes: ["codeBlock"],
	isMappable: () => true,

	toTiptap(node: CmsNode) {
		const language = asString(node.attrs?.language) ?? null;
		const meta = asString(node.attrs?.meta) ?? null;
		const source = extractCodeBlockValue(node);
		const parsed = parseCodeFence(source, language, meta);

		if (!parsed) {
			// 나타낼 수 없는 주석이 있으면 주석 줄까지 원문 그대로 편집한다(데이터를 잃지 않는다).
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

	toCms(node: JSONContent) {
		const content = node.content ?? [];
		const text = content.map((child) => (child?.type === "text" ? (child.text ?? "") : "")).join("");
		const language = asString(node.attrs?.language) ?? null;
		const meta = asString(node.attrs?.meta) ?? null;
		const attrs = { ...(language ? { language } : {}), ...(meta ? { meta } : {}) };

		if (node.attrs?.rawMode === true) return [{ type: "codeBlock", attrs: { ...attrs, value: text } }];

		const lineEffects = Array.isArray(node.attrs?.lineEffects) ? (node.attrs.lineEffects as CodeLineEffect[]) : [];
		const rules = Array.isArray(node.attrs?.rules) ? (node.attrs.rules as CodeRule[]) : [];
		const source = asString(node.attrs?.source);
		// 불러온 뒤 바뀐 것이 없으면 원문 그대로 저장한다(주석 줄의 위치·쓰는 방식까지 바이트 불변).
		if (source != null && fingerprintOf(language, content, lineEffects, rules) === node.attrs?.sourceKey)
			return [{ type: "codeBlock", attrs: { ...attrs, value: source } }];

		const value = serializeCodeFence({ text, spans: spansFromContent(content), lineEffects, rules }, language);
		return [{ type: "codeBlock", attrs: { ...attrs, value } }];
	},
};
