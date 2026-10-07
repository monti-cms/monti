import type { Element, Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { type ComponentType, Fragment, type ReactNode } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { parseCodeFenceMeta } from "../../annotation/code-block/code-fence-to-document";
import { codeBlockDocumentOf } from "../../doc/stored-code-block";
import type { CmsJsonValue, CmsNode } from "../../doc/types";
import type { Site } from "../../site";
import {
	type CodeHighlightOptions,
	createAllowedRenderTagsFromConfig,
	createCodeHighlighter,
	fromCodeBlockDocumentToShikiAnnotationPayload,
	type HighlightFn,
	type HighlightSite,
	showsLineNumbers,
	siteHighlight,
} from "../code";
import type { StoredCodeAnnotations } from "./types";

/**
 * Code blocks of a stored document: the stored code and annotations go through the same Shiki pipeline the MDX chain used (annotation payload → `highlight`),
 * and the highlighted `<pre>` becomes React elements with `hast-util-to-jsx-runtime`. No data is smuggled through element attributes.
 */

export interface HighlightedCode {
	/** The `<pre>` element, with only the properties Shiki sets (and the line number flag). */
	readonly pre: Element;
	/** Descriptions of the tooltips inside the code, in number order. */
	readonly notes: readonly string[];
	readonly showLineNumbers: boolean;
	readonly title?: string;
	readonly code: string;
	readonly language: string;
}

const hasHighlighterOptions = (options: CodeHighlightOptions) =>
	options.langs !== undefined || options.themes !== undefined || options.langAlias !== undefined;

const customHighlighters = new WeakMap<object, Promise<HighlightFn>>();

/** The function that highlights for the given code options: theirs, one built from their languages and themes, or the site's. */
export const highlighterFor = (
	site: HighlightSite,
	options: CodeHighlightOptions | undefined,
): Promise<HighlightFn> | HighlightFn => {
	if (!options) return siteHighlight(site);
	if (options.highlight) return options.highlight;
	if (!hasHighlighterOptions(options)) return siteHighlight(site);
	let created = customHighlighters.get(options);
	if (!created) {
		created = createCodeHighlighter(options).then((highlighter) => highlighter.highlight);
		customHighlighters.set(options, created);
	}
	return created;
};

// `tabindex` is left out: the MDX frame (`CmsPre`) never set it, so the markup stays the same.
const PRE_PROPERTIES = new Set(["class", "className", "style"]);

const parseNotes = (value: unknown): string[] => {
	if (typeof value !== "string") return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
};

const plainPre = (code: string): Element => ({
	type: "element",
	tagName: "pre",
	properties: {},
	children: [{ type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: code }] }],
});

const stringOf = (value: CmsJsonValue | undefined): string => (typeof value === "string" ? value : "");

/** The language, code, title and annotations a stored code block holds, as plain values. */
export const readCodeBlock = (node: CmsNode) => {
	const attrs = node.attrs ?? {};
	const annotations = attrs.annotations;
	const meta = stringOf(attrs.meta);
	const title = parseCodeFenceMeta(meta).title;
	return {
		language: stringOf(attrs.language),
		code: stringOf(attrs.code),
		meta,
		/** The file name (`title="src/a.ts"` in the fence meta). */
		title: typeof title === "string" ? title : undefined,
		annotations: (annotations && typeof annotations === "object" && !Array.isArray(annotations)
			? annotations
			: {}) as StoredCodeAnnotations,
	};
};

/** Highlights one stored code block. It never throws: code that cannot be annotated or highlighted is shown as plain text. */
export const highlightCodeBlock = (
	site: Pick<Site, "annotationConfig">,
	node: CmsNode,
	highlight: HighlightFn,
	options: CodeHighlightOptions | undefined,
) => {
	const { language, code } = readCodeBlock(node);
	const lang = language || "text";
	try {
		const document = codeBlockDocumentOf(site, node.attrs ?? {});
		const payload = fromCodeBlockDocumentToShikiAnnotationPayload(document, site.annotationConfig);
		const title = typeof payload.meta.title === "string" ? payload.meta.title : undefined;
		const numbered = showsLineNumbers(payload.meta);
		const base = { code: payload.code, language: lang, showLineNumbers: numbered, ...(title ? { title } : {}) };
		if (options?.ignoreLang?.(lang))
			return { ...base, pre: plainPre(payload.code), notes: [] } satisfies HighlightedCode;

		const root: Root = highlight(payload.code, lang, payload.meta, {
			decorations: payload.decorations,
			lineDecorations: payload.lineDecorations,
			rowWrappers: payload.rowWrappers,
			allowedRenderTags: createAllowedRenderTagsFromConfig(site.annotationConfig),
		});
		const found = root.children.find((child): child is Element => child.type === "element");
		if (!found) return { ...base, pre: plainPre(payload.code), notes: [] } satisfies HighlightedCode;

		const properties: Element["properties"] = {};
		for (const [key, value] of Object.entries(found.properties ?? {})) {
			if (PRE_PROPERTIES.has(key)) properties[key] = value;
		}
		// CSS draws line numbers whenever the attribute exists. If off, the attribute is not set.
		if (numbered) properties["data-show-line-numbers"] = "true";
		const pre: Element = { ...found, properties };
		return { ...base, pre, notes: parseNotes(found.properties?.notes) } satisfies HighlightedCode;
	} catch {
		const plain = code;
		return {
			code: plain,
			language: lang,
			showLineNumbers: false,
			pre: plainPre(plain),
			notes: [],
		} satisfies HighlightedCode;
	}
};

/** Elements in the highlighted code that a component draws (`fold`, `collapse`, `Tooltip`, ...): the tag → component table. */
export type CodeTags = Readonly<Record<string, ComponentType<{ readonly children?: ReactNode }>>>;

const PassThrough = ({ children }: { readonly children?: ReactNode }) => children;

/** The highlighted `<pre>` as React elements. A render tag without a component shows its text. */
export const codePreElement = (site: Pick<Site, "annotationConfig">, pre: Element, tags: CodeTags): ReactNode => {
	const allowed = createAllowedRenderTagsFromConfig(site.annotationConfig);
	const components: Record<string, ComponentType<{ readonly children?: ReactNode }>> = {};
	// Only components (`Tooltip`) can be missing: the lowercase tags are HTML elements, or `fold` and `collapse`, which the core defaults draw.
	for (const tag of allowed) if (/^[A-Z]/.test(tag)) components[tag] = PassThrough;
	Object.assign(components, tags);
	return toJsxRuntime(pre, { Fragment, jsx, jsxs, components });
};
