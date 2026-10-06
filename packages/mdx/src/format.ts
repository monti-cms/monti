import {
	type CmsMark,
	type CmsNode,
	entryIdOfMark,
	type StoredDocument,
	withoutBlockIds,
} from "@monti-cms/core/document";
import {
	type CmsFormat,
	defineFormat,
	type FormatExportContext,
	type FormatImportResult,
	type FormatIssue,
} from "@monti-cms/core/format";
import { bodyFromMdx, documentToMdx } from "./body";
import type { SyntaxExtension } from "./syntax/types";
import { NO_SYNTAX } from "./syntax-config";

/**
 * The `mdx` format: the stored document written as MDX (CommonMark + GFM + standard MDX JSX, and the syntax extensions it is given) and read back. It is
 * the format a site picks with `format: "mdx"`, the notation of the source panel in the admin and the text the AI plugin's model reads and writes.
 *
 * Both directions are pure functions of their arguments (the site's blocks are the only thing they read, from the site config), so the format runs on the
 * server and in the browser alike.
 */

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

export interface MdxFormatOptions {
	/** Syntax extensions (`directiveSyntax()`, `shikiNotationSyntax()`), in precedence order for writing. None: standard MDX only. */
	readonly syntax?: readonly SyntaxExtension[];
}

/** The `mdx` format reading and writing with the given syntax extensions. */
export const createMdxFormat = (options: MdxFormatOptions = {}): CmsFormat<"mdx"> => {
	const syntax = options.syntax ?? NO_SYNTAX;

	const exportDocument = (doc: StoredDocument, ctx: FormatExportContext): string =>
		documentToMdx({ ...doc, content: resolveNodes(doc.content, ctx) }, syntax);

	const importText = (text: string): FormatImportResult => {
		const body = bodyFromMdx(text, syntax);
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

	return defineFormat({
		name: "mdx",
		label: "MDX",
		mimeType: "text/mdx",
		extension: "mdx",
		export: exportDocument,
		import: importText,
	});
};

/** The `mdx` format with no syntax extension (standard MDX). A site with extensions gets its own from `mdx({ syntax })`. */
export const mdxFormat: CmsFormat<"mdx"> = createMdxFormat();

export { analyze } from "./analyze";
export {
	type Body,
	type BodyOptions,
	bodyDocument,
	bodyFromDocument,
	bodyFromMdx,
	documentToMdx,
	fromStoredDocument,
	type OutOfRangeAnnotation,
	toStoredDocument,
} from "./body";
export * from "./directives";
export { mdxMessages } from "./messages";
export { parseMdxAst } from "./parse";
export { BLOCK_JSX_NAMES, INLINE_JSX_MARKS, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "./registry";
export { remarkFenceBlocksToMdx } from "./remark-fence-blocks";
export { serialize } from "./serialize";
export { insertSoftBreaks, type SoftBreakResult } from "./soft-breaks";
export {
	configuredSyntax,
	NO_SYNTAX,
	siteCodeLineEffects,
	siteSyntaxBlocks,
	syntaxRemarkPlugins,
} from "./syntax-config";
export { toDocument } from "./to-document";
export { compareMdxStructure, readableMdx } from "./translation-check";
export type {
	CmsJsxAttribute,
	CmsMdxAnalysis,
	CmsMdxError,
	CmsMdxErrorCode,
	CmsMdxPosition,
} from "./types";
