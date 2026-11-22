import type { ReadContext } from "../../engine/types";
import type { Block, BlockDefinition, Doc } from "../../rich-text/types";
import { blockDefinitions } from "../../rich-text/validate-doc";

/**
 * 본문에서 상태를 갖는 블록들, 읽는 순서로: 깊이와 관계없이 글자나 내용을 직접 품는 블록 모두. 컨테이너 블록
 * (`holds: "blocks"`)은 상태를 갖지 않고, 안에 든 블록이 각자 가진다.
 */
export function bodyUnits(ctx: ReadContext, body: Doc | undefined): Block[] {
	return unitsOf(body?.blocks ?? [], blockDefinitions(ctx.config));
}

function unitsOf(blocks: Block[], definitions: Map<string, BlockDefinition>): Block[] {
	return blocks.flatMap((block) =>
		definitions.get(block.type)?.holds === "blocks" ? unitsOf(block.children ?? [], definitions) : [block],
	);
}

/** 본문의 깊이와 관계없는 모든 블록(컨테이너 포함)의 `id`. */
export function blockIds(body: Doc | undefined): Set<string> {
	return new Set(idsOf(body?.blocks ?? []));
}

function idsOf(blocks: Block[]): string[] {
	return blocks.flatMap((block) => [block.id, ...idsOf(block.children ?? [])]);
}
