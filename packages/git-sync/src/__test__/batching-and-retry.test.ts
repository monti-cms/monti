import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { flushTarget } from "../outbound";
import { closeGlobalPool, createHarness, DEFAULT_TARGET, type Harness } from "./harness";

const harnesses: Harness[] = [];
const make = async (options: Parameters<typeof createHarness>[0] = {}) => {
	const h = await createHarness(options);
	harnesses.push(h);
	return h;
};
afterEach(async () => {
	await Promise.all(harnesses.splice(0).map((h) => h.close()));
});
afterAll(closeGlobalPool);

const publish = (h: Harness, slug: string, title = slug) =>
	h.service.createDraft(
		{ collection: "memo", slug, metadata: { title }, body: `Body ${slug}`, format: "mdx" },
		{ publishImmediately: true },
	);

const commits = (h: Harness) => h.github.calls.filter((call) => call === "createCommit").length;

describe("publishes that arrive close together are one commit", () => {
	it("commits the first publish at once and batches the ones that follow inside the window", async () => {
		const h = await make({ debounceMs: 60_000 });
		await publish(h, "first");
		expect(h.repo.files("main").has("content/memo/first.en.mdx")).toBe(true);
		expect(commits(h)).toBe(1);

		await publish(h, "second");
		await publish(h, "third");
		// Inside the window: queued in the plugin's storage, not committed.
		expect(h.repo.files("main").has("content/memo/second.en.mdx")).toBe(false);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(2);
		expect(commits(h)).toBe(1);
		// Waiting for the batch is not a failure: nothing is listed as failed, nothing counts toward the badge or dead-lettering.
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0, pending: 2 });
		expect((await h.cms.events.list()).items).toEqual([]);
		expect(h.errors).not.toHaveBeenCalled();

		// The window ends (the last commit is now older than the window): the outbox retries the two deliveries. The first takes both entries in one
		// commit, the second finds nothing left to do.
		await h.ctx.state.status.patch("site", { lastFlushAt: Date.now() - 61_000 });
		const result = await h.cms.events.retry({ all: true });
		expect(result.failed).toBe(0);
		expect(h.repo.files("main").has("content/memo/second.en.mdx")).toBe(true);
		expect(h.repo.files("main").has("content/memo/third.en.mdx")).toBe(true);
		expect(commits(h)).toBe(2);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(0);
		expect((await h.cms.events.counts()).failed).toBe(0);
	});

	it("flushes the batch by itself when the window ends in a process that keeps running", async () => {
		const h = await make({ debounceMs: 300 });
		await publish(h, "alpha");
		await publish(h, "beta");
		await publish(h, "gamma");
		await vi.waitFor(
			() => {
				expect(h.repo.files("main").has("content/memo/beta.en.mdx")).toBe(true);
				expect(h.repo.files("main").has("content/memo/gamma.en.mdx")).toBe(true);
			},
			{ timeout: 5000 },
		);
		expect(commits(h)).toBeLessThan(3);
	});

	it("commits publishes handled at the same moment together", async () => {
		const h = await make({ debounceMs: 0 });
		const [a, b] = await Promise.all([publish(h, "one"), publish(h, "two")]);
		expect(a.id).not.toBe(b.id);
		expect(h.repo.files("main").has("content/memo/one.en.mdx")).toBe(true);
		expect(h.repo.files("main").has("content/memo/two.en.mdx")).toBe(true);
		// Fewer commits than publishes when the queue held both when the first flush read it.
		expect(commits(h)).toBeLessThanOrEqual(2);
	});

	it("batches many entries pushed in one go (the first sync) into one commit", async () => {
		const h = await make({ debounceMs: 60_000 });
		for (const slug of ["a", "b", "c", "d"]) await publish(h, slug);
		h.github.calls.length = 0;
		const result = await flushTarget(h.ctx, h.target);
		expect(result.written).toBe(3);
		expect(commits(h)).toBe(1);
		for (const slug of ["a", "b", "c", "d"]) expect(h.repo.files("main").has(`content/memo/${slug}.en.mdx`)).toBe(true);
	});
});

describe("a failed push is retried through the outbox, not lost", () => {
	it("keeps the entry queued, records the failure, and delivers it on the retry", async () => {
		const h = await make();
		h.github.failNext("createCommit", { status: 502 });
		const entry = await publish(h, "flaky");
		// The write stands, the file is not in git yet, and the failure is recorded for the outbox.
		expect(h.repo.files("main").has("content/memo/flaky.en.mdx")).toBe(false);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);
		const failed = await h.cms.events.list();
		expect(failed.items.find((item) => item.change.entryId === entry.id)).toMatchObject({
			subscriber: "plugin:git-sync",
			state: "failed",
			lastError: expect.stringContaining("502"),
		});

		const result = await h.cms.events.retry({ all: true });
		expect(result.delivered).toBeGreaterThanOrEqual(1);
		expect(h.repo.files("main").has("content/memo/flaky.en.mdx")).toBe(true);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(0);
		expect((await h.cms.events.counts()).failed).toBe(0);
	});

	it("dead-letters a delivery that keeps failing and keeps the entry in the queue for a later flush", async () => {
		const h = await make({ maxAttempts: 2 });
		h.github.failNext("getBranchHead", { status: 503, times: 50 });
		await publish(h, "never");
		await h.cms.events.retry({ all: true });
		expect((await h.cms.events.counts()).dead).toBe(1);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);

		// GitHub is back: the admin's "Commit the queue now" (or the next publish) sends it.
		h.github.failNext("getBranchHead", { times: 0 });
		await flushTarget(h.ctx, h.target);
		expect(h.repo.files("main").has("content/memo/never.en.mdx")).toBe(true);
	});

	it("waits for a token instead of failing: deferred for an hour, queued, never dead, and saving the token sends it", async () => {
		const h = await make({ noSettings: true, maxAttempts: 2 });
		const entry = await publish(h, "no-token");
		await publish(h, "no-token-2");
		// A setup state, not a failure: nothing listed as failed or dead, nothing logged, the entries wait in the queue.
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0, pending: 2 });
		expect((await h.cms.events.list()).items).toEqual([]);
		expect(h.errors).not.toHaveBeenCalled();
		expect(await h.ctx.state.queue.list("site")).toHaveLength(2);
		expect(h.github.tokens).toEqual([]);
		const pending = await h.cms.events.list({ states: ["pending"] });
		const due = pending.items.find((item) => item.change.entryId === entry.id)?.nextAttemptAt;
		expect((due?.getTime() ?? 0) - Date.now()).toBeGreaterThan(55 * 60_000);
		// Retrying without a token defers again, however often (more than maxAttempts).
		for (let round = 0; round < 3; round += 1) await h.cms.events.retry({ all: true });
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0 });

		// Saving the token (the Settings tab) sends what waited, and delivers the deferred events.
		const saved = await h.cms.handle(
			new Request("http://localhost/api/cms/v1/git-sync/settings", {
				method: "PUT",
				headers: { origin: "http://localhost", "content-type": "application/json" },
				body: JSON.stringify({ token: "ghp_late_token", expectedVersion: 0 }),
			}),
		);
		expect(saved.status).toBe(200);
		expect(h.repo.files("main").has("content/memo/no-token.en.mdx")).toBe(true);
		expect(h.repo.files("main").has("content/memo/no-token-2.en.mdx")).toBe(true);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(0);
		expect(await h.cms.events.counts()).toMatchObject({ pending: 0, failed: 0, dead: 0 });
	});

	it("still fails and retries a real error while a token exists (401, 404, network)", async () => {
		const h = await make();
		h.github.failNext("getBranchHead", { status: 401, message: "GitHub answered 401: Bad credentials" });
		await publish(h, "bad-credentials");
		expect((await h.cms.events.list()).items[0]).toMatchObject({
			state: "failed",
			lastError: expect.stringContaining("401"),
		});
	});

	it("does not let a failing entry hold the others back", async () => {
		const h = await make({ debounceMs: 60_000 });
		await publish(h, "seed");
		const bad = await publish(h, "bad");
		await publish(h, "good");
		// Making one entry unreadable must not stop the other from going out.
		const real = h.cms.store();
		const patched = new Proxy(real, {
			get: (target, name) =>
				name === "getEntry"
					? async (id: string) => {
							if (id === bad.id) throw new Error("export broke");
							return target.getEntry(id);
						}
					: Reflect.get(target, name),
		});
		(h.cms as { store: () => unknown }).store = () => patched;
		await expect(flushTarget(h.ctx, h.target)).rejects.toThrow(/1 queued entry could not be synced/);
		(h.cms as { store: () => unknown }).store = () => real;
		expect(h.repo.files("main").has("content/memo/good.en.mdx")).toBe(true);
		expect(h.repo.files("main").has("content/memo/bad.en.mdx")).toBe(false);
		expect((await h.ctx.state.queue.list("site")).map(({ item }) => item.entryId)).toEqual([bad.id]);
	});
});

describe("pull request mode", () => {
	const prTarget = { ...DEFAULT_TARGET, mode: "pr" as const };

	it("commits to the pull request branch, opens a pull request and turns on auto-merge", async () => {
		const h = await make({ targets: [prTarget] });
		const mainBefore = h.repo.branches.get("main");
		await publish(h, "via-pr");
		// The base branch is untouched; the file is on the pull request branch.
		expect(h.repo.branches.get("main")).toBe(mainBefore);
		expect(h.repo.files("monti/publish").has("content/memo/via-pr.en.mdx")).toBe(true);
		expect(h.repo.pullRequests).toHaveLength(1);
		expect(h.repo.pullRequests[0]).toMatchObject({
			head: "monti/publish",
			base: "main",
			state: "open",
			autoMerge: true,
		});
		expect(h.repo.pullRequests[0]?.title).toContain("via-pr");
		const status = await h.ctx.state.status.get("site");
		expect(status.lastFlush).toMatchObject({
			branch: "monti/publish",
			pullRequestUrl: "https://github.com/acme/site/pull/1",
		});
	});

	it("adds to the open pull request instead of opening another, and starts again from the base after a merge", async () => {
		const h = await make({ targets: [prTarget] });
		await publish(h, "pr-one");
		await publish(h, "pr-two");
		expect(h.repo.pullRequests).toHaveLength(1);
		expect(h.repo.files("monti/publish").has("content/memo/pr-one.en.mdx")).toBe(true);
		expect(h.repo.files("monti/publish").has("content/memo/pr-two.en.mdx")).toBe(true);

		h.repo.merge(1);
		expect(h.repo.files("main").has("content/memo/pr-one.en.mdx")).toBe(true);
		expect(h.repo.files("main").has("content/memo/pr-two.en.mdx")).toBe(true);

		// The next publish opens a new pull request from a branch reset onto the merged base.
		await publish(h, "pr-three");
		expect(h.repo.pullRequests).toHaveLength(2);
		expect(h.repo.pullRequests[1]).toMatchObject({ number: 2, state: "open" });
		expect(h.repo.files("monti/publish").has("content/memo/pr-three.en.mdx")).toBe(true);
	});

	it("says so when the repo does not allow auto-merge, and still opens the pull request", async () => {
		const h = await make({ targets: [prTarget] });
		h.repo.allowAutoMerge = false;
		await publish(h, "manual-merge");
		expect(h.repo.pullRequests[0]?.autoMerge).toBe(false);
		expect((await h.ctx.state.status.get("site")).lastFlush?.note).toMatch(/Auto-merge is off/);
	});

	it("keeps the pull request when auto-merge cannot be enabled", async () => {
		const h = await make({ targets: [prTarget] });
		h.repo.autoMergeError = "Pull request is in clean status";
		await publish(h, "clean-status");
		expect(h.repo.pullRequests).toHaveLength(1);
		expect((await h.ctx.state.status.get("site")).lastFlush?.note).toMatch(/could not be enabled: .*clean status/);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(0);
	});

	it("opens a new pull request for a version whose pull request was closed without merging", async () => {
		const h = await make({ targets: [prTarget] });
		const entry = await publish(h, "closed-pr", "First");
		h.repo.merge(1);
		const saved = await h.service.saveDraft(
			entry.id,
			{
				collection: "memo",
				slug: "closed-pr",
				metadata: { title: "Second" },
				body: "second",
				format: "mdx",
				expectedVersion: entry.version,
			},
			{ publishImmediately: false },
		);
		await h.service.publish({ id: entry.id, expectedVersion: saved.version });
		expect(h.repo.pullRequests).toHaveLength(2);
		h.repo.close(2);
		expect(h.repo.files("main").get("content/memo/closed-pr.en.mdx")).toContain("First");

		// Nothing is on its way any more: the next flush of the entry (here a retry of its event) puts the version in a new pull request.
		await h.ctx.state.queue.put({ target: "site", entryId: entry.id, queuedAt: Date.now() });
		await flushTarget(h.ctx, h.target);
		expect(h.repo.pullRequests).toHaveLength(3);
		expect(h.repo.pullRequests[2]).toMatchObject({ state: "open" });
		expect(h.repo.files("monti/publish").get("content/memo/closed-pr.en.mdx")).toContain("Second");
	});

	it("does not take a file that still has the old text on the base branch for an edit in git", async () => {
		const h = await make({ targets: [prTarget] });
		const entry = await publish(h, "pending", "Pending");
		const saved = await h.service.saveDraft(
			entry.id,
			{
				collection: "memo",
				slug: "pending",
				metadata: { title: "Pending 2" },
				body: "second",
				format: "mdx",
				expectedVersion: entry.version,
			},
			{ publishImmediately: false },
		);
		await h.service.publish({ id: entry.id, expectedVersion: saved.version });
		// Nothing conflicted although the base branch never had the file.
		expect(await h.ctx.state.conflicts.list("site")).toEqual([]);
		expect(h.repo.files("monti/publish").get("content/memo/pending.en.mdx")).toContain("Pending 2");
	});
});
