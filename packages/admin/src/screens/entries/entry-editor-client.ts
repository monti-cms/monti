import { cmsApiUrl } from "@monti-cms/core/client";
import type { StoredDocument } from "@monti-cms/core/mdx";
import type { IncomingReferenceItem } from "@monti-cms/core/runtime";
import { cmsFetch } from "../admin-api";
import type { CmsIssue } from "../api-error-message";
import type { EntryData, EntryForm } from "./entry-form";
import { deleteLocalBackup, getLocalBackup, type LocalBackupRecord, saveLocalBackup } from "./local-backup";
import { t } from "./translate";

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

/**
 * The server calls the entry editor makes. The default is {@link cmsEntryClient} (the admin API). A test or another transport passes its own to
 * `useEntryEditor({ client })`. Methods reject with `CmsApiError` for an error response and with a `TypeError` when the network is down;
 * the editor turns both into an `EditorError`.
 *
 * @experimental
 */
export interface EntryEditorClient {
	get(id: string): Promise<EntryData>;
	create(input: EntrySaveInput & { collection: string; folderId?: string }): Promise<EntryData>;
	update(id: string, input: EntrySaveInput & { expectedVersion: number }): Promise<EntryData>;
	publish(
		id: string,
		input: { expectedVersion: number; resetPublishedAt?: boolean },
	): Promise<EntryData & { warnings?: CmsIssue[] }>;
	changeStatus(id: string, action: EntryStatusAction, input: { expectedVersion: number }): Promise<void>;
	duplicate(id: string, input: { title: string }): Promise<EntryData>;
	remove(id: string, input: { expectedVersion: number }): Promise<void>;
	relations(id: string): Promise<{ incomingReferences: IncomingReferenceItem[] }>;
}

/**
 * The admin API (`/v1/entries`).
 *
 * @experimental
 */
export const cmsEntryClient: EntryEditorClient = {
	get: (id) => cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}`), { fallback: t("loadFailed") }),
	create: (input) =>
		cmsFetch<EntryData>(cmsApiUrl("/v1/entries"), { method: "POST", json: input, fallback: t("saveFailed") }),
	update: (id, input) =>
		cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}`), { method: "PATCH", json: input, fallback: t("saveFailed") }),
	publish: (id, input) =>
		cmsFetch<EntryData & { warnings?: CmsIssue[] }>(cmsApiUrl(`/v1/entries/${id}/publish`), {
			method: "POST",
			json: input,
			fallback: t("publishFailed"),
		}),
	changeStatus: async (id, action, input) => {
		await cmsFetch(cmsApiUrl(`/v1/entries/${id}/${action}`), { method: "POST", json: input });
	},
	duplicate: (id, input) =>
		cmsFetch<EntryData>(cmsApiUrl(`/v1/entries/${id}/duplicate`), { method: "POST", json: input }),
	remove: async (id, input) => {
		await cmsFetch(cmsApiUrl(`/v1/entries/${id}?expectedVersion=${input.expectedVersion}`), { method: "DELETE" });
	},
	relations: (id) =>
		cmsFetch<{ incomingReferences: IncomingReferenceItem[] }>(cmsApiUrl(`/v1/entries/${id}/relations`)),
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
 * The browser's IndexedDB.
 *
 * @experimental
 */
export const localRecoveryStore: RecoveryStore = {
	get: (key) => getLocalBackup<EntryForm>(key),
	put: (record) => saveLocalBackup(record),
	delete: (key) => deleteLocalBackup(key),
};
