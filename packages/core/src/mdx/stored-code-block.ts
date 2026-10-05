import { annotationConfig } from "../annotation/code-block/active";
import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "../annotation/code-block/document-to-code-fence";
import type { AnnotationAttr, CodeBlockDocument, CodeBlockRule } from "../annotation/code-block/types";
import type { CmsJsonValue } from "./types";

/**
 * A code block in a stored document: the code itself and its annotations as data, not the fence text with Monti annotation comments in it.
 *
 * ```ts
 * { language: "ts", meta: 'title="a.ts"', code: "const a = 1;", annotations?: {
 *     lines?: [{ name: "plus", start: 0, end: 1, attrs?: { … } }],          // line effects over lines [start, end)
 *     text?:  [{ line: 0, scope: "char", name: "strong", start: 6, end: 7, attrs?: { … } }], // text effects (offsets as the parser keeps them)
 *     rules?: [{ scope: "document", name: "fold", pattern: "old", flags: "g", line?: 0, attrs?: { … } }], // ranges found by a regex
 * } }
 * ```
 *
 * The fence text is written from it with the Monti annotation comments (`fromCodeBlockDocumentToCodeFence`), so other tools that read the
 * MDX still see annotations as comments, and Monti reads them back to the same data. Values derived from it (the parsed annotation
 * document, the meta keys as attributes) are rebuilt when the document is read (`workingCodeBlockAttrs`).
 */

const attrsOf = (attributes: readonly AnnotationAttr[] | undefined): Record<string, CmsJsonValue> | undefined => {
	if (!attributes || attributes.length === 0) return undefined;
	const out: Record<string, CmsJsonValue> = {};
	for (const { name, value } of attributes) out[name] = value as CmsJsonValue;
	return out;
};

const attributesOf = (attrs: CmsJsonValue | undefined): AnnotationAttr[] =>
	attrs && typeof attrs === "object" && !Array.isArray(attrs)
		? Object.entries(attrs).map(([name, value]) => ({ name, value }))
		: [];

const withAttrs = <T extends Record<string, CmsJsonValue>>(item: T, attrs: Record<string, CmsJsonValue> | undefined) =>
	attrs ? { ...item, attrs } : item;

const parseFence = (language: string, meta: string, value: string): CodeBlockDocument =>
	fromCodeFenceToCodeBlockDocument(
		{ type: "code", lang: language || undefined, meta: meta || undefined, value },
		annotationConfig,
	);

const asString = (value: CmsJsonValue | undefined) => (typeof value === "string" ? value : "");
const asNumber = (value: CmsJsonValue | undefined) => (typeof value === "number" ? value : 0);
const asRecords = (value: CmsJsonValue | undefined): Record<string, CmsJsonValue>[] =>
	Array.isArray(value)
		? value.filter(
				(item): item is Record<string, CmsJsonValue> => !!item && typeof item === "object" && !Array.isArray(item),
			)
		: [];

/** The stored attributes of a code block from its working attributes (`language`, `meta`, and `value` with the annotation comments). */
export const storedCodeBlockAttrs = (attrs: Record<string, CmsJsonValue>): Record<string, CmsJsonValue> => {
	const language = asString(attrs.language);
	const meta = asString(attrs.meta);
	const parsed = parseFence(language, meta, asString(attrs.value));

	// Stored in the order they are written back (by first line, then as written), so reading the written text gives the same list.
	const lines = [...parsed.annotations]
		.sort((a, b) => a.range.start - b.range.start || a.order - b.order)
		.map((annotation) =>
			withAttrs(
				{ name: annotation.name, start: annotation.range.start, end: annotation.range.end },
				attrsOf(annotation.attributes),
			),
		);
	const text = parsed.lines.flatMap((line, index) =>
		[...line.annotations]
			.sort((a, b) => a.order - b.order)
			// A range a rule found is not stored: the rule finds it again.
			.filter((annotation) => annotation.rule === undefined)
			.map((annotation) =>
				withAttrs(
					{
						line: index,
						scope: annotation.scope,
						name: annotation.name,
						start: annotation.range.start,
						end: annotation.range.end,
					},
					attrsOf(annotation.attributes),
				),
			),
	);
	const rules = (parsed.rules ?? []).map((rule) =>
		withAttrs(
			{
				scope: rule.scope,
				name: rule.name,
				pattern: rule.pattern,
				flags: rule.flags,
				...(rule.line === undefined ? {} : { line: rule.line }),
			},
			attrsOf(rule.attributes),
		),
	);

	const annotations: Record<string, CmsJsonValue> = {};
	if (lines.length > 0) annotations.lines = lines;
	if (text.length > 0) annotations.text = text;
	if (rules.length > 0) annotations.rules = rules;
	return {
		language,
		meta,
		code: parsed.lines.map((line) => line.value).join("\n"),
		...(Object.keys(annotations).length > 0 ? { annotations } : {}),
	};
};

/** The fence text of a stored code block: its code with the annotations written back as Monti annotation comments. */
const fenceValue = (attrs: Record<string, CmsJsonValue>): string => {
	const code = asString(attrs.code);
	const annotations =
		attrs.annotations && typeof attrs.annotations === "object" && !Array.isArray(attrs.annotations)
			? attrs.annotations
			: {};
	const document: CodeBlockDocument = {
		lang: asString(attrs.language) || "text",
		meta: {},
		annotations: asRecords(annotations.lines).map((item, order) => ({
			scope: "line",
			name: asString(item.name),
			range: { start: asNumber(item.start), end: asNumber(item.end) },
			attributes: attributesOf(item.attrs),
			priority: 0,
			order,
		})),
		lines: code.split("\n").map((value) => ({ value, annotations: [] })),
		rules: asRecords(annotations.rules).map(
			(item): CodeBlockRule => ({
				scope: item.scope === "char" ? "char" : "document",
				name: asString(item.name),
				pattern: asString(item.pattern),
				flags: asString(item.flags),
				...(typeof item.line === "number" ? { line: item.line } : {}),
				attributes: attributesOf(item.attrs),
			}),
		),
	};
	asRecords(annotations.text).forEach((item, order) => {
		const line = document.lines[asNumber(item.line)];
		line?.annotations.push({
			scope: item.scope === "document" ? "document" : "char",
			name: asString(item.name),
			range: { start: asNumber(item.start), end: asNumber(item.end) },
			attributes: attributesOf(item.attrs),
			priority: 0,
			order,
			source: "mdast",
		});
	});
	return fromCodeBlockDocumentToCodeFence(document, annotationConfig).value;
};

/** Fields the code block node owns. A fence meta key with the same name (`value="x"`) must not overwrite them. */
const OWN_FIELDS = new Set(["language", "meta", "value", "codeDocument"]);

/**
 * The working attributes of a stored code block (what `toDocument` makes from a fence): `language`, `meta`, `value` with the annotation
 * comments, the parsed annotation document, and the fence's meta keys as attributes.
 */
export const workingCodeBlockAttrs = (attrs: Record<string, CmsJsonValue>): Record<string, CmsJsonValue> => {
	const language = asString(attrs.language);
	const meta = asString(attrs.meta);
	const value = fenceValue(attrs);
	const codeDocument = parseFence(language, meta, value);
	const out: Record<string, CmsJsonValue> = {
		language,
		meta,
		value,
		codeDocument: JSON.parse(JSON.stringify(codeDocument)) as CmsJsonValue,
	};
	for (const [key, item] of Object.entries(codeDocument.meta)) {
		if (!OWN_FIELDS.has(key)) out[key] = item;
	}
	return out;
};
