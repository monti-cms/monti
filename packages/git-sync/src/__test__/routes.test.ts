import { defineSite } from "@monti-cms/core";
import { composeFile } from "@monti-cms/core/front-matter";
import { fakeCms } from "@monti-cms/core/testing";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { baseConfig } from "../../test/cms.config";
import { gitSync } from "../index";
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

const slots = (body: unknown) =>
	h.cms.handle(
		new Request("http://localhost/api/monti/v1/api-keys/slots", {
			method: "PUT",
			headers: { "content-type": "application/json", origin: "http://localhost" },
			body: JSON.stringify(body),
		}),
	);
const assign = (key: unknown) => slots({ plugin: "git-sync", slot: "token", key });
const publishMemo = (slug: string) =>
	h.service.createDraft(
		{ collection: "memo", slug, metadata: { title: "x" }, body: "x", format: "mdx" },
		{ publishImmediately: true },
	);

describe("the GitHub token slot", () => {
	const keyNamed = async (name: string) => (await h.cms.apiKeys.list()).find((key) => key.name === name);
	const tokenSlot = async () => (await h.cms.apiKeys.slots()).find((slot) => slot.plugin === "git-sync");

	it("is declared by the plugin, with a label in the admin language", async () => {
		expect(await tokenSlot()).toMatchObject({ slot: "token", label: "GitHub token", key: expect.anything() });
		const bare = fakeCms({
			config: defineSite({ ...baseConfig, plugins: [] }),
			server: { secret: "a-long-test-secret" },
		});
		expect((await bare.apiKeys.slots()).filter((slot) => slot.plugin === "git-sync")).toEqual([]);
	});

	it("is not asked for while the plugin is switched off (`enabled: false`)", () => {
		expect(gitSync({ enabled: false }).keySlots).toBeUndefined();
		expect((gitSync({}).keySlots ?? []).map((slot) => slot.id)).toEqual(["token", "webhook-secret"]);
	});

	it("is a key of the store, never in the plugin's storage, and the status never sends the token or the webhook secret back", async () => {
		const key = await keyNamed("GitHub");
		const secretKey = await keyNamed("GitHub webhook");
		expect(key).toBeDefined();
		expect(secretKey).toBeDefined();
		// The plugin keeps no settings of its own: both secrets are keys of the store.
		expect(await h.cms.storage("git-sync").collection("settings").list()).toEqual([]);
		expect(await h.cms.apiKeys.slot("git-sync", "token").read()).toBe(TOKEN);
		expect(await h.cms.apiKeys.slot("git-sync", "webhook-secret").read()).toBe(WEBHOOK_SECRET);

		const text = await (await call("status")).text();
		expect(JSON.parse(text).keys).toEqual({
			secretsAvailable: true,
			token: { id: key?.id, name: "GitHub", tail: "1234", readable: true },
			webhookSecret: { id: secretKey?.id, name: "GitHub webhook", tail: "", readable: true },
		});
		expect(text).not.toContain(TOKEN);
		expect(text).not.toContain(WEBHOOK_SECRET);
		expect((await keyNamed("GitHub"))?.slots).toHaveLength(1);
	});

	it("uses a typed key assigned through the slots route for the next GitHub call, and picks up a replaced value", async () => {
		expect((await assign({ use: "new", value: "ghp_new_value_9999" })).status).toBe(200);
		expect((await (await call("status")).json()).keys).toMatchObject({ token: { name: "GitHub 2", tail: "9999" } });
		expect(h.github.tokens).toEqual([]);
		await publishMemo("uses-token");
		expect(h.github.tokens.at(-1)).toBe("ghp_new_value_9999");

		const key = await keyNamed("GitHub 2");
		await h.cms.apiKeys.update(key?.id ?? "", { expectedVersion: key?.version ?? 0, value: "ghp_rotated_token_7777" });
		await publishMemo("rotated");
		expect(h.github.tokens.at(-1)).toBe("ghp_rotated_token_7777");
	});

	it("is back in the no-token state when the slot is cleared, and the key itself stays", async () => {
		expect((await assign({ use: "none" })).status).toBe(200);
		expect((await (await call("status")).json()).keys).toMatchObject({ token: null });
		await expect(h.ctx.client(h.target)).rejects.toMatchObject({ name: "GitSyncNotConfigured" });
		await publishMemo("after-clear");
		// A setup state, not a failure: the entry waits in the queue and nothing reaches GitHub.
		expect(h.github.tokens).toEqual([]);
		expect(await h.cms.events.counts()).toMatchObject({ failed: 0, dead: 0 });
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);
		expect((await keyNamed("GitHub"))?.slots).toEqual([]);
	});

	it("is back in the no-token state when the key is deleted", async () => {
		const key = await keyNamed("GitHub");
		await h.cms.apiKeys.remove(key?.id ?? "", { expectedVersion: key?.version ?? 0, force: true });
		expect((await (await call("status")).json()).keys).toMatchObject({ token: null });
		await expect(h.ctx.client(h.target)).rejects.toMatchObject({ name: "GitSyncNotConfigured" });
		await publishMemo("after-delete");
		expect(h.github.tokens).toEqual([]);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);
	});

	it("sends what waited as soon as a token is assigned (the slot's onChange), and does nothing while there is none", async () => {
		await assign({ use: "none" });
		await publishMemo("waiting");
		expect(await h.ctx.state.queue.list("site")).toHaveLength(1);
		await assign({ use: "new", value: "ghp_late_token_0000" });
		expect(h.repo.files("main").has("content/memo/waiting.en.mdx")).toBe(true);
		expect(await h.ctx.state.queue.list("site")).toHaveLength(0);
	});
});

describe("the webhook secret slot", () => {
	const assignSecret = (key: unknown) => slots({ plugin: "git-sync", slot: "webhook-secret", key });

	it("is a key assigned to its own slot, named after the service, and is forgotten when the slot is cleared", async () => {
		expect((await assignSecret({ use: "new", value: "another-secret-123456" })).status).toBe(200);
		expect((await (await call("status")).json()).keys.webhookSecret).toMatchObject({
			name: "GitHub webhook 2",
			tail: "3456",
		});
		expect((await assignSecret({ use: "none" })).status).toBe(200);
		expect((await (await call("status")).json()).keys.webhookSecret).toBeNull();
		expect(await h.cms.apiKeys.slot("git-sync", "webhook-secret").read()).toBeNull();
	});

	it("is not reachable from another site: the same-origin check applies to every change", async () => {
		const evil = { origin: "https://evil.example" };
		const change = await h.cms.handle(
			new Request("http://localhost/api/monti/v1/api-keys/slots", {
				method: "PUT",
				headers: { "content-type": "application/json", ...evil },
				body: JSON.stringify({ plugin: "git-sync", slot: "webhook-secret", key: { use: "none" } }),
			}),
		);
		expect(change.status).toBe(403);
		expect((await call("pull", "POST", {}, evil)).status).toBe(403);
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
			error: {
				code: "precondition_failed",
				message: expect.stringContaining('no git-sync target "nope"'),
			},
		});

		h.github.failNext("getBranchHead", { status: 503, message: "GitHub answered 503: down" });
		const down = await call("pull", "POST", { target: "site" });
		expect(down.status).toBe(502);
		expect(await down.json()).toMatchObject({
			// The person reads the text of the code; GitHub's words are the detail.
			error: { code: "upstream_failed", detail: expect.stringContaining("503") },
		});
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
