import { isBlockId, newBlockId } from "@monti-cms/core/document";
import { type AnyExtension, Extension, getExtensionField, type NodeConfig } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Editor attribute that holds a block's id (`CmsNode.id`). Not called `id`, which some nodes may want for themselves. */
export const BLOCK_ID_ATTRIBUTE = "blockId";

const blockIdsKey = new PluginKey("cmsBlockIds");

const isInlineNode = (extension: AnyExtension): boolean => {
	const context = { name: extension.name, options: extension.options, storage: extension.storage };
	if (getExtensionField<NodeConfig["inline"]>(extension, "inline", context) === true) return true;
	const group = getExtensionField<NodeConfig["group"]>(extension, "group", context);
	return typeof group === "string" && group.split(" ").includes("inline");
};

/**
 * Block ids in the editor. Every block node carries the id of its block in the stored document, so a save can send the document with
 * the ids it was loaded with and blocks keep them exactly (the server only pairs blocks up when it is sent MDX).
 *
 * - Splitting a block (Enter) does not copy the id: the first part keeps it and the new block gets one (`keepOnSplit: false`).
 * - After every change, a block without a valid id, or with the id of an earlier block (a pasted, duplicated or dragged copy), gets a new one.
 * - The id is not rendered: copied HTML carries none, so a pasted block always gets a new one. A block is found by its id in the document
 *   (`findBlock`), not in the page.
 */
export const CmsBlockIds = Extension.create({
	name: "cmsBlockIds",

	addGlobalAttributes() {
		// Block nodes only: inline nodes (text, line breaks, footnote references) carry no id.
		const types = this.extensions
			.filter((extension) => extension.type === "node" && extension.name !== "doc" && !isInlineNode(extension))
			.map((extension) => extension.name);
		return [
			{
				types,
				attributes: {
					[BLOCK_ID_ATTRIBUTE]: {
						default: null,
						keepOnSplit: false,
						parseHTML: () => null,
						renderHTML: () => ({}),
					},
				},
			},
		];
	},

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: blockIdsKey,
				appendTransaction: (transactions, _old, state) => {
					if (!transactions.some((transaction) => transaction.docChanged)) return null;
					const seen = new Set<string>();
					const missing: number[] = [];
					state.doc.descendants((node, pos) => {
						if (!node.isBlock || !(BLOCK_ID_ATTRIBUTE in node.attrs)) return;
						const id = node.attrs[BLOCK_ID_ATTRIBUTE];
						if (isBlockId(id) && !seen.has(id)) seen.add(id);
						else missing.push(pos);
					});
					if (missing.length === 0) return null;
					const transaction = state.tr;
					for (const pos of missing) {
						let id = newBlockId();
						while (seen.has(id)) id = newBlockId();
						seen.add(id);
						transaction.setNodeAttribute(pos, BLOCK_ID_ATTRIBUTE, id);
					}
					// Giving a block an id is not an edit of its own: it joins the change that made the block.
					return transaction.setMeta("addToHistory", false);
				},
			}),
		];
	},
});

/** Position of the block with this id in a document, or `undefined`. */
export const findBlock = (doc: ProseMirrorNode, id: string): number | undefined => {
	let found: number | undefined;
	doc.descendants((node, pos) => {
		if (found !== undefined) return false;
		if (node.isBlock && node.attrs[BLOCK_ID_ATTRIBUTE] === id) {
			found = pos;
			return false;
		}
		return true;
	});
	return found;
};
