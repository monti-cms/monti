import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFile } from "../front-matter";
import { pullTarget } from "../inbound";
import { closeGlobalPool, createHarness, type Harness } from "./harness";

let h: Harness;
beforeEach(async () => {
	h = await createHarness();
});
afterEach(async () => {
	await h.close();
});
afterAll(closeGlobalPool);

describe("languages and item collections", () => {
	it("writes each language to its own file, with the source named in the translation's front matter", async () => {
		const source = await h.service.createDraft(
			{
				collection: "post",
				slug: "two-languages",
				metadata: { title: "English title", summary: "s" },
				body: "English body",
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		const translation = await h.service.createTranslation({ sourceId: source.id, locale: "ko" });
		const saved = await h.service.saveDraft(
			translation.id,
			{
				collection: "post",
				slug: "two-languages",
				metadata: { title: "한국어 제목" },
				body: "한국어 본문",
				format: "mdx",
				expectedVersion: translation.version,
			},
			{ publishImmediately: false },
		);
		await h.service.publish({ id: translation.id, expectedVersion: saved.version });

		const files = h.repo.files("main");
		expect(files.has("content/post/two-languages.en.mdx")).toBe(true);
		const korean = parseFile(files.get("content/post/two-languages.ko.mdx") ?? "");
		expect(korean).toMatchObject({
			ok: true,
			data: {
				title: "한국어 제목",
				slug: "two-languages",
				monti: { id: translation.id, locale: "ko", translationOf: source.id },
			},
		});
		expect(korean.ok && korean.body.trim()).toBe("한국어 본문");

		// The translation's file imports back to the same content.
		const before = await h.store.getEntry(translation.id);
		const path = "content/post/two-languages.ko.mdx";
		h.repo.commit("main", [
			{ path, text: (files.get(path) ?? "").replace(/lastmod: .*/, "lastmod: 2020-01-01T00:00:00.000Z") },
		]);
		const summary = await pullTarget(h.ctx, h.target);
		expect(summary.errors).toEqual([]);
		const after = await h.store.getEntry(translation.id);
		expect(after.published?.contentHash).toBe(before.published?.contentHash);
		expect(after.locale).toBe("ko");
	});

	it("syncs an item collection, with the per-language names under translations", async () => {
		const tag = await h.service.createDraft(
			{
				collection: "tag",
				slug: "outbound-tag",
				metadata: { title: "Tag", translations: { ko: { title: "태그" } } },
				body: "",
				format: "mdx",
			},
			{ publishImmediately: true },
		);
		expect(parseFile(h.repo.files("main").get("content/tag/outbound-tag.en.mdx") ?? "")).toMatchObject({
			ok: true,
			data: { title: "Tag", translations: { ko: { title: "태그" } }, monti: { id: tag.id, collection: "tag" } },
		});
	});
});

describe("one flush or pull at a time per target", () => {
	const memo = (slug: string) =>
		h.service.createDraft(
			{ collection: "memo", slug, metadata: { title: slug }, body: "x", format: "mdx" },
			{ publishImmediately: true },
		);

	it("takes over a lock whose holder stopped", async () => {
		expect(await h.ctx.state.locks.tryAcquire("site", "crashed", 1, Date.now() - 10)).toBe(true);
		await memo("after-crash");
		expect(h.repo.files("main").has("content/memo/after-crash.en.mdx")).toBe(true);
		expect(await h.ctx.state.locks.get("site")).toBeNull();
	});

	it("waits for a lock that is held, then goes on", async () => {
		await h.ctx.state.locks.tryAcquire("site", "busy", 400, Date.now());
		const started = Date.now();
		await memo("after-wait");
		expect(Date.now() - started).toBeGreaterThanOrEqual(300);
		expect(h.repo.files("main").has("content/memo/after-wait.en.mdx")).toBe(true);
	});
});

describe("the secret", () => {
	it("cannot be saved when the server config has no secret, and says what to set", async () => {
		const bare = await createHarness({ noSecret: true });
		try {
			const response = await bare.cms.handle(
				new Request("http://localhost/api/cms/v1/git-sync/settings", {
					method: "PUT",
					headers: { origin: "http://localhost", "content-type": "application/json" },
					body: JSON.stringify({ token: "ghp_x", expectedVersion: 0 }),
				}),
			);
			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({
				code: "secret_not_configured",
				message: expect.stringContaining("MONTI_SECRET"),
			});
			const view = await (await bare.cms.handle(new Request("http://localhost/api/cms/v1/git-sync/settings"))).json();
			expect(view).toMatchObject({ secretsAvailable: false, token: { set: false } });
		} finally {
			await bare.close();
		}
	});
});
