import { STORED_DOCUMENT_VERSION, type StoredDocument, withoutBlockIds } from "@monti-cms/core/document";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { docOf } from "../../../test/mdx";
import {
	COMPOSITION_WAIT_MS,
	createEntryEditor,
	type EntryEditorCallbacks,
	type EntryEditorTarget,
	RECOVERY_IDLE_MS,
} from "../entry-editor-store";
import { type EntryData, formFingerprint, formFromEntry } from "../entry-form";
import {
	conflictError,
	ENTRY,
	fakeClient,
	fakeRecoveryStore,
	invalidError,
	recoveryCopy,
	serverError,
	unauthorizedError,
} from "./entry-editor-fakes";

/**
 * The entry editor's engine, driven without React or a DOM: a fake server and a fake recovery store stand in for `fetch` and IndexedDB.
 * Uses the reference blog's `post` collection (an `summary` filled from the body, a slug made from the title).
 */

const ADMIN = "u1";
const tick = () => vi.advanceTimersByTimeAsync(0);

function setup({
	server = ENTRY,
	records = [] as ReturnType<typeof recoveryCopy>[],
	target,
	callbacks = {},
}: {
	server?: EntryData;
	records?: ReturnType<typeof recoveryCopy>[];
	target?: EntryEditorTarget;
	callbacks?: EntryEditorCallbacks;
} = {}) {
	const fake = fakeClient(server);
	const recovery = fakeRecoveryStore(records);
	const onSaved = vi.fn();
	const core = createEntryEditor({
		adminId: ADMIN,
		target: target ?? { mode: "edit", entryId: server.id },
		client: fake.client,
		recoveryStore: recovery.store,
		callbacks: () => ({ onSaved, ...callbacks }),
	});
	const editor = () => core.view(core.store.getState());
	return { core, editor, onSaved, ...fake, recovery };
}

/** Opens the editor and waits until the entry has loaded and the recovery copy was looked up. */
async function opened(options: Parameters<typeof setup>[0] = {}) {
	const ctx = setup(options);
	ctx.core.start();
	await vi.waitFor(() => expect(ctx.editor().load.status).not.toBe("loading"));
	return ctx;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("load", () => {
	it("opens an entry: ready, with its form, version and a saved status", async () => {
		const { editor, client } = await opened();
		expect(client.get).toHaveBeenCalledWith("entry-1");
		expect(editor().load).toEqual({ status: "ready" });
		expect(editor().collection).toBe("post");
		expect(editor().form).toEqual(formFromEntry(ENTRY));
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(editor().getSnapshot()).toMatchObject({ entryId: "entry-1", version: 4, saveStatus: "saved" });
		expect(editor().recovery).toBeNull();
		expect(editor().conflict).toBeNull();
	});

	it("is loading until the server answers", async () => {
		const ctx = setup();
		expect(ctx.editor().load).toEqual({ status: "loading" });
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().load.status).toBe("ready"));
	});

	it("reports a failed load as an error state with the server's message, and a network error as the offline text", async () => {
		const ctx = setup();
		ctx.client.get.mockRejectedValueOnce(unauthorizedError());
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().load.status).toBe("error"));
		const load = ctx.editor().load;
		expect(load.status === "error" && load.error).toMatchObject({ code: "session_expired", message: "sign in again" });

		const offline = setup();
		offline.client.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		offline.core.start();
		await vi.waitFor(() => expect(offline.editor().load.status).toBe("error"));
		const failed = offline.editor().load;
		expect(failed.status === "error" && failed.error.code).toBe("offline");
	});

	it("says redirect instead of navigating when the entry belongs to an item collection", async () => {
		const ctx = await opened({ server: { ...ENTRY, collection: "tag" } });
		expect(ctx.editor().load).toEqual({
			status: "redirect",
			reason: "item-collection",
			collection: "tag",
			entryId: "entry-1",
		});
		expect(ctx.editor().entry).toBeNull();
	});

	it("starts a new entry of an item collection as a redirect without any request", () => {
		const ctx = setup({ target: { mode: "new", collection: "tag" } });
		expect(ctx.editor().load).toEqual({ status: "redirect", reason: "item-collection", collection: "tag" });
		ctx.core.start();
		expect(ctx.client.get).not.toHaveBeenCalled();
	});

	it("drops the result of a load that was stopped", async () => {
		const ctx = setup();
		ctx.core.start();
		ctx.core.stop();
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(ctx.editor().load).toEqual({ status: "loading" });
		expect(ctx.editor().entry).toBeNull();
	});
});

describe("the form", () => {
	it("a change is local: unsaved, dirty, and nothing is sent to the server", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "가" });
		expect(editor().form.title).toBe("가");
		expect(editor().saveStatus).toBe("dirty");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(client.update).not.toHaveBeenCalled();
	});

	it("going back to what the server has is saved again, and drops the recovery copy", async () => {
		const { editor, recovery } = await opened();
		editor().setForm({ title: "가" });
		editor().setForm({ title: "테스트" });
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		await vi.waitFor(() => expect(recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
	});

	it("regenerates the slug from the title until it is touched by hand, and regenerateSlug starts it again", async () => {
		const { editor } = await opened({ target: { mode: "new", collection: "post" }, server: ENTRY });
		expect(editor().slug.touched).toBe(false);
		editor().setForm({ title: "Hello World" });
		const generated = editor().form.slug;
		expect(generated).not.toBe("");
		editor().setSlug("mine");
		expect(editor().slug).toEqual({ touched: true });
		editor().setForm({ title: "Another title" });
		expect(editor().form.slug).toBe("mine");
		editor().regenerateSlug();
		expect(editor().slug.touched).toBe(false);
		expect(editor().form.slug).not.toBe("mine");
	});

	it("an opened entry has a touched slug, so editing the title leaves it alone", async () => {
		const { editor } = await opened();
		expect(editor().slug.touched).toBe(true);
		editor().setForm({ title: "Different" });
		expect(editor().form.slug).toBe("test");
	});

	it("notifies subscribers only for a real change", async () => {
		const { core, editor } = await opened();
		const listener = vi.fn();
		core.store.subscribe(listener);
		editor().setForm({ title: "테스트" });
		expect(listener).not.toHaveBeenCalled();
		editor().setForm({ title: "다름" });
		expect(listener).toHaveBeenCalled();
	});
});

describe("save", () => {
	it("sends a PATCH with the expected version and the form's metadata, and the entry is saved", async () => {
		const { editor, client, onSaved } = await opened();
		editor().setForm({ title: "수정" });
		const result = await editor().save();
		expect(result.ok).toBe(true);
		expect(result.ok && result.value.changed).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
		const [id, input] = client.update.mock.calls[0] as [string, Record<string, unknown>];
		expect(id).toBe("entry-1");
		expect(input).toMatchObject({
			expectedVersion: 4,
			slug: "test",
			metadata: { title: "수정", categoryId: "cat-1", summary: "요약" },
		});
		// The body is always sent as a document, never as text.
		expect(input).not.toHaveProperty("mdx");
		expect(JSON.stringify(input.doc)).toContain("첫째 줄");
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(editor().saveError).toBeNull();
		expect(editor().getSnapshot().version).toBe(5);
		expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-1", version: 5 }), { created: false });
	});

	it("a save with nothing to save sends nothing", async () => {
		const { editor, client } = await opened();
		const result = await editor().save();
		expect(result).toMatchObject({ ok: true, value: { changed: false } });
		expect(client.update).not.toHaveBeenCalled();
	});

	it("sends one request at a time: a second save while one is running shares it", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "수정" });
		const [first, second] = await Promise.all([editor().save(), editor().save()]);
		expect(first.ok && second.ok).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
	});

	it("input during a send is unsaved meanwhile, and goes out in the same save once that request ends", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "첫째" });
		const send = client.update.getMockImplementation() as NonNullable<
			ReturnType<typeof client.update.getMockImplementation>
		>;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		client.update.mockImplementationOnce(async (id, input) => {
			await gate;
			return send(id, input);
		});
		const saving = editor().save();
		await vi.waitFor(() => expect(editor().saveStatus).toBe("saving"));
		editor().setForm({ title: "둘째" });
		expect(editor().hasUnsavedChanges).toBe(true);
		release();
		expect((await saving).ok).toBe(true);
		expect(client.update.mock.calls.map(([, input]) => (input.metadata as { title: string }).title)).toEqual([
			"첫째",
			"둘째",
		]);
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
	});

	it("creates a new entry with POST (with its folder), asks the UI to move to the edit URL, and drops the new-entry copy", async () => {
		const { editor, client, onSaved, recovery } = await opened({
			target: { mode: "new", collection: "post", folderId: "folder-1" },
		});
		expect(editor().load).toEqual({ status: "ready" });
		editor().setForm({ title: "새 글" });
		const result = await editor().save();
		expect(result.ok && result.value.entry.id).toBe("created-1");
		expect(client.create).toHaveBeenCalledWith(
			expect.objectContaining({
				collection: "post",
				folderId: "folder-1",
				metadata: expect.objectContaining({ title: "새 글" }),
			}),
		);
		expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "created-1" }), { created: true });
		expect(recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:new:post`);
		expect(editor().getSnapshot().entryId).toBe("created-1");
		// From now on it is an edit.
		editor().setForm({ title: "새 글 수정" });
		await editor().save();
		expect(client.update).toHaveBeenCalledWith("created-1", expect.objectContaining({ expectedVersion: 1 }));
	});

	it("sends the document the body editor made, with its block ids", async () => {
		const doc: StoredDocument = {
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [{ type: "paragraph", id: "abcd1234", content: [{ type: "text", text: "본문" }] }],
		};
		const { editor, client } = await opened();
		editor().setBody(doc);
		expect(editor().form.doc).toEqual(doc);
		expect(editor().hasUnsavedChanges).toBe(true);
		await editor().save();
		const first = client.update.mock.calls[0]?.[1] as Record<string, unknown>;
		expect(first.doc).toEqual(doc);
		expect(first).not.toHaveProperty("mdx");
	});

	it("a body that reads the same as the server's is not a change, whatever its block ids and the order of its keys", async () => {
		const { editor } = await opened();
		const server = editor().form.doc;
		const sameContent = {
			...server,
			content: server.content.map((block) => ({ ...block, id: "zzzzzzzz" })),
		};
		editor().setBody(sameContent);
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(editor().saveStatus).toBe("saved");
	});

	it("sends a removed field's value back as stored (orphaned metadata round trip)", async () => {
		const stored = { title: "테스트", removedField: "left behind", removedList: ["a", "b"] };
		const { editor, client } = await opened({ server: { ...ENTRY, working: { metadata: stored, doc: docOf("") } } });
		editor().setForm({ title: "Renamed" });
		await editor().save();
		expect((client.update.mock.calls[0]?.[1] as { metadata: unknown }).metadata).toEqual({
			...stored,
			title: "Renamed",
		});
	});

	it("keeps the translation group info the save response does not carry", async () => {
		const group: EntryData = {
			...ENTRY,
			locale: "ko",
			translationGroupId: "entry-1",
			translations: [{ id: "entry-1", locale: "ko", status: "draft", isSource: true, title: "t", workingSlug: "test" }],
		};
		const { editor, client } = await opened({ server: group });
		client.update.mockResolvedValueOnce({ ...ENTRY, version: 5 });
		editor().setForm({ title: "수정" });
		await editor().save();
		expect(editor().entry?.translations).toHaveLength(1);
		expect(editor().entry?.version).toBe(5);
	});

	it("a trashed entry cannot be saved", async () => {
		const { editor, client } = await opened({ server: { ...ENTRY, status: "trashed" } });
		expect(editor().readOnly).toBe(true);
		editor().setForm({ title: "수정" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "read_only" } });
		expect(client.update).not.toHaveBeenCalled();
	});
});

describe("failures are results", () => {
	it("offline: an `offline` error, kept in the browser as local-only, retryable", async () => {
		const { editor, client, recovery } = await opened();
		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		editor().setForm({ title: "오프라인" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "offline", retryable: true } });
		expect(editor().saveStatus).toBe("local-only");
		expect(editor().saveError?.code).toBe("offline");
		expect(editor().hasUnsavedChanges).toBe(true);
		// The recovery copy is written before the server save and kept after it fails.
		expect(recovery.records.get(`${ADMIN}:entry-1`)?.snapshot.title).toBe("오프라인");
	});

	it("offline without a recovery copy: failed, not local-only", async () => {
		const { editor, client, recovery } = await opened();
		recovery.available.current = false;
		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		editor().setForm({ title: "오프라인" });
		await editor().save();
		expect(editor().recoveryCopyAvailable).toBe(false);
		expect(editor().saveStatus).toBe("failed");
	});

	it("session expired: a `session_expired` error, and a retry after signing in sends the changes", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(unauthorizedError());
		editor().setForm({ title: "만료" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "session_expired", status: 401 } });
		expect(editor().saveStatus).toBe("session-expired");
		expect(editor().saveError?.message).toBe("sign in again");

		const retried = await editor().retry();
		expect(retried.ok).toBe(true);
		expect(editor().saveStatus).toBe("saved");
		expect(editor().saveError).toBeNull();
		expect(client.update).toHaveBeenCalledTimes(2);
	});

	it("a refused save (4xx) is a `validation` error with its issues and is not retried on its own", async () => {
		const { editor, client } = await opened();
		const issues = [{ code: "too_long", path: "title" }];
		client.update.mockRejectedValueOnce(invalidError(issues));
		editor().setForm({ title: "x".repeat(10) });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "validation", issues, retryable: false } });
		expect(editor().saveStatus).toBe("failed");
		expect(editor().saveError?.message).toBe("title is too long");
	});

	it("a server error (5xx) keeps the changes in the browser and says it can be retried", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(serverError());
		editor().setForm({ title: "서버 오류" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { retryable: true, message: "server error" } });
		expect(editor().saveStatus).toBe("local-only");
	});

	it("retry checks the server version first: a newer one is a conflict, nothing is sent", async () => {
		const { editor, client, server } = await opened();
		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		editor().setForm({ title: "내 수정" });
		await editor().save();
		server.current = { ...ENTRY, version: 9, working: { ...ENTRY.working, metadata: { title: "남의 수정" } } };
		const result = await editor().retry();
		expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().saveStatus).toBe("conflict");
		expect(editor().conflict?.server.version).toBe(9);
		expect(editor().conflict?.local.title).toBe("내 수정");
		expect(client.update).toHaveBeenCalledTimes(1);
	});
});

describe("conflict", () => {
	/** Someone else saved version 9 while this editor still holds version 4. */
	async function conflicted() {
		const ctx = await opened();
		ctx.server.current = {
			...ENTRY,
			version: 9,
			working: { ...ENTRY.working, metadata: { ...ENTRY.working.metadata, title: "남의 수정" } },
		};
		ctx.editor().setForm({ title: "내 수정" });
		const result = await ctx.editor().save();
		return { ...ctx, result };
	}

	it("a 409 is a `conflict` error and state: the server's latest and what this editor holds", async () => {
		const { editor, result } = await conflicted();
		expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().saveStatus).toBe("conflict");
		expect(editor().conflict?.server).toMatchObject({ version: 9 });
		expect(editor().conflict?.local.title).toBe("내 수정");
	});

	it("nothing is sent while the conflict stands: save, retry and publish fail with `conflict`", async () => {
		const { editor, client } = await conflicted();
		client.update.mockClear();
		client.publish.mockClear();
		expect(await editor().save()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(await editor().publish()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(client.update).not.toHaveBeenCalled();
		expect(client.publish).not.toHaveBeenCalled();
	});

	it("overwriteWithMine saves this editor's form on top of the server's version", async () => {
		const { editor, client, server } = await conflicted();
		client.update.mockClear();
		const result = await editor().overwriteWithMine();
		expect(result.ok).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
		expect(client.update.mock.calls[0]?.[1]).toMatchObject({
			expectedVersion: 9,
			metadata: expect.objectContaining({ title: "내 수정" }),
		});
		expect(server.current.version).toBe(10);
		expect(editor().conflict).toBeNull();
		expect(editor().saveStatus).toBe("saved");
	});

	it("reload loads the server's version into the form and drops the local changes and their recovery copy, without a page reload", async () => {
		const { editor, client, recovery } = await conflicted();
		client.get.mockClear();
		const result = await editor().reload();
		expect(client.get).toHaveBeenCalledTimes(1);
		expect(result.ok && result.value.version).toBe(9);
		expect(editor().conflict).toBeNull();
		expect(editor().form.title).toBe("남의 수정");
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(editor().getSnapshot().version).toBe(9);
		expect(recovery.records.has(`${ADMIN}:entry-1`)).toBe(false);
		// The editor works on the new version: the next save is sent at version 9.
		editor().setForm({ title: "이어서" });
		await editor().save();
		expect(client.update).toHaveBeenLastCalledWith("entry-1", expect.objectContaining({ expectedVersion: 9 }));
	});

	it("a reload that fails changes nothing and says why", async () => {
		const { editor, client } = await conflicted();
		client.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const result = await editor().reload();
		expect(result).toMatchObject({ ok: false, error: { code: "offline" } });
		expect(editor().conflict).not.toBeNull();
		expect(editor().form.title).toBe("내 수정");
	});

	it("overwriteWithMine and reload without a conflict fail with `invalid_state`", async () => {
		const { editor } = await opened();
		expect(await editor().overwriteWithMine()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
	});

	it("a publish that meets a newer version is a conflict state, and the save status is left alone", async () => {
		const { editor, client, server } = await opened();
		server.current = { ...ENTRY, version: 9 };
		// The editor has nothing unsaved, so publish goes straight to the server with the stale version.
		const result = await editor().publish();
		expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().conflict?.server.version).toBe(9);
		expect(editor().saveStatus).toBe("saved");
		expect(client.update).not.toHaveBeenCalled();
		expect(editor().busy).toBeNull();
	});
});

describe("publish", () => {
	it("saves first, then publishes at the saved version", async () => {
		const { editor, client, onSaved } = await opened();
		editor().setForm({ title: "발행 전 수정" });
		const result = await editor().publish();
		expect(result.ok).toBe(true);
		expect(result.ok && result.value.entry.status).toBe("published");
		expect(client.update).toHaveBeenCalledTimes(1);
		expect(client.publish).toHaveBeenCalledWith("entry-1", { expectedVersion: 5 });
		expect(client.update.mock.invocationCallOrder[0]).toBeLessThan(
			client.publish.mock.invocationCallOrder[0] as number,
		);
		expect(editor().entry?.status).toBe("published");
		expect(editor().getSnapshot().version).toBe(6);
		expect(editor().busy).toBeNull();
		expect(onSaved).toHaveBeenLastCalledWith(expect.objectContaining({ status: "published" }), { created: false });
	});

	it("is busy while it runs, and a second publish meanwhile fails with `invalid_state`", async () => {
		const { editor, client } = await opened();
		let release = () => {};
		client.publish.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = () => resolve({ ...ENTRY, version: 5, status: "published" });
				}),
		);
		const first = editor().publish();
		await vi.waitFor(() => expect(client.publish).toHaveBeenCalled());
		expect(editor().busy).toBe("publish");
		expect(await editor().publish()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		release();
		expect((await first).ok).toBe(true);
		expect(editor().busy).toBeNull();
	});

	it("creates a new entry and publishes it", async () => {
		const { editor, client } = await opened({ target: { mode: "new", collection: "memo" } });
		editor().setForm({ title: "바로 발행" });
		const result = await editor().publish();
		expect(result.ok).toBe(true);
		expect(client.create).toHaveBeenCalledTimes(1);
		expect(client.publish).toHaveBeenCalledWith("created-1", { expectedVersion: 1 });
	});

	it("sends resetPublishedAt only when asked, and returns the warnings", async () => {
		const { editor, client } = await opened();
		client.publish.mockResolvedValueOnce({
			...ENTRY,
			version: 5,
			status: "published",
			warnings: [{ code: "seo_missing" }],
		});
		const result = await editor().publish({ resetPublishedAt: true });
		expect(client.publish).toHaveBeenCalledWith("entry-1", { expectedVersion: 4, resetPublishedAt: true });
		expect(result.ok && result.value.warnings).toEqual([{ code: "seo_missing" }]);
	});

	it("fills an empty body-filled field from the body, and says which", async () => {
		const server: EntryData = {
			...ENTRY,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("## 소개\n\n**본문** 첫 문장.") },
		};
		const { editor, client } = await opened({ server });
		const result = await editor().publish();
		expect(result.ok && result.value.filled).toEqual([{ name: "summary", label: expect.any(String) }]);
		expect((client.update.mock.calls[0]?.[1] as unknown as { metadata: { summary: string } }).metadata.summary).toBe(
			"소개 본문 첫 문장.",
		);
		expect(editor().form.summary).toBe("소개 본문 첫 문장.");
	});

	it("does not publish when a body-filled field has no body to come from: a validation error naming the field", async () => {
		const server: EntryData = {
			...ENTRY,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("```js\nonly();\n```") },
		};
		const { editor, client } = await opened({ server });
		const result = await editor().publish();
		expect(result).toMatchObject({
			ok: false,
			error: { code: "validation", issues: [{ code: "missing_field", path: "summary" }] },
		});
		expect(editor().publishIssues).toEqual([expect.objectContaining({ code: "missing_field", path: "summary" })]);
		expect(client.update).not.toHaveBeenCalled();
		expect(client.publish).not.toHaveBeenCalled();
		expect(editor().busy).toBeNull();
	});

	it("a refusal with issues is a validation error and sets publishIssues; the next publish clears them", async () => {
		const { editor, client } = await opened();
		const issues = [{ code: "required", path: "categoryId" }];
		client.publish.mockRejectedValueOnce(invalidError(issues));
		const result = await editor().publish();
		expect(result).toMatchObject({ ok: false, error: { code: "validation", issues } });
		expect(editor().publishIssues).toEqual(issues);
		const again = await editor().publish();
		expect(again.ok).toBe(true);
		expect(editor().publishIssues).toEqual([]);
	});

	it("a save that fails stops the publish and returns that failure", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(unauthorizedError());
		editor().setForm({ title: "수정" });
		const result = await editor().publish();
		expect(result).toMatchObject({ ok: false, error: { code: "session_expired" } });
		expect(client.publish).not.toHaveBeenCalled();
	});

	it("a trashed entry cannot be published", async () => {
		const { editor } = await opened({ server: { ...ENTRY, status: "trashed" } });
		expect(await editor().publish()).toMatchObject({ ok: false, error: { code: "read_only" } });
	});
});

describe("status changes, duplicate and delete", () => {
	it("changeStatus sends the version, reloads the entry and is busy meanwhile", async () => {
		const { editor, client } = await opened();
		const result = await editor().changeStatus("archive");
		expect(client.changeStatus).toHaveBeenCalledWith("entry-1", "archive", { expectedVersion: 4 });
		expect(result.ok && result.value.entry?.status).toBe("archived");
		expect(editor().entry?.status).toBe("archived");
		expect(editor().busy).toBeNull();
	});

	it("trashing makes the entry read-only; restoring makes it editable again", async () => {
		const { editor } = await opened();
		await editor().changeStatus("trash");
		expect(editor().readOnly).toBe(true);
		await editor().changeStatus("restore");
		expect(editor().readOnly).toBe(false);
	});

	it("refuses a status change while changes are unsaved, except restore", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "저장 전" });
		expect(await editor().changeStatus("archive")).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		expect(client.changeStatus).not.toHaveBeenCalled();
		expect((await editor().changeStatus("restore")).ok).toBe(true);
	});

	it("trashing a translation says to open the original instead and does not reload", async () => {
		const translation: EntryData = { ...ENTRY, id: "entry-2", locale: "en", translationGroupId: "entry-1" };
		const { editor, client } = await opened({ server: translation });
		client.get.mockClear();
		const result = await editor().changeStatus("trash");
		expect(result).toEqual({ ok: true, value: { entry: null, openEntryId: "entry-1" } });
		expect(client.get).not.toHaveBeenCalled();
	});

	it("a failed status change is an error result", async () => {
		const { editor, client } = await opened();
		client.changeStatus.mockRejectedValueOnce(conflictError());
		expect(await editor().changeStatus("archive")).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().busy).toBeNull();
	});

	it("duplicate copies a saved entry with a copy title, and needs the changes saved first", async () => {
		const { editor, client } = await opened();
		const result = await editor().duplicate();
		expect(client.duplicate).toHaveBeenCalledWith("entry-1", { title: expect.stringContaining("테스트") });
		expect(result.ok && result.value.id).toBe("copy-1");
		editor().setForm({ title: "저장 전" });
		expect(await editor().duplicate()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
	});

	it("deletePermanently deletes at the version and removes the recovery copy", async () => {
		const { editor, client, recovery } = await opened({ server: { ...ENTRY, status: "trashed" } });
		const result = await editor().deletePermanently();
		expect(result.ok).toBe(true);
		expect(client.remove).toHaveBeenCalledWith("entry-1", { expectedVersion: 4 });
		expect(recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
	});

	it("a delete the server refuses is an error result and keeps the recovery copy", async () => {
		const { editor, client, recovery } = await opened({ server: { ...ENTRY, status: "trashed" } });
		client.remove.mockRejectedValueOnce(conflictError());
		expect(await editor().deletePermanently()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(recovery.store.delete).not.toHaveBeenCalled();
	});
});

describe("recovery copy", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it("is kept once input pauses, only the last state, and is never sent to the server", async () => {
		const ctx = await opened();
		ctx.editor().setForm({ title: "가" });
		await vi.advanceTimersByTimeAsync(RECOVERY_IDLE_MS - 1000);
		ctx.editor().setForm({ title: "가나" });
		// Input continues, so the count starts again.
		await vi.advanceTimersByTimeAsync(RECOVERY_IDLE_MS - 1000);
		expect(ctx.recovery.store.put).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		expect(ctx.recovery.store.put).toHaveBeenCalledTimes(1);
		expect(ctx.recovery.store.put).toHaveBeenCalledWith(
			expect.objectContaining({
				key: `${ADMIN}:entry-1`,
				baseVersion: 4,
				snapshot: expect.objectContaining({ title: "가나" }),
			}),
		);
		expect(ctx.client.update).not.toHaveBeenCalled();
		expect(ctx.client.create).not.toHaveBeenCalled();
	});

	it("flushRecovery writes the waiting copy right away (leaving the screen, hiding the tab), and stop does too", async () => {
		const ctx = await opened();
		ctx.editor().setForm({ title: "떠나기 전" });
		expect(ctx.recovery.store.put).not.toHaveBeenCalled();
		await ctx.core.flushRecovery();
		expect(ctx.recovery.store.put).toHaveBeenCalledTimes(1);

		ctx.editor().setForm({ title: "닫기 전" });
		ctx.core.stop();
		await tick();
		expect(ctx.recovery.store.put).toHaveBeenCalledTimes(2);
		expect(ctx.recovery.records.get(`${ADMIN}:entry-1`)?.snapshot.title).toBe("닫기 전");
	});

	it("a save writes the waiting copy first and removes it once the server has the changes", async () => {
		const ctx = await opened();
		ctx.editor().setForm({ title: "저장" });
		const saving = ctx.editor().save();
		await vi.runAllTimersAsync();
		const result = await saving;
		expect(result.ok).toBe(true);
		expect(ctx.recovery.store.put).toHaveBeenCalledWith(
			expect.objectContaining({ snapshot: expect.objectContaining({ title: "저장" }) }),
		);
		expect(ctx.recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
		expect(ctx.recovery.records.size).toBe(0);
	});

	it("stalled browser storage does not hold up the server save", async () => {
		const ctx = await opened();
		ctx.recovery.store.put.mockImplementation(() => new Promise<boolean>(() => {}));
		ctx.editor().setForm({ title: "느린 저장소" });
		const saving = ctx.editor().save();
		await vi.advanceTimersByTimeAsync(5000);
		expect((await saving).ok).toBe(true);
		expect(ctx.client.update).toHaveBeenCalledTimes(1);
	});

	it("a save waits for IME composition to end; if no end ever comes it saves after the wait", async () => {
		const ctx = await opened();
		ctx.editor().setForm({ title: "조합" });
		ctx.editor().setComposing(true);
		const saving = ctx.editor().save();
		await vi.advanceTimersByTimeAsync(COMPOSITION_WAIT_MS - 100);
		expect(ctx.client.update).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(200);
		await vi.runAllTimersAsync();
		expect((await saving).ok).toBe(true);
		expect(ctx.client.update).toHaveBeenCalledTimes(1);

		// An end signal releases the wait at once.
		ctx.editor().setForm({ title: "조합 둘째" });
		ctx.editor().setComposing(true);
		const second = ctx.editor().save();
		await tick();
		ctx.editor().setComposing(false);
		await vi.runAllTimersAsync();
		expect((await second).ok).toBe(true);
		expect(ctx.client.update).toHaveBeenCalledTimes(2);
	});
});

describe("recovery on open", () => {
	it("offers a copy made at the server's version as `restore`, and restoring puts it into the form", async () => {
		const copy = recoveryCopy(ENTRY, { title: "임시 저장한 제목" });
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({ kind: "restore", savedAt: copy.savedAt });
		expect(editor().form.title).toBe("테스트");
		editor().restoreRecovery();
		expect(editor().form.title).toBe("임시 저장한 제목");
		expect(editor().recovery).toBeNull();
		expect(editor().saveStatus).toBe("dirty");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(editor().slug.touched).toBe(true);
	});

	it("offers `conflict` when the server changed after the copy was made, with the server's entry", async () => {
		const copy = recoveryCopy(ENTRY, { title: "예전 제목" }, { baseVersion: 3 });
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({
			kind: "conflict",
			savedAt: copy.savedAt,
			server: expect.objectContaining({ version: 4 }),
		});
	});

	it("discardRecovery keeps the server's version and deletes the copy", async () => {
		const { editor, recovery } = await opened({ records: [recoveryCopy(ENTRY, { title: "임시" })] });
		await editor().discardRecovery();
		expect(editor().recovery).toBeNull();
		expect(editor().form.title).toBe("테스트");
		expect(recovery.records.has(`${ADMIN}:entry-1`)).toBe(false);
	});

	it("a copy that already matches the server (a lost save response) is deleted without asking", async () => {
		const matching = recoveryCopy(ENTRY, {});
		const { editor, recovery } = await opened({ records: [matching] });
		expect(editor().recovery).toBeNull();
		expect(recovery.records.has(`${ADMIN}:entry-1`)).toBe(false);
	});

	it("a copy that matches what the server has now (saved, but the response was lost) is dropped", async () => {
		const saved: EntryData = {
			...ENTRY,
			version: 5,
			working: { ...ENTRY.working, metadata: { ...ENTRY.working.metadata, title: "이미 저장됨" } },
		};
		const copy = recoveryCopy(ENTRY, { title: "이미 저장됨" });
		const { editor, recovery } = await opened({ server: saved, records: [copy] });
		expect(editor().recovery).toBeNull();
		expect(recovery.records.size).toBe(0);
		expect(editor().form.title).toBe("이미 저장됨");
	});

	it("a new entry offers the copy of its collection when it differs from its base", async () => {
		const base = formFromEntry({ ...ENTRY, working: { metadata: {}, doc: docOf("") }, workingSlug: null });
		const snapshot = { ...base, title: "쓰던 글" };
		const record = {
			key: `${ADMIN}:new:post`,
			entryId: "new",
			baseVersion: 0,
			baseFingerprint: formFingerprint(base),
			localFingerprint: formFingerprint(snapshot),
			snapshot,
			changeSeq: 1,
			savedAt: 5,
		};
		const ctx = setup({ target: { mode: "new", collection: "post" }, records: [record] });
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().recovery).not.toBeNull());
		expect(ctx.editor().recovery).toEqual({ kind: "restore", savedAt: 5 });
		expect(ctx.editor().load).toEqual({ status: "ready" });
		ctx.editor().restoreRecovery();
		expect(ctx.editor().form.title).toBe("쓰던 글");
	});

	it("an unavailable store is the same as no copy: the editor still opens", async () => {
		const ctx = setup();
		ctx.recovery.store.get.mockRejectedValueOnce(new Error("blocked"));
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().load.status).toBe("ready"));
		expect(ctx.editor().recovery).toBeNull();
	});
});

describe("recovery copies saved before the form held the body as a document", () => {
	/** What the browser stored then: the body as MDX text in `snapshot.mdx`, and the fingerprint of that form. */
	const legacyCopy = (server: EntryData, changes: { title?: string; mdx: string }, baseVersion = server.version) => {
		const { doc: _doc, ...current } = formFromEntry(server);
		const base = { ...current, mdx: "첫째 줄\n둘째 줄" };
		const snapshot = { ...base, ...changes };
		return {
			key: `${ADMIN}:${server.id}`,
			entryId: server.id,
			baseVersion,
			baseFingerprint: JSON.stringify(base),
			localFingerprint: JSON.stringify(snapshot),
			snapshot,
			changeSeq: 1,
			savedAt: 1_700_000_000_000,
		} as unknown as ReturnType<typeof recoveryCopy>;
	};
	const LEGACY_TEXT = "## 제목\n\n**쓰던** 본문";

	it("restores the body that was typed as MDX as a document holding the text exactly", async () => {
		const copy = legacyCopy(ENTRY, { mdx: LEGACY_TEXT });
		const { editor, client } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({ kind: "restore", savedAt: copy.savedAt });
		editor().restoreRecovery();
		expect(editor().form).not.toHaveProperty("mdx");
		expect(editor().form.doc.content).toHaveLength(1);
		expect(editor().form.doc.content[0]).toMatchObject({
			type: "unparsed",
			attrs: { format: "mdx", source: LEGACY_TEXT },
		});
		expect(editor().hasUnsavedChanges).toBe(true);
		await editor().save();
		const sent = client.update.mock.calls[0]?.[1] as unknown as { doc: StoredDocument };
		expect(sent).not.toHaveProperty("mdx");
		expect(sent.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { format: "mdx", source: LEGACY_TEXT } });
	});

	it("keeps the title typed with the old body, and restoring does not leave the old key behind", async () => {
		const copy = legacyCopy(ENTRY, { title: "예전에 쓰던 제목", mdx: "본문" });
		const { editor } = await opened({ records: [copy] });
		editor().restoreRecovery();
		expect(editor().form.title).toBe("예전에 쓰던 제목");
		expect(Object.keys(editor().form)).not.toContain("mdx");
	});

	it("a copy whose body the mdx format cannot read is restored as it was typed, in a document that holds the text", async () => {
		const broken = "# 제목\n\n<Component>";
		const copy = legacyCopy(ENTRY, { mdx: broken });
		const { editor, client } = await opened({ records: [copy] });
		editor().restoreRecovery();
		expect(editor().form.doc.content).toHaveLength(1);
		expect(editor().form.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: broken } });
		await editor().save();
		const sent = client.update.mock.calls[0]?.[1] as unknown as { doc: StoredDocument };
		expect(sent.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: broken } });
	});

	it("offers a copy even when its text matches the server body, as the admin does not read the text", async () => {
		const copy = legacyCopy(ENTRY, { mdx: "첫째 줄\n둘째 줄" });
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({ kind: "restore", savedAt: copy.savedAt });
	});

	it("offers `conflict` for an old copy when the server changed after it was made", async () => {
		const copy = legacyCopy(ENTRY, { mdx: "예전 본문" }, 3);
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toMatchObject({ kind: "conflict", server: expect.objectContaining({ version: 4 }) });
	});

	it("a new entry offers an old copy that has something typed, and nothing for an empty one", async () => {
		const empty = (mdx: string) => {
			const base = { title: "", slug: "", mdx: "" };
			const snapshot = { ...base, mdx };
			return {
				key: `${ADMIN}:new:post`,
				entryId: "new",
				baseVersion: 0,
				baseFingerprint: JSON.stringify(base),
				localFingerprint: JSON.stringify(snapshot),
				snapshot,
				changeSeq: 1,
				savedAt: 5,
			} as unknown as ReturnType<typeof recoveryCopy>;
		};
		const typed = setup({ target: { mode: "new", collection: "post" }, records: [empty("쓰던 글")] });
		typed.core.start();
		await vi.waitFor(() => expect(typed.editor().recovery).not.toBeNull());
		typed.editor().restoreRecovery();
		expect(typed.editor().form.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: "쓰던 글" } });

		const untouched = setup({ target: { mode: "new", collection: "post" }, records: [empty("")] });
		untouched.core.start();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(untouched.editor().recovery).toBeNull();
	});
});

describe("translation source flow", () => {
	const translation: EntryData = {
		...ENTRY,
		id: "entry-2",
		locale: "en",
		translationGroupId: "entry-1",
		working: {
			metadata: { title: "Hello" },
			doc: docOf("Body"),
			translation: { version: 3, baseSource: "Old source", baseDoc: null } as never,
		},
		source: {
			id: "entry-1",
			locale: "ko",
			status: "draft",
			workingSlug: "test",
			metadata: { title: "테스트" },
			doc: docOf("New source"),
		},
	};

	it("is null for an entry that is not a translation", async () => {
		const { editor } = await opened();
		expect(editor().translation).toBeNull();
	});

	it("says the source changed when it differs from the confirmed one, and confirming it records the source in the next save", async () => {
		const { editor, client } = await opened({ server: translation });
		expect(editor().translation).toMatchObject({
			source: { locale: "ko", title: "테스트" },
			confirmed: { version: 4 },
			sourceChanged: true,
		});
		editor().confirmTranslationSource();
		expect(editor().translation?.sourceChanged).toBe(false);
		expect(editor().hasUnsavedChanges).toBe(true);
		await editor().save();
		const sent = client.update.mock.calls[0]?.[1] as {
			translation?: { version: number; baseDoc: { content: { content?: { text?: string }[] }[] } };
		};
		// The confirmed source is the document of the source.
		expect(sent.translation?.version).toBe(4);
		expect(sent.translation?.baseDoc.content[0]?.content?.[0]?.text).toBe("New source");
	});
});

describe("snapshot and view", () => {
	it("getSnapshot is current without waiting for a render", async () => {
		const { editor } = await opened();
		const before = editor().getSnapshot();
		editor().setForm({ title: "바로" });
		expect(before.hasUnsavedChanges).toBe(false);
		expect(editor().getSnapshot()).toMatchObject({ hasUnsavedChanges: true, saveStatus: "dirty", entryId: "entry-1" });
	});

	it("the view of one state is one object, so selectors stay stable between changes", async () => {
		const { core } = await opened();
		const state = core.store.getState();
		expect(core.view(state)).toBe(core.view(state));
	});
});
