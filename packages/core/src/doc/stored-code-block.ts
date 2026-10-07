import { fromCodeFenceToCodeBlockDocument } from "../annotation/code-block/code-fence-to-document";
import { fromCodeBlockDocumentToCodeFence } from "../annotation/code-block/document-to-code-fence";
import type { AnnotationAttr, CodeBlockDocument, CodeBlockRule } from "../annotation/code-block/types";
import type { Site } from "../site";
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

/** What the code block functions need of a site: its code fence comment config (the line effects it uses). */
export type CodeBlockSite = Pick<Site, "annotationConfig">;

const parseFence = (site: CodeBlockSite, language: string, meta: string, value: string): CodeBlockDocument =>
	fromCodeFenceToCodeBlockDocument(
		{ type: "code", lang: language || undefined, meta: meta || undefined, value },
		site.annotationConfig,
	);

const asString = (value: CmsJsonValue | undefined) => (typeof value === "string" ? value : "");
const asNumber = (value: CmsJsonValue | undefined) => (typeof value === "number" ? value : 0);
const asRecords = (value: CmsJsonValue | undefined): Record<string, CmsJsonValue>[] =>
	Array.isArray(value)
		? value.filter(
				(item): item is Record<string, CmsJsonValue> => !!item && typeof item === "object" && !Array.isArray(item),
			)
		: [];

/** Names of the line annotations of a working code block whose range reaches past its last code line. Stored, they are cut or dropped. */
export const outOfRangeAnnotationNames = (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>): string[] => {
	const names: string[] = [];
	fromCodeFenceToCodeBlockDocument(
		{
			type: "code",
			lang: asString(attrs.language) || undefined,
			meta: asString(attrs.meta) || undefined,
			value: asString(attrs.value),
		},
		site.annotationConfig,
		{ onOutOfRange: (annotation) => names.push(annotation.name) },
	);
	return names;
};

/** The stored attributes of a code block from its working attributes (`language`, `meta`, and `value` with the annotation comments). */
export const storedCodeBlockAttrs = (
	site: CodeBlockSite,
	attrs: Record<string, CmsJsonValue>,
): Record<string, CmsJsonValue> => {
	const language = asString(attrs.language);
	const meta = asString(attrs.meta);
	const parsed = parseFence(site, language, meta, asString(attrs.value));

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
export const storedCodeBlockFence = (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>): string => {
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
	// Text offsets are into the whole code, as the parser keeps them. The writer takes a range that fits inside its line as the line's own, so an offset into the
	// code is given as one into the line: otherwise a range on a later line that happens to fit (after a short first line) would be written where it is not.
	const lineStarts: number[] = [];
	let lineStart = 0;
	for (const line of document.lines) {
		lineStarts.push(lineStart);
		lineStart += line.value.length + 1;
	}
	asRecords(annotations.text).forEach((item, order) => {
		const lineIndex = asNumber(item.line);
		const line = document.lines[lineIndex];
		const scope = item.scope === "document" ? "document" : "char";
		const offset = scope === "char" ? (lineStarts[lineIndex] ?? 0) : 0;
		const start = asNumber(item.start) - offset;
		const end = asNumber(item.end) - offset;
		line?.annotations.push({
			scope,
			name: asString(item.name),
			range: start >= 0 ? { start, end } : { start: asNumber(item.start), end: asNumber(item.end) },
			attributes: attributesOf(item.attrs),
			priority: 0,
			order,
			source: "mdast",
		});
	});
	return fromCodeBlockDocumentToCodeFence(document, site.annotationConfig).value;
};

/** The annotation document of a stored code block (the one `workingCodeBlockAttrs` keeps as `codeDocument`), for a renderer that needs only that. */
export const codeBlockDocumentOf = (site: CodeBlockSite, attrs: Record<string, CmsJsonValue>): CodeBlockDocument =>
	parseFence(site, asString(attrs.language), asString(attrs.meta), storedCodeBlockFence(site, attrs));

/** Fields the code block node owns. A fence meta key with the same name (`value="x"`) must not overwrite them. */
const OWN_FIELDS = new Set(["language", "meta", "value", "codeDocument"]);

/**
 * The working attributes of a stored code block (what `toDocument` makes from a fence): `language`, `meta`, `value` with the annotation
 * comments, the parsed annotation document, and the fence's meta keys as attributes.
 */
export const workingCodeBlockAttrs = (
	site: CodeBlockSite,
	attrs: Record<string, CmsJsonValue>,
): Record<string, CmsJsonValue> => {
	const language = asString(attrs.language);
	const meta = asString(attrs.meta);
	const value = storedCodeBlockFence(site, attrs);
	const codeDocument = parseFence(site, language, meta, value);
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
