import type { BlockDefinition } from "@monti-cms/core/client";
import type { CmsJsonValue, CmsNode } from "@monti-cms/core/mdx";
import { fenceBlockConverter } from "../../converters/fence-preview";
import type { BlockConverter } from "../../converters/types";
import { ADDED_NODE_BLOCKS, blockNodeName, childBlocksOf, isContainer, isFence } from "./shared";

const hasDynamicAttribute = (node: CmsNode) =>
	Array.isArray(node.attrs?.attributes) &&
	node.attrs.attributes.some(
		(attr) =>
			typeof attr === "object" && attr !== null && !Array.isArray(attr) && ("spread" in attr || "expression" in attr),
	);

const isEmptyParagraph = (node: { type?: string; content?: unknown[] }) =>
	node.type === "paragraph" && !node.content?.length;

/** Renderer name of a block used only inside a parent block (e.g. `Tab`). Outside the parent it is kept as a raw-source preserving box. */
export const PARENT_ONLY_TYPES: ReadonlySet<string> = new Set(
	ADDED_NODE_BLOCKS.filter((block) => block.parent).map((block) => block.component),
);

/**
 * Converter for one directive block. Directive attributes go to the node's `values`, and the body to the node content. The original attribute order is
 * kept in `originalAttributes` and restored on save.
 *
 * With child block rules (e.g. tabs), it checks the number and kinds of children and converts directly with the child converters. If the minimum body count is 0
 * (e.g. callout), a block with no body is opened with one empty paragraph, and when only an empty paragraph remains it is saved with no body.
 */
function directiveConverter(
	block: BlockDefinition,
	all: readonly BlockDefinition[],
	byComponent: ReadonlyMap<string, BlockConverter>,
): BlockConverter {
	const nodeName = blockNodeName(block);
	const children = childBlocksOf(block, all);
	const childComponents = new Set(children.map((child) => child.component));
	const min = block.children?.min ?? 1;
	const max = block.children?.max ?? Number.POSITIVE_INFINITY;
	const childConverter = (node: CmsNode) => (childComponents.has(node.type) ? byComponent.get(node.type) : undefined);
	return {
		name: block.component,
		cmsTypes: [block.component],
		tiptapTypes: [nodeName],
		isMappable(node, ctx) {
			// JSX spread/expressions leave the whole block as a raw-source preserving box.
			if (hasDynamicAttribute(node)) return false;
			if (!isContainer(block)) return !node.content?.length;
			const content = node.content ?? [];
			if (childComponents.size > 0) {
				return (
					content.length >= min &&
					content.length <= max &&
					content.every((child) => !!childConverter(child)?.isMappable(child, ctx))
				);
			}
			return (
				(content.length > 0 || min === 0) &&
				content.every((child) => !PARENT_ONLY_TYPES.has(child.type) && ctx.isMappableBlock(child))
			);
		},
		toTiptap(node, ctx) {
			const attrs = node.attrs ?? {};
			const values = Object.fromEntries(
				Object.entries(attrs).filter(([key]) => key !== "name" && key !== "attributes"),
			);
			const base = { type: nodeName, attrs: { values, originalAttributes: attrs.attributes ?? [] } };
			if (!isContainer(block)) return base;
			const content = node.content ?? [];
			// The editor schema requires at least one body block (block+). A block with no body is opened with one empty paragraph.
			if (childComponents.size === 0 && content.length === 0) return { ...base, content: [{ type: "paragraph" }] };
			return {
				...base,
				content: content.map((child) => childConverter(child)?.toTiptap(child, ctx) ?? ctx.blockToTiptap(child)),
			};
		},
		toCms(node, ctx): CmsNode[] {
			const values = (node.attrs?.values ?? {}) as Record<string, CmsJsonValue>;
			const original = Array.isArray(node.attrs?.originalAttributes) ? node.attrs.originalAttributes : [];
			const attributes = original
				.filter(
					(attr: unknown): attr is { name: string; value?: CmsJsonValue } =>
						typeof attr === "object" && attr !== null && "name" in attr && typeof attr.name === "string",
				)
				.filter((attr: { name: string }) => values[attr.name] !== undefined)
				.map((attr: { name: string; value?: CmsJsonValue }) => ({ ...attr, value: values[attr.name] }));
			for (const [name, value] of Object.entries(values)) {
				if (value !== undefined && !attributes.some((attr: { name: string }) => attr.name === name))
					attributes.push({ name, value });
			}
			const content = node.content ?? [];
			// A body with only an empty paragraph is saved with no body (the opposite of toTiptap above). A block that must have a body is left as is.
			const emptyBody = min === 0 && childComponents.size === 0 && content.every(isEmptyParagraph);
			return [
				{
					type: block.component,
					attrs: { ...values, name: block.component, attributes },
					content: isContainer(block) && !emptyBody ? content.flatMap(ctx.tiptapBlockToCms) : [],
				},
			];
		},
	};
}

/** All added block converters. A code fence block gets that language's code block, a directive block gets the node of its renderer name. */
export function addedBlockConverters(all: readonly BlockDefinition[]): BlockConverter[] {
	const byComponent = new Map<string, BlockConverter>();
	const converters = all.map((block) => {
		const converter = isFence(block)
			? fenceBlockConverter(block, blockNodeName(block))
			: directiveConverter(block, all, byComponent);
		byComponent.set(block.component, converter);
		return converter;
	});
	return converters;
}

export const ADDED_BLOCK_CONVERTERS: readonly BlockConverter[] = addedBlockConverters(ADDED_NODE_BLOCKS);
