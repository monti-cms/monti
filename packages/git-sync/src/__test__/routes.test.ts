import { composeFile } from "@monti-cms/core/front-matter";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeGlobalPool, createHarness, type Harness, TOKEN, WEBHOOK_SECRET } from "./harness";

let h: Harness;
beforeEach(async () => {
	h = await createHarness();
});
afterEach(async () => {
	await h.close();
});
afterAll(closeGlobalPool);

const call = (
	path: string,
	method = "GET",
	body?: unknown,
	headers: Record<string, string> = { origin: "http://localhost" },
) =>
	h.cms.handle(
		new Request(`http://localhost/api/cms/v1/git-sync/${path}`, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);

describe("settings: the token and the webhook secret", () => {
	it("stores them encrypted in the plugin's storage and never sends them back", async () => {
		const stored = await h.cms
			.storage("git-sync")
			.collection<{ token: string; webhookSecret: string }>("settings")
			.get("default");
		expect(stored?.value.token).toMatch(/^mk1:/);
		expect(JSON.stringify(stored)).not.toContain(TOKEN);
		expect(JSON.stringify(stored)).not.toContain(WEBHOOK_SECRET);

		const response = await call("settings");
		const text = await response.text();
		expect(JSON.parse(text)).toEqual({
			secretsAvailable: true,
			token: { set: true, hint: "…1234", readable: true },
			webhookSecret: { set: true, readable: true },
			version: 1,
		});
		expect(text).not.toContain(TOKEN);
		expect(text).not.toContain(WEBHOOK_SECRET);
		const status = await (await call("status")).text();
		expect(status).not.toContain(TOKEN);
	});

	it("saves a new token with the version that was read, keeps what is not sent, and can forget a value", async () => {
		const saved = await call("settings", "PUT", { token: "ghp_new_value_9999", expectedVersion: 1 });
		expect(saved.status).toBe(200);
		expect(await saved.json()).toMatchObject({
			token: { set: true, hint: "…9999" },
			webhookSecret: { set: true },
			version: 2,
		});
		expect(h.github.tokens).toEqual([]);

		// The new token is what the next GitHub call uses.
		await h.service.createDraft(
			{ collection: "memo", slug: "uses-token", metadata: { title: "x" }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);
		expect(h.github.tokens.at(-1)).toBe("ghp_new_value_9999");

		const forgotten = await call("settings", "PUT", { webhookSecret: null, expectedVersion: 2 });
		expect(await forgotten.json()).toMatchObject({ token: { set: true }, webhookSecret: { set: false }, version: 3 });
	});

	it("refuses a save without a version, with a stale one, and with a value that is not text", async () => {
		expect((await call("settings", "PUT", { token: "x" })).status).toBe(428);
		expect((await call("settings", "PUT", { token: "x", expectedVersion: 7 })).status).toBe(409);
		expect((await call("settings", "PUT", { token: 5, expectedVersion: 1 })).status).toBe(400);
	});

	it("is not reachable from another site: the same-origin check applies to every change", async () => {
		expect(
			(await call("settings", "PUT", { token: "x", expectedVersion: 1 }, { origin: "https://evil.example" })).status,
		).toBe(403);
		expect((await call("pull", "POST", {}, { origin: "https://evil.example" })).status).toBe(403);
		expect((await call("conflicts/resolve", "POST", {}, {})).status).toBe(403);
	});
});

describe("status, pull now and the queue", () => {
	it("lists each target with what was synced, queued and found", async () => {
		await h.service.createDraft(
			{ collection: "memo", slug: "listed", metadata: { title: "Listed" }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);
		const status = await (await call("status")).json();
		expect(status.targets).toEqual([
			expect.objectContaining({
				id: "site",
				repo: "acme/site",
				branch: "main",
				folder: "content",
				format: "mdx",
				path: "{collection}/{slug}.{locale}.{ext}",
				mode: "commit",
				synced: 1,
				queued: 0,
				conflicts: 0,
				lastFlush: expect.objectContaining({ files: 1, branch: "main" }),
			}),
		]);
	});

	it('"Pull now" imports what changed and reports it, per target or for all', async () => {
		h.repo.commit("main", [
			{
				path: "content/memo/pulled-now.en.mdx",
				text: composeFile({ title: "Pulled now", slug: "pulled-now" }, "text\n"),
			},
		]);
		const response = await call("pull", "POST", { target: "site" });
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ results: [{ target: "site", summary: { created: 1, errors: [] } }] });
		const status = await (await call("status")).json();
		expect(status.targets[0].lastPull).toMatchObject({ created: 1 });
		expect((await call("pull", "POST", {})).status).toBe(200);
	});

	it("answers a target that does not exist, and GitHub failing, with a message instead of a crash", async () => {
		const missing = await call("pull", "POST", { target: "nope" });
		expect(missing.status).toBe(409);
		expect(await missing.json()).toMatchObject({
			code: "git_sync",
			message: expect.stringContaining('no git-sync target "nope"'),
		});

		h.github.failNext("getBranchHead", { status: 503, message: "GitHub answered 503: down" });
		const down = await call("pull", "POST", { target: "site" });
		expect(down.status).toBe(502);
		expect(await down.json()).toMatchObject({ code: "github_error", message: expect.stringContaining("503") });
	});

	it('"Commit the queue now" sends what waits in the batch queue', async () => {
		const queued = await createHarness({ debounceMs: 60_000 });
		try {
			const publish = (slug: string) =>
				queued.service
					.createDraft(
						{ collection: "memo", slug, metadata: { title: slug }, body: "x", format: "mdx" },
						{ publishImmediately: true },
					)
					.then((result) => result.entry);
			await publish("sent-at-once");
			await publish("waits-in-queue");
			expect(queued.repo.files("main").has("content/memo/waits-in-queue.en.mdx")).toBe(false);
			const response = await queued.cms.handle(
				new Request("http://localhost/api/cms/v1/git-sync/flush", {
					method: "POST",
					headers: { origin: "http://localhost", "content-type": "application/json" },
					body: "{}",
				}),
			);
			expect(await response.json()).toMatchObject({ results: [{ written: 1 }] });
			expect(queued.repo.files("main").has("content/memo/waits-in-queue.en.mdx")).toBe(true);
		} finally {
			await queued.close();
		}
	});
});

describe("conflicts over the API", () => {
	it("lists a conflict with both texts and resolves it with the person's choice", async () => {
		const entry = (
			await h.service.createDraft(
				{ collection: "memo", slug: "api-conflict", metadata: { title: "Before" }, body: "text", format: "mdx" },
				{ publishImmediately: true },
			)
		).entry;
		const path = "content/memo/api-conflict.en.mdx";
		h.repo.commit("main", [
			{ path, text: (h.repo.files("main").get(path) ?? "").replace("title: Before", "title: In git") },
		]);
		const current = await h.store.getEntry(entry.id);
		await h.service.saveDraft(
			entry.id,
			{
				collection: "memo",
				slug: "api-conflict",
				metadata: { title: "On server" },
				body: "text",
				format: "mdx",
				expectedVersion: current.version,
			},
			{ publishImmediately: true },
		);

		const listed = await (await call("conflicts")).json();
		expect(listed.items).toHaveLength(1);
		const [item] = listed.items;
		expect(item).toMatchObject({
			entryId: entry.id,
			kind: "changed",
			reason: "both-changed",
			label: "On server",
			target: "site",
		});
		expect(item.serverText).toContain("title: On server");
		expect(item.gitText).toContain("title: In git");

		expect((await call("conflicts/resolve", "POST", { target: "site", entryId: entry.id })).status).toBe(400);
		expect(
			(
				await call("conflicts/resolve", "POST", {
					target: "site",
					entryId: entry.id,
					resolution: "git",
					gitSha: "0".repeat(40),
				})
			).status,
		).toBe(409);
		const resolved = await call("conflicts/resolve", "POST", {
			target: "site",
			entryId: entry.id,
			resolution: "server",
			gitSha: item.gitSha,
		});
		expect(resolved.status).toBe(200);
		expect(await resolved.json()).toMatchObject({ resolution: "server" });
		expect((await (await call("conflicts")).json()).items).toEqual([]);
		expect(h.repo.files("main").get(path)).toContain("title: On server");
		expect(
			(await call("conflicts/resolve", "POST", { target: "site", entryId: entry.id, resolution: "server" })).status,
		).toBe(404);
	});
});
