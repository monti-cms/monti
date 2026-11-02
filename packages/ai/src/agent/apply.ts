import { type AdminRequest, type Cms, CmsError } from "@monti-cms/core/server";
import { type Proposal, type ProposalItem, type ProposalStore, planOf } from "./proposals";

type Auth = AdminRequest["auth"];

const codeOf = (error: unknown): string => (error instanceof CmsError ? error.code : "internal_error");

/** Whether the target of a pending item still stands where it did when it was planned. */
async function stillThere(cms: Cms, auth: Auth, item: ProposalItem): Promise<boolean> {
	return (await cms.writes.baseOf(item.operation, item.target, { auth })) === item.base;
}

/**
 * Marks the pending items whose target changed since the plan as `stale` (and back to `pending` when it changed back), so the review shows them left out
 * ("changed meanwhile · make again"). Called when the review opens and before applying. A proposal that is not pending is returned as it is.
 */
export async function refreshStale(cms: Cms, auth: Auth, store: ProposalStore, proposal: Proposal): Promise<Proposal> {
	if (proposal.status !== "pending") return proposal;
	const states = new Map<string, "pending" | "stale">();
	for (const item of proposal.items) {
		if (item.state !== "pending" && item.state !== "stale") continue;
		states.set(item.id, (await stillThere(cms, auth, item)) ? "pending" : "stale");
	}
	if (proposal.items.every((item) => !states.has(item.id) || states.get(item.id) === item.state)) return proposal;
	return store.update(auth.userId, proposal.id, (current) => ({
		...current,
		items: current.items.map((item) => {
			const state = states.get(item.id);
			if (!state || state === item.state) return item;
			const { reason: _reason, ...rest } = item;
			return state === "stale" ? { ...rest, state, reason: "changed" } : { ...rest, state };
		}),
	}));
}

/** One step of applying or undoing, for the progress line ("Applying 9 / 17"). */
export interface ApplyProgress {
	readonly done: number;
	readonly total: number;
	readonly item: ProposalItem;
}

/**
 * Applies the included pending items in order, one at a time, as the admin and recorded as the agent's. Each result is stored as soon as it is known, so a cut
 * run applied again only does what is left. Nothing groups the items: one that fails does not stop the others, and keeps its reason. An item whose target moved
 * since the plan is left as `stale`, never forced.
 */
export async function applyProposal(
	cms: Cms,
	auth: Auth,
	store: ProposalStore,
	id: string,
	onProgress?: (progress: ApplyProgress) => void,
): Promise<Proposal> {
	let proposal = await store.get(auth.userId, id);
	if (!proposal) throw new CmsError("No such proposal", "not_found");
	if (proposal.status !== "pending" && proposal.status !== "applying") {
		throw new CmsError("The proposal was already settled", "invalid_status");
	}
	proposal = await refreshStale(cms, auth, store, proposal);
	proposal = await store.update(auth.userId, id, (current) => ({ ...current, status: "applying" }));
	const todo = proposal.items.filter((item) => item.included && item.state === "pending");
	const agent = { runId: proposal.runId, proposalId: id };
	let done = 0;
	for (const item of todo) {
		let next: ProposalItem;
		if (!(await stillThere(cms, auth, item))) {
			next = { ...item, state: "stale", reason: "changed" };
		} else {
			try {
				const applied = await cms.writes.apply(item.operation, planOf(item), { auth, agent });
				next = { ...item, state: "applied", applied: { ...applied, at: new Date().toISOString() } };
			} catch (error) {
				next = { ...item, state: "failed", reason: codeOf(error) };
			}
		}
		proposal = await store.update(auth.userId, id, (current) => ({
			...current,
			items: current.items.map((candidate) => (candidate.id === item.id ? next : candidate)),
		}));
		done += 1;
		onProgress?.({ done, total: todo.length, item: next });
	}
	// Some included item not applied (failed, or its target moved): "N not done".
	const missed = proposal.items.some((item) => item.included && (item.state === "failed" || item.state === "stale"));
	return store.update(auth.userId, id, (current) => ({
		...current,
		status: missed ? "partial" : "applied",
		settledAt: new Date().toISOString(),
	}));
}

/**
 * Undoes the applied items, last first. An item whose target changed after it was applied is left as it is (`kept`, "changed since"): a person's later edit is
 * never overwritten. The rest are reverted as the admin, recorded as the agent's.
 */
export async function revertProposal(
	cms: Cms,
	auth: Auth,
	store: ProposalStore,
	id: string,
	onProgress?: (progress: ApplyProgress) => void,
): Promise<Proposal> {
	let proposal = await store.get(auth.userId, id);
	if (!proposal) throw new CmsError("No such proposal", "not_found");
	if (proposal.status !== "applied" && proposal.status !== "partial") {
		throw new CmsError("Only an applied proposal can be undone", "invalid_status");
	}
	const todo = proposal.items.filter((item) => item.state === "applied").reverse();
	const agent = { runId: proposal.runId, proposalId: id };
	let done = 0;
	for (const item of todo) {
		const now = await cms.writes.baseOf(item.operation, item.target, { auth });
		let next: ProposalItem;
		if (now !== item.applied?.base) {
			next = { ...item, state: "kept", reason: "changed" };
		} else {
			try {
				await cms.writes.revert(item.operation, planOf(item), item.applied?.undo, { auth, agent });
				next = { ...item, state: "reverted" };
			} catch (error) {
				next = { ...item, state: "kept", reason: codeOf(error) };
			}
		}
		proposal = await store.update(auth.userId, id, (current) => ({
			...current,
			items: current.items.map((candidate) => (candidate.id === item.id ? next : candidate)),
		}));
		done += 1;
		onProgress?.({ done, total: todo.length, item: next });
	}
	return store.update(auth.userId, id, (current) => ({
		...current,
		status: "reverted",
		settledAt: new Date().toISOString(),
	}));
}

/** Discards a proposal that waits for review: nothing changes, and it stays in its conversation as "discarded". */
export async function discardProposal(auth: Auth, store: ProposalStore, id: string): Promise<Proposal> {
	return store.update(auth.userId, id, (current) => {
		if (current.status !== "pending") throw new CmsError("Only a waiting proposal can be discarded", "invalid_status");
		return { ...current, status: "discarded", settledAt: new Date().toISOString() };
	});
}

/** Puts items in or leaves them out before applying. */
export async function includeItems(
	auth: Auth,
	store: ProposalStore,
	id: string,
	changes: Readonly<Record<string, boolean>>,
): Promise<Proposal> {
	return store.update(auth.userId, id, (current) => {
		if (current.status !== "pending") throw new CmsError("The proposal is no longer open", "invalid_status");
		return {
			...current,
			items: current.items.map((item) =>
				Object.hasOwn(changes, item.id) ? { ...item, included: Boolean(changes[item.id]) } : item,
			),
		};
	});
}
