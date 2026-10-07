import { type BlockDefinition, perSite, type Site } from "@monti-cms/core/client";
import type { CmsJsonValue, CmsNode } from "@monti-cms/core/document";
import { BLOCK_ID_ATTRIBUTE } from "../../block-ids";
import { fenceBlockConverter } from "../../converters/fence-preview";
import type { BlockConverter } from "../../converters/types";
import { addedNodeBlocks, blockNodeName, childBlocksOf, isContainer, isFence } from "./shared";

const isEmptyParagraph = (node: { type?: string; content?: unknown[] }) =>
	node.type === "paragraph" && !node.content?.length;

/** Stored node type of a block used only inside a parent block (e.g. `tab`). Outside the parent it is kept as a box holding the node. */
export const parentOnlyTypes = perSite(
	(site: Pick<Site, "ADDED_BLOCKS">): ReadonlySet<string> =>
		new Set(
			addedNodeBlocks(site)
				.filter((block) => block.parent)
				.map((block) => block.name),
		),
);

/**
 * Converter for one added block. The stored node is the block's name with its attribute values, and the body is the node content.
 *
 * With child block rules (e.g. tabs), it checks the number and kinds of children and converts directly with the child converters. If the minimum body count is 0
 * (e.g. callout), a block with no body is opened with one empty paragraph, and when only an empty paragraph remains it is saved with no body.
 */
function blockConverter(
	block: BlockDefinition,
	all: readonly BlockDefinition[],
	byName: ReadonlyMap<string, BlockConverter>,
): BlockConverter {
	const nodeName = blockNodeName(block);
	const children = childBlocksOf(block, all);
	const childNames = new Set(children.map((child) => child.name));
	const min = block.children?.min ?? 1;
	const max = block.children?.max ?? Number.POSITIVE_INFINITY;
	const childConverter = (node: CmsNode) => (childNames.has(node.type) ? byName.get(node.type) : undefined);
	return {
		name: block.name,
		cmsTypes: [block.name],
		tiptapTypes: [nodeName],
		isMappable(node, ctx) {
			if (!isContainer(block)) return !node.content?.length;
			const content = node.content ?? [];
			if (childNames.size > 0) {
				return (
					content.length >= min &&
					content.length <= max &&
					content.every((child) => !!childConverter(child)?.isMappable(child, ctx))
				);
			}
			return (
				(content.length > 0 || min === 0) &&
				content.every((child) => !parentOnlyTypes(ctx.site).has(child.type) && ctx.isMappableBlock(child))
			);
		},
		toTiptap(node, ctx) {
			const base = { type: nodeName, attrs: { values: { ...(node.attrs ?? {}) } } };
			if (!isContainer(block)) return base;
			const content = node.content ?? [];
			// The editor schema requires at least one body block (block+). A block with no body is opened with one empty paragraph.
			if (childNames.size === 0 && content.length === 0) return { ...base, content: [{ type: "paragraph" }] };
			return {
				...base,
				content: content.map((child) => {
					const converter = childConverter(child);
					if (!converter) return ctx.blockToTiptap(child);
					// A child with its own converter (a tab, a column) keeps the id it has, like any other block.
					const converted = converter.toTiptap(child, ctx);
					return child.id === undefined || converted.attrs?.[BLOCK_ID_ATTRIBUTE] != null
						? converted
						: { ...converted, attrs: { ...(converted.attrs ?? {}), [BLOCK_ID_ATTRIBUTE]: child.id } };
				}),
			};
		},
		toCms(node, ctx): CmsNode[] {
			const values = (node.attrs?.values ?? {}) as Record<string, CmsJsonValue>;
			const attrs: Record<string, CmsJsonValue> = {};
			for (const [name, value] of Object.entries(values)) {
				if (value !== undefined) attrs[name] = value;
			}
			const content = node.content ?? [];
			// A body with only an empty paragraph is saved with no body (the opposite of toTiptap above). A block that must have a body is left as is.
			const emptyBody = min === 0 && childNames.size === 0 && content.every(isEmptyParagraph);
			return [
				{
					type: block.name,
					attrs,
					...(isContainer(block) ? { content: emptyBody ? [] : content.flatMap(ctx.tiptapBlockToCms) } : {}),
				},
			];
		},
	};
}

/** All added block converters. A code fence block gets that language's code block, any other block gets the node of its name. */
export function addedBlockConverters(all: readonly BlockDefinition[]): BlockConverter[] {
	const byName = new Map<string, BlockConverter>();
	const converters = all.map((block) => {
		const converter = isFence(block)
			? fenceBlockConverter(block, blockNodeName(block))
			: blockConverter(block, all, byName);
		byName.set(block.name, converter);
		return converter;
	});
	return converters;
}

/** The converters of the added blocks of a site. The same list for the same site. */
export const addedBlockConvertersOf = perSite((site: Pick<Site, "ADDED_BLOCKS">): readonly BlockConverter[] =>
	addedBlockConverters(addedNodeBlocks(site)),
);
