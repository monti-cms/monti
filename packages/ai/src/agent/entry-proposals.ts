import { type AdminRequest, type Cms, CmsError, type WriteApplied } from "@monti-cms/core/server";
import { codeOf, refreshStale } from "./apply";
import { type Proposal, type ProposalItem, type ProposalStore, planOf, type SpotMessage } from "./proposals";

type Auth = AdminRequest["auth"];

/**
 * What the entry editor shows as blue pencil marks (docs/design/agent-editor.md): the proposals that wait for review and change this entry, each with the items
 * whose spot changed since the plan marked stale, so the editor never offers to put back what a person wrote over.
 */
export async function proposalsForEntry(
	cms: Cms,
	auth: Auth,
	store: ProposalStore,
	entryId: string,
): Promise<Proposal[]> {
	const found = await store.pendingFor(auth.userId, entryId);
	return Promise.all(found.map((proposal) => refreshStale(cms, auth, store, proposal)));
}

/**
 * What the admin did with items where they show: accepted in the entry editor and saved there (with the blocks the editor put in place of a body change),
 * accepted where nothing waits for a save (a media tile's alt text: applied now), and discarded.
 */
export interface EditorSettlement {
	readonly accepted?: readonly { readonly id: string; readonly placed?: readonly string[] }[];
	readonly applied?: readonly string[];
	readonly discarded?: readonly string[];
}

/** What the media library shows as proposals on its tiles (flow 6 · 25): the waiting media proposals, with spots changed since the plan marked stale. */
export async function proposalsForMedia(cms: Cms, auth: Auth, store: ProposalStore): Promise<Proposal[]> {
	const found = await store.pendingMedia(auth.userId);
	return Promise.all(found.map((proposal) => refreshStale(cms, auth, store, proposal)));
}

/**
 * Records what the admin did with a proposal's items in the entry editor (docs/design/agent-editor.md): an accepted item, once saved, counts as applied and
 * can be undone like one; a discarded item is left out. When none of its items waits any more, the proposal is settled: applied when any item was, discarded
 * otherwise. Items for other entries keep waiting.
 */
export async function settleInEditor(
	cms: Cms,
	auth: Auth,
	store: ProposalStore,
	id: string,
	{ accepted = [], applied = [], discarded = [] }: EditorSettlement,
): Promise<Proposal> {
	const proposal = await store.get(auth.userId, id);
	if (!proposal) throw new CmsError("No such proposal", "not_found");
	if (proposal.status !== "pending") throw new CmsError("The proposal is no longer open", "invalid_status");
	const adopted = new Map<string, WriteApplied>();
	for (const { id: itemId, placed } of accepted) {
		const item = proposal.items.find((candidate) => candidate.id === itemId);
		if (!item || item.state !== "pending") continue;
		adopted.set(itemId, await cms.writes.adopt(item.operation, planOf(item), placed ? { placed } : {}, { auth }));
	}
	// Accepted where nothing waits for a save: applied here, the way the review applies.
	const appliedNow = new Map<string, ProposalItem>();
	for (const itemId of applied) {
		const item = proposal.items.find((candidate) => candidate.id === itemId);
		if (!item || item.state !== "pending") continue;
		try {
			const done = await cms.writes.apply(item.operation, planOf(item), {
				auth,
				agent: { runId: proposal.runId, proposalId: id },
			});
			appliedNow.set(itemId, { ...item, state: "applied", applied: { ...done, at: new Date().toISOString() } });
		} catch (error) {
			appliedNow.set(itemId, { ...item, state: "failed", reason: codeOf(error) });
		}
	}
	const at = new Date().toISOString();
	const left = new Set(discarded);
	return store.update(auth.userId, id, (current) => {
		const items = current.items.map((item): ProposalItem => {
			const now = appliedNow.get(item.id);
			if (now && item.state === "pending") return now;
			const done = adopted.get(item.id);
			if (done && item.state === "pending")
				return { ...item, state: "applied", applied: { ...done, at, inEditor: true } };
			return left.has(item.id) ? { ...item, included: false } : item;
		});
		const waiting = items.some((item) => item.included && (item.state === "pending" || item.state === "stale"));
		if (waiting) return { ...current, items };
		const status = items.some((item) => item.state === "applied") ? "applied" : "discarded";
		return { ...current, items, status, settledAt: at };
	});
}

/** What every change waiting in the entry editor carries: where it came from and what was said about it. */
interface EditorProposalViewBase {
	readonly id: string;
	readonly proposalId: string;
	readonly runId: string;
	readonly request: string;
	/** What was said about it in its card. */
	readonly thread: readonly SpotMessage[];
}

/** A body change waiting in the entry editor, with what the editor needs to draw and accept it. */
export interface EditorBodyProposalView extends EditorProposalViewBase {
	readonly kind: "body";
	readonly blockId: string;
	/** The block as planned against, and the blocks that take its place (none removes it), as stored. */
	readonly block: unknown;
	readonly nodes: readonly unknown[];
}

/** A field change waiting in the entry editor (a summary, an SEO description): the value it was planned against and the new one. */
export interface EditorFieldProposalView extends EditorProposalViewBase {
	readonly kind: "field";
	readonly field: string;
	readonly before: unknown;
	readonly value: unknown;
}

export type EditorProposalView = EditorBodyProposalView | EditorFieldProposalView;

/** The changes of the proposals that the editor of entry `entryId` shows (its body and its fields): waiting, put in, and not changed meanwhile. */
export const editorProposalViews = (proposals: readonly Proposal[], entryId: string): EditorProposalView[] =>
	proposals.flatMap((proposal) =>
		proposal.items.flatMap((item): EditorProposalView[] => {
			if (item.target.id !== entryId || item.state !== "pending" || !item.included) return [];
			const base = {
				id: item.id,
				proposalId: proposal.id,
				runId: proposal.runId,
				request: proposal.request,
				thread: item.thread ?? [],
			};
			if (item.operation === "entries.updateBody") {
				const change = item.change as { blockId: string; block: unknown; nodes: readonly unknown[] };
				return [{ ...base, kind: "body", blockId: change.blockId, block: change.block, nodes: change.nodes }];
			}
			if (item.operation === "entries.updateFields") {
				const change = item.change as { field: string; value: unknown };
				return [{ ...base, kind: "field", field: change.field, before: item.preview.before, value: change.value }];
			}
			return [];
		}),
	);

/** An alt text change waiting on a media tile (flow 6 · 25): the file, the text it was planned against and the new one. */
export interface MediaProposalView {
	readonly id: string;
	readonly proposalId: string;
	readonly runId: string;
	readonly request: string;
	readonly mediaId: string;
	readonly before: string | null;
	readonly value: string;
	readonly thread: readonly SpotMessage[];
}

/** The alt text changes the media library shows: waiting and put in. Captions stay on the review page (a tile shows no caption). */
export const mediaProposalViews = (proposals: readonly Proposal[]): MediaProposalView[] =>
	proposals.flatMap((proposal) =>
		proposal.items.flatMap((item): MediaProposalView[] => {
			if (item.operation !== "media.updateText" || item.state !== "pending" || !item.included) return [];
			const change = item.change as { spot: string; value: string };
			if (change.spot !== "defaultAlt") return [];
			return [
				{
					id: item.id,
					proposalId: proposal.id,
					runId: proposal.runId,
					request: proposal.request,
					mediaId: item.target.id,
					before: typeof item.preview.before === "string" ? item.preview.before : null,
					value: change.value,
					thread: item.thread ?? [],
				},
			];
		}),
	);
