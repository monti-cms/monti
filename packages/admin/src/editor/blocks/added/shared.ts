import type { BlockDefinition } from "@monti-cms/core/client";
import { ADDED_BLOCKS } from "@monti-cms/core/client";

/**
 * 더한 블록(블록 확장 플러그인·사이트 설정의 `blocks`)의 편집기 표현. `editor.view: "node"`인 블록은 정의에서 만든
 * Tiptap 노드로 편집하고, 나머지는 원문 보존 상자로 둔다.
 */

/** 더한 블록의 Tiptap 노드 이름(`cms` + 파스칼 이름, 예: `callout` → `cmsCallout`). */
export const blockNodeName = (block: Pick<BlockDefinition, "name">) =>
	`cms${block.name.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, char: string) => char.toUpperCase())}`;

/** 편집기가 이미 쓰는 이름. 더한 블록의 노드 이름이 겹치면 안 된다. */
const TAKEN_NODE_NAMES = new Set(["cmsOpaqueBlock", "cmsMath", "cmsBlockKeymap", "cmsBlockDrag", "cmsUntranslated"]);

/** 편집기 노드로 편집하는 더한 블록. */
export const ADDED_NODE_BLOCKS: readonly BlockDefinition[] = ADDED_BLOCKS.filter(
	(block) => block.editor.view === "node",
);

for (const block of ADDED_NODE_BLOCKS) {
	if (TAKEN_NODE_NAMES.has(blockNodeName(block))) {
		throw new Error(`cms block "${block.name}": editor node name ${blockNodeName(block)} is already used`);
	}
}

const BY_NODE_NAME = new Map(ADDED_NODE_BLOCKS.map((block) => [blockNodeName(block), block]));

/** Tiptap 노드 이름 → 더한 블록 정의. */
export const addedBlockOfNode = (nodeName: string): BlockDefinition | undefined => BY_NODE_NAME.get(nodeName);

/** 블록 정의의 기본 속성 값. */
export const defaultValues = (block: BlockDefinition): Record<string, string | boolean> =>
	Object.fromEntries(
		Object.entries(block.attributes).flatMap(([name, attribute]) =>
			attribute.defaultValue === undefined ? [] : [[name, attribute.defaultValue]],
		),
	);

/** 컨테이너 블록인가(본문이나 자식 블록을 담는다). */
export const isContainer = (block: BlockDefinition) => block.syntax.kind === "container";

/** 코드 펜스 블록인가. */
export const isFence = (block: BlockDefinition) => block.syntax.kind === "fence";

/** 정해진 자식 블록이 아니라 일반 본문을 담는 컨테이너인가(예: 콜아웃·탭 하나). */
export const isBodyContainer = (block: BlockDefinition) => isContainer(block) && !block.children?.blocks?.length;

/** 자식 블록 정의. */
export const childBlocksOf = (block: BlockDefinition, all: readonly BlockDefinition[] = ADDED_NODE_BLOCKS) =>
	(block.children?.blocks ?? []).flatMap((name) => all.find((candidate) => candidate.name === name) ?? []);

/** 컨테이너 블록 노드 이름. 핸들로 자식 블록을 하나씩 옮길 수 있다. */
export const CONTAINER_NODE_NAMES: ReadonlySet<string> = new Set(
	ADDED_NODE_BLOCKS.filter(isContainer).map(blockNodeName),
);

/** 본문 블록이 하나 이상이어야 하는 컨테이너 노드 이름(예: 콜아웃·탭 하나). */
export const BODY_CONTAINER_NODE_NAMES: ReadonlySet<string> = new Set(
	ADDED_NODE_BLOCKS.filter(isBodyContainer).map(blockNodeName),
);

/** 부모 블록 안의 틀(예: 탭 하나·단 하나). 따로 옮기지 않는다. */
export const PARENT_ONLY_NODE_NAMES: ReadonlySet<string> = new Set(
	ADDED_NODE_BLOCKS.filter((block) => block.parent).map(blockNodeName),
);
