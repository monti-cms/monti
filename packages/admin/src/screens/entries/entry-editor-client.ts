import { cmsApiUrl, type Site } from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/document";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import { cmsFetch } from "../admin-api";
import type { CmsIssue } from "../api-error-message";
import type { EntryData, EntryForm } from "./entry-form";
import { deleteLocalBackup, getLocalBackup, type LocalBackupRecord, saveLocalBackup } from "./local-backup";
import { entriesMessages } from "./messages";

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

/**
 * The server calls the entry editor makes. The default is {@link cmsEntryClient} (the admin API). A test or another transport passes its own to
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
export const cmsEntryClient = (site: Site): EntryEditorClient => {
	const t = site.createTranslator(entriesMessages);
	return {
		get: (id) => cmsFetch<EntryData>(site, cmsApiUrl(`/v1/entries/${id}`), { fallback: t("loadFailed") }),
		create: (input) =>
			cmsFetch<EntryWriteResult>(site, cmsApiUrl("/v1/entries"), {
				method: "POST",
				json: input,
				fallback: t("saveFailed"),
			}),
		update: (id, input) =>
			cmsFetch<EntryWriteResult>(site, cmsApiUrl(`/v1/entries/${id}`), {
				method: "PATCH",
				json: input,
				fallback: t("saveFailed"),
			}),
		publish: (id, input) =>
			cmsFetch<EntryWriteResult>(site, cmsApiUrl(`/v1/entries/${id}/publish`), {
				method: "POST",
				json: input,
				fallback: t("publishFailed"),
			}),
		changeStatus: async (id, action, input) => {
			await cmsFetch(site, cmsApiUrl(`/v1/entries/${id}/${action}`), { method: "POST", json: input });
		},
		duplicate: (id, input) =>
			cmsFetch<EntryWriteResult>(site, cmsApiUrl(`/v1/entries/${id}/duplicate`), { method: "POST", json: input }),
		remove: async (id, input) => {
			await cmsFetch(site, cmsApiUrl(`/v1/entries/${id}?expectedVersion=${input.expectedVersion}`), {
				method: "DELETE",
			});
		},
		relations: (id) =>
			cmsFetch<{ incomingReferences: IncomingReferenceItem[] }>(site, cmsApiUrl(`/v1/entries/${id}/relations`)),
	};
};

/** What the browser keeps of an unsaved edit: one record per entry (or per new entry of a collection). */
export type RecoveryRecord = LocalBackupRecord<EntryForm>;

/**
 * Where the recovery copy lives. The default is the browser's IndexedDB (`local-backup.ts`). `put` resolves `false` when the copy could not
 * be kept (private browsing, storage quota), so the editor can tell the user that recovery is unavailable.
 *
 * @experimental
 */
export interface RecoveryStore {
	get(key: string): Promise<RecoveryRecord | null>;
	put(record: RecoveryRecord): Promise<boolean>;
	delete(key: string): Promise<void>;
}

/**
 * The browser's IndexedDB, in a database of the site's own (two sites on one origin keep their copies apart). Copies the old shared database holds are still found:
 * the first read of one moves it to the site's database.
 *
 * @experimental
 */
export const localRecoveryStoreOf = (site: Site): RecoveryStore => ({
	get: (key) => getLocalBackup<EntryForm>(key, site),
	put: (record) => saveLocalBackup(record, site),
	delete: (key) => deleteLocalBackup(key, site),
});
