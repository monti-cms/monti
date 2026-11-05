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
};

/** A record a screen shows: `{ kind: "entry", id }`, `{ kind: "schema", id: "current" }`. */
export type Target = { kind: string; id: string };

/** The pending proposals aimed at the screen's record (T2). They live on the server, so they are there again when the screen opens. */
export function useProposals(target: Target | null) {
	const { data, reload } = useRead<ProposalItem[]>("proposals.forTarget", target ?? { kind: "none", id: "none" }, {
		afterWrites: true,
	});
	return { items: target ? (data ?? []) : [], reload };
}
