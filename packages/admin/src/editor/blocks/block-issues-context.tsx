"use client";

import { createContext, type ReactNode, useContext } from "react";

/** The warnings of the latest save or publish that belong to a block, as text, by the id of the block (`position.blockId`). */
export type BlockIssueTexts = ReadonlyMap<string, readonly string[]>;

const BlockIssuesContext = createContext<BlockIssueTexts | null>(null);

const NONE: readonly string[] = [];

/**
 * Gives the block views below it the warnings to show next to their block (a block's own syntax check, for one). The entry editor provides it from the
 * warnings of the latest save or publish; without it, no block shows any.
 */
export function BlockIssuesProvider({ issues, children }: { issues: BlockIssueTexts; children: ReactNode }) {
	return <BlockIssuesContext.Provider value={issues}>{children}</BlockIssuesContext.Provider>;
}

/** The texts of the warnings of the block with this id. */
export function useBlockIssues(blockId: string | null): readonly string[] {
	const issues = useContext(BlockIssuesContext);
	return (blockId !== null && issues?.get(blockId)) || NONE;
}
