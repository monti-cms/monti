import type { CmsNode } from "@monti-cms/core/document";
import { emptyStoredDocument } from "@monti-cms/core/document";
import { defineFormat } from "@monti-cms/core/format";
import { documentText } from "@monti-cms/core/site";

const inlineText = (nodes: readonly CmsNode[] | undefined): string =>
	(nodes ?? [])
		.map((node) => {
			if (node.type !== "text") return inlineText(node.content);
			const bold = node.marks?.some((mark) => mark.type === "bold");
			return bold ? `**${node.text}**` : (node.text ?? "");
		})
		.join("");

export const markdownFormat = defineFormat({
	name: "markdown",
	label: "Markdown",
	mimeType: "text/markdown",
	extension: "md",
	export: (doc, ctx) =>
		`${doc.content
			.map((node) => {
				if (node.type === "paragraph") return inlineText(node.content);
				if (node.type === "heading") return `${"#".repeat(Number(node.attrs?.level ?? 2))} ${inlineText(node.content)}`;
				// Say what the text could not keep. The API returns it as a warning of the export.
				ctx.report({
					code: "markdown_block_dropped",
					message: `A "${node.type}" block was left out.`,
					params: { block: node.type },
				});
				return "";
			})
			.filter(Boolean)
			.join("\n\n")}\n`,
	import: (text) => {
		const content = text
			.split(/\n{2,}/)
			.filter((part) => part.trim())
			.map((part): CmsNode => {
				const heading = /^(#{1,6}) (.*)$/.exec(part.trim());
				return heading
					? {
							type: "heading",
							attrs: { level: (heading[1] as string).length },
							content: [{ type: "text", text: heading[2] as string }],
						}
					: { type: "paragraph", content: [{ type: "text", text: part.trim() }] };
			});
		return { ok: true, doc: { ...emptyStoredDocument(), content } };
	},
});

/** A one-way format: it has no `import`, so a write with `format: "text"` is refused (`format_not_importable`). */
export const textFormat = defineFormat({
	name: "text",
	label: "Plain text",
	mimeType: "text/plain",
	extension: "txt",
	export: (doc, ctx) => documentText(ctx.site, doc, { code: true, media: false, hidden: false }),
});
