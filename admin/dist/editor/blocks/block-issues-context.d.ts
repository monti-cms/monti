import { type ReactNode } from "react";
/** The warnings of the latest save or publish that belong to a block, as text, by the id of the block (`position.blockId`). */
export type BlockIssueTexts = ReadonlyMap<string, readonly string[]>;
/**
 * Gives the block views below it the warnings to show next to their block (a block's own syntax check, for one). The entry editor provides it from the
 * warnings of the latest save or publish; without it, no block shows any.
 */
export declare function BlockIssuesProvider({ issues, children }: {
    issues: BlockIssueTexts;
    children: ReactNode;
}): import("react").JSX.Element;
/** The texts of the warnings of the block with this id. */
export declare function useBlockIssues(blockId: string | null): readonly string[];
