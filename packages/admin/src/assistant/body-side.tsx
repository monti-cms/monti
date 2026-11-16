import type { Block, Doc } from "@monti-cms/core";
import { ReadBody } from "../editor/read-body";
import { sideMarks } from "../screens/entry/compare-entries";
import { useBlockNames } from "../screens/entry/use-block-names";

const docOf = (block: Block | null): Doc | null => (block ? { type: "doc", blocks: [block] } : null);

/**
 * One side of a change to the body: the block as it is (`before`, the words the change takes out in the blue pencil, struck through) or as proposed
 * (`after`, the words it puts in), read as the editor draws it. Against a block the other side lacks, every word of it is marked.
 */
export function BodySide({ block, other, side }: { block: Block; other: Block | null; side: "before" | "after" }) {
	const names = useBlockNames();
	const doc = docOf(block) as Doc;
	return (
		<ReadBody
			doc={doc}
			marks={sideMarks(doc, docOf(other), side === "before" ? "mine" : "server", names)}
			mark={side === "before" ? "removed" : "added"}
		/>
	);
}
