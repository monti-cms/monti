import { documentText } from "@monti-cms/core/client";
import type { CmsMark, CmsNode } from "@monti-cms/core/document";
import { emptyStoredDocument, entryIdOfMark, entryLinkHref } from "@monti-cms/core/document";
import { defineFormat, type FormatExportContext } from "@monti-cms/core/format";

const ESCAPED = /[\\*`[\]]/g;

// ---- document -> text

const wrap = (text: string, mark: CmsMark, ctx: FormatExportContext): string => {
	if (mark.type === "code") return `\`${text}\``;
	if (mark.type === "bold") return `**${text}**`;
	if (mark.type === "italic") return `*${text}*`;
	if (mark.type === "link") {
		const entryId = entryIdOfMark(mark);
		// An internal link is written as the address of its target. The text is for readers (`read`) or for importing again (`sync`), and a link
		// whose target is gone stays as the label (read) or keeps its id (sync).
		const href = entryId
			? (ctx.link(entryId)?.url ?? (ctx.purpose === "sync" ? entryLinkHref(entryId) : null))
			: mark.attrs?.href;
		return typeof href === "string" ? `[${text}](${href})` : text;
	}
	return text; // a mark this format has no notation for (underline, a color…): the text stays
};

// The first mark is the innermost, so a link is the outermost: `[**text**](href)`.
const ORDER = ["code", "italic", "bold", "link"];

const inlineText = (nodes: readonly CmsNode[] | undefined, ctx: FormatExportContext): string =>
	(nodes ?? [])
		.map((node) => {
			if (node.type === "hardBreak") return "  \n";
			if (node.type !== "text") return node.content ? inlineText(node.content, ctx) : "";
			const marks = [...(node.marks ?? [])].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
			const isCode = marks.some((mark) => mark.type === "code");
			let text = isCode ? (node.text ?? "") : (node.text ?? "").replace(ESCAPED, "\\$&");
			for (const mark of marks) text = wrap(text, mark, ctx);
			return text;
		})
		.join("");

const blockText = (node: CmsNode, ctx: FormatExportContext): string => {
	switch (node.type) {
		case "paragraph":
			return inlineText(node.content, ctx);
		case "heading":
			return `${"#".repeat(Number(node.attrs?.level ?? 2))} ${inlineText(node.content, ctx)}`;
		case "bulletList":
		case "orderedList":
			return (node.content ?? [])
				.map((item, index) => {
					const body = (item.content ?? []).map((child) => blockText(child, ctx)).join(" ");
					return `${node.type === "bulletList" ? "-" : `${index + 1}.`} ${body}`;
				})
				.join("\n");
		default:
			// Say what the text could not keep. The API returns it as a warning of the export.
			ctx.report({
				code: "markdown_block_dropped",
				message: `A "${node.type}" block has no Markdown notation here and was left out.`,
				params: { block: node.type },
			});
			return "";
	}
};

// ---- text -> document

/** The index of the closing `delimiter` that is not escaped and not part of a longer run of `*`. */
const closing = (text: string, delimiter: string, from: number): number => {
	for (let at = from; at < text.length; at += 1) {
		if (text[at] === "\\") at += 1;
		else if (text.startsWith(delimiter, at) && text[at + delimiter.length] !== "*" && at > from) return at;
	}
	return -1;
};

function inlineNodes(text: string, marks: readonly CmsMark[] = []): CmsNode[] {
	const nodes: CmsNode[] = [];
	let plain = "";
	const push = (value: string, own: readonly CmsMark[]) => {
		if (value) nodes.push({ type: "text", text: value, ...(own.length > 0 ? { marks: [...own] } : {}) });
	};
	const flush = () => {
		push(plain, marks);
		plain = "";
	};
	for (let at = 0; at < text.length; ) {
		const char = text[at] as string;
		if (char === "\\" && at + 1 < text.length) {
			plain += text[at + 1];
			at += 2;
			continue;
		}
		if (char === "`") {
			const end = text.indexOf("`", at + 1);
			if (end > at + 1) {
				flush();
				push(text.slice(at + 1, end), [...marks, { type: "code" }]);
				at = end + 1;
				continue;
			}
		}
		if (char === "*") {
			const delimiter = text.startsWith("**", at) ? "**" : "*";
			const end = closing(text, delimiter, at + delimiter.length);
			if (end > 0) {
				flush();
				nodes.push(
					...inlineNodes(text.slice(at + delimiter.length, end), [
						...marks,
						{ type: delimiter === "**" ? "bold" : "italic" },
					]),
				);
				at = end + delimiter.length;
				continue;
			}
		}
		if (char === "[") {
			const link = /^\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/.exec(text.slice(at));
			if (link) {
				flush();
				nodes.push(...inlineNodes(link[1] as string, [...marks, { type: "link", attrs: { href: link[2] as string } }]));
				at += link[0].length;
				continue;
			}
		}
		plain += char;
		at += 1;
	}
	flush();
	return nodes;
}

const paragraph = (text: string): CmsNode => ({ type: "paragraph", content: inlineNodes(text) });

const blockNode = (lines: readonly string[]): CmsNode => {
	const first = lines[0] as string;
	const heading = /^(#{1,6}) (.*)$/.exec(first);
	if (heading && lines.length === 1)
		return {
			type: "heading",
			attrs: { level: (heading[1] as string).length },
			content: inlineNodes(heading[2] as string),
		};
	const bullet = lines.every((line) => /^[-*] /.test(line));
	const ordered = lines.every((line) => /^\d+\. /.test(line));
	if (bullet || ordered) {
		const items = lines.map(
			(line): CmsNode => ({ type: "listItem", content: [paragraph(line.replace(/^([-*]|\d+\.) /, ""))] }),
		);
		return { type: bullet ? "bulletList" : "orderedList", content: items };
	}
	return paragraph(lines.join(" ").trim());
};

/**
 * Plain Markdown, both ways: paragraphs, `#` headings, `-` and `1.` lists, `**bold**`, `*italic*`, `` `code` `` and `[links](/a)`. Anything else in a
 * document is reported and left out on export; anything else in a text is a paragraph. It knows nothing about ids, storage or validation: that is core's job.
 */
export const markdownFormat = defineFormat({
	name: "markdown",
	label: "Markdown",
	mimeType: "text/markdown",
	extension: "md",
	export: (doc, ctx) =>
		`${doc.content
			.map((node) => blockText(node, ctx))
			.filter(Boolean)
			.join("\n\n")}\n`,
	import: (text) => {
		const content = text
			.replace(/\r\n?/g, "\n")
			.split(/\n{2,}/)
			.map((part) => part.split("\n").filter((line) => line.trim()))
			.filter((lines) => lines.length > 0)
			.map(blockNode);
		return { ok: true, doc: { ...emptyStoredDocument(), content } };
	},
});

/** A one-way format: it has no `import`, so a write with `format: "text"` is refused (`format_not_importable`). Good for a feed or a search index. */
export const textFormat = defineFormat({
	name: "text",
	label: "Plain text",
	mimeType: "text/plain",
	extension: "txt",
	export: (doc, ctx) => documentText(ctx.site, doc, { code: true, media: false, hidden: false }),
});

/** The module of the plugin's `formats` loader: its default export is a format or a list of them. */
export default [markdownFormat, textFormat];
