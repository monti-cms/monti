import { useCallback, useMemo } from "react";
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

const NONE: Target = { kind: "none", id: "none" };

/**
 * The pending proposals aimed at the screen's record (T2). They live on the server, so they are there again when the screen opens. `also`: a second
 * record the same screen shows (settings: the site's values and the schema), its items joined after the first's, each item once.
 */
export function useProposals(target: Target | null, also: Target | null = null) {
	const first = useRead<ProposalItem[]>("proposals.forTarget", target ?? NONE, { afterWrites: true, skip: !target });
	const second = useRead<ProposalItem[]>("proposals.forTarget", also ?? NONE, { afterWrites: true, skip: !also });
	const items = useMemo(() => {
		const all = [...(target ? (first.data ?? []) : []), ...(also ? (second.data ?? []) : [])];
		return all.filter((item, index) => all.findIndex((each) => each.id === item.id) === index);
	}, [target, also, first.data, second.data]);
	const reloadFirst = first.reload;
	const reloadSecond = second.reload;
	const reload = useCallback(async () => {
		await Promise.all([reloadFirst(), reloadSecond()]);
	}, [reloadFirst, reloadSecond]);
	return { items, reload };
}
