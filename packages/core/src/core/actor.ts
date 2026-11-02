import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthContext } from "../adapters/auth";

/**
 * Who is making the change a request carries out. The admin API runs each route inside {@link withActor}, and the store reads {@link currentActor} when a write
 * raises an entry's version, so the entry records who made its latest change (`changedBy`) and when (`changedAt`). The edit screen shows both when someone else
 * saved first. A write made outside a request (a script, a plugin job) has no actor, and records none: it never takes the name of someone who made an earlier change.
 *
 * It is request context rather than a parameter of every write, so a write that is added later records its actor without each caller passing it down.
 */
/**
 * A change the admin agent carried out on the admin's behalf: the conversation it came from and the proposal the admin applied. The activity log marks such a
 * change with ✦ and links the conversation; the trash shows "✦ 버림" for an item it trashed.
 */
export interface AgentAttribution {
	readonly runId: string;
	readonly proposalId: string;
}

const storage = new AsyncLocalStorage<{ readonly actor: string | null; readonly agent: AgentAttribution | null }>();

/** Runs `run` with `actor` as the one making the changes (none for `null` and `undefined`), and `agent` when the admin agent carries them out. */
export const withActor = <T>(actor: string | null | undefined, run: () => T, agent?: AgentAttribution | null): T =>
	storage.run({ actor: actor?.trim() || null, agent: agent ?? null }, run);

/** The one making the change that is being carried out, or `null` outside a request or when it is not known. */
export const currentActor = (): string | null => storage.getStore()?.actor ?? null;

/** The agent conversation and proposal the change being carried out comes from, or `null` for a change a person made. */
export const currentAgent = (): AgentAttribution | null => storage.getStore()?.agent ?? null;

/** The name an admin is recorded under: the name the login method gives (the GitHub name or login), else the account ID. */
export const actorOf = (auth: Pick<AuthContext, "name" | "accountId">): string =>
	auth.name?.trim() || String(auth.accountId);
