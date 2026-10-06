import { documentToMdx } from "@monti-cms/core/mdx";
import { vi } from "vitest";
import { CmsApiError } from "../../admin-api";
import type { CmsIssue } from "../../api-error-message";
import type { EntryEditorClient, RecoveryRecord, RecoveryStore } from "../entry-editor-client";
import { type EntryData, type EntryForm, type EntryFormPatch, formFingerprint, formFromEntry } from "../entry-form";

/**
 * Fakes for the entry editor's two seams, so a test drives the editor without `fetch` or IndexedDB. They use the reference blog's `post` collection.
 */

export const ENTRY: EntryData = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "요약" }, mdx: "첫째 줄\n둘째 줄" },
};

export const conflictError = () => new CmsApiError(409, "conflict", "someone saved first", [], { code: "conflict" });
export const unauthorizedError = () =>
	new CmsApiError(401, "unauthorized", "sign in again", [], { code: "unauthorized" });
export const serverError = () => new CmsApiError(500, undefined, "server error", [], {});
export const invalidError = (issues: CmsIssue[] = []) =>
	new CmsApiError(400, "invalid_input", "title is too long", issues, { code: "invalid_input" });

/**
 * A server with one entry. `update` checks the version like the real one (409 `conflict` when it is behind); every method is a spy, so a test can
 * make the next call fail with `mockRejectedValueOnce`.
 */
export function fakeClient(initial: EntryData = ENTRY) {
	const server = { current: initial };
	const client = {
		get: vi.fn(async (_id: string) => structuredClone(server.current)),
		create: vi.fn(async (input: Parameters<EntryEditorClient["create"]>[0]) => {
			server.current = {
				...ENTRY,
				id: "created-1",
				collection: input.collection,
				version: 1,
				workingSlug: input.slug,
				working: { metadata: input.metadata, mdx: documentToMdx(input.doc), doc: input.doc },
			};
			return structuredClone(server.current);
		}),
		update: vi.fn(async (_id: string, input: Parameters<EntryEditorClient["update"]>[1]) => {
			if (input.expectedVersion !== server.current.version) throw conflictError();
			server.current = {
				...server.current,
				version: server.current.version + 1,
				workingSlug: input.slug,
				working: { metadata: input.metadata, mdx: documentToMdx(input.doc), doc: input.doc },
			};
			return structuredClone(server.current);
		}),
		publish: vi.fn(
			async (
				_id: string,
				input: Parameters<EntryEditorClient["publish"]>[1],
			): Promise<EntryData & { warnings?: CmsIssue[] }> => {
				if (input.expectedVersion !== server.current.version) throw conflictError();
				server.current = { ...server.current, version: server.current.version + 1, status: "published" };
				return { ...structuredClone(server.current), warnings: [] };
			},
		),
		changeStatus: vi.fn(async (_id: string, action: Parameters<EntryEditorClient["changeStatus"]>[1]) => {
			const status = { archive: "archived", unarchive: "draft", trash: "trashed", restore: "draft" } as const;
			server.current = { ...server.current, version: server.current.version + 1, status: status[action] };
		}),
		duplicate: vi.fn(async (_id: string, _input: { title: string }) => ({
			...structuredClone(server.current),
			id: "copy-1",
		})),
		remove: vi.fn(async (_id: string, _input: { expectedVersion: number }) => undefined),
		relations: vi.fn(async (_id: string) => ({ incomingReferences: [] })),
	} satisfies EntryEditorClient;
	return { client, server };
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
	const base = formFromEntry(server);
	const snapshot = { ...base, ...changes } as EntryForm;
	return {
		key: `${adminId}:${server.id}`,
		entryId: server.id,
		baseVersion,
		baseFingerprint: formFingerprint(base),
		localFingerprint: formFingerprint(snapshot),
		snapshot,
		changeSeq: 1,
		savedAt: 1_700_000_000_000,
	};
}
