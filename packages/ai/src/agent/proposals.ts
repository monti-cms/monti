import { CmsError, type PluginCollection, type WritePlan, type WriteTarget } from "@monti-cms/core/server";

/**
 * Where a proposal stands (docs/design/agent.md §5): waiting for review, being applied, applied (all or some), reverted, or discarded. A proposal waits as long
 * as its conversation exists; it never expires on its own.
 */
export type ProposalStatus = "pending" | "applying" | "applied" | "partial" | "reverted" | "discarded";

/**
 * Where one item stands:
 * - `pending`: waiting for review; `stale`: its target changed since the plan, so it is left out ("changed meanwhile").
 * - `applied` or `failed` (with the reason) after applying.
 * - `reverted` after undoing; `kept`: not reverted, because its target changed after it was applied ("changed since").
 */
export type ProposalItemState = "pending" | "stale" | "applied" | "failed" | "reverted" | "kept";

/** One change of a proposal: a planned write of one operation on one target. */
export interface ProposalItem {
	readonly id: string;
	/** The write operation that planned it (`entries.moveToFolder`). */
	readonly operation: string;
	readonly target: WriteTarget;
	readonly preview: WritePlan["preview"];
	/** The target's base when planned. */
	readonly base: string;
	/** What the operation needs to apply it. */
	readonly change: unknown;
	/** What the target was called when planned, and the preview in words where it holds ids (see `WritePlan`). */
	readonly subject?: WritePlan["subject"];
	readonly shown?: WritePlan["shown"];
	/** The admin can leave an item out before applying. */
	readonly included: boolean;
	readonly state: ProposalItemState;
	/** The error code of a failed item, or why an item is stale or kept. */
	readonly reason?: string;
	/** What the admin and the assistant said about this one change in the editor's card (docs/design/agent.md §7), oldest first. */
	readonly thread?: readonly SpotMessage[];
	/** After applying: the target's base right after, and what reverting needs. */
	readonly applied?: {
		readonly base: string;
		readonly undo: unknown;
		readonly at: string;
		/** Accepted in the entry editor and saved there, not applied from the review. */
		readonly inEditor?: boolean;
	};
}

/** One message of a change's card: the admin asking for it to be made again, or the assistant saying what it did. */
export interface SpotMessage {
	readonly author: "admin" | "assistant";
	readonly text: string;
	/** When it was said (ISO). */
	readonly at: string;
}

/** The write changes one run of the agent proposed, kept with its conversation. */
export interface ProposalValue {
	readonly adminId: string;
	readonly runId: string;
	/** What the admin asked, quoted on the review page and in the activity log. */
	readonly request: string;
	readonly status: ProposalStatus;
	readonly items: readonly ProposalItem[];
	/** When it was applied, reverted or discarded (ISO). */
	readonly settledAt?: string;
}

export interface Proposal extends ProposalValue {
	readonly id: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** Most items one proposal holds. A request that plans more is refused with a note to split it. */
export const MAX_PROPOSAL_ITEMS = 500;

const keyOf = (adminId: string, id: string) => `${adminId}/${id}`;

const toProposal = (item: { key: string; value: ProposalValue; createdAt: Date; updatedAt: Date }): Proposal => ({
	...item.value,
	id: item.key.slice(item.value.adminId.length + 1),
	createdAt: item.createdAt,
	updatedAt: item.updatedAt,
});

/** A plan of a write as a new item of a proposal. */
export const itemOf = (id: string, operation: string, plan: WritePlan): ProposalItem => ({
	id,
	operation,
	target: plan.target,
	preview: plan.preview,
	base: plan.base,
	change: plan.change,
	...(plan.subject ? { subject: plan.subject } : {}),
	...(plan.shown ? { shown: plan.shown } : {}),
	included: true,
	state: "pending",
});

/** The plan an item was made from, as the operation takes it back to apply or revert. */
export const planOf = (item: ProposalItem): WritePlan => ({
	target: item.target,
	preview: item.preview,
	base: item.base,
	change: item.change,
});

/** The proposals of the admin agent, in the AI plugin's storage. Each admin reads only their own. */
export function createProposalStore(collection: PluginCollection<ProposalValue>) {
	/** Reads, changes and writes one proposal again, retrying a write another request made in between. */
	const update = async (
		adminId: string,
		id: string,
		change: (current: Proposal) => ProposalValue,
	): Promise<Proposal> => {
		const key = keyOf(adminId, id);
		for (let attempt = 0; ; attempt++) {
			const item = await collection.get(key);
			if (!item || item.value.adminId !== adminId) throw new CmsError("No such proposal", "not_found");
			try {
				return toProposal(await collection.set(key, change(toProposal(item)), { expectedVersion: item.version }));
			} catch (error) {
				if (attempt >= 4 || !(error instanceof CmsError) || error.code !== "conflict") throw error;
			}
		}
	};

	return {
		async get(adminId: string, id: string): Promise<Proposal | null> {
			const item = await collection.get(keyOf(adminId, id));
			return item && item.value.adminId === adminId ? toProposal(item) : null;
		},

		/** The proposals of one conversation, oldest first. */
		async ofRun(adminId: string, runId: string): Promise<Proposal[]> {
			return (await collection.list({ prefix: `${adminId}/` }))
				.filter((item) => item.value.adminId === adminId && item.value.runId === runId)
				.map(toProposal)
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		},

		/** The proposals that wait for review and change the entry `entryId`, oldest first. */
		async pendingFor(adminId: string, entryId: string): Promise<Proposal[]> {
			return (await collection.list({ prefix: `${adminId}/` }))
				.filter(
					(item) =>
						item.value.adminId === adminId &&
						item.value.status === "pending" &&
						item.value.items.some((change) => change.target.kind === "entry" && change.target.id === entryId),
				)
				.map(toProposal)
				.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
		},

		async create(id: string, value: Omit<ProposalValue, "status" | "items">): Promise<Proposal> {
			return toProposal(
				await collection.set(
					keyOf(value.adminId, id),
					{ ...value, status: "pending", items: [] },
					{ expectedVersion: 0 },
				),
			);
		},

		/** Adds planned items to a proposal that still waits for review. */
		async addItems(adminId: string, id: string, items: readonly ProposalItem[]): Promise<Proposal> {
			return update(adminId, id, (current) => {
				if (current.status !== "pending") throw new CmsError("The proposal is no longer open", "invalid_status");
				if (current.items.length + items.length > MAX_PROPOSAL_ITEMS) {
					throw new CmsError(`A proposal holds at most ${MAX_PROPOSAL_ITEMS} changes`, "too_many_items");
				}
				return { ...current, items: [...current.items, ...items] };
			});
		},

		update,

		/** Deletes every proposal of a conversation (the conversation was deleted). */
		async removeOfRun(adminId: string, runId: string): Promise<void> {
			for (const item of await collection.list({ prefix: `${adminId}/` })) {
				if (item.value.adminId !== adminId || item.value.runId !== runId) continue;
				await collection.delete(item.key, { expectedVersion: item.version }).catch(() => undefined);
			}
		},
	};
}

export type ProposalStore = ReturnType<typeof createProposalStore>;
