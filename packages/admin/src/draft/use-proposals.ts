import { useRead } from "../operations/use-operation";

/** A pending proposal item, as `proposals.forTarget` gives it: the write the assistant asked for, waiting for a person (doc 05). */
export type ProposalItem = {
	id: string;
	proposalId: string;
	/** The person's request it came from: the name the bubble shows. */
	request: string;
	conversationId: string;
	operation: string;
	input: unknown;
	/** What its write said it would do when it was proposed; a body edit's has the words of the blocks it changes, as they were then. */
	preview?: { was?: Record<string, string> } | null;
	/** What was asked of it at its place since it was made, and what the assistant answered (doc 10, a request at its place). */
	thread?: { request: string; answer: string; at: string }[];
};

/** A record a screen shows: `{ kind: "entry", id }`, `{ kind: "schema", id: "current" }`. */
export type Target = { kind: string; id: string };

const NONE: Target = { kind: "none", id: "none" };
const NO_OTHERS: Target[] = [];

/**
 * The pending proposals aimed at the screen's record (T2). They live on the server, so they are there again when the screen opens. `also`: the other
 * records the same screen shows (settings: the schema and every collection's admin values beside the site's values); an item aimed at any of them
 * is in the list once.
 */
export function useProposals(target: Target | null, also: Target[] = NO_OTHERS) {
	const { data, reload } = useRead<ProposalItem[]>(
		"proposals.forTarget",
		{ ...(target ?? NONE), also },
		{ skip: !target },
	);
	return { items: target ? (data ?? []) : [], reload };
}
