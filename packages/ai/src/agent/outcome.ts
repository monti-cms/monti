import type { Proposal } from "./proposals";

/** What came of a conversation, as its row in the past conversations says it: a proposal waiting, applied (how many), undone, or discarded. */
export type RunOutcome =
	| { readonly kind: "pending" }
	| { readonly kind: "applied"; readonly count: number }
	| { readonly kind: "reverted" }
	| { readonly kind: "discarded" };

/** The outcome of a conversation from its proposals: the latest one decides; none for a conversation that proposed nothing. */
export function outcomeOf(proposals: readonly Proposal[]): RunOutcome | undefined {
	const latest = proposals.at(-1);
	if (!latest) return undefined;
	switch (latest.status) {
		case "pending":
		case "applying":
			return { kind: "pending" };
		case "applied":
		case "partial":
			return { kind: "applied", count: latest.items.filter((item) => item.state === "applied").length };
		case "reverted":
			return { kind: "reverted" };
		case "discarded":
			return { kind: "discarded" };
	}
}
