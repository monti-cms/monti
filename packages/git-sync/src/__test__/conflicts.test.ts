import { parseFile } from "@monti-cms/core/front-matter";
import { exportBodyText } from "@monti-cms/core/plugin/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { listConflicts, resolveConflict } from "../conflicts";
import { pullTarget } from "../inbound";
import { pushAll } from "../outbound";
import { closeGlobalPool, createHarness, type Harness } from "./harness";

let h: Harness;

// Each test has its own site and repo: an open conflict is found again by every pull, so tests must not share them.
beforeEach(async () => {
	h = await createHarness();
});
afterEach(async () => {
	await h.close();
});
afterAll(closeGlobalPool);

const publishMemo = (slug: string, title: string, body = `Body of ${title}`) =>
	h.service
		.createDraft({ collection: "memo", slug, metadata: { title }, body, format: "mdx" }, { publishImmediately: true })
		.then((result) => result.entry);

/** Saves a new title and body of an entry as a draft; `publish` also publishes it. */
const change = async (id: string, values: { title: string; body: string }, publish = true) => {
	const entry = await h.store.getEntry(id);
	const saved = (
		await h.service.saveDraft(
			id,
			{
				collection: "memo",
				slug: entry.workingSlug,
				metadata: { ...entry.working.metadata, title: values.title },
				body: values.body,
				format: "mdx",
				expectedVersion: entry.version,
			},
			{ publishImmediately: false },
		)
	).entry;
	if (publish) (await h.service.publish({ id, expectedVersion: saved.version })).entry;
};

const pathOf = (slug: string) => `content/memo/${slug}.en.mdx`;
const gitText = (slug: string) => h.repo.files("main").get(pathOf(slug)) ?? "";
const editInGit = (slug: string, from: string, to: string) => {
	const text = gitText(slug);
	if (!text.includes(from)) throw new Error(`${from} is not in ${slug}`);
	return h.repo.commit("main", [{ path: pathOf(slug), text: text.replace(from, to) }]);
};
const bodyOf = async (id: string) => {
	const entry = await h.store.getEntry(id);
	return (
		await exportBodyText(h.cms, { format: "mdx", doc: entry.published?.doc ?? entry.working.doc, locale: "en" })
	).text.trim();
};
const conflictOf = async (id: string) => (await listConflicts(h.ctx)).find((item) => item.entryId === id);

/** The entry changed on the server but that change could not be pushed (GitHub failed), then the file changed in git. */
const bothChanged = async (slug: string) => {
	const entry = await publishMemo(slug, "Server v1", "base text");
	h.github.failNext("createCommit");
	await change(entry.id, { title: "Server v2", body: "server text" });
	editInGit(slug, "title: Server v1", "title: Git v2");
	return entry;
};

describe("a hash mismatch on both sides is a conflict, not a merge", () => {
	it("records the conflict and writes nothing when the entry and its file both changed", async () => {
		const entry = await bothChanged("both");
		const head = h.repo.branches.get("main");
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary).toMatchObject({ applied: 0, conflicts: 1, errors: [] });
		// Neither side was touched.
		expect(h.repo.branches.get("main")).toBe(head);
		expect((await h.store.getEntry(entry.id)).published?.metadata).toMatchObject({ title: "Server v2" });

		const found = await conflictOf(entry.id);
		expect(found).toMatchObject({
			kind: "changed",
			reason: "both-changed",
			path: pathOf("both"),
			repo: "acme/site",
			label: "Server v2",
		});
		// Both texts are written by the format: the server's from the entry as it is now, git's as it is in the repo.
		expect(parseFile(found?.serverText ?? "")).toMatchObject({ ok: true, data: { title: "Server v2" } });
		expect(found?.serverText).toContain("server text");
		expect(parseFile(found?.gitText ?? "")).toMatchObject({ ok: true, data: { title: "Git v2" } });
		expect(found?.gitText).toContain("base text");
		expect(found?.gitSha).toBe(h.repo.treeOf("main").get(pathOf("both")));

		// A second pull finds the same conflict and does not pile up another.
		await pullTarget(h.ctx, h.target);
		expect((await h.ctx.state.conflicts.list("site")).filter((item) => item.entryId === entry.id)).toHaveLength(1);
	});

	it('"Use git version" writes the git text to the entry, publishes it and settles the conflict', async () => {
		const entry = await bothChanged("use-git");
		await pullTarget(h.ctx, h.target);
		const found = await conflictOf(entry.id);
		const head = h.repo.branches.get("main");

		const result = await resolveConflict(h.ctx, {
			target: "site",
			entryId: entry.id,
			resolution: "git",
			gitSha: found?.gitSha,
		});
		expect(result.resolution).toBe("git");
		const after = await h.store.getEntry(entry.id);
		expect(after.status).toBe("published");
		expect(after.published?.metadata).toMatchObject({ title: "Git v2" });
		expect(await bodyOf(entry.id)).toBe("base text");
		expect(await conflictOf(entry.id)).toBeUndefined();
		// Nothing was pushed: git already has this version.
		expect(h.repo.branches.get("main")).toBe(head);
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({
			blobSha: found?.gitSha,
			contentHash: after.published?.contentHash,
		});
		expect((await pullTarget(h.ctx, h.target)).conflicts).toBe(0);
	});

	it('"Use server version" pushes the server text over the file and settles the conflict', async () => {
		const entry = await bothChanged("use-server");
		await pullTarget(h.ctx, h.target);
		const found = await conflictOf(entry.id);

		const result = await resolveConflict(h.ctx, {
			target: "site",
			entryId: entry.id,
			resolution: "server",
			gitSha: found?.gitSha,
		});
		expect(result.resolution).toBe("server");
		expect(gitText("use-server")).toBe(found?.serverText);
		expect(gitText("use-server")).not.toContain("Git v2");
		expect((await h.store.getEntry(entry.id)).published?.metadata).toMatchObject({ title: "Server v2" });
		expect(await conflictOf(entry.id)).toBeUndefined();
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({
			blobSha: h.repo.treeOf("main").get(pathOf("use-server")),
		});
		expect((await pullTarget(h.ctx, h.target)).conflicts).toBe(0);
	});

	it("refuses a decision about a file that changed again since the person looked", async () => {
		const entry = await bothChanged("moved-on");
		await pullTarget(h.ctx, h.target);
		const seen = await conflictOf(entry.id);
		// The file changes once more and the next pull refreshes the conflict with the new git text.
		editInGit("moved-on", "title: Git v2", "title: Git v3");
		await pullTarget(h.ctx, h.target);
		const now = await conflictOf(entry.id);
		expect(now?.gitText).toContain("Git v3");
		expect(now?.gitSha).not.toBe(seen?.gitSha);

		// A decision made on what the person saw before is refused, and nothing changes.
		await expect(
			resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "git", gitSha: seen?.gitSha }),
		).rejects.toMatchObject({ code: "conflict" });
		expect((await h.store.getEntry(entry.id)).published?.metadata).toMatchObject({ title: "Server v2" });
		expect(await conflictOf(entry.id)).toBeDefined();

		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "git", gitSha: now?.gitSha });
		expect((await h.store.getEntry(entry.id)).published?.metadata).toMatchObject({ title: "Git v3" });
	});

	it("settles itself when the edit in git is undone: the server's change goes out", async () => {
		const entry = await bothChanged("undone");
		await pullTarget(h.ctx, h.target);
		expect(await conflictOf(entry.id)).toBeDefined();
		// The person reverts the file to what it was when it was last synced.
		editInGit("undone", "title: Git v2", "title: Server v1");
		await pullTarget(h.ctx, h.target);
		expect(await conflictOf(entry.id)).toBeUndefined();
		expect(gitText("undone")).toContain("title: Server v2");
		expect((await h.store.getEntry(entry.id)).published?.metadata).toMatchObject({ title: "Server v2" });
		expect(await h.ctx.state.queue.list("site")).toEqual([]);
	});

	it("is a conflict when the entry has unpublished changes that the import would replace", async () => {
		const entry = await publishMemo("unpublished", "Published title", "published text");
		await change(entry.id, { title: "Draft only", body: "draft text" }, false);
		editInGit("unpublished", "title: Published title", "title: Git title");
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.conflicts).toBe(1);
		const found = await conflictOf(entry.id);
		expect(found).toMatchObject({ reason: "unpublished-changes", kind: "changed" });
		// The server version of the diff is the published one (the file holds the published version).
		expect(found?.serverText).toContain("Published title");
		expect((await h.store.getEntry(entry.id)).working.metadata).toMatchObject({ title: "Draft only" });

		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "git" });
		const after = await h.store.getEntry(entry.id);
		expect(after.working.metadata).toMatchObject({ title: "Git title" });
		expect(after.published?.metadata).toMatchObject({ title: "Git title" });
	});

	it("is a conflict when a file exists in git that was never synced and says something else", async () => {
		const entry = await publishMemo("never-synced", "Never synced");
		// As if the plugin had been added after the entry was published.
		await h.ctx.state.records.remove("site", entry.id);
		editInGit("never-synced", "title: Never synced", "title: Someone else's");
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.conflicts).toBe(1);
		expect(await conflictOf(entry.id)).toMatchObject({ reason: "unsynced" });
	});

	it("adopts a file that already says what the entry says, without a conflict", async () => {
		const entry = await publishMemo("already-same", "Already same");
		const text = gitText("already-same");
		await h.ctx.state.records.remove("site", entry.id);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.conflicts).toBe(0);
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({ path: pathOf("already-same") });
		expect(gitText("already-same")).toBe(text);
	});
});

describe("a change that would overwrite an edit in git is held back", () => {
	it("does not push over a file edited in git: the file stays, the conflict is recorded, later publishes wait", async () => {
		const entry = await publishMemo("push-blocked", "Original", "original text");
		editInGit("push-blocked", "title: Original", "title: Edited in git");
		const edited = gitText("push-blocked");
		const commitsBefore = h.github.calls.length;

		// The server publishes a change before the repo's push reached the CMS.
		await change(entry.id, { title: "Server edit", body: "server text" });
		expect(gitText("push-blocked")).toBe(edited);
		expect(h.github.calls.length).toBeGreaterThan(commitsBefore);
		const found = await conflictOf(entry.id);
		expect(found).toMatchObject({ kind: "changed", reason: "both-changed" });
		expect(found?.serverText).toContain("Server edit");
		expect(found?.gitText).toBe(edited);

		// Another publish of the entry does not push either, and the queue is not left holding it.
		await change(entry.id, { title: "Server edit 2", body: "server text 2" });
		expect(gitText("push-blocked")).toBe(edited);
		expect(await h.ctx.state.queue.list("site")).toEqual([]);
		expect((await conflictOf(entry.id))?.serverText).toContain("Server edit 2");

		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "server" });
		expect(gitText("push-blocked")).toContain("Server edit 2");
		expect(parseFile(gitText("push-blocked"))).toMatchObject({ ok: true, data: { title: "Server edit 2" } });
	});

	it("does not delete a file edited in git when the entry is trashed: the removal is the conflict", async () => {
		const entry = await publishMemo("remove-blocked", "To remove");
		editInGit("remove-blocked", "title: To remove", "title: Edited before removal");
		const trashed = await h.store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		expect(h.repo.files("main").has(pathOf("remove-blocked"))).toBe(true);
		const found = await conflictOf(entry.id);
		expect(found).toMatchObject({ kind: "removed", reason: "git-edit-blocks-removal", serverText: null });
		expect(found?.gitText).toContain("Edited before removal");

		// "Use server version" removes the file.
		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "server" });
		expect(h.repo.files("main").has(pathOf("remove-blocked"))).toBe(false);
		expect(await h.ctx.state.records.get("site", entry.id)).toBeNull();
		expect(await conflictOf(entry.id)).toBeUndefined();
		expect(trashed.status).toBe("trashed");
	});

	it('"Use git version" brings a trashed entry back with the git text', async () => {
		const entry = await publishMemo("restore-from-git", "Will be trashed");
		editInGit("restore-from-git", "title: Will be trashed", "title: Edited in git");
		await h.store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "git" });
		const after = await h.store.getEntry(entry.id);
		expect(after.status).toBe("published");
		expect(after.published?.metadata).toMatchObject({ title: "Edited in git" });
		expect(h.repo.files("main").has(pathOf("restore-from-git"))).toBe(true);
	});
});

describe("the first sync", () => {
	it("exports every published entry in one commit, leaves identical files alone and reports files it would overwrite", async () => {
		const first = await publishMemo("init-one", "Init one");
		await publishMemo("init-two", "Init two");
		const other = await publishMemo("init-three", "Init three");
		// A fresh setup: nothing is recorded, and the repo already has some of the files.
		for (const record of (await h.ctx.state.records.list("site")).values()) {
			await h.ctx.state.records.remove("site", record.entryId);
		}
		const mine = gitText("init-one");
		h.repo.commit("main", [{ path: pathOf("init-three"), text: "---\ntitle: Written by hand\n---\n\nhand text\n" }]);

		const result = await pushAll(h.ctx, h.target);
		expect(result.queued).toBeGreaterThanOrEqual(3);
		// The identical file was adopted, the different one is a conflict and kept as it is, the missing ones are written.
		expect(gitText("init-one")).toBe(mine);
		expect(gitText("init-three")).toContain("Written by hand");
		expect(await conflictOf(other.id)).toMatchObject({ reason: "unsynced" });
		expect(await h.ctx.state.records.get("site", first.id)).toMatchObject({ path: pathOf("init-one") });
	});

	it("is what `monti git-sync:push --all` runs, and it asks for --all", async () => {
		const { commands } = await import("../commands");
		const lines: string[] = [];
		const errors: string[] = [];
		const io = { cms: h.cms, log: (line: string) => lines.push(line), error: (line: string) => errors.push(line) };
		expect(await commands.push?.run({ ...io, args: {} })).toBe(1);
		expect(errors.join("\n")).toMatch(/needs --all/);
		await publishMemo("by-push-all", "By push all");
		expect(await commands.push?.run({ ...io, args: { all: true } })).toBe(0);
		expect(lines.join("\n")).toMatch(/site \(acme\/site@main\): \d+ published entries/);
	});
});
