import { SUMMARY_ROLE } from "@monti-cms/core";
import { vi } from "vitest";
import { contentCollection, defaultLocale } from "../../../../../core/test/any-site";
import { testSite } from "../../../../../core/test/site";
import { CmsApiError } from "../../../api/client";
import type { EntryEditorClient, EntryWriteResult } from "../../../api/entries";
import type { CmsIssue } from "../../../api/error-message";
import { docOf } from "../../../test/mdx";
import type { RecoveryRecord, RecoveryStore } from "../entry-editor-client";
import { type EntryData, type EntryForm, type EntryFormPatch, formFingerprint, formFromEntry } from "../entry-form";

/**
 * Fakes for the entry editor's two seams, so a test drives the editor without `fetch` or IndexedDB. They use the site's first document collection
 * with a body (`contentCollection`), so the same tests run on any site config.
 */

/** The collection's summary field (the field with the summary role), if it has one. */
export const SUMMARY_FIELD = testSite
	.storedFields(contentCollection)
	.find(({ field }) => field.kind === "text" && field.role === SUMMARY_ROLE);

/** The first relation the collection requires, if any: the entry holds a value for it, as a publishable entry does. */
export const REQUIRED_RELATION = testSite
	.storedFields(contentCollection)
	.find(({ field, when }) => field.kind === "relation" && field.required === true && !when);

/** The entry's metadata without its summary: a summary field filled from the body is empty until publishing fills it. */
export const METADATA_WITHOUT_SUMMARY: Record<string, unknown> = {
	title: "테스트",
	...(REQUIRED_RELATION ? { [REQUIRED_RELATION.name]: "rel-1" } : {}),
};

export const ENTRY: EntryData = {
	id: "entry-1",
	collection: contentCollection,
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: {
		metadata: { ...METADATA_WITHOUT_SUMMARY, ...(SUMMARY_FIELD ? { [SUMMARY_FIELD.name]: "요약" } : {}) },
		doc: docOf("첫째 줄\n둘째 줄"),
	},
};

export const conflictError = () => new CmsApiError(409, "conflict", "someone saved first", [], { code: "conflict" });
export const unauthorizedError = () =>
	new CmsApiError(401, "unauthorized", "sign in again", [], { code: "unauthorized" });
export const serverError = () => new CmsApiError(500, undefined, "server error", [], {});
export const invalidError = (issues: CmsIssue[] = []) =>
	new CmsApiError(400, "invalid_input", "title is too long", issues, { code: "invalid_input" });

/**
 * A server with one entry, and the other records a backlink pick writes to (`records`, by id). `update` checks the version like the real one (409
 * `conflict` when it is behind); every method is a spy, so a test can make the next call fail with `mockRejectedValueOnce`.
 */
export function fakeClient(initial: EntryData = ENTRY, records: Record<string, EntryData> = {}) {
	const server = { current: initial };
	const others = structuredClone(records);
	const client = {
		get: vi.fn(async (id: string) => structuredClone(others[id] ?? server.current)),
		create: vi.fn(async (input: Parameters<EntryEditorClient["create"]>[0]): Promise<EntryWriteResult> => {
			server.current = {
				...ENTRY,
				id: "created-1",
				collection: input.collection,
				version: 1,
				workingSlug: input.slug,
				working: { metadata: input.metadata, doc: input.doc ?? server.current.working.doc },
			};
			// Like the real server, a write answers with the translation group; a fresh entry is its only member.
			server.current.translations = [
				{
					id: "created-1",
					locale: server.current.locale ?? defaultLocale,
					status: "draft",
					isSource: true,
					title: null,
					workingSlug: input.slug,
				},
			];
			return { entry: structuredClone(server.current), warnings: [] };
		}),
		update: vi.fn(async (id: string, input: Parameters<EntryEditorClient["update"]>[1]): Promise<EntryWriteResult> => {
			const other = others[id];
			if (other) {
				if (input.expectedVersion !== other.version) throw conflictError();
				others[id] = { ...other, version: other.version + 1, working: { ...other.working, metadata: input.metadata } };
				return { entry: structuredClone(others[id]), warnings: [] };
			}
			if (input.expectedVersion !== server.current.version) throw conflictError();
			server.current = {
				...server.current,
				version: server.current.version + 1,
				workingSlug: input.slug,
				working: { metadata: input.metadata, doc: input.doc ?? server.current.working.doc },
			};
			return { entry: structuredClone(server.current), warnings: [] };
		}),
		publish: vi.fn(
			async (_id: string, input: Parameters<EntryEditorClient["publish"]>[1]): Promise<EntryWriteResult> => {
				if (input.expectedVersion !== server.current.version) throw conflictError();
				server.current = { ...server.current, version: server.current.version + 1, status: "published" };
				return { entry: structuredClone(server.current), warnings: [] };
			},
		),
		changeStatus: vi.fn(async (_id: string, action: Parameters<EntryEditorClient["changeStatus"]>[1]) => {
			const status = { archive: "archived", unarchive: "draft", trash: "trashed", restore: "draft" } as const;
			server.current = { ...server.current, version: server.current.version + 1, status: status[action] };
		}),
		duplicate: vi.fn(async (_id: string, _input: { title: string }) => ({
			entry: { ...structuredClone(server.current), id: "copy-1" },
			warnings: [],
		})),
		remove: vi.fn(async (_id: string, _input: { expectedVersion: number }) => undefined),
		relations: vi.fn(async (_id: string) => ({ incomingReferences: [] })),
	} satisfies EntryEditorClient;
	return { client, server, records: others };
}

/** A recovery store in memory. `put` can be made to fail (private browsing) with `available.current = false`. */
export function fakeRecoveryStore(initial: RecoveryRecord[] = []) {
	const records = new Map(initial.map((record) => [record.key, record]));
	const available = { current: true };
	const store = {
		get: vi.fn(async (key: string) => records.get(key) ?? null),
		put: vi.fn(async (record: RecoveryRecord) => {
			if (!available.current) return false;
			records.set(record.key, structuredClone(record));
			return true;
		}),
		delete: vi.fn(async (key: string) => {
			records.delete(key);
		}),
	} satisfies RecoveryStore;
	return { store, records, available };
}

/** A recovery copy of `server` with `changes` typed on top, made at `baseVersion` (the server's version by default). */
export function recoveryCopy(
	server: EntryData,
	changes: EntryFormPatch,
	{ adminId = "u1", baseVersion = server.version }: { adminId?: string; baseVersion?: number } = {},
): RecoveryRecord {
	const base = formFromEntry(testSite, server);
	const snapshot = { ...base, ...changes } as EntryForm;
	return {
		key: `${adminId}:${server.id}`,
		entryId: server.id,
		baseVersion,
		baseFingerprint: formFingerprint(testSite, base),
		localFingerprint: formFingerprint(testSite, snapshot),
		snapshot,
		changeSeq: 1,
		savedAt: 1_700_000_000_000,
	};
}
