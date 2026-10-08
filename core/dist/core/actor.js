import { AsyncLocalStorage } from "node:async_hooks";
/**
 * Who is making the change a request carries out. The admin API runs each route inside {@link withActor}, and the store reads {@link currentActor} when a write
 * raises an entry's version, so the entry records who made its latest change (`changedBy`) and when (`changedAt`). The edit screen shows both when someone else
 * saved first. A write made outside a request (a script, a plugin job) has no actor, and records none: it never takes the name of someone who made an earlier change.
 *
 * It is request context rather than a parameter of every write, so a write that is added later records its actor without each caller passing it down.
 */
const storage = new AsyncLocalStorage();
/** Runs `run` with `actor` as the one making the changes (none for `null` and `undefined`). */
export const withActor = (actor, run) => storage.run({ actor: actor?.trim() || null }, run);
/** The one making the change that is being carried out, or `null` outside a request or when it is not known. */
export const currentActor = () => storage.getStore()?.actor ?? null;
/** The name an admin is recorded under: the name the login method gives (the GitHub name or login), else the account ID. */
export const actorOf = (auth) => auth.name?.trim() || String(auth.accountId);
