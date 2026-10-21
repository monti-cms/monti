import type { StoredDocument } from "@monti-cms/core/document";
import type { BulkOp, EntryStatus, IncomingReferenceItem, ListEntriesItem, Site } from "@monti-cms/core/site";
import { commonMessages } from "../lib/common.messages";
import { bulkBarMessages } from "../screens/entries/bulk-bar.messages";
import type { EntryData } from "../screens/entries/entry-form";
import { entriesMessages } from "../screens/entries/messages";
import { adminFetch } from "./client";
import type { CmsIssue } from "./error-message";

/** One page of the list API response. */
export interface EntriesPage {
	items: ListEntriesItem[];
	total: number;
}

/** What `GET /v1/entries/search` answers. */
export type EntrySearchResponse = {
	items: { id: string; title: string | null; slug: string | null; status: string }[];
};

/** Query keys. Everything under `all` is refetched after a write; the trash badge count and the other list-wide numbers sit under it too. */
export const entriesKeys = {
	all: ["cms", "entries"] as const,
	list: (query: string) => [...entriesKeys.all, "list", query] as const,
	detail: (id: string) => [...entriesKeys.all, "detail", id] as const,
	relations: (id: string) => [...entriesKeys.all, "relations", id] as const,
	search: (query: string) => [...entriesKeys.all, "search", query] as const,
	taxonomy: (collection?: string) =>
		collection === undefined
			? ([...entriesKeys.all, "taxonomy"] as const)
			: ([...entriesKeys.all, "taxonomy", collection] as const),
	trashCount: () => [...entriesKeys.all, "trash-count"] as const,
};

/** A status change of an entry. */
export type EntryStatusAction = "archive" | "unarchive" | "trash" | "restore";

/** The body of a save: always the stored document (with block ids). The admin never sends text. */
export type EntryBodyPayload = { readonly doc: StoredDocument };

/** What a save sends. `translation` is set only when the entry is a translation. */
export type EntrySaveInput = {
	readonly slug: string | null;
	readonly metadata: Record<string, unknown>;
	readonly translation?: unknown;
} & EntryBodyPayload;

/** What a write of the admin API answers: the entry as it is now, and the warnings the write found (never part of the entry). */
export interface EntryWriteResult {
	readonly entry: EntryData;
	readonly warnings: readonly CmsIssue[];
}

const entryUrl = (id: string) => `/v1/entries/${encodeURIComponent(id)}`;

export const getEntry = <T = EntryData>(site: Site, id: string, signal?: AbortSignal, fallback?: string) =>
	adminFetch<T>(site, entryUrl(id), { signal, fallback });

/** `GET /v1/entries?<query>` (the list screen, taxonomy options, counts, the editor's internal-link search). */
export const listEntries = <T = EntriesPage>(
	site: Site,
	query: string | URLSearchParams,
	signal?: AbortSignal,
	fallback?: string,
) => adminFetch<T>(site, `/v1/entries?${query.toString()}`, { signal, fallback });

/** `GET /v1/entries/search?<query>` (relation pickers: title search, or lookup by `id`). */
export const searchEntries = (site: Site, query: string | URLSearchParams, signal?: AbortSignal) =>
	adminFetch<EntrySearchResponse>(site, `/v1/entries/search?${query.toString()}`, { signal });

/** `POST /v1/entries` */
export const createEntry = <T = EntryWriteResult>(
	site: Site,
	input: {
		collection: string;
		folderId?: string;
		slug: string | null;
		metadata: Record<string, unknown>;
		doc: StoredDocument;
		translation?: unknown;
	},
	fallback?: string,
) => adminFetch<T>(site, "/v1/entries", { method: "POST", json: input, fallback });

/** `PATCH /v1/entries/:id` */
export const updateEntry = <T = EntryWriteResult>(
	site: Site,
	id: string,
	input: {
		expectedVersion: number;
		slug: string | null;
		metadata: Record<string, unknown>;
		doc?: StoredDocument;
		translation?: unknown;
	},
	fallback?: string,
) => adminFetch<T>(site, entryUrl(id), { method: "PATCH", json: input, fallback });

/** `POST /v1/entries/:id/publish` */
export const publishEntry = (
	site: Site,
	id: string,
	input: { expectedVersion: number; resetPublishedAt?: boolean },
	fallback?: string,
) => adminFetch<EntryWriteResult>(site, `${entryUrl(id)}/publish`, { method: "POST", json: input, fallback });

/** `POST /v1/entries/:id/check`: what publishing the saved draft would find, without publishing. */
export const checkEntryPublish = (site: Site, id: string, fallback?: string) =>
	adminFetch<{ issues: CmsIssue[]; warnings: CmsIssue[] }>(site, `${entryUrl(id)}/check`, {
		method: "POST",
		json: {},
		fallback,
	});

/** `POST /v1/entries/:id/{archive,unarchive,trash,restore}` */
export const changeEntryStatus = async (
	site: Site,
	id: string,
	action: EntryStatusAction,
	input: { expectedVersion: number },
	fallback?: string,
): Promise<void> => {
	await adminFetch(site, `${entryUrl(id)}/${action}`, { method: "POST", json: input, fallback });
};

/** `POST /v1/entries/:id/duplicate` */
export const duplicateEntry = (site: Site, id: string, input: { title: string }, fallback?: string) =>
	adminFetch<EntryWriteResult>(site, `${entryUrl(id)}/duplicate`, { method: "POST", json: input, fallback });

/** `DELETE /v1/entries/:id?expectedVersion=n` (permanent). */
export const removeEntry = async (
	site: Site,
	id: string,
	input: { expectedVersion: number },
	fallback?: string,
): Promise<void> => {
	await adminFetch(site, `${entryUrl(id)}?${new URLSearchParams({ expectedVersion: String(input.expectedVersion) })}`, {
		method: "DELETE",
		fallback,
	});
};

/** `GET /v1/entries/:id/relations` (what points at this entry). */
export const getEntryRelations = <T = { incomingReferences: IncomingReferenceItem[] }>(
	site: Site,
	id: string,
	signal?: AbortSignal,
) => adminFetch<T>(site, `${entryUrl(id)}/relations`, { signal });

/** `POST /v1/entries/:id/translations` (a draft translation of the entry in `locale`). */
export const createEntryTranslation = (site: Site, id: string, locale: string, fallback?: string) =>
	adminFetch<{ entry: { id: string } }>(site, `${entryUrl(id)}/translations`, {
		method: "POST",
		json: { locale },
		fallback,
	});

export type BulkUsage = { entryId: string; title: string | null; collection: string; state: string };

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[]; usages?: BulkUsage[] };

/** A row a bulk action targets. `status`, when known, lets a lifecycle action leave out rows it cannot change (`canTransition`). */
export type BulkSelection = { id: string; expectedVersion: number; title?: string | null; status?: EntryStatus };

export type BulkParams = { field?: string; ids?: string[]; id?: string | null; folderId?: string | null };

/** `POST /v1/bulk`: one answer per item. */
export async function bulkEntries(
	site: Site,
	op: BulkOp,
	items: BulkSelection[],
	params: BulkParams = {},
): Promise<BulkItemResult[]> {
	const data = await adminFetch<{ results: BulkItemResult[] }>(site, "/v1/bulk", {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: site.createTranslator(bulkBarMessages)("requestFailed"),
	});
	return data.results;
}

/**
 * The server calls the entry editor makes. The default is {@link adminEntryClient} (the admin API). A test or another transport passes its own to
 * `useEntryEditor({ client })`. Methods reject with `CmsApiError` for an error response and with a `TypeError` when the network is down;
 * the editor turns both into an `EditorError`.
 *
 * @experimental
 */
export interface EntryEditorClient {
	get(id: string): Promise<EntryData>;
	/** A write answers the entry and, apart from it, the warnings the server found (a block's syntax check, for one). They never block. */
	create(input: EntrySaveInput & { collection: string; folderId?: string }): Promise<EntryWriteResult>;
	update(id: string, input: EntrySaveInput & { expectedVersion: number }): Promise<EntryWriteResult>;
	publish(id: string, input: { expectedVersion: number; resetPublishedAt?: boolean }): Promise<EntryWriteResult>;
	changeStatus(id: string, action: EntryStatusAction, input: { expectedVersion: number }): Promise<void>;
	duplicate(id: string, input: { title: string }): Promise<EntryWriteResult>;
	remove(id: string, input: { expectedVersion: number }): Promise<void>;
	relations(id: string): Promise<{ incomingReferences: IncomingReferenceItem[] }>;
}

/**
 * The admin API (`/v1/entries`).
 *
 * @experimental
 */
export const adminEntryClient = (site: Site): EntryEditorClient => {
	const t = site.createTranslator(entriesMessages);
	const saveFailed = site.createTranslator(commonMessages)("saveFailed");
	return {
		get: (id) => getEntry(site, id, undefined, t("loadFailed")),
		create: (input) => createEntry(site, input, saveFailed),
		update: (id, input) => updateEntry(site, id, input, saveFailed),
		publish: (id, input) => publishEntry(site, id, input, t("publishFailed")),
		changeStatus: (id, action, input) => changeEntryStatus(site, id, action, input),
		duplicate: (id, input) => duplicateEntry(site, id, input),
		remove: (id, input) => removeEntry(site, id, input),
		relations: (id) => getEntryRelations(site, id),
	};
};
