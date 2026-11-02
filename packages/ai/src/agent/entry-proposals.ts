import type { AdminRequest, Cms } from "@monti-cms/core/server";
import { refreshStale } from "./apply";
import type { Proposal, ProposalStore } from "./proposals";

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
