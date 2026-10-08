import { parseFile } from "@monti-cms/core/front-matter";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { listConflicts, resolveConflict } from "../conflicts";
import { blobSha } from "../github/blob-sha";
import { pullTarget } from "../inbound";
import { type FakePullRequest, pullRequestPayload, pushPayload, webhookSignature } from "../testing";
import { closeGlobalPool, createHarness, DRAFT_TARGET, type Harness, WEBHOOK_SECRET } from "./harness";

const harnesses: Harness[] = [];
const make = async (options: Parameters<typeof createHarness>[0] = {}) => {
	const h = await createHarness({ targets: [DRAFT_TARGET], ...options });
	harnesses.push(h);
	return h;
};
afterEach(async () => {
	await Promise.all(harnesses.splice(0).map((h) => h.close()));
});
afterAll(closeGlobalPool);

const WEBHOOK = "http://localhost/api/cms/v1/git-sync/webhook";

const hook = (h: Harness, event: string, body: string, headers: Record<string, string> = {}) =>
	h.cms.handle(
		new Request(WEBHOOK, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-github-event": event,
				"x-hub-signature-256": webhookSignature(WEBHOOK_SECRET, body),
				...headers,
			},
			body,
		}),
	);

/** What the `pull_request` payload says about a pull request. */
const ref = (pr: FakePullRequest | undefined, merged = false) => ({
	number: pr?.number ?? 0,
	head: pr?.head ?? "",
	base: pr?.base ?? "",
	merged,
});

const pathOf = (slug: string) => `content/memo/${slug}.en.mdx`;
const branchOf = (slug: string) => `monti/draft/${slug}`;

/** A new draft (never published). */
const draft = (h: Harness, slug: string, title = slug, body = `Body of ${title}`) =>
	h.service
		.createDraft({ collection: "memo", slug, metadata: { title }, body, format: "mdx" })
		.then((result) => result.entry);

/** A new published entry. */
const published = (h: Harness, slug: string, title = slug, body = `Body of ${title}`) =>
	h.service
		.createDraft({ collection: "memo", slug, metadata: { title }, body, format: "mdx" }, { publishImmediately: true })
		.then((result) => result.entry);

/** Saves the draft of an entry (the entry as it is now, so the version is the current one). */
const save = async (h: Harness, id: string, fields: { slug: string; title?: string; body: string }) => {
	const current = await h.store.getEntry(id);
	return h.service
		.saveDraft(
			id,
			{
				collection: "memo",
				slug: fields.slug,
				metadata: { title: fields.title ?? fields.slug },
				body: fields.body,
				format: "mdx",
				expectedVersion: current.version,
			},
			{ publishImmediately: false },
		)
		.then((result) => result.entry);
};

const publish = async (h: Harness, id: string) => {
	const current = await h.store.getEntry(id);
	return h.service.publish({ id, expectedVersion: current.version }).then((result) => result.entry);
};

const call = (h: Harness, name: string) => h.github.calls.filter((item) => item === name).length;

const bodyOf = (text: string | undefined) => {
	const parsed = parseFile(text ?? "");
	return parsed.ok ? parsed.body.trim() : null;
};

describe("drafts are off unless the target asks", () => {
	it("creates no branch and no pull request for a draft", async () => {
		const h = await make({ targets: [{ ...DRAFT_TARGET, drafts: false }] });
		await draft(h, "quiet");
		expect([...h.repo.branches.keys()]).toEqual(["main"]);
		expect(h.repo.pullRequests).toEqual([]);
		expect(h.github.calls).toEqual([]);
	});
});

describe("saving a draft", () => {
	it("creates the branch from the target branch with the draft file and opens a draft pull request that links back to the admin", async () => {
		const h = await make();
		const main = h.repo.branches.get("main") ?? "";
		const entry = await draft(h, "first-draft", "First draft", "hello");

		const branch = branchOf("first-draft");
		expect(h.repo.branches.has(branch)).toBe(true);
		// Created from the head of the target branch, which did not move.
		expect(h.repo.branches.get("main")).toBe(main);
		expect(h.repo.isAncestor(main, h.repo.branches.get(branch) ?? "")).toBe(true);
		const text = h.repo.files(branch).get(pathOf("first-draft"));
		expect(text).toContain("First draft");
		expect(bodyOf(text)).toBe("hello");
		expect(h.repo.files("main").has(pathOf("first-draft"))).toBe(false);

		expect(h.repo.pullRequests).toHaveLength(1);
		const [pr] = h.repo.pullRequests;
		expect(pr).toMatchObject({ head: branch, base: "main", title: "Draft: First draft", state: "open" });
		expect(pr?.body).toContain(`/entries/${entry.id}/edit`);
		expect(pr?.body).toContain("Merging this pull request publishes the entry");

		const record = await h.ctx.state.drafts.get("site", entry.id);
		expect(record).toMatchObject({ branch, path: pathOf("first-draft"), prNumber: 1, slug: "first-draft" });
		expect(record?.blobSha).toBe(blobSha(text ?? ""));
	});

	it("adds a commit to the same branch and updates the pull request instead of opening another", async () => {
		const h = await make();
		const entry = await draft(h, "again", "Again", "one");
		const first = h.repo.branches.get(branchOf("again")) ?? "";
		await save(h, entry.id, { slug: "again", title: "Again, retitled", body: "two" });

		expect(h.repo.pullRequests).toHaveLength(1);
		expect(h.repo.pullRequests[0]).toMatchObject({ title: "Draft: Again, retitled", state: "open" });
		const now = h.repo.branches.get(branchOf("again")) ?? "";
		expect(now).not.toBe(first);
		expect(h.repo.isAncestor(first, now)).toBe(true);
		expect(bodyOf(h.repo.files(branchOf("again")).get(pathOf("again")))).toBe("two");
		expect(call(h, "createPullRequest")).toBe(1);
	});

	it("proposes the changes of a published entry's draft against its published file", async () => {
		const h = await make();
		const entry = await published(h, "live", "Live", "published text");
		expect(h.repo.pullRequests).toEqual([]);
		await save(h, entry.id, { slug: "live", title: "Live", body: "unpublished text" });

		expect(bodyOf(h.repo.files("main").get(pathOf("live")))).toBe("published text");
		expect(bodyOf(h.repo.files(branchOf("live")).get(pathOf("live")))).toBe("unpublished text");
		expect(h.repo.pullRequests).toHaveLength(1);
	});

	it("keeps the branch name valid and apart when two drafts have the same address", async () => {
		const h = await make();
		const memo = await draft(h, "same", "A memo");
		const post = (
			await h.service.createDraft({
				collection: "post",
				slug: "same",
				metadata: { title: "A post" },
				body: "x",
				format: "mdx",
			})
		).entry;
		expect(h.repo.branches.has(branchOf("same"))).toBe(true);
		expect(h.repo.branches.has(`${branchOf("same")}-${post.id.slice(0, 8)}`)).toBe(true);
		expect(memo.id).not.toBe(post.id);
		expect(h.repo.pullRequests).toHaveLength(2);
	});
});

describe("saves are debounced per entry", () => {
	it("waits until the entry has been quiet, then writes one commit with the latest draft", async () => {
		const h = await make({ draftDebounceMs: 60_000 });
		const entry = await draft(h, "typing", "Typing", "a");
		await save(h, entry.id, { slug: "typing", body: "ab" });
		await save(h, entry.id, { slug: "typing", body: "abc" });

		// Inside the window nothing reaches the repo, and waiting is not a failure.
		expect(h.repo.branches.has(branchOf("typing"))).toBe(false);
		expect(call(h, "createCommit")).toBe(0);
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0 });
		expect((await h.cms.events.list()).items).toEqual([]);
		expect(h.errors).not.toHaveBeenCalled();

		// The quiet period ends: the outbox calls again, the older events (overtaken by the newest) have nothing to do, and the newest writes the branch once.
		Object.assign(h.ctx, { now: () => Date.now() + 61_000 });
		const result = await h.cms.events.retry({ all: true });
		expect(result.failed).toBe(0);
		expect(call(h, "createCommit")).toBe(1);
		expect(bodyOf(h.repo.files(branchOf("typing")).get(pathOf("typing")))).toBe("abc");
		expect(h.repo.pullRequests).toHaveLength(1);
	});

	it("writes the branch by itself when the quiet period ends in a process that keeps running", async () => {
		// Only the timer is fake, so how fast the database answers cannot change which saves are inside the quiet period.
		const h = await make({ draftDebounceMs: 60_000 });
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		try {
			const entry = await draft(h, "burst", "Burst", "1");
			await save(h, entry.id, { slug: "burst", body: "2" });
			await save(h, entry.id, { slug: "burst", body: "3" });
			expect(call(h, "createCommit")).toBe(0);
			await vi.advanceTimersByTimeAsync(61_000);
		} finally {
			vi.useRealTimers();
		}
		await vi.waitFor(() => expect(bodyOf(h.repo.files(branchOf("burst")).get(pathOf("burst")))).toBe("3"), {
			timeout: 10_000,
		});
		expect(call(h, "createCommit")).toBe(1);
	});
});

describe("publishing in the CMS merges the draft pull request", () => {
	it("squash-merges it instead of making a separate commit, and removes the branch", async () => {
		const h = await make();
		const entry = await draft(h, "ship-it", "Ship it", "v1");
		await save(h, entry.id, { slug: "ship-it", title: "Ship it", body: "v2" });
		await publish(h, entry.id);

		const [pr] = h.repo.pullRequests;
		expect(pr?.state).toBe("merged");
		expect(h.repo.pullRequests).toHaveLength(1);
		expect(h.repo.branches.has(branchOf("ship-it"))).toBe(false);
		expect(bodyOf(h.repo.files("main").get(pathOf("ship-it")))).toBe("v2");
		// The target's branch moved by the merge only.
		const head = h.repo.commits.get(h.repo.branches.get("main") ?? "");
		expect(head?.message).toMatch(/^Merge #1/);

		const sync = await h.ctx.state.records.get("site", entry.id);
		expect(sync?.blobSha).toBe(blobSha(h.repo.files("main").get(pathOf("ship-it")) ?? ""));
		expect(sync?.baseSha).toBe(sync?.blobSha);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		// The merge is in sync with the CMS: a pull has nothing to apply and nothing to decide.
		const pulled = await pullTarget(h.ctx, h.target);
		expect(pulled).toMatchObject({ applied: 0, created: 0, conflicts: 0, errors: [] });
		expect(await h.ctx.state.conflicts.list("site")).toEqual([]);
	});

	it("publishes what the CMS published, not the older draft the debounce had not sent yet", async () => {
		const h = await make();
		const entry = await draft(h, "stale-branch", "Stale", "on the branch");
		Object.assign(h.ctx, { draftDebounceMs: 60_000 });
		await save(h, entry.id, { slug: "stale-branch", title: "Stale", body: "not on the branch yet" });
		expect(bodyOf(h.repo.files(branchOf("stale-branch")).get(pathOf("stale-branch")))).toBe("on the branch");
		await publish(h, entry.id);
		// The outbox keeps the order of an entry's events: the publish follows the deferred save, when its quiet period ends.
		expect(h.repo.pullRequests[0]?.state).toBe("open");

		Object.assign(h.ctx, { now: () => Date.now() + 61_000 });
		await h.cms.events.retry({ all: true });
		expect(h.repo.pullRequests[0]?.state).toBe("merged");
		expect(bodyOf(h.repo.files("main").get(pathOf("stale-branch")))).toBe("not on the branch yet");
		expect(h.repo.branches.has(branchOf("stale-branch"))).toBe(false);
	});

	it("commits as usual when the entry has no draft pull request", async () => {
		const h = await make({ draftDebounceMs: 60_000 });
		const entry = await draft(h, "no-pr-yet", "No PR", "quick");
		await publish(h, entry.id);
		Object.assign(h.ctx, { now: () => Date.now() + 61_000 });
		await h.cms.events.retry({ all: true });
		expect(h.repo.pullRequests).toEqual([]);
		expect(bodyOf(h.repo.files("main").get(pathOf("no-pr-yet")))).toBe("quick");
	});

	it("falls back to the target's mode when the merge is blocked: a commit to the branch, and the pull request is closed", async () => {
		const h = await make();
		const entry = await draft(h, "blocked", "Blocked", "text");
		h.repo.mergeBlocked = 'Required status check "ci" is expected.';
		await publish(h, entry.id);

		expect(h.repo.pullRequests[0]?.state).toBe("closed");
		expect(h.repo.branches.has(branchOf("blocked"))).toBe(false);
		expect(bodyOf(h.repo.files("main").get(pathOf("blocked")))).toBe("text");
		expect(h.repo.commits.get(h.repo.branches.get("main") ?? "")?.message).toMatch(/^Publish memo\/blocked/);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({ blobSha: expect.any(String) });
	});

	it("in pr mode leaves the pull request open with auto-merge on when the merge is blocked, and the merge completes the publish", async () => {
		const h = await make({ targets: [{ ...DRAFT_TARGET, mode: "pr" }] });
		const entry = await draft(h, "wait-for-ci", "Wait for CI", "published text");
		h.repo.mergeBlocked = "Required status check is expected.";
		await publish(h, entry.id);

		const [pr] = h.repo.pullRequests;
		expect(h.repo.pullRequests).toHaveLength(1);
		expect(pr).toMatchObject({ state: "open", autoMerge: true });
		expect(h.repo.files("main").has(pathOf("wait-for-ci"))).toBe(false);
		expect(h.repo.branches.has("monti/publish")).toBe(false);
		expect(bodyOf(h.repo.files(branchOf("wait-for-ci")).get(pathOf("wait-for-ci")))).toBe("published text");
		expect(await h.ctx.state.drafts.get("site", entry.id)).toMatchObject({ publishing: true });

		// Checks pass and GitHub merges: the entry is already published, so the merge only settles the records.
		h.repo.mergeBlocked = undefined;
		h.repo.merge(pr?.number ?? 0);
		const response = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr, true)));
		expect(response.status).toBe(200);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		const sync = await h.ctx.state.records.get("site", entry.id);
		expect(sync?.blobSha).toBe(blobSha(h.repo.files("main").get(pathOf("wait-for-ci")) ?? ""));
		expect(sync?.baseSha).toBe(sync?.blobSha);
		expect((await h.store.getEntry(entry.id)).status).toBe("published");
		expect(h.repo.branches.has(branchOf("wait-for-ci"))).toBe(false);
	});
});

describe("a push to a draft branch updates the draft", () => {
	it("saves the file on the branch as the entry's draft without publishing, and does not push it back", async () => {
		const h = await make();
		const entry = await draft(h, "edit-me", "Edit me", "v1");
		const branch = branchOf("edit-me");
		const text = h.repo.files(branch).get(pathOf("edit-me")) ?? "";
		const edit = h.repo.commit(
			branch,
			[{ path: pathOf("edit-me"), text: text.replace("Edit me", "Edited in git").replace("v1", "edited in git") }],
			"Edit on GitHub",
		);
		const before = (await h.store.getEntry(entry.id)).working.contentHash;

		const response = await hook(h, "push", pushPayload("acme/site", branch));
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ drafts: [{ branch, outcome: "applied" }] });

		const after = await h.store.getEntry(entry.id);
		expect(after.working.contentHash).not.toBe(before);
		expect(after.working.metadata).toMatchObject({ title: "Edited in git" });
		expect(after.status).toBe("draft");
		expect(after.published).toBeUndefined();
		// The save the import made did not come back as a commit.
		expect(h.repo.branches.get(branch)).toBe(edit);
		expect(h.repo.pullRequests).toHaveLength(1);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toMatchObject({
			blobSha: blobSha(h.repo.files(branch).get(pathOf("edit-me")) ?? ""),
			contentHash: after.working.contentHash,
		});

		// The push of the same file again (and the echo of our own pushes) changes nothing.
		expect(await (await hook(h, "push", pushPayload("acme/site", branch))).json()).toMatchObject({
			drafts: [{ outcome: "unchanged" }],
		});
	});

	it("ignores a draft branch no draft uses and a push to a repo with no target for drafts", async () => {
		const h = await make();
		const stranger = await hook(h, "push", pushPayload("acme/site", "monti/draft/nobody"));
		expect(await stranger.json()).toMatchObject({ drafts: [{ outcome: "ignored" }] });
		const other = await hook(h, "push", pushPayload("someone/else", "monti/draft/x"));
		expect(await other.json()).toMatchObject({ ignored: expect.stringContaining("no target with drafts") });
	});

	it("records a conflict when the draft changed on both sides since the last sync, and writes nothing", async () => {
		const h = await make();
		const entry = await draft(h, "both", "Both", "start");
		const branch = branchOf("both");
		const gitText = (h.repo.files(branch).get(pathOf("both")) ?? "").replace("start", "git side");
		h.repo.commit(branch, [{ path: pathOf("both"), text: gitText }]);
		// The server changed the draft too, inside the quiet period (the branch does not have it yet).
		Object.assign(h.ctx, { draftDebounceMs: 60_000 });
		const server = await save(h, entry.id, { slug: "both", title: "Both", body: "server side" });

		const response = await hook(h, "push", pushPayload("acme/site", branch));
		expect(await response.json()).toMatchObject({ drafts: [{ outcome: "conflict" }] });
		expect((await h.store.getEntry(entry.id)).working.contentHash).toBe(server.working.contentHash);
		const conflict = await h.ctx.state.conflicts.get("site", entry.id, "draft");
		expect(conflict).toMatchObject({ scope: "draft", reason: "both-changed", path: pathOf("both"), gitText });
		// The published-file conflicts are separate.
		expect(await h.ctx.state.conflicts.get("site", entry.id)).toBeNull();

		const [view] = await listConflicts(h.ctx);
		expect(view).toMatchObject({ scope: "draft", entryId: entry.id, gitText });
		expect(view?.serverText).toContain("server side");

		const resolved = await resolveConflict(h.ctx, {
			target: "site",
			entryId: entry.id,
			resolution: "git",
			gitSha: conflict?.gitSha,
			scope: "draft",
		});
		expect(resolved.resolution).toBe("git");
		expect((await h.store.getEntry(entry.id)).working.metadata).toMatchObject({ title: "Both" });
		expect(bodyOf((await h.ctx.state.drafts.get("site", entry.id)) ? gitText : "")).toBe("git side");
		expect(await h.ctx.state.conflicts.get("site", entry.id, "draft")).toBeNull();
		// Still a draft: nothing was published by the decision.
		expect((await h.store.getEntry(entry.id)).published).toBeUndefined();
	});

	it('records a conflict when the server saves over an edit made on the branch, and "server version" overwrites the branch', async () => {
		const h = await make();
		const entry = await draft(h, "race", "Race", "start");
		const branch = branchOf("race");
		const edit = h.repo.commit(branch, [
			{
				path: pathOf("race"),
				text: (h.repo.files(branch).get(pathOf("race")) ?? "").replace("start", "git side"),
			},
		]);
		await save(h, entry.id, { slug: "race", title: "Race", body: "server side" });

		expect(await h.ctx.state.conflicts.get("site", entry.id, "draft")).toMatchObject({ scope: "draft" });
		// Nothing was overwritten.
		expect(h.repo.branches.get(branch)).toBe(edit);
		// While the decision waits, further saves do not touch the branch either.
		await save(h, entry.id, { slug: "race", title: "Race", body: "server side 2" });
		expect(h.repo.branches.get(branch)).toBe(edit);

		await resolveConflict(h.ctx, { target: "site", entryId: entry.id, resolution: "server", scope: "draft" });
		expect(bodyOf(h.repo.files(branch).get(pathOf("race")))).toBe("server side 2");
		expect(await h.ctx.state.conflicts.get("site", entry.id, "draft")).toBeNull();
	});
});

describe("a draft pull request merged on GitHub publishes the entry", () => {
	it("publishes with the merged file as the published version", async () => {
		const h = await make();
		const entry = await draft(h, "merge-me", "Merge me", "v1");
		const branch = branchOf("merge-me");
		// Edited on GitHub (a push the server has not seen), then merged.
		h.repo.commit(branch, [
			{
				path: pathOf("merge-me"),
				text: (h.repo.files(branch).get(pathOf("merge-me")) ?? "")
					.replace("v1", "final words")
					.replace("Merge me", "Merged"),
			},
		]);
		const [pr] = h.repo.pullRequests;
		h.repo.merge(pr?.number ?? 0);

		const response = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr, true)));
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ closed: [{ outcome: "published" }] });

		const after = await h.store.getEntry(entry.id);
		expect(after.status).toBe("published");
		expect(after.published?.metadata).toMatchObject({ title: "Merged" });
		expect(after.working.contentHash).toBe(after.published?.contentHash);
		const mergedText = h.repo.files("main").get(pathOf("merge-me")) ?? "";
		expect(bodyOf(mergedText)).toBe("final words");
		expect(await h.ctx.state.records.get("site", entry.id)).toMatchObject({ blobSha: blobSha(mergedText) });
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		expect(h.repo.branches.has(branch)).toBe(false);
		// Nothing was pushed back for the publish the merge caused.
		expect(h.repo.commits.get(h.repo.branches.get("main") ?? "")?.message).toMatch(/^Merge #1/);
		expect(call(h, "createCommit")).toBe(1);
	});

	it("is found by the push to the target's branch too, in either order", async () => {
		const h = await make();
		const entry = await draft(h, "either-order", "Either order", "v1");
		const [pr] = h.repo.pullRequests;
		h.repo.merge(pr?.number ?? 0);

		// The push to main arrives first.
		const pushed = await hook(h, "push", pushPayload("acme/site", "main"));
		expect(pushed.status).toBe(200);
		expect((await h.store.getEntry(entry.id)).status).toBe("published");
		expect(await h.ctx.state.conflicts.list("site")).toEqual([]);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		// Then the pull request event: nothing is left to do for it.
		const closed = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr, true)));
		expect(await closed.json()).toMatchObject({ closed: [{ outcome: "ignored" }] });
	});

	it("records a conflict instead of publishing when the draft also changed on the server since the last sync", async () => {
		const h = await make();
		const entry = await draft(h, "late-save", "Late save", "synced");
		Object.assign(h.ctx, { draftDebounceMs: 60_000 });
		const saved = await save(h, entry.id, { slug: "late-save", title: "Late save", body: "only on the server" });
		const [pr] = h.repo.pullRequests;
		h.repo.merge(pr?.number ?? 0);

		const response = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr, true)));
		expect(await response.json()).toMatchObject({ closed: [{ outcome: "conflict" }] });
		const after = await h.store.getEntry(entry.id);
		expect(after.status).toBe("draft");
		expect(after.working.contentHash).toBe(saved.working.contentHash);
		expect(await h.ctx.state.conflicts.get("site", entry.id)).toMatchObject({ reason: "both-changed" });
	});
});

describe("a draft pull request closed without merging", () => {
	it("leaves the draft as it is, and the next save opens a new pull request", async () => {
		const h = await make();
		const entry = await draft(h, "not-now", "Not now", "v1");
		const before = await h.store.getEntry(entry.id);
		const [pr] = h.repo.pullRequests;
		h.repo.close(pr?.number ?? 0);

		const response = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr, false)));
		expect(await response.json()).toMatchObject({ closed: [{ outcome: "closed" }] });
		const after = await h.store.getEntry(entry.id);
		expect(after.status).toBe("draft");
		expect(after.version).toBe(before.version);
		expect(after.working.contentHash).toBe(before.working.contentHash);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toMatchObject({ prClosed: true });
		expect(h.repo.files("main").has(pathOf("not-now"))).toBe(false);
		// Listed as open nowhere.
		expect(await (await import("../drafts")).listDraftPullRequests(h.ctx)).toEqual([]);

		await save(h, entry.id, { slug: "not-now", title: "Not now", body: "v2" });
		expect(h.repo.pullRequests).toHaveLength(2);
		expect(h.repo.pullRequests[1]).toMatchObject({ state: "open", head: branchOf("not-now") });
		expect(await h.ctx.state.drafts.get("site", entry.id)).toMatchObject({ prNumber: 2 });
		expect((await h.ctx.state.drafts.get("site", entry.id))?.prClosed).toBeUndefined();
	});

	it("only trusts a signed request", async () => {
		const h = await make();
		await draft(h, "signed", "Signed");
		const [pr] = h.repo.pullRequests;
		const body = pullRequestPayload("acme/site", ref(pr, true));
		h.github.calls.length = 0;
		const refused = await hook(h, "pull_request", body, { "x-hub-signature-256": "sha256=deadbeef" });
		expect(refused.status).toBe(401);
		expect(h.github.calls).toEqual([]);
		// Other pull requests and actions are not git-sync's business.
		const ignored = await hook(h, "pull_request", pullRequestPayload("acme/site", ref(pr), "opened"));
		expect(ignored.status).toBe(202);
		const notDraft = await hook(
			h,
			"pull_request",
			pullRequestPayload("acme/site", { number: 9, head: "feature/x", base: "main", merged: true }),
		);
		expect(await notDraft.json()).toMatchObject({ ignored: "not a draft pull request" });
	});
});

describe("discarding, trashing and deleting", () => {
	it("closes the pull request and deletes the branch when the draft goes back to the published version", async () => {
		const h = await make();
		const entry = await published(h, "discard-me", "Discard me", "published text");
		await save(h, entry.id, { slug: "discard-me", title: "Discard me", body: "unpublished text" });
		expect(h.repo.pullRequests[0]?.state).toBe("open");

		const reverted = await save(h, entry.id, { slug: "discard-me", title: "Discard me", body: "published text" });
		expect(reverted.working.contentHash).toBe(reverted.published?.contentHash);
		expect(h.repo.pullRequests[0]?.state).toBe("closed");
		expect(h.repo.branches.has(branchOf("discard-me"))).toBe(false);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toBeNull();
		// The published file is untouched.
		expect(bodyOf(h.repo.files("main").get(pathOf("discard-me")))).toBe("published text");
	});

	it("does the same when the entry is trashed or deleted", async () => {
		const h = await make();
		const trashed = await draft(h, "to-trash", "To trash");
		const deleted = await draft(h, "to-delete", "To delete");
		expect(h.repo.pullRequests.map((pr) => pr.state)).toEqual(["open", "open"]);

		await h.store.trashEntry({ id: trashed.id, expectedVersion: trashed.version });
		expect(h.repo.pullRequests[0]?.state).toBe("closed");
		expect(h.repo.branches.has(branchOf("to-trash"))).toBe(false);

		const gone = await h.store.trashEntry({ id: deleted.id, expectedVersion: deleted.version });
		await h.store.permanentDeleteEntry({ id: deleted.id, expectedVersion: gone.version });
		expect(h.repo.pullRequests[1]?.state).toBe("closed");
		expect(h.repo.branches.has(branchOf("to-delete"))).toBe(false);
		expect(await h.ctx.state.drafts.list("site")).toEqual(new Map());
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0 });
	});
});

describe("a new address for a draft", () => {
	it("opens a new branch and pull request and closes the old ones", async () => {
		const h = await make();
		const entry = await draft(h, "old-address", "Same title", "text");
		await save(h, entry.id, { slug: "new-address", title: "Same title", body: "text" });

		expect(h.repo.branches.has(branchOf("old-address"))).toBe(false);
		expect(h.repo.branches.has(branchOf("new-address"))).toBe(true);
		expect(h.repo.pullRequests.map((pr) => [pr.head, pr.state])).toEqual([
			[branchOf("old-address"), "closed"],
			[branchOf("new-address"), "open"],
		]);
		expect(h.repo.files(branchOf("new-address")).has(pathOf("new-address"))).toBe(true);
		expect(await h.ctx.state.drafts.get("site", entry.id)).toMatchObject({
			slug: "new-address",
			branch: branchOf("new-address"),
			prNumber: 2,
		});
	});
});

describe("the admin", () => {
	const call = (h: Harness, path: string) =>
		h.cms.handle(
			new Request(`http://localhost/api/cms/v1/git-sync/${path}`, { headers: { origin: "http://localhost" } }),
		);

	it("lists the open draft pull requests per target and for one entry", async () => {
		const h = await make();
		const one = await draft(h, "listed-one", "Listed one");
		await draft(h, "listed-two", "Listed two");

		const status = (await (await call(h, "status")).json()) as {
			targets: { drafts: boolean; draftPullRequests: { entryId: string; url: string; number: number }[] }[];
		};
		expect(status.targets[0]?.drafts).toBe(true);
		expect(status.targets[0]?.draftPullRequests.map((item) => item.number).sort()).toEqual([1, 2]);
		expect(status.targets[0]?.draftPullRequests[0]?.url).toContain("https://github.com/acme/site/pull/");

		const mine = (await (await call(h, `drafts?entryId=${one.id}`)).json()) as {
			items: { entryId: string; url: string }[];
		};
		expect(mine.items).toHaveLength(1);
		expect(mine.items[0]).toMatchObject({ entryId: one.id, url: "https://github.com/acme/site/pull/1" });
		const none = (await (await call(h, "drafts?entryId=missing")).json()) as { items: unknown[] };
		expect(none.items).toEqual([]);
	});
});
