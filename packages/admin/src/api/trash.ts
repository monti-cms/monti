import type {
	IncomingReferenceItem,
	Site,
	TrashDeleteResult,
	TrashEmptyResult,
	TrashItem,
	TrashListParams,
	TrashListResult,
	TrashRestoreResult,
	TrashTarget,
} from "@monti-cms/core/site";
import { adminFetch } from "./client";

/** The contract's types as they travel in JSON: dates are ISO strings. */
type Jsonified<T> = T extends Date
	? string
	: T extends readonly (infer U)[]
		? Jsonified<U>[]
		: T extends object
			? { -readonly [K in keyof T]: Jsonified<T[K]> }
			: T;

export type TrashItemJson = Jsonified<TrashItem>;
export type TrashEntryJson = Extract<TrashItemJson, { type: "entry" }>;
export type TrashFolderJson = Extract<TrashItemJson, { type: "folder" }>;
export type TrashMediaJson = Extract<TrashItemJson, { type: "media" }>;
/** One page of the trash as the API answers it. */
export type TrashPage = Jsonified<TrashListResult>;
export type TrashRestoreOutcome = Jsonified<TrashRestoreResult>;
export type TrashDeleteOutcome = Jsonified<TrashDeleteResult>;
export type TrashEmptyOutcome = Jsonified<TrashEmptyResult>;

/** A referrer of an entry as the relations endpoint lists it; `sourceStatus` is `trashed` for a referrer that is in the trash itself. */
export type TrashReferrer = IncomingReferenceItem;

/** Query keys. Everything under `all` is refetched after the trash changes. */
export const trashKeys = {
	all: ["cms", "trash"] as const,
	list: (query: string) => [...trashKeys.all, "list", query] as const,
};

/** The query string of `GET /v1/trash`; what is unset is left out. */
export function trashQuery(params: TrashListParams): URLSearchParams {
	const query = new URLSearchParams();
	if (params.kind) query.set("kind", params.kind);
	if (params.folderId) query.set("folder", params.folderId);
	if (params.search) query.set("q", params.search);
	if (params.direction) query.set("sort", params.direction);
	if (params.page && params.page > 1) query.set("page", String(params.page));
	if (params.pageSize) query.set("pageSize", String(params.pageSize));
	return query;
}

/** `GET /v1/trash?<query>`: the units at the top of the trash, or the inside of one folder, or what a search finds. */
export const listTrash = (site: Site, query: string | URLSearchParams, signal?: AbortSignal, fallback?: string) =>
	adminFetch<TrashPage>(site, `/v1/trash?${query.toString()}`, { signal, fallback });

/** How many units the trash holds at its top: what the rail's badge shows. */
export async function countTrash(site: Site, signal?: AbortSignal): Promise<number> {
	const page = await listTrash(site, new URLSearchParams({ pageSize: "25" }), signal);
	return Object.values(page.kinds ?? {}).reduce((sum, count) => sum + count, 0);
}

/**
 * `POST /v1/trash/restore`: each unit on its own, so one that cannot come back does not stop the others; one answer per unit, in order. Entries and
 * folders name the version the screen saw (the undo of a trash toast passes the one the trash returned); media files need none.
 */
export const restoreTrash = async (site: Site, items: readonly TrashTarget[], fallback?: string) =>
	(
		await adminFetch<{ results: TrashRestoreOutcome[] }>(site, "/v1/trash/restore", {
			method: "POST",
			json: { items },
			fallback,
		})
	).results;

/** `POST /v1/trash/delete`: deletes for good, in the given order. A unit something points at stays and comes back as `in_use` with its referrers. */
export const deleteTrash = (site: Site, items: readonly TrashTarget[], fallback?: string) =>
	adminFetch<{ results: TrashDeleteOutcome[] }>(site, "/v1/trash/delete", {
		method: "POST",
		json: { items },
		fallback,
	});

/** `POST /v1/trash/empty`: deletes everything at the top of the trash that nothing points at; the rest stays and comes back in `kept`. */
export const emptyTrash = (site: Site, fallback?: string) =>
	adminFetch<TrashEmptyOutcome>(site, "/v1/trash/empty", { method: "POST", fallback });

/** `POST /v1/references/unlink`: takes these entries out of the relation fields that point at them (the published copy too). */
export const unlinkReferences = (site: Site, targetIds: readonly string[], fallback?: string) =>
	adminFetch<{ entries: number }>(site, "/v1/references/unlink", { method: "POST", json: { targetIds }, fallback });

/** `GET /v1/entries/:id/relations?includeTrashed=true`: what points at an entry, the entries in the trash too. */
export const getReferrers = (site: Site, id: string, signal?: AbortSignal) =>
	adminFetch<{ incomingReferences: TrashReferrer[] }>(
		site,
		`/v1/entries/${encodeURIComponent(id)}/relations?includeTrashed=true`,
		{ signal },
	);
