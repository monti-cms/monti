import { STORED_DOCUMENT_VERSION, type StoredDocument } from "@monti-cms/core/document";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { docOf } from "../../../test/mdx";
import { RECOVERY_IDLE_MS } from "../entry-editor-recovery-state";
import { COMPOSITION_WAIT_MS, createEntryEditor } from "../entry-editor-store";
import type { EntryEditorCallbacks, EntryEditorTarget } from "../entry-editor-types";
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
	others = {},
}: {
	server?: EntryData;
	records?: ReturnType<typeof recoveryCopy>[];
	target?: EntryEditorTarget;
	callbacks?: EntryEditorCallbacks;
	/** Other records on the server, by id: the series a backlink pick writes to. */
	others?: Record<string, EntryData>;
} = {}) {
	const fake = fakeClient(server, others);
	const recovery = fakeRecoveryStore(records);
	const onSaved = vi.fn();
	const core = createEntryEditor({
		site: testSite,
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
	it("WRITE-W11 reports a failed load as an error state with the server's message, and a network error as the offline text", async () => {
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

	it("WRITE-W6 says redirect instead of navigating when the entry belongs to an item collection", async () => {
		const ctx = await opened({ server: { ...ENTRY, collection: "tag" } });
		expect(ctx.editor().load).toEqual({
			status: "redirect",
			reason: "item-collection",
			collection: "tag",
			entryId: "entry-1",
		});
		expect(ctx.editor().entry).toBeNull();
	});

	it("WRITE-W6 starts a new entry of an item collection as a redirect without any request", () => {
		const ctx = setup({ target: { mode: "new", collection: "tag" } });
		expect(ctx.editor().load).toEqual({ status: "redirect", reason: "item-collection", collection: "tag" });
		ctx.core.start();
		expect(ctx.client.get).not.toHaveBeenCalled();
	});
});

describe("the form", () => {
	it("WRITE-S1 a change is local: unsaved, dirty, and nothing is sent to the server", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "가" });
		expect(editor().form.title).toBe("가");
		expect(editor().saveStatus).toBe("dirty");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(client.update).not.toHaveBeenCalled();
	});

	it("WRITE-R3 going back to what the server has is saved again, and drops the recovery copy", async () => {
		const { editor, recovery } = await opened();
		editor().setForm({ title: "가" });
		editor().setForm({ title: "테스트" });
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		await vi.waitFor(() => expect(recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
	});

	it("WRITE-P4 regenerates the slug from the title until it is touched by hand, and regenerateSlug starts it again", async () => {
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

	it("WRITE-P4 an opened entry has a touched slug, so editing the title leaves it alone", async () => {
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
	it("WRITE-S1 sends a PATCH with the expected version and the form's metadata, and the entry is saved", async () => {
		const { editor, client, onSaved } = await opened();
		editor().setForm({ title: "수정" });
		const result = await editor().save();
		expect(result.ok).toBe(true);
		expect(result.ok && result.value.changed).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
		// The body is always sent as a document, never as text: the one the entry was opened with.
		expect(client.update).toHaveBeenCalledWith(
			"entry-1",
			expect.objectContaining({
				expectedVersion: 4,
				slug: "test",
				metadata: expect.objectContaining({ title: "수정", categoryId: "cat-1", summary: "요약" }),
				doc: ENTRY.working.doc,
			}),
		);
		expect(client.update).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ mdx: expect.anything() }),
		);
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(editor().saveError).toBeNull();
		expect(editor().getSnapshot().version).toBe(5);
		expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "entry-1", version: 5 }), { created: false });
	});

	it("WRITE-P1 keeps the warnings of the latest save and publish as state, replaced by the next one", async () => {
		const { editor, client } = await opened();
		expect(editor().bodyWarnings).toEqual([]);
		const warning = {
			code: "chart_syntax",
			message: "1줄: 문법 오류",
			position: { blockId: "chart001" },
			text: "1줄: 문법 오류",
		};
		// The fake server saves as usual; this one answer also carries a warning.
		const save = client.update.getMockImplementation() as typeof client.update;
		client.update.mockImplementationOnce(async (id, input) => ({ ...(await save(id, input)), warnings: [warning] }));
		editor().setForm({ title: "수정" });
		expect((await editor().save()).ok).toBe(true);
		expect(editor().bodyWarnings).toEqual([warning]);

		// A save that finds none clears them.
		editor().setForm({ title: "다시 수정" });
		expect((await editor().save()).ok).toBe(true);
		expect(editor().bodyWarnings).toEqual([]);

		const publish = client.publish.getMockImplementation() as typeof client.publish;
		client.publish.mockImplementationOnce(async (id, input) => ({
			...(await publish(id, input)),
			warnings: [warning],
		}));
		const published = await editor().publish();
		expect(published.ok && published.value.warnings).toEqual([warning]);
		expect(editor().bodyWarnings).toEqual([warning]);
	});

	it("WRITE-S3 a save with nothing to save sends nothing", async () => {
		const { editor, client } = await opened();
		const result = await editor().save();
		expect(result).toMatchObject({ ok: true, value: { changed: false } });
		expect(client.update).not.toHaveBeenCalled();
	});

	it("WRITE-S4 sends one request at a time: a second save while one is running shares it", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "수정" });
		const [first, second] = await Promise.all([editor().save(), editor().save()]);
		expect(first.ok && second.ok).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
	});

	it("WRITE-S4 input during a send is unsaved meanwhile, and goes out in the same save once that request ends", async () => {
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
		expect(client.update).toHaveBeenCalledTimes(2);
		for (const [nth, title] of [
			[1, "첫째"],
			[2, "둘째"],
		] as const)
			expect(client.update).toHaveBeenNthCalledWith(
				nth,
				"entry-1",
				expect.objectContaining({ metadata: expect.objectContaining({ title }) }),
			);
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
	});

	it("WRITE-S1 shows the language a new entry was saved in as existing right after the first save", async () => {
		const { editor } = await opened({ target: { mode: "new", collection: "post" } });
		expect(editor().entry?.translations ?? []).toEqual([]);
		editor().setForm({ title: "새 글" });
		const result = await editor().save();
		expect(result.ok).toBe(true);
		const members = editor().entry?.translations ?? [];
		expect(members.map((member) => member.id)).toContain("created-1");
		expect(members.find((member) => member.id === "created-1")?.locale).toBe("ko");
	});

	it("WRITE-S1 creates a new entry with POST (with its folder), asks the UI to move to the edit URL, and drops the new-entry copy", async () => {
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

	it("WRITE-S1 sends the document the body editor made, with its block ids", async () => {
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
		expect(client.update).toHaveBeenCalledWith("entry-1", expect.objectContaining({ doc }));
		expect(client.update).not.toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ mdx: expect.anything() }),
		);
	});

	it("WRITE-S3 a body that reads the same as the server's is not a change, whatever its block ids and the order of its keys", async () => {
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

	it("WRITE-S8 sends a removed field's value back as stored (orphaned metadata round trip)", async () => {
		const stored = { title: "테스트", removedField: "left behind", removedList: ["a", "b"] };
		const { editor, client } = await opened({ server: { ...ENTRY, working: { metadata: stored, doc: docOf("") } } });
		editor().setForm({ title: "Renamed" });
		await editor().save();
		expect(client.update).toHaveBeenCalledWith(
			"entry-1",
			expect.objectContaining({ metadata: { ...stored, title: "Renamed" } }),
		);
	});

	it("TRANS-L2 keeps the translation group info the save response does not carry", async () => {
		const group: EntryData = {
			...ENTRY,
			locale: "ko",
			translationGroupId: "entry-1",
			translations: [{ id: "entry-1", locale: "ko", status: "draft", isSource: true, title: "t", workingSlug: "test" }],
		};
		const { editor, client } = await opened({ server: group });
		client.update.mockResolvedValueOnce({ entry: { ...ENTRY, version: 5 }, warnings: [] });
		editor().setForm({ title: "수정" });
		await editor().save();
		expect(editor().entry?.translations).toHaveLength(1);
		expect(editor().entry?.version).toBe(5);
	});

	it("TRASH-T7 a trashed entry cannot be saved", async () => {
		const { editor, client } = await opened({ server: { ...ENTRY, status: "trashed" } });
		expect(editor().readOnly).toBe(true);
		editor().setForm({ title: "수정" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "read_only" } });
		expect(client.update).not.toHaveBeenCalled();
	});
});

describe("failures are results", () => {
	it("WRITE-S5 offline: an `offline` error, kept in the browser as local-only, retryable", async () => {
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

	it("WRITE-S5 a retry that cannot reach the server keeps the changes in the browser and sends nothing", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		editor().setForm({ title: "오프라인" });
		await editor().save();
		client.update.mockClear();
		client.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		expect(await editor().retry()).toMatchObject({ ok: false, error: { code: "offline" } });
		expect(editor().saveStatus).toBe("local-only");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(client.update).not.toHaveBeenCalled();
	});

	it("WRITE-S5 offline without a recovery copy: failed, not local-only", async () => {
		const { editor, client, recovery } = await opened();
		recovery.available.current = false;
		client.update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		editor().setForm({ title: "오프라인" });
		await editor().save();
		expect(editor().recoveryCopyAvailable).toBe(false);
		expect(editor().saveStatus).toBe("failed");
	});

	it("WRITE-S5 session expired: a `session_expired` error, and a retry after signing in sends the changes", async () => {
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

	it("WRITE-S5 a refused save (4xx) is a `validation` error with its issues and is not retried on its own", async () => {
		const { editor, client } = await opened();
		const issues = [{ code: "too_long", path: "title", text: "제목이 너무 깁니다." }];
		client.update.mockRejectedValueOnce(invalidError(issues));
		editor().setForm({ title: "x".repeat(10) });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { code: "validation", issues, retryable: false } });
		expect(editor().saveStatus).toBe("failed");
		expect(editor().saveError?.message).toBe("title is too long");
	});

	it("WRITE-S5 a server error (5xx) keeps the changes in the browser and says it can be retried", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(serverError());
		editor().setForm({ title: "서버 오류" });
		const result = await editor().save();
		expect(result).toMatchObject({ ok: false, error: { retryable: true, message: "server error" } });
		expect(editor().saveStatus).toBe("local-only");
	});

	it("WRITE-S5 retry checks the server version first: a newer one is a conflict, nothing is sent", async () => {
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

	it("WRITE-C1 a 409 is a `conflict` error and state: the server's latest and what this editor holds", async () => {
		const { editor, result } = await conflicted();
		expect(result).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().saveStatus).toBe("conflict");
		expect(editor().conflict?.server).toMatchObject({ version: 9 });
		expect(editor().conflict?.local.title).toBe("내 수정");
	});

	it("WRITE-C1 nothing is sent while the conflict stands: save, retry and publish fail with `conflict`", async () => {
		const { editor, client } = await conflicted();
		client.update.mockClear();
		client.publish.mockClear();
		expect(await editor().save()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(await editor().publish()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(client.update).not.toHaveBeenCalled();
		expect(client.publish).not.toHaveBeenCalled();
	});

	it("WRITE-C1 typing while the conflict stands keeps the conflict, and still sends nothing", async () => {
		const { editor, client } = await conflicted();
		client.update.mockClear();
		editor().setForm({ title: "더 고침" });
		expect(editor().saveStatus).toBe("conflict");
		expect(await editor().save()).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(client.update).not.toHaveBeenCalled();
	});

	it("WRITE-C3 overwriteWithMine saves this editor's form on top of the server's version", async () => {
		const { editor, client, server } = await conflicted();
		client.update.mockClear();
		const result = await editor().overwriteWithMine();
		expect(result.ok).toBe(true);
		expect(client.update).toHaveBeenCalledTimes(1);
		expect(client.update).toHaveBeenCalledWith(
			"entry-1",
			expect.objectContaining({ expectedVersion: 9, metadata: expect.objectContaining({ title: "내 수정" }) }),
		);
		expect(server.current.version).toBe(10);
		expect(editor().conflict).toBeNull();
		expect(editor().saveStatus).toBe("saved");
	});

	it("WRITE-C2 reload loads the server's version into the form and drops the local changes and their recovery copy, without a page reload", async () => {
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

	it("WRITE-C2 a reload that fails changes nothing and says why", async () => {
		const { editor, client } = await conflicted();
		client.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const result = await editor().reload();
		expect(result).toMatchObject({ ok: false, error: { code: "offline" } });
		expect(editor().conflict).not.toBeNull();
		expect(editor().form.title).toBe("내 수정");
	});

	it("WRITE-C3 overwriteWithMine and reload without a conflict fail with `invalid_state`", async () => {
		const { editor } = await opened();
		expect(await editor().overwriteWithMine()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
	});

	it("WRITE-C1 a publish that meets a newer version is a conflict state, and the save status is left alone", async () => {
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
	it("WRITE-P2 saves first, then publishes at the saved version", async () => {
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

	it("WRITE-P2 is busy while it runs, and a second publish meanwhile fails with `invalid_state`", async () => {
		const { editor, client } = await opened();
		let release = () => {};
		client.publish.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					release = () => resolve({ entry: { ...ENTRY, version: 5, status: "published" }, warnings: [] });
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

	it("WRITE-P2 creates a new entry and publishes it", async () => {
		const { editor, client } = await opened({ target: { mode: "new", collection: "memo" } });
		editor().setForm({ title: "바로 발행" });
		const result = await editor().publish();
		expect(result.ok).toBe(true);
		expect(client.create).toHaveBeenCalledTimes(1);
		expect(client.publish).toHaveBeenCalledWith("created-1", { expectedVersion: 1 });
	});

	it("WRITE-P5 sends resetPublishedAt only when asked, and returns the warnings", async () => {
		const { editor, client } = await opened();
		client.publish.mockResolvedValueOnce({
			entry: { ...ENTRY, version: 5, status: "published" },
			warnings: [{ code: "seo_missing", text: "SEO" }],
		});
		const result = await editor().publish({ resetPublishedAt: true });
		expect(client.publish).toHaveBeenCalledWith("entry-1", { expectedVersion: 4, resetPublishedAt: true });
		expect(result.ok && result.value.warnings).toEqual([{ code: "seo_missing", text: "SEO" }]);
	});

	it("WRITE-P1 fills an empty body-filled field from the body, and says which", async () => {
		const server: EntryData = {
			...ENTRY,
			working: { metadata: { title: "테스트", categoryId: "cat-1" }, doc: docOf("## 소개\n\n**본문** 첫 문장.") },
		};
		const { editor, client } = await opened({ server });
		const result = await editor().publish();
		expect(result.ok && result.value.filled).toEqual([{ name: "summary", label: expect.any(String) }]);
		expect(client.update).toHaveBeenCalledWith(
			"entry-1",
			expect.objectContaining({ metadata: expect.objectContaining({ summary: "소개 본문 첫 문장." }) }),
		);
		expect(editor().form.summary).toBe("소개 본문 첫 문장.");
	});

	it("WRITE-P1 does not publish when a body-filled field has no body to come from: a validation error naming the field", async () => {
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

	it("WRITE-P1 a refusal with issues is a validation error and sets publishIssues; the next publish clears them", async () => {
		const { editor, client } = await opened();
		const issues = [{ code: "required", path: "categoryId", text: "카테고리를 입력하세요." }];
		client.publish.mockRejectedValueOnce(invalidError(issues));
		const result = await editor().publish();
		expect(result).toMatchObject({ ok: false, error: { code: "validation", issues } });
		expect(editor().publishIssues).toEqual(issues);
		const again = await editor().publish();
		expect(again.ok).toBe(true);
		expect(editor().publishIssues).toEqual([]);
	});

	it("WRITE-P2 a save that fails stops the publish and returns that failure", async () => {
		const { editor, client } = await opened();
		client.update.mockRejectedValueOnce(unauthorizedError());
		editor().setForm({ title: "수정" });
		const result = await editor().publish();
		expect(result).toMatchObject({ ok: false, error: { code: "session_expired" } });
		expect(client.publish).not.toHaveBeenCalled();
	});

	it("TRASH-T7 a trashed entry cannot be published", async () => {
		const { editor } = await opened({ server: { ...ENTRY, status: "trashed" } });
		expect(await editor().publish()).toMatchObject({ ok: false, error: { code: "read_only" } });
	});
});

describe("status changes, duplicate and delete", () => {
	it("WRITE-S2 changeStatus sends the version, reloads the entry and is busy meanwhile", async () => {
		const { editor, client } = await opened();
		const result = await editor().changeStatus("archive");
		expect(client.changeStatus).toHaveBeenCalledWith("entry-1", "archive", { expectedVersion: 4 });
		expect(result.ok && result.value.entry?.status).toBe("archived");
		expect(editor().entry?.status).toBe("archived");
		expect(editor().busy).toBeNull();
	});

	it("TRASH-T7 trashing makes the entry read-only; restoring makes it editable again", async () => {
		const { editor } = await opened();
		await editor().changeStatus("trash");
		expect(editor().readOnly).toBe(true);
		await editor().changeStatus("restore");
		expect(editor().readOnly).toBe(false);
	});

	it("WRITE-S6 refuses a status change while changes are unsaved, except restore", async () => {
		const { editor, client } = await opened();
		editor().setForm({ title: "저장 전" });
		expect(await editor().changeStatus("archive")).toMatchObject({ ok: false, error: { code: "invalid_state" } });
		expect(client.changeStatus).not.toHaveBeenCalled();
		expect((await editor().changeStatus("restore")).ok).toBe(true);
	});

	it("TRASH-T6 trashing a translation says to open the original instead and does not reload", async () => {
		const translation: EntryData = { ...ENTRY, id: "entry-2", locale: "en", translationGroupId: "entry-1" };
		const { editor, client } = await opened({ server: translation });
		client.get.mockClear();
		const result = await editor().changeStatus("trash");
		// The version after the trash is told, so the undo can name it.
		expect(result).toEqual({ ok: true, value: { entry: null, openEntryId: "entry-1", version: ENTRY.version + 1 } });
		expect(client.get).not.toHaveBeenCalled();
	});

	it("WRITE-W9 a failed status change is an error result", async () => {
		const { editor, client } = await opened();
		client.changeStatus.mockRejectedValueOnce(conflictError());
		expect(await editor().changeStatus("archive")).toMatchObject({ ok: false, error: { code: "conflict" } });
		expect(editor().busy).toBeNull();
	});

	it("WRITE-W10 duplicate copies a saved entry with a copy title, and needs the changes saved first", async () => {
		const { editor, client } = await opened();
		const result = await editor().duplicate();
		expect(client.duplicate).toHaveBeenCalledWith("entry-1", { title: expect.stringContaining("테스트") });
		expect(result.ok && result.value.id).toBe("copy-1");
		editor().setForm({ title: "저장 전" });
		expect(await editor().duplicate()).toMatchObject({ ok: false, error: { code: "invalid_state" } });
	});

	it("WRITE-R3 deletePermanently deletes at the version and removes the recovery copy", async () => {
		const { editor, client, recovery } = await opened({ server: { ...ENTRY, status: "trashed" } });
		const result = await editor().deletePermanently();
		expect(result.ok).toBe(true);
		expect(client.remove).toHaveBeenCalledWith("entry-1", { expectedVersion: 4 });
		expect(recovery.store.delete).toHaveBeenCalledWith(`${ADMIN}:entry-1`);
	});

	it("WRITE-R3 a delete the server refuses is an error result and keeps the recovery copy", async () => {
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

	it("WRITE-R1 is kept once input pauses, only the last state, and is never sent to the server", async () => {
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

	it("WRITE-R1 flushRecovery writes the waiting copy right away (leaving the screen, hiding the tab), and stop does too", async () => {
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

	it("WRITE-R3 a save writes the waiting copy first and removes it once the server has the changes", async () => {
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

	it("WRITE-S4 stalled browser storage does not hold up the server save", async () => {
		const ctx = await opened();
		ctx.recovery.store.put.mockImplementation(() => new Promise<boolean>(() => {}));
		ctx.editor().setForm({ title: "느린 저장소" });
		const saving = ctx.editor().save();
		await vi.advanceTimersByTimeAsync(5000);
		expect((await saving).ok).toBe(true);
		expect(ctx.client.update).toHaveBeenCalledTimes(1);
	});

	it("WRITE-S4 a save waits for IME composition to end; if no end ever comes it saves after the wait", async () => {
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
	it("WRITE-R2 offers a copy made at the server's version as `restore`, and restoring puts it into the form", async () => {
		const copy = recoveryCopy(ENTRY, { title: "임시 저장한 제목" });
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({ kind: "restore", savedAt: copy.savedAt, form: copy.snapshot });
		expect(editor().form.title).toBe("테스트");
		editor().restoreRecovery();
		expect(editor().form.title).toBe("임시 저장한 제목");
		expect(editor().recovery).toBeNull();
		expect(editor().saveStatus).toBe("dirty");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(editor().slug.touched).toBe(true);
	});

	it("WRITE-R2 offers `conflict` when the server changed after the copy was made, with the server's entry", async () => {
		const copy = recoveryCopy(ENTRY, { title: "예전 제목" }, { baseVersion: 3 });
		const { editor } = await opened({ records: [copy] });
		expect(editor().recovery).toEqual({
			kind: "conflict",
			savedAt: copy.savedAt,
			form: copy.snapshot,
			server: expect.objectContaining({ version: 4 }),
		});
	});

	it("WRITE-R2 loading the server's version over a copy made before it takes the copy's notice away", async () => {
		const { editor } = await opened({ records: [recoveryCopy(ENTRY, { title: "예전 제목" }, { baseVersion: 3 })] });
		expect(editor().recovery).toMatchObject({ kind: "conflict" });
		expect((await editor().reload()).ok).toBe(true);
		expect(editor().recovery).toBeNull();
	});

	it("WRITE-R2 discardRecovery keeps the server's version and deletes the copy", async () => {
		const { editor, recovery } = await opened({ records: [recoveryCopy(ENTRY, { title: "임시" })] });
		await editor().discardRecovery();
		expect(editor().recovery).toBeNull();
		expect(editor().form.title).toBe("테스트");
		expect(recovery.records.has(`${ADMIN}:entry-1`)).toBe(false);
	});

	it("WRITE-R2 a copy that already matches the server (a lost save response) is deleted without asking", async () => {
		const matching = recoveryCopy(ENTRY, {});
		const { editor, recovery } = await opened({ records: [matching] });
		expect(editor().recovery).toBeNull();
		expect(recovery.records.has(`${ADMIN}:entry-1`)).toBe(false);
	});

	it("WRITE-R2 a copy that matches what the server has now (saved, but the response was lost) is dropped", async () => {
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

	it("WRITE-R2 a new entry offers the copy of its collection when it differs from its base", async () => {
		const base = formFromEntry(testSite, { ...ENTRY, working: { metadata: {}, doc: docOf("") }, workingSlug: null });
		const snapshot = { ...base, title: "쓰던 글" };
		const record = {
			key: `${ADMIN}:new:post`,
			entryId: "new",
			baseVersion: 0,
			baseFingerprint: formFingerprint(testSite, base),
			localFingerprint: formFingerprint(testSite, snapshot),
			snapshot,
			changeSeq: 1,
			savedAt: 5,
		};
		const ctx = setup({ target: { mode: "new", collection: "post" }, records: [record] });
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().recovery).not.toBeNull());
		expect(ctx.editor().recovery).toEqual({ kind: "restore", savedAt: 5, form: snapshot });
		expect(ctx.editor().load).toEqual({ status: "ready" });
		ctx.editor().restoreRecovery();
		expect(ctx.editor().form.title).toBe("쓰던 글");
	});

	it("WRITE-R2 an unavailable store is the same as no copy: the editor still opens", async () => {
		const ctx = setup();
		ctx.recovery.store.get.mockRejectedValueOnce(new Error("blocked"));
		ctx.core.start();
		await vi.waitFor(() => expect(ctx.editor().load.status).toBe("ready"));
		expect(ctx.editor().recovery).toBeNull();
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

	it("TRANS-S1 says the source changed when it differs from the confirmed one, and confirming it records the source in the next save", async () => {
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
		// The confirmed source is the document of the source.
		expect(client.update).toHaveBeenCalledWith(
			"entry-2",
			expect.objectContaining({
				translation: expect.objectContaining({ version: 4, baseDoc: translation.source?.doc }),
			}),
		);
	});
});

describe("backlink picks", () => {
	// The reference blog's post has a `series` backlink: a series (`collection`) lists its posts in `itemIds`.
	const series = (id: string, itemIds: string[]): EntryData => ({
		...ENTRY,
		id,
		collection: "collection",
		version: 1,
		workingSlug: id,
		working: { metadata: { title: id, itemIds }, doc: ENTRY.working.doc },
	});
	const pick = { add: [{ id: "s2", title: "s2" }], remove: ["s1"] };
	const withSeries = () => opened({ others: { s1: series("s1", ["other", "entry-1"]), s2: series("s2", ["other"]) } });

	it("WRITE-W7 a pick is an unsaved change: dirty, and nothing is sent until the save", async () => {
		const { editor, client } = await withSeries();
		editor().setBacklink("series", pick);
		expect(editor().saveStatus).toBe("dirty");
		expect(editor().hasUnsavedChanges).toBe(true);
		expect(editor().getSnapshot().hasUnsavedChanges).toBe(true);
		expect(client.update).not.toHaveBeenCalled();
		// Taking the pick back leaves nothing to save.
		editor().setBacklink("series", null);
		expect(editor().saveStatus).toBe("saved");
		expect(editor().hasUnsavedChanges).toBe(false);
	});

	it("WRITE-W7 the save writes the picks to the series after the entry, and a save with only picks does not send the entry", async () => {
		const { editor, client, records } = await withSeries();
		editor().setForm({ title: "가" });
		editor().setBacklink("series", pick);
		expect((await editor().save()).ok).toBe(true);
		expect(client.update.mock.calls.map(([id]) => id)).toEqual(["entry-1", "s2", "s1"]);
		// Added to the end of one series; taken out of the other.
		expect(records.s2?.working.metadata.itemIds).toEqual(["other", "entry-1"]);
		expect(records.s1?.working.metadata.itemIds).toEqual(["other"]);
		expect(editor().backlinks).toEqual({});
		expect(editor().saveStatus).toBe("saved");

		client.update.mockClear();
		editor().setBacklink("series", { add: [], remove: ["s2"] });
		const result = await editor().save();
		expect(result.ok && result.value.changed).toBe(true);
		expect(client.update.mock.calls.map(([id]) => id)).toEqual(["s2"]);
		expect(editor().hasUnsavedChanges).toBe(false);
	});

	it("WRITE-W7 a pick the save could not write is dropped with its reason, and the entry stays saved", async () => {
		const { editor, client } = await withSeries();
		editor().setForm({ title: "가" });
		editor().setBacklink("series", { add: [{ id: "s2", title: "s2" }], remove: [] });
		const write = client.update.getMockImplementation();
		client.update.mockImplementation(async (id, input) => {
			if (id === "s2" || !write) throw serverError();
			return write(id, input);
		});
		expect((await editor().save()).ok).toBe(true);
		expect(editor().backlinks).toEqual({});
		expect(editor().backlinkErrors.series).toBe("server error");
		expect(editor().saveStatus).toBe("saved");
		// A new pick clears the reason.
		editor().setBacklink("series", { add: [{ id: "s2", title: "s2" }], remove: [] });
		expect(editor().backlinkErrors).toEqual({});
	});

	it("WRITE-W7 a retry after a failed save writes the picks with the entry", async () => {
		const { editor, client, records } = await withSeries();
		editor().setForm({ title: "가" });
		editor().setBacklink("series", { add: [{ id: "s2", title: "s2" }], remove: [] });
		client.update.mockRejectedValueOnce(serverError());
		expect((await editor().save()).ok).toBe(false);
		expect(editor().backlinks.series).toBeDefined();
		expect((await editor().retry()).ok).toBe(true);
		expect(records.s2?.working.metadata.itemIds).toEqual(["other", "entry-1"]);
		expect(editor().hasUnsavedChanges).toBe(false);
	});

	it("WRITE-W7 a translation's pick puts the original into the series", async () => {
		const translation = { ...ENTRY, id: "entry-en", translationGroupId: "entry-1" };
		const { editor, records } = await opened({ server: translation, others: { s2: series("s2", []) } });
		editor().setBacklink("series", { add: [{ id: "s2", title: "s2" }], remove: [] });
		await editor().save();
		expect(records.s2?.working.metadata.itemIds).toEqual(["entry-1"]);
	});

	it("WRITE-W7 a status change waits for unsaved picks, and reload drops them", async () => {
		const { editor, client } = await withSeries();
		editor().setBacklink("series", pick);
		const archived = await editor().changeStatus("archive");
		expect(!archived.ok && archived.error.code).toBe("invalid_state");
		await editor().reload();
		expect(editor().backlinks).toEqual({});
		expect(editor().hasUnsavedChanges).toBe(false);
		expect(client.update).not.toHaveBeenCalled();
	});
});
