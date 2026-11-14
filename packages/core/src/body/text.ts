import { type Block, blockMap, type Doc, plainText } from "./doc";
import { inlineToText } from "./inline-text";

const attrList = (attrs: Record<string, unknown> = {}) => {
	const pairs = Object.entries(attrs).map(
		([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
	);
	return pairs.length ? `{${pairs.join(" ")}}` : "";
};

/**
 * One block as lines for the model (doc 03, "agent"): `{#b_1} text`. A text block's text has its marks as tags (`inlineToText`), the form `setText`
 * takes back; a code block's code is as it is. Blocks that hold blocks open with `:::type` and close with `:::`.
 */
function blockLines(block: Block): string[] {
	const tag = `{#${block.id}} `;
	const body = inlineToText(block.content ?? []);
	switch (block.type) {
		case "paragraph":
			return [tag + body];
		case "heading":
			return [`${tag}${"#".repeat(Number(block.attrs?.level ?? 2))} ${body}`];
		case "listItem":
			return [`${tag}- ${block.attrs?.checked === undefined ? "" : block.attrs.checked ? "[x] " : "[ ] "}${body}`];
		case "codeBlock": {
			// Its other values (file name, line effects, rules) beside the language; the code stays as it is, with no tags in it (doc 17).
			const { language, ...rest } = block.attrs ?? {};
			return [
				`${tag}\`\`\`${typeof language === "string" ? language : ""}${Object.keys(rest).length ? ` ${attrList(rest)}` : ""}`,
				plainText(block.content),
				"```",
			];
		}
		case "divider":
			return [`${tag}---`];
	}
	if (block.children)
		return [`${tag}:::${block.type}${attrList(block.attrs)}`, ...block.children.flatMap(blockLines), ":::"];
	return [`${tag}::${block.type}${attrList(block.attrs)}${body ? ` ${body}` : ""}`];
}

/** A body as short readable text with block ids, for the model: shorter than the JSON, and exact about where each block is. */
export function bodyText(doc: Doc, only?: string[]): string {
	const blocks = blockMap(doc);
	const chosen = only ? only.flatMap((id) => blocks.get(id) ?? []) : doc.blocks;
	return chosen.flatMap(blockLines).join("\n");
}
