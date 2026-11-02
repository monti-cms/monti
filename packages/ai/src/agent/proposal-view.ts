import type { Proposal, ProposalItemState, ProposalStatus } from "./proposals";

/** A proposal as the panel and the review screen read it: everything but what applying needs (the change and the undo data stay on the server). */
export interface ProposalView {
	readonly id: string;
	readonly runId: string;
	readonly request: string;
	readonly status: ProposalStatus;
	readonly items: readonly {
		readonly id: string;
		readonly operation: string;
		readonly target: Proposal["items"][number]["target"];
		readonly preview: Proposal["items"][number]["preview"];
		readonly included: boolean;
		readonly state: ProposalItemState;
		readonly reason?: string;
		readonly appliedAt?: string;
	}[];
	readonly settledAt?: string;
	readonly createdAt: string;
}

export const proposalView = (proposal: Proposal): ProposalView => ({
	id: proposal.id,
	runId: proposal.runId,
	request: proposal.request,
	status: proposal.status,
	items: proposal.items.map((item) => ({
		id: item.id,
		operation: item.operation,
		target: item.target,
		preview: item.preview,
		included: item.included,
		state: item.state,
		...(item.reason ? { reason: item.reason } : {}),
		...(item.applied ? { appliedAt: item.applied.at } : {}),
	})),
	...(proposal.settledAt ? { settledAt: proposal.settledAt } : {}),
	createdAt: proposal.createdAt.toISOString(),
});
