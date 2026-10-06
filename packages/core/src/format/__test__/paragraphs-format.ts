import { entryIdOfMark } from "../../doc/entry-links";
import { STORED_DOCUMENT_VERSION, type StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { defineFormat } from "../types";

export const doc = (...content: CmsNode[]): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content,
});

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

/**
 * A format written the way anyone could write one (a Hugo-like site, a plain-text exporter): blank-line separated paragraphs, `[label](address)` links and
 * `![alt](url)` images. It knows nothing about ids, storage or validation: that is core's job. A text with `<<<` is one it cannot read.
 */
export const paragraphsFormat = defineFormat({
	name: "paragraphs",
	label: "Paragraphs",
	mimeType: "text/plain",
	extension: "txt",
	export: (document, ctx) =>
		document.content
			.map((block) => {
				if (block.type === "image") {
					const mediaId = String(block.attrs?.mediaId ?? "");
					const found = mediaId ? ctx.media(mediaId) : null;
					return `![${block.attrs?.alt ?? ""}](${found?.url ?? block.attrs?.src ?? ""})`;
				}
				return (block.content ?? [])
					.map((inline) => {
						const entryId = inline.marks?.map(entryIdOfMark).find(Boolean);
						if (entryId) return `[${inline.text}](${ctx.link(entryId)?.url ?? entryId})`;
						const href = inline.marks?.find((mark) => mark.type === "link")?.attrs?.href;
						if (typeof href === "string") return `[${inline.text}](${href})`;
						return inline.text ?? "";
					})
					.join("");
			})
			.join("\n\n"),
	import: (text) => {
		if (text.includes("<<<")) return { ok: false, issues: [{ code: "bad_marker", position: { line: 1, column: 1 } }] };
		const content = text
			.split(/\n{2,}/)
			.filter((part) => part.trim())
			.map((part): CmsNode => {
				const image = IMAGE.exec(part.trim());
				if (image) return { type: "image", attrs: { alt: image[1] ?? "", src: image[2] ?? "" } };
				const inlines: CmsNode[] = [];
				let last = 0;
				for (const match of part.matchAll(LINK)) {
					if ((match.index ?? 0) > last) inlines.push({ type: "text", text: part.slice(last, match.index) });
					inlines.push({
						type: "text",
						text: match[1] ?? "",
						marks: [{ type: "link", attrs: { href: match[2] ?? "" } }],
					});
					last = (match.index ?? 0) + match[0].length;
				}
				if (last < part.length) inlines.push({ type: "text", text: part.slice(last) });
				return { type: "paragraph", content: inlines };
			});
		return { ok: true, doc: doc(...content) };
	},
});
