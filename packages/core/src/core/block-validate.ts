import type { BlockDefinition, BlockNode } from "../blocks/define";
import type { StoredDocument } from "../doc/stored-document";
import type { CmsJsonValue, CmsMark, CmsNode } from "../doc/types";
import type { WriteOperation } from "../services/hooks";
import type { Site } from "../site";
import type { Issue } from "./types";

/**
 * Runs the `validate` slot of block definitions over a stored document: once for every node of a block that has one (a fence block is a
 * `codeBlock` node of its language, a text block is a mark, other blocks are nodes named after them). The findings are **warnings** that carry the
 * block's name (`params.block`) and the id of the block they are in (`position.blockId`), so the editor can show them next to the block.
 * Nothing here blocks a write: a check that throws is reported as a `block_validate_failed` warning and the write goes on.
 */

export interface BlockValidationRequest {
	readonly locale: string;
	readonly operation: WriteOperation;
}

type Found = { readonly block: BlockDefinition; readonly node: BlockNode };

/** Attributes of a stored code block that are the code itself, not settings of the block. */
const CODE_ATTRIBUTES: ReadonlySet<string> = new Set(["code", "annotations"]);

const markKey = (mark: CmsMark) => `${mark.type}|${JSON.stringify(mark.attrs ?? null)}`;

/** The nodes of the document that belong to a block with a `validate`, in body order. A mark split over several text nodes counts once. */
function nodesToValidate(site: Site, doc: StoredDocument): Found[] {
	const found: Found[] = [];
	const withCheck = (name: string): BlockDefinition | undefined => {
		const block = site.BLOCK_BY_NAME.get(name);
		return block?.validate ? block : undefined;
	};

	const addMarks = (children: readonly CmsNode[], blockId: string | undefined) => {
		const open = new Set<string>();
		for (const child of children) {
			if (child.text === undefined) {
				if (child.type === "hardBreak" || child.type === "footnoteReference") continue;
				open.clear();
				continue;
			}
			const marks = new Map((child.marks ?? []).map((mark) => [markKey(mark), mark] as const));
			for (const key of open) if (!marks.has(key)) open.delete(key);
			for (const [key, mark] of marks) {
				if (open.has(key)) continue;
				open.add(key);
				const block = withCheck(mark.type);
				if (block)
					found.push({
						block,
						node: { name: block.name, id: blockId, attributes: { ...mark.attrs }, source: undefined },
					});
			}
		}
	};

	const visit = (node: CmsNode, parentId: string | undefined) => {
		if (node.text !== undefined) return;
		const blockId = node.id ?? parentId;
		const attrs: Readonly<Record<string, CmsJsonValue>> = node.attrs ?? {};
		if (node.type === "codeBlock") {
			const language = attrs.language;
			const fence = site.fenceBlockOf(language);
			if (fence?.validate) {
				const settings = Object.fromEntries(Object.entries(attrs).filter(([key]) => !CODE_ATTRIBUTES.has(key)));
				const code = attrs.code;
				found.push({
					block: fence,
					node: { name: fence.name, id: blockId, attributes: settings, source: typeof code === "string" ? code : "" },
				});
			}
		} else if (node.type !== "unparsed") {
			const block = withCheck(node.type === "tableRow" ? "row" : node.type === "tableCell" ? "cell" : node.type);
			if (block)
				found.push({ block, node: { name: block.name, id: blockId, attributes: { ...attrs }, source: undefined } });
		}
		const children = node.content ?? [];
		addMarks(children, blockId);
		for (const child of children) visit(child, blockId);
	};
	for (const node of doc.content) visit(node, undefined);
	return found;
}

/** Warnings from the `validate` of every block in the document. Empty when no block of the site has one. */
export async function validateBlocks(
	site: Site,
	doc: StoredDocument,
	request: BlockValidationRequest,
): Promise<Issue[]> {
	const warnings: Issue[] = [];
	for (const { block, node } of nodesToValidate(site, doc)) {
		const position = node.id === undefined ? {} : { blockId: node.id };
		try {
			const issues = await block.validate?.(node, { site, locale: request.locale, operation: request.operation });
			for (const issue of issues ?? []) {
				warnings.push({
					code: issue.code,
					...(issue.message === undefined ? {} : { message: issue.message }),
					params: { ...issue.params, block: block.name },
					path: "body",
					position,
				});
			}
		} catch (error) {
			console.error(`[cms] validate of block ${block.name} failed`, error);
			warnings.push({
				code: "block_validate_failed",
				message: block.name,
				params: { block: block.name },
				path: "body",
				position,
			});
		}
	}
	return warnings;
}
