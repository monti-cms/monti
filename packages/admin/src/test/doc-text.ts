import {
	assignBlockIds,
	type CmsMark,
	type CmsNode,
	canonicalDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "@monti-cms/core/document";
import { testSite } from "../../../core/test/site";

/**
 * A tiny reader that turns plain text into a stored document, so core tests can describe a body in one line without a text format package (core parses no
 * MDX; `@monti-cms/mdx` does). It reads the subset of CommonMark that core tests use, and nothing else:
 *
 * - blocks separated by blank lines: paragraphs, `#` to `######` headings, `---`, `> ` quotes, `- ` or `* ` lists, `1. ` lists, fenced code (```` ```ts title="a.ts" ````),
 *   and a line that is only an image (`![alt](src "title")`);
 * - inside a paragraph: `**bold**`, `*em*`, `_em_`, `~~strike~~`, `` `code` ``, `[label](href "title")`, `![alt](src "title")`, and `<br />` for a line break. A single newline stays a newline in the text.
 *
 * Anything else is plain text. A test that needs a table, a footnote, a block with attributes or any other node builds the document by hand. The result has block ids
 * (paired with `previous` where the blocks match), as a document read by a format does after core has given them.
 *
 * `packages/mdx/src/__test__/doc-text.test.ts` checks that this reader and the real MDX format read this subset to the same document.
 */

const text = (value: string, marks?: CmsMark[]): CmsNode => ({
	type: "text",
	text: value,
	...(marks?.length ? { marks } : {}),
});

const INLINE =
	/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\*\*([^*]+)\*\*|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|<br\s*\/>/g;

const inlines = (source: string, marks: CmsMark[] = []): CmsNode[] => {
	const out: CmsNode[] = [];
	let at = 0;
	const push = (value: string, extra: CmsMark[] = []) => {
		if (value) out.push(text(value, [...marks, ...extra]));
	};
	for (const match of source.matchAll(INLINE)) {
		push(source.slice(at, match.index));
		at = (match.index ?? 0) + match[0].length;
		if (match[0].startsWith("<br")) out.push({ type: "hardBreak" });
		else if (match[2] !== undefined) {
			out.push({
				type: "image",
				attrs: { alt: match[1] ?? "", src: match[2], ...(match[3] ? { title: match[3] } : {}) },
			});
		} else if (match[5] !== undefined) {
			const attrs = { href: match[5], ...(match[6] ? { title: match[6] } : {}) };
			out.push(...inlines(match[4] ?? "", [...marks, { type: "link", attrs }]));
		} else if (match[7] !== undefined) out.push(...inlines(match[7], [...marks, { type: "bold" }]));
		else if (match[8] !== undefined) out.push(...inlines(match[8], [...marks, { type: "strike" }]));
		else if (match[9] !== undefined) push(match[9], [{ type: "code" }]);
		else out.push(...inlines(match[10] ?? match[11] ?? "", [...marks, { type: "italic" }]));
	}
	push(source.slice(at));
	return out;
};

const paragraph = (lines: string[]): CmsNode => ({
	type: "paragraph",
	content: inlines(lines.join("\n").replace(/<br \/>\n/g, "<br />")),
});

const FENCE = /^```(\S*)\s*(.*)$/;
const LIST = /^(?:([-*])|(\d+)\.)\s+(.*)$/;

const blocks = (lines: string[]): CmsNode[] => {
	const out: CmsNode[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i] as string;
		if (line.trim() === "") {
			i++;
			continue;
		}
		const fence = FENCE.exec(line);
		if (fence) {
			const code: string[] = [];
			i++;
			while (i < lines.length && !(lines[i] as string).startsWith("```")) code.push(lines[i++] as string);
			i++;
			out.push({ type: "codeBlock", attrs: { language: fence[1] ?? "", meta: fence[2] ?? "", code: code.join("\n") } });
			continue;
		}
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			out.push({
				type: "heading",
				attrs: { level: (heading[1] as string).length },
				content: inlines(heading[2] ?? ""),
			});
			i++;
			continue;
		}
		if (/^---+$/.test(line.trim())) {
			out.push({ type: "horizontalRule" });
			i++;
			continue;
		}
		if (line.startsWith(">")) {
			const quoted: string[] = [];
			while (i < lines.length && (lines[i] as string).startsWith(">"))
				quoted.push((lines[i++] as string).replace(/^>\s?/, ""));
			out.push({ type: "blockquote", content: blocks(quoted) });
			continue;
		}
		const item = LIST.exec(line);
		if (item) {
			const ordered = item[2] !== undefined;
			const items: CmsNode[] = [];
			while (i < lines.length) {
				const next = LIST.exec(lines[i] as string);
				if (!next || (next[2] !== undefined) !== ordered) break;
				items.push({ type: "listItem", content: [paragraph([next[3] ?? ""])] });
				i++;
			}
			out.push({ type: ordered ? "orderedList" : "bulletList", content: items });
			continue;
		}
		const lone = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(line.trim());
		if (lone) {
			out.push({
				type: "image",
				attrs: { alt: lone[1] ?? "", src: lone[2] as string, ...(lone[3] ? { title: lone[3] } : {}) },
			});
			i++;
			continue;
		}
		const run: string[] = [];
		while (i < lines.length && (lines[i] as string).trim() !== "" && !FENCE.test(lines[i] as string))
			run.push((lines[i++] as string).trim());
		out.push(paragraph(run));
	}
	return out;
};

/** The stored document of `source`, with block ids paired with those of `previous`. */
export const docOfText = (source: string, previous?: StoredDocument | null): StoredDocument => {
	const doc = canonicalDocument(testSite, {
		type: "doc",
		version: STORED_DOCUMENT_VERSION,
		content: blocks(source.split("\n")),
	});
	return { ...doc, content: assignBlockIds(doc.content, [previous?.content]) };
};
