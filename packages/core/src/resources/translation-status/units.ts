import type { ReadContext } from "../../engine/types";
import type { Block, BlockDefinition, Doc } from "../../rich-text/types";
import { blockDefinitions } from "../../rich-text/validate-doc";

/**
 * The blocks of a body that have a translation status, in reading order: every block at any depth that holds text or
 * nothing. Container blocks (`holds: "blocks"`) have none; the blocks inside them have their own.
 */
export function bodyUnits(ctx: ReadContext, body: Doc | undefined): Block[] {
	return unitsOf(body?.blocks ?? [], blockDefinitions(ctx.config));
}

function unitsOf(blocks: Block[], definitions: Map<string, BlockDefinition>): Block[] {
	return blocks.flatMap((block) =>
		definitions.get(block.type)?.holds === "blocks" ? unitsOf(block.children ?? [], definitions) : [block],
	);
}

/** The ids of every block of a body at any depth, containers too. */
export function blockIds(body: Doc | undefined): Set<string> {
	return new Set(idsOf(body?.blocks ?? []));
}

function idsOf(blocks: Block[]): string[] {
	return blocks.flatMap((block) => [block.id, ...idsOf(block.children ?? [])]);
}
