import { withoutBlockIds } from "../mdx/block-ids";
import { entryIdOfMark } from "../mdx/entry-links";
import { bodyFromMdx, documentToMdx, type StoredDocument } from "../mdx/stored-document";
import { syntaxBlocks, syntaxCodeLineEffects } from "../mdx/syntax";
import type { CmsMark, CmsNode } from "../mdx/types";
import {
	type CmsFormat,
	defineFormat,
	type FormatContext,
	type FormatExportContext,
	type FormatImportResult,
	type FormatIssue,
} from "./types";

/**
 * The built-in `mdx` format: the stored document written as MDX (CommonMark + GFM + standard MDX JSX, and the site's syntax extensions) and read back.
 * It is the same code core always used for MDX, behind the format seam; it moves to the `@monti-cms/mdx` package when MDX leaves core.
 */

/** What a format may rely on, from the site config: its blocks and code line effects. Core and the admin build the context of the built-in format with it. */
export const builtInFormatContext = (locale: string): FormatContext => ({
	locale,
	blocks: syntaxBlocks,
	codeLineEffects: syntaxCodeLineEffects,
});

/**
 * The marks of a text with its internal links resolved: a link by id becomes a link to the real path of its target. A link that cannot be resolved is
 * dropped for a reader (the label stays) and kept as its id for a text that will be imported again. Returns `undefined` when no mark changed.
 */
const resolveMarks = (marks: readonly CmsMark[], ctx: FormatExportContext): CmsMark[] | undefined => {
	let changed = false;
	const next: CmsMark[] = [];
	for (const mark of marks) {
		const entryId = entryIdOfMark(mark);
		if (!entryId) {
			next.push(mark);
			continue;
		}
		changed = true;
		const link = ctx.link(entryId);
		if (link) {
			next.push({ attrs: { href: link.url }, type: "link" });
			continue;
		}
		ctx.report({ code: "unresolved_internal_link", message: entryId, params: { entryId } });
		// A text to read (a site, a feed) cannot use an id of this database, so the link is dropped and its label stays. A text to import again keeps the id.
		if (ctx.purpose === "sync") next.push(mark);
	}
	return changed ? next : undefined;
};

const fileLabel = (node: CmsNode, filename: string): string =>
	typeof node.attrs?.label === "string" && node.attrs.label.trim() ? node.attrs.label : filename;

/** The document as a reader of the text needs it: internal links by address, registered images by URL. */
const resolveNodes = (nodes: readonly CmsNode[], ctx: FormatExportContext): CmsNode[] =>
	nodes.map((node): CmsNode => {
		let next = node;
		if (node.marks) {
			const marks = resolveMarks(node.marks, ctx);
			if (marks) next = { ...next, ...(marks.length > 0 ? { marks } : {}) };
			if (marks && marks.length === 0) {
				const { marks: _dropped, ...rest } = next;
				next = rest;
			}
		}
		const mediaId = typeof node.attrs?.mediaId === "string" ? node.attrs.mediaId : undefined;
		if (mediaId && ctx.purpose === "read" && (node.type === "image" || node.type === "file")) {
			const media = ctx.media(mediaId);
			if (!media) {
				ctx.report({ code: "unresolved_media", message: mediaId, params: { mediaId } });
			} else if (node.type === "image") {
				const { mediaId: _mediaId, ...attrs } = node.attrs ?? {};
				next = { ...next, attrs: { ...attrs, src: media.url } };
			} else {
				// An attachment card is drawn by the site's own components; outside it, the file is a link to its URL.
				next = {
					content: [
						{
							marks: [{ attrs: { href: media.url }, type: "link" }],
							text: fileLabel(node, media.filename),
							type: "text",
						},
					],
					type: "paragraph",
				};
			}
		}
		if (next.content) {
			const content = resolveNodes(next.content, ctx);
			next = { ...next, content };
		}
		return next;
	});

const exportDocument = (doc: StoredDocument, ctx: FormatExportContext): string =>
	documentToMdx({ ...doc, content: resolveNodes(doc.content, ctx) });

const importText = (text: string): FormatImportResult => {
	const body = bodyFromMdx(text);
	if (body.doc) {
		const { doc } = body;
		const warnings: FormatIssue[] = (body.outOfRange ?? []).map((item) => {
			const blockIndex = doc.content.findIndex((block) => block.id === item.blockId);
			return {
				code: "code_annotation_out_of_range",
				message: item.name,
				params: { name: item.name },
				...(blockIndex < 0 ? {} : { blockIndex }),
			};
		});
		// Block ids are core's to give: the ones the parser made are dropped.
		return { ok: true, doc: { ...doc, content: withoutBlockIds(doc.content) }, warnings };
	}
	const { analysis } = body;
	const issues: FormatIssue[] = analysis.errors.map((error) => ({
		code: "mdx_error",
		message: error.message,
		params: { reason: error.code, ...error.params },
		position: { line: error.position.line, column: error.position.column },
	}));
	if (analysis.frontmatter !== null) issues.push({ code: "frontmatter_present", position: { line: 1, column: 1 } });
	return { ok: false, issues };
};

export const mdxFormat: CmsFormat<"mdx"> = defineFormat({
	name: "mdx",
	label: "MDX",
	mimeType: "text/mdx",
	extension: "mdx",
	export: exportDocument,
	import: importText,
});
