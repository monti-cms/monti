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

/** 부모 블록 안에서만 쓰는 블록의 렌더러 이름(예: `Tab`). 부모 밖에서는 원문 보존 상자로 둔다. */
export const PARENT_ONLY_TYPES: ReadonlySet<string> = new Set(
	ADDED_NODE_BLOCKS.filter((block) => block.parent).map((block) => block.component),
);

/**
 * 지시자 블록 하나의 변환기. 지시자 속성은 노드의 `values`로, 본문은 노드 내용으로 옮긴다. 원래 속성 순서는
 * `originalAttributes`에 두고 저장할 때 되살린다.
 *
 * 자식 블록 규칙이 있으면(예: 탭) 자식 개수와 종류를 확인하고 자식 변환기로 직접 바꾼다. 본문 최소 개수가 0이면
 * (예: 콜아웃) 본문 없는 블록을 빈 문단 하나로 열고, 빈 문단만 남으면 본문 없이 저장한다.
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
			// JSX spread/표현식은 블록 전체를 원문 보존 상자로 남긴다.
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
			// 편집기 스키마는 본문 블록이 하나 이상이어야 한다(block+). 본문 없는 블록은 빈 문단 하나로 연다.
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
			// 빈 문단만 남은 본문은 본문 없이 저장한다(위 toTiptap의 반대). 본문이 꼭 있어야 하는 블록은 그대로 둔다.
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

/** 더한 블록 변환기 전부. 코드 펜스 블록은 그 언어의 코드 블록을, 지시자 블록은 그 렌더러 이름의 노드를 받는다. */
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
