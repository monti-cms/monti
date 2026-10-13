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
		new Request(`http://localhost/api/monti/v1/git-sync/${path}`, {
			method,
			headers: { "content-type": "application/json", ...headers },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);

describe("settings: the token and the webhook secret", () => {
	const keyNamed = async (name: string) => (await h.cms.apiKeys.list()).find((key) => key.name === name);

	it("keeps the token in the key store and the webhook secret encrypted in the plugin's storage, and never sends them back", async () => {
		const stored = await h.cms
			.storage("git-sync")
			.collection<{ tokenKeyId: string | null; webhookSecret: string }>("settings")
			.get("default");
		const key = await keyNamed("GitHub");
		expect(key).toBeDefined();
		expect(stored?.value.tokenKeyId).toBe(key?.id);
		expect(stored?.value.webhookSecret).toMatch(/^mk1:/);
		expect(JSON.stringify(stored)).not.toContain(TOKEN);
		expect(JSON.stringify(stored)).not.toContain(WEBHOOK_SECRET);
		expect(await h.cms.apiKeys.read(key?.id ?? "")).toBe(TOKEN);

		const response = await call("settings");
		const text = await response.text();
		expect(JSON.parse(text)).toEqual({
			secretsAvailable: true,
			token: { key: { id: key?.id, name: "GitHub", tail: "1234", readable: true } },
			webhookSecret: { set: true, readable: true },
			version: 1,
		});
		expect(text).not.toContain(TOKEN);
		expect(text).not.toContain(WEBHOOK_SECRET);
		const status = await (await call("status")).text();
		expect(status).not.toContain(TOKEN);
		// The key store lists where the token is used.
		expect((await keyNamed("GitHub"))?.uses).toEqual([expect.objectContaining({ plugin: "git-sync", slot: "token" })]);
	});

	it("saves a typed token as a new key, uses it for the next GitHub call, keeps what is not sent, and can unset the key", async () => {
		const saved = await call("settings", "PUT", {
			token: { use: "new", value: "ghp_new_value_9999" },
			expectedVersion: 1,
		});
		expect(saved.status).toBe(200);
		const body = await saved.json();
		expect(body).toMatchObject({
			token: { key: { name: "GitHub 2", tail: "9999" } },
			webhookSecret: { set: true },
			version: 2,
		});
		expect(JSON.stringify(body)).not.toContain("ghp_new_value_9999");
		expect(h.github.tokens).toEqual([]);

		// The new token is what the next GitHub call uses.
		await h.service.createDraft(
			{ collection: "memo", slug: "uses-token", metadata: { title: "x" }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);
		expect(h.github.tokens.at(-1)).toBe("ghp_new_value_9999");

		const kept = await call("settings", "PUT", { webhookSecret: null, expectedVersion: 2 });
		expect(await kept.json()).toMatchObject({
			token: { key: { name: "GitHub 2" } },
			webhookSecret: { set: false },
			version: 3,
		});

		const unset = await call("settings", "PUT", { token: { use: "none" }, expectedVersion: 3 });
		expect(await unset.json()).toMatchObject({ token: { key: null }, version: 4 });
		// The key itself stays in the store, with no place that uses it.
		expect((await keyNamed("GitHub 2"))?.uses).toEqual([]);
	});

	it("can pick a key of the store, and picks up a value that was replaced in the store", async () => {
		const other = await h.cms.apiKeys.add({ name: "Team token", value: "ghp_team_token_5555" });
		const picked = await call("settings", "PUT", { token: { use: "saved", keyId: other.id }, expectedVersion: 1 });
		expect(await picked.json()).toMatchObject({ token: { key: { id: other.id, name: "Team token" } } });
		expect((await keyNamed("Team token"))?.uses).toEqual([
			expect.objectContaining({ plugin: "git-sync", slot: "token" }),
		]);
		expect((await keyNamed("GitHub"))?.uses).toEqual([]);

		await h.cms.apiKeys.update(other.id, { expectedVersion: other.version, value: "ghp_rotated_token_7777" });
		await h.service.createDraft(
			{ collection: "memo", slug: "rotated", metadata: { title: "x" }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);
		expect(h.github.tokens.at(-1)).toBe("ghp_rotated_token_7777");
	});

	it("is back in the no-token state when the key is deleted", async () => {
		const key = await keyNamed("GitHub");
		await h.cms.apiKeys.remove(key?.id ?? "", { expectedVersion: key?.version ?? 0 });
		expect(await (await call("settings")).json()).toMatchObject({ token: { key: null } });
		await expect(h.ctx.client(h.target)).rejects.toMatchObject({ name: "GitSyncNotConfigured" });
		await h.service.createDraft(
			{ collection: "memo", slug: "after-delete", metadata: { title: "x" }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);
		// A setup state, not a failure: the entry waits in the queue and nothing reaches GitHub.
		expect(h.github.tokens).toEqual([]);
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0 });
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);
	});

	it("removes the key it made when the settings cannot be saved", async () => {
		const before = (await h.cms.apiKeys.list()).length;
		const stale = await call("settings", "PUT", {
			token: { use: "new", value: "ghp_never_saved_0000" },
			expectedVersion: 7,
		});
		expect(stale.status).toBe(409);
		expect(await h.cms.apiKeys.list()).toHaveLength(before);
	});

	it("refuses a save without a version, with a stale one, and with a token that is not a key choice", async () => {
		const choice = { use: "new", value: "x" };
		expect((await call("settings", "PUT", { token: choice })).status).toBe(428);
		expect((await call("settings", "PUT", { token: choice, expectedVersion: 7 })).status).toBe(409);
		expect((await call("settings", "PUT", { token: 5, expectedVersion: 1 })).status).toBe(400);
		expect((await call("settings", "PUT", { token: "ghp_plain_text", expectedVersion: 1 })).status).toBe(400);
		expect((await call("settings", "PUT", { token: { use: "saved", keyId: "nope" }, expectedVersion: 1 })).status).toBe(
			400,
		);
	});

	it("is not reachable from another site: the same-origin check applies to every change", async () => {
		expect(
			(
				await call(
					"settings",
					"PUT",
					{ token: { use: "none" }, expectedVersion: 1 },
					{ origin: "https://evil.example" },
				)
			).status,
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
				new Request("http://localhost/api/monti/v1/git-sync/flush", {
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
