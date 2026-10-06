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
import type { CmsJsonValue, CmsNode } from "@monti-cms/core/document";
import { storedCodeBlockAttrs, storedCodeBlockFence } from "@monti-cms/core/document";
import type { JSONContent } from "@tiptap/core";
import { asString } from "./shared";
import type { BlockConverter } from "./types";

/** The fence text of a stored code block: its code with the annotations written as Monti annotation comments. This is the model the code editor works on. */
export const codeFenceOf = (node: CmsNode): string => storedCodeBlockFence(node.attrs ?? {});

/** The stored attributes of a code block from the editor's fence text (`language`, `meta`, and the value with its annotation comments). */
export const storedCodeAttrs = (
	language: string | null,
	meta: string | null,
	value: string,
): Record<string, CmsJsonValue> => storedCodeBlockAttrs({ language: language ?? "", meta: meta ?? "", value });

const attrsFrom = (attributes: AnnotationAttr[] | undefined): Record<string, unknown> =>
	Object.fromEntries((attributes ?? []).map((attr) => [attr.name, attr.value]));

const attributesFrom = (attrs: Record<string, unknown>): AnnotationAttr[] =>
	Object.entries(attrs)
		.filter(([, value]) => value !== undefined && value !== null && value !== false)
		.map(([name, value]) => ({ name, value }));

/** Keeps only the mark attributes of a char effect (tooltip content, collapse starting expanded). */
const spanAttrs = (name: string, attrs: Record<string, unknown>): Record<string, unknown> =>
	name === "Tooltip" ? { content: String(attrs.content ?? "") } : name === "fold" ? { open: attrs.open === true } : {};

const sameAttrs = (a: Record<string, unknown>, b: Record<string, unknown>) => JSON.stringify(a) === JSON.stringify(b);

/** Merges the same effect when consecutive. If the same effect overlaps with different attributes it cannot be represented as a mark, so null. */
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

/** Reads char effect ranges from Tiptap code block content (text with marks). */
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
	// Text with marks is split per mark combination even when contiguous. Rejoin the same effect.
	const merged: CodeSpan[] = [];
	for (const span of [...spans].sort((a, b) => a.name.localeCompare(b.name) || a.from - b.from)) {
		const last = merged[merged.length - 1];
		if (last && last.name === span.name && last.to === span.from && sameAttrs(last.attrs, span.attrs))
			last.to = span.to;
		else merged.push(span);
	}
	return merged;
}

/** Turns char effect ranges into text fragments with marks. */
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
 * Reads a code fence value (including comment lines) into the editor model.
 * null if there are comments the editor cannot represent (unknown line effects, the same effect overlapping with different attributes) - opens in raw editing.
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

	// IDs are assigned by order. The same source always becomes the same editor document (so load and re-save comparisons stay stable).
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

/** Writes the editor model as a code fence value (including comment lines). */
export function serializeCodeFence(model: ParsedCodeFence, language: string | null): string {
	const lines = model.text.split("\n");
	const starts = lineStarts(model.text);
	const inline: InlineAnnotation[][] = lines.map(() => []);
	model.spans.forEach((span, order) => {
		// Comment ranges are line-based. An effect spanning several lines is split per line.
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
		const source = codeFenceOf(node);
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

	toCms(node: JSONContent) {
		const content = node.content ?? [];
		const text = content.map((child) => (child?.type === "text" ? (child.text ?? "") : "")).join("");
		const language = asString(node.attrs?.language) ?? null;
		const meta = asString(node.attrs?.meta) ?? null;

		if (node.attrs?.rawMode === true) return [{ type: "codeBlock", attrs: storedCodeAttrs(language, meta, text) }];

		const lineEffects = Array.isArray(node.attrs?.lineEffects) ? (node.attrs.lineEffects as CodeLineEffect[]) : [];
		const rules = Array.isArray(node.attrs?.rules) ? (node.attrs.rules as CodeRule[]) : [];
		const source = asString(node.attrs?.source);
		// If nothing changed since loading, save the original text as is (byte-identical, including comment line positions and style).
		if (source != null && fingerprintOf(language, content, lineEffects, rules) === node.attrs?.sourceKey)
			return [{ type: "codeBlock", attrs: storedCodeAttrs(language, meta, source) }];

		const value = serializeCodeFence({ text, spans: spansFromContent(content), lineEffects, rules }, language);
		return [{ type: "codeBlock", attrs: storedCodeAttrs(language, meta, value) }];
	},
};
